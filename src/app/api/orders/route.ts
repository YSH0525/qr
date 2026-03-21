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
import { emitToAdmin, emitToRoom } from "@/lib/socket-server";
import { format } from "date-fns";
import type { ServiceType } from "@/types/service";

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
    const statuses = searchParams.getAll("status");
    const roomId = searchParams.get("roomId");
    const type = searchParams.get("type");

    // Build query constraints
    const constraints: ReturnType<typeof where>[] = [];
    if (statuses.length === 1) {
      constraints.push(where("status", "==", statuses[0]));
    } else if (statuses.length > 1) {
      constraints.push(where("status", "in", statuses));
    }
    if (roomId) {
      constraints.push(where("roomUuid", "==", roomId));
    }
    if (type) {
      constraints.push(where("type", "==", type));
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
        const orderData = d.data() as { type?: string };

        // Product orders have items in subcollection
        if (!orderData.type || orderData.type === "product") {
          const itemsSnap = await getDocs(
            collection(firestore, "orders", d.id, "items")
          );
          const items = itemsSnap.docs.map((item) => ({
            id: item.id,
            ...item.data(),
          }));
          return { ...order, items, type: orderData.type || "product" };
        }

        // Service orders have items inline
        return { ...order, type: orderData.type };
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
    const orderType = body.type || "product";

    if (orderType === "product") {
      return handleProductOrder(body);
    } else {
      return handleServiceOrder(body, orderType);
    }
  } catch (e) {
    console.error("Order creation error:", e);
    return NextResponse.json({ error: "주문 생성 실패" }, { status: 500 });
  }
}

async function handleProductOrder(body: Record<string, unknown>) {
  // Validate input with Zod schema
  const parseResult = orderSchema.safeParse(body);
  if (!parseResult.success) {
    const firstError = parseResult.error.issues[0]?.message || "입력값이 올바르지 않습니다";
    return NextResponse.json({ error: firstError }, { status: 400 });
  }

  const { roomId: roomUuid, items, note } = parseResult.data;

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
    costPrice: number | null;
    quantity: number;
    subtotal: number;
  }[] = [];

  try {
    await runTransaction(firestore, async (transaction) => {
      const menuDocs = [];
      for (const item of items) {
        const menuRef = doc(firestore, "menuItems", item.menuItemId);
        const menuSnap = await transaction.get(menuRef);
        if (!menuSnap.exists()) {
          throw new Error(`메뉴를 찾을 수 없습니다 (ID: ${item.menuItemId})`);
        }
        menuDocs.push({ ref: menuRef, snap: menuSnap, orderItem: item });
      }

      for (const { snap, orderItem } of menuDocs) {
        const data = snap.data() as {
          name: string;
          price: number;
          costPrice?: number | null;
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
          costPrice: data.costPrice ?? null,
          quantity: orderItem.quantity,
          subtotal,
        });
      }

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
  const now = new Date().toISOString();
  const dailySeq = await getNextDailySeq();

  const orderData = {
    orderId,
    type: "product",
    roomId: room.id,
    roomUuid: room.roomId,
    roomNumber: room.roomNumber,
    status: "pending",
    paymentMethod: "deferred",
    paymentStatus: "deferred",
    totalAmount,
    note: note || null,
    dailySeq,
    createdAt: now,
    updatedAt: now,
  };

  const orderRef = await addDoc(
    collection(firestore, "orders"),
    orderData
  );

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
  emitToRoom(room.roomId, "order:created", fullOrder);
  emitToAdmin("deferred:updated", {});

  return NextResponse.json(fullOrder, { status: 201 });
}

async function handleServiceOrder(body: Record<string, unknown>, orderType: string) {
  const { roomId: roomUuid, categoryId, note, items, extensionHours, freeExtension, cleaningOptions } = body as {
    roomId: string;
    categoryId?: string;
    note?: string;
    items?: { itemId: string; name: string; quantity: number }[];
    extensionHours?: number;
    freeExtension?: boolean;
    cleaningOptions?: Record<string, unknown>;
  };

  if (!roomUuid) {
    return NextResponse.json({ error: "roomId가 필요합니다" }, { status: 400 });
  }

  // Find room
  const roomSnap = await getDocs(
    query(
      collection(firestore, "rooms"),
      where("roomId", "==", roomUuid)
    )
  );
  if (roomSnap.empty) {
    return NextResponse.json({ error: "객실을 찾을 수 없습니다" }, { status: 404 });
  }
  const roomDoc = roomSnap.docs[0];
  const roomData = roomDoc.data() as { roomNumber: string; roomId: string };

  // Resolve category info
  let categoryName = "";
  let categoryIcon = "";
  let catType: ServiceType = orderType as ServiceType;
  let hourlyRate = 0;

  if (categoryId && !categoryId.startsWith("quick-")) {
    const catDoc = await getDoc(doc(firestore, "serviceCategories", categoryId));
    if (!catDoc.exists()) {
      return NextResponse.json({ error: "서비스를 찾을 수 없습니다" }, { status: 404 });
    }
    const catData = catDoc.data() as {
      name: string;
      type: ServiceType;
      icon: string;
      hourlyRate?: number;
    };
    categoryName = catData.name;
    categoryIcon = catData.icon;
    catType = catData.type;
    hourlyRate = catData.hourlyRate || 0;
  } else if (categoryId?.startsWith("quick-")) {
    // Quick request types
    const quickType = categoryId.replace("quick-", "");
    const QUICK_TYPES: Record<string, { categoryName: string; categoryIcon: string }> = {
      towel: { categoryName: "수건 요청", categoryIcon: "Droplets" },
      inquiry: { categoryName: "기타문의", categoryIcon: "MessageCircle" },
    };
    const qt = QUICK_TYPES[quickType];
    if (qt) {
      categoryName = qt.categoryName;
      categoryIcon = qt.categoryIcon;
    }
  }

  // Calculate extension amount and total
  let extensionAmount: number | null = null;
  let totalAmount = 0;
  if (catType === "checkout_extension" && extensionHours) {
    extensionAmount = freeExtension ? 0 : hourlyRate * extensionHours;
    totalAmount = extensionAmount;
  }

  const orderId = generateOrderId();
  const now = new Date().toISOString();
  const dailySeq = await getNextDailySeq();

  const orderData: Record<string, unknown> = {
    orderId,
    type: catType,
    dailySeq,
    categoryId: categoryId || null,
    categoryName,
    categoryIcon,
    roomId: roomDoc.id,
    roomUuid: roomData.roomId,
    roomNumber: roomData.roomNumber,
    status: "pending",
    note: note || null,
    items: [], // product items (empty for service)
    serviceItems: items || [],
    cleaningOptions: catType === "cleaning" && cleaningOptions ? cleaningOptions : null,
    extensionHours: extensionHours || null,
    extensionAmount,
    freeExtension: freeExtension || false,
    totalAmount,
    paymentMethod:
      catType === "checkout_extension" && extensionHours && !freeExtension
        ? "deferred"
        : null,
    paymentStatus:
      catType === "checkout_extension" && extensionHours && !freeExtension
        ? "deferred"
        : null,
    createdAt: now,
    updatedAt: now,
  };

  const docRef = await addDoc(
    collection(firestore, "orders"),
    orderData
  );

  const fullOrder = { id: docRef.id, ...orderData };
  emitToAdmin("order:created", fullOrder);
  emitToRoom(roomData.roomId, "order:created", fullOrder);

  if (orderData.paymentMethod === "deferred") {
    emitToAdmin("deferred:updated", {});
  }

  return NextResponse.json(fullOrder, { status: 201 });
}
