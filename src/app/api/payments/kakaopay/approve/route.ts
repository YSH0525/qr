import { NextRequest, NextResponse } from "next/server";
import { firestore } from "@/lib/firebase";
import {
  collection,
  getDocs,
  addDoc,
  deleteDoc,
  query,
  where,
} from "firebase/firestore";
import { kakaoPayApprove, kakaoPayCancel } from "@/lib/kakaopay";
import { orderEvents } from "@/lib/sse";
import { getNextDailySeq } from "@/lib/daily-seq";
import { getBaseUrlFromRequest } from "@/lib/constants";

interface PendingOrderData {
  orderId: string;
  roomId: string;
  roomUuid: string;
  roomNumber: string;
  items: {
    menuItemId: string;
    menuItemName: string;
    menuItemPrice: number;
    quantity: number;
    subtotal: number;
  }[];
  totalAmount: number;
  note: string | null;
  paymentMethod: string;
  kakaoTid: string | null;
  createdAt: string;
}

export async function GET(req: NextRequest) {
  const baseUrl = getBaseUrlFromRequest(req);

  try {
    const { searchParams } = new URL(req.url);
    const pgToken = searchParams.get("pg_token");
    const orderId = searchParams.get("orderId");

    if (!pgToken || !orderId) {
      return NextResponse.redirect(baseUrl);
    }

    // Look up pending payment data
    const snap = await getDocs(
      query(
        collection(firestore, "pendingOrderPayments"),
        where("orderId", "==", orderId)
      )
    );

    if (snap.empty) {
      console.error(`Pending order not found for orderId: ${orderId}`);
      return NextResponse.redirect(baseUrl);
    }

    const pendingDoc = snap.docs[0];
    const data = pendingDoc.data() as PendingOrderData;

    if (!data.kakaoTid) {
      console.error(`No kakaoTid in pending order: ${orderId}`);
      return NextResponse.redirect(
        `${baseUrl}/room/${data.roomUuid}/payment/fail?orderId=${orderId}`
      );
    }

    const approveResult = await kakaoPayApprove({
      tid: data.kakaoTid,
      orderId: data.orderId,
      roomId: data.roomUuid,
      pgToken,
    });

    // Verify approved amount matches order amount
    if (approveResult.amount?.total !== data.totalAmount) {
      console.error(
        `Payment amount mismatch: expected ${data.totalAmount}, got ${approveResult.amount?.total}`
      );
      try {
        await kakaoPayCancel({
          tid: data.kakaoTid,
          cancelAmount: approveResult.amount?.total ?? data.totalAmount,
        });
      } catch (cancelErr) {
        console.error("Failed to cancel mismatched payment:", cancelErr);
      }
      await deleteDoc(pendingDoc.ref);
      return NextResponse.redirect(
        `${baseUrl}/room/${data.roomUuid}/payment/fail?orderId=${orderId}`
      );
    }

    // Payment approved — now create the actual order
    const now = new Date().toISOString();
    const dailySeq = await getNextDailySeq();

    const orderData = {
      orderId: data.orderId,
      dailySeq,
      roomId: data.roomId,
      roomUuid: data.roomUuid,
      roomNumber: data.roomNumber,
      status: "pending",
      paymentMethod: "kakaopay",
      paymentStatus: "paid",
      totalAmount: data.totalAmount,
      note: data.note,
      kakaoTid: data.kakaoTid,
      createdAt: data.createdAt,
      updatedAt: now,
    };

    const orderRef = await addDoc(
      collection(firestore, "orders"),
      orderData
    );

    // Create order items in subcollection
    for (const item of data.items) {
      await addDoc(
        collection(firestore, "orders", orderRef.id, "items"),
        item
      );
    }

    const fullOrder = {
      id: orderRef.id,
      ...orderData,
      items: data.items,
    };

    // Broadcast to dashboard
    orderEvents.broadcast("new-order", fullOrder);

    // Clean up pending data
    await deleteDoc(pendingDoc.ref);

    // Redirect to success page
    return NextResponse.redirect(
      `${baseUrl}/room/${data.roomUuid}/payment/success?orderId=${orderId}`
    );
  } catch (e) {
    console.error("KakaoPay approve error:", e);
    const { searchParams } = new URL(req.url);
    const failOrderId = searchParams.get("orderId") || "";

    try {
      const failSnap = await getDocs(
        query(
          collection(firestore, "pendingOrderPayments"),
          where("orderId", "==", failOrderId)
        )
      );
      if (!failSnap.empty) {
        const failData = failSnap.docs[0].data() as { roomUuid: string };
        await deleteDoc(failSnap.docs[0].ref);
        return NextResponse.redirect(
          `${baseUrl}/room/${failData.roomUuid}/payment/fail?orderId=${failOrderId}`
        );
      }
    } catch {
      // Fall through to generic redirect
    }

    return NextResponse.redirect(baseUrl);
  }
}
