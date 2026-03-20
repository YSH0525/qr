import { NextRequest, NextResponse } from "next/server";
import { firestore } from "@/lib/firebase";
import {
  collection,
  getDocs,
  addDoc,
  doc,
  getDoc,
  query,
  where,
  runTransaction,
} from "firebase/firestore";
import { orderSchema } from "@/lib/validations";
import { getNextDailySeq } from "@/lib/daily-seq";
import { emitToAdmin } from "@/lib/socket-server";
import { format } from "date-fns";

function generateOrderId(): string {
  const date = format(new Date(), "yyyyMMdd");
  const rand = Math.floor(Math.random() * 1000)
    .toString()
    .padStart(3, "0");
  return `ORD-${date}-${rand}`;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const roomId = searchParams.get("roomId");

    // Build query constraints
    const constraints: ReturnType<typeof where>[] = [];
    if (status) {
      constraints.push(where("status", "==", status));
    }
    if (roomId) {
      constraints.push(where("roomUuid", "==", roomId));
    }

    const ordersSnap = await getDocs(
      query(
        collection(firestore, "orders"),
        ...constraints
      )
    );

    const result = await Promise.all(
      ordersSnap.docs.map(async (d) => {
        const order = { id: d.id, ...d.data() };
        // Get order items subcollection
        const itemsSnap = await getDocs(
          collection(firestore, "orders", d.id, "items")
        );
        const items = itemsSnap.docs.map((item) => ({
          id: item.id,
          ...item.data(),
        }));
        return { ...order, items };
      })
    );

    // Sort by createdAt descending (newest first)
    result.sort((a, b) => {
      const aTime = (a as Record<string, unknown>).createdAt as string;
      const bTime = (b as Record<string, unknown>).createdAt as string;
      return bTime > aTime ? 1 : bTime < aTime ? -1 : 0;
    });

    return NextResponse.json(result);
  } catch (e) {
    console.error("Orders fetch error:", e);
    return NextResponse.json({ error: "주문 목록 조회 실패" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Validate input with Zod schema
    const parseResult = orderSchema.safeParse(body);
    if (!parseResult.success) {
      const firstError = parseResult.error.issues[0]?.message || "입력값이 올바르지 않습니다";
      return NextResponse.json({ error: firstError }, { status: 400 });
    }

    const { roomId: roomUuid, items, paymentMethod, note } = parseResult.data;

    // Block direct kakaopay order creation — must use payment ready flow
    if (paymentMethod === "kakaopay") {
      return NextResponse.json(
        { error: "카카오페이 결제는 결제 준비 API를 통해 진행해야 합니다" },
        { status: 400 }
      );
    }

    // Find room by UUID
    const roomSnap = await getDocs(
      query(
        collection(firestore, "rooms"),
        where("roomId", "==", roomUuid)
      )
    );

    if (roomSnap.empty) {
      return NextResponse.json(
        { error: "객실을 찾을 수 없습니다" },
        { status: 404 }
      );
    }

    const room = { id: roomSnap.docs[0].id, ...roomSnap.docs[0].data() } as {
      id: string;
      roomId: string;
      roomNumber: string;
    };

    // Get menu items, validate stock, and deduct via transaction
    let totalAmount = 0;
    const itemDetails: {
      menuItemId: string;
      menuItemName: string;
      menuItemPrice: number;
      quantity: number;
      subtotal: number;
    }[] = [];

    try {
      await runTransaction(firestore, async (transaction) => {
        // Phase 1: Read all menu items within the transaction
        const menuDocs = [];
        for (const item of items) {
          const menuRef = doc(firestore, "menuItems", item.menuItemId);
          const menuSnap = await transaction.get(menuRef);
          if (!menuSnap.exists()) {
            throw new Error(`메뉴를 찾을 수 없습니다 (ID: ${item.menuItemId})`);
          }
          menuDocs.push({ ref: menuRef, snap: menuSnap, orderItem: item });
        }

        // Phase 2: Validate stock and calculate totals
        for (const { snap, orderItem } of menuDocs) {
          const data = snap.data() as {
            name: string;
            price: number;
            stock?: number | null;
            stockUsed?: number;
          };
          if (data.stock !== null && data.stock !== undefined) {
            const remaining = data.stock - (data.stockUsed || 0);
            if (remaining < orderItem.quantity) {
              throw new Error(
                `"${data.name}" 재고가 부족합니다 (잔여: ${remaining}개)`
              );
            }
          }
          const subtotal = data.price * orderItem.quantity;
          totalAmount += subtotal;
          itemDetails.push({
            menuItemId: snap.id,
            menuItemName: data.name,
            menuItemPrice: data.price,
            quantity: orderItem.quantity,
            subtotal,
          });
        }

        // Phase 3: Deduct stock
        for (const { ref, snap, orderItem } of menuDocs) {
          const data = snap.data() as { stock?: number | null; stockUsed?: number };
          if (data.stock !== null && data.stock !== undefined) {
            transaction.update(ref, {
              stockUsed: (data.stockUsed || 0) + orderItem.quantity,
            });
          }
        }
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : "재고 확인 실패";
      return NextResponse.json({ error: message }, { status: 409 });
    }

    const orderId = generateOrderId();
    const paymentStatus = paymentMethod === "deferred" ? "deferred" : "pending";
    const now = new Date().toISOString();
    const dailySeq = await getNextDailySeq();

    const orderData = {
      orderId,
      roomId: room.id,
      roomUuid: room.roomId,
      roomNumber: room.roomNumber,
      status: "pending",
      paymentMethod,
      paymentStatus,
      totalAmount,
      note: note || null,
      kakaoTid: null,
      dailySeq,
      createdAt: now,
      updatedAt: now,
    };

    // Create order document
    const orderRef = await addDoc(
      collection(firestore, "orders"),
      orderData
    );

    // Create order items in subcollection
    for (const item of itemDetails) {
      await addDoc(
        collection(firestore, "orders", orderRef.id, "items"),
        item
      );
    }

    const fullOrder = {
      id: orderRef.id,
      ...orderData,
      items: itemDetails,
    };

    emitToAdmin("order:created", fullOrder);
    if (paymentMethod === "deferred") {
      emitToAdmin("deferred:updated", {});
    }

    return NextResponse.json(fullOrder, { status: 201 });
  } catch (e) {
    console.error("Order creation error:", e);
    return NextResponse.json({ error: "주문 생성 실패" }, { status: 500 });
  }
}
