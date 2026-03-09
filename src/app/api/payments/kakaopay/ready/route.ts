import { NextRequest, NextResponse } from "next/server";
import { firestore } from "@/lib/firebase";
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  where,
} from "firebase/firestore";
import { kakaoPayReady } from "@/lib/kakaopay";
import { getBaseUrlFromRequest, getCallbackBaseUrl } from "@/lib/constants";
import { format } from "date-fns";

function generateOrderId(): string {
  const date = format(new Date(), "yyyyMMdd");
  const rand = Math.floor(Math.random() * 1000)
    .toString()
    .padStart(3, "0");
  return `ORD-${date}-${rand}`;
}

const THIRTY_MINUTES_MS = 30 * 60 * 1000;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { roomId: roomUuid, items, note } = body;

    // Input validation
    if (!roomUuid || typeof roomUuid !== "string") {
      return NextResponse.json({ error: "객실 ID가 필요합니다" }, { status: 400 });
    }
    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: "최소 1개 이상의 상품을 주문해야 합니다" },
        { status: 400 }
      );
    }

    // Validate each item
    for (const item of items) {
      if (!item.menuItemId || typeof item.menuItemId !== "string") {
        return NextResponse.json({ error: "메뉴 ID가 올바르지 않습니다" }, { status: 400 });
      }
      if (
        typeof item.quantity !== "number" ||
        !Number.isInteger(item.quantity) ||
        item.quantity < 1 ||
        item.quantity > 99
      ) {
        return NextResponse.json(
          { error: "수량은 1~99 사이의 정수여야 합니다" },
          { status: 400 }
        );
      }
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

    // Get menu items and calculate total
    let totalAmount = 0;
    const itemDetails = [];
    for (const item of items) {
      const menuItemDoc = await getDoc(
        doc(firestore, "menuItems", item.menuItemId)
      );
      if (!menuItemDoc.exists()) {
        return NextResponse.json(
          { error: `메뉴를 찾을 수 없습니다 (ID: ${item.menuItemId})` },
          { status: 404 }
        );
      }
      const menuItem = menuItemDoc.data() as { name: string; price: number };
      const subtotal = menuItem.price * item.quantity;
      totalAmount += subtotal;
      itemDetails.push({
        menuItemId: menuItemDoc.id,
        menuItemName: menuItem.name,
        menuItemPrice: menuItem.price,
        quantity: item.quantity,
        subtotal,
      });
    }

    if (totalAmount <= 0) {
      return NextResponse.json({ error: "결제 금액이 없습니다" }, { status: 400 });
    }

    // Clean up stale pending payments (older than 30 minutes)
    const existingPending = await getDocs(
      query(
        collection(firestore, "pendingOrderPayments"),
        where("roomUuid", "==", roomData.roomId)
      )
    );
    const now = new Date();
    for (const pendingDoc of existingPending.docs) {
      const pendingCreatedAt = pendingDoc.data().createdAt as string;
      const elapsed = now.getTime() - new Date(pendingCreatedAt).getTime();
      if (elapsed > THIRTY_MINUTES_MS) {
        await deleteDoc(pendingDoc.ref);
      }
    }

    const orderId = generateOrderId();
    const nowIso = now.toISOString();

    // Save pending payment data (NOT in orders yet)
    const pendingData = {
      orderId,
      roomId: roomDoc.id,
      roomUuid: roomData.roomId,
      roomNumber: roomData.roomNumber,
      items: itemDetails,
      totalAmount,
      note: note || null,
      paymentMethod: "kakaopay",
      kakaoTid: null,
      createdAt: nowIso,
    };

    const pendingRef = await addDoc(
      collection(firestore, "pendingOrderPayments"),
      pendingData
    );

    const baseUrl = getBaseUrlFromRequest(req);
    const callbackBaseUrl = getCallbackBaseUrl(req);

    console.log("[KakaoPay ready] baseUrl:", baseUrl, "callbackBaseUrl:", callbackBaseUrl);

    const result = await kakaoPayReady({
      orderId,
      itemName: `${roomData.roomNumber}호 주문`,
      totalAmount,
      roomId: roomData.roomId,
      baseUrl: callbackBaseUrl,
      callbackUrls: {
        approval: `${callbackBaseUrl}/api/payments/kakaopay/approve?orderId=${orderId}`,
        cancel: `${callbackBaseUrl}/api/payments/kakaopay/cancel?orderId=${orderId}`,
        fail: `${callbackBaseUrl}/api/payments/kakaopay/fail?orderId=${orderId}`,
      },
    });

    // Save TID to pending document
    await updateDoc(pendingRef, { kakaoTid: result.tid });

    return NextResponse.json({
      orderId,
      tid: result.tid,
      redirectUrl: result.next_redirect_mobile_url,
      redirectPcUrl: result.next_redirect_pc_url,
    });
  } catch (e) {
    console.error("KakaoPay ready error:", e);
    const message =
      e instanceof Error ? e.message : "카카오페이 결제 준비 중 오류가 발생했습니다";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
