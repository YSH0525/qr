import { NextRequest, NextResponse } from "next/server";
import { firestore } from "@/lib/firebase";
import {
  collection,
  getDocs,
  query,
  where,
  updateDoc,
} from "firebase/firestore";
import { kakaoPayApprove } from "@/lib/kakaopay";
import { orderEvents } from "@/lib/sse";
import { BASE_URL } from "@/lib/constants";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const pgToken = searchParams.get("pg_token");
    const orderId = searchParams.get("orderId");

    if (!pgToken || !orderId) {
      return NextResponse.json(
        { error: "필수 파라미터가 누락되었습니다" },
        { status: 400 }
      );
    }

    const orderSnap = await getDocs(
      query(
        collection(firestore, "orders"),
        where("orderId", "==", orderId)
      )
    );

    if (orderSnap.empty) {
      return NextResponse.json(
        { error: "주문을 찾을 수 없습니다" },
        { status: 404 }
      );
    }

    const orderDoc = orderSnap.docs[0];
    const order = orderDoc.data() as {
      orderId: string;
      roomUuid: string;
      roomNumber: string;
      kakaoTid: string | null;
      totalAmount: number;
    };

    if (!order.kakaoTid) {
      return NextResponse.json(
        { error: "주문을 찾을 수 없습니다" },
        { status: 404 }
      );
    }

    const approveResult = await kakaoPayApprove({
      tid: order.kakaoTid,
      orderId: order.orderId,
      roomId: order.roomUuid,
      pgToken,
    });

    // Verify approved amount matches order amount
    if (approveResult.amount?.total !== order.totalAmount) {
      console.error(
        `Payment amount mismatch: expected ${order.totalAmount}, got ${approveResult.amount?.total}`
      );
      await updateDoc(orderDoc.ref, {
        paymentStatus: "failed",
        updatedAt: new Date().toISOString(),
      });
      return NextResponse.redirect(
        `${BASE_URL}/room/${order.roomUuid}/payment/fail?orderId=${orderId}`
      );
    }

    // Update payment status
    const updatedAt = new Date().toISOString();
    await updateDoc(orderDoc.ref, {
      paymentStatus: "paid",
      updatedAt,
    });

    orderEvents.broadcast("order-updated", {
      id: orderDoc.id,
      ...order,
      paymentStatus: "paid",
    });

    // Redirect to success page
    return NextResponse.redirect(
      `${BASE_URL}/room/${order.roomUuid}/payment/success?orderId=${orderId}`
    );
  } catch (e) {
    console.error("KakaoPay approve error:", e);
    const { searchParams } = new URL(req.url);
    const failOrderId = searchParams.get("orderId") || "";

    // Try to get roomUuid from the order for redirect
    try {
      const failSnap = await getDocs(
        query(
          collection(firestore, "orders"),
          where("orderId", "==", failOrderId)
        )
      );
      if (!failSnap.empty) {
        const failOrder = failSnap.docs[0].data() as { roomUuid: string };
        await updateDoc(failSnap.docs[0].ref, {
          paymentStatus: "failed",
          updatedAt: new Date().toISOString(),
        });
        return NextResponse.redirect(
          `${BASE_URL}/room/${failOrder.roomUuid}/payment/fail?orderId=${failOrderId}`
        );
      }
    } catch {
      // Fall through to generic redirect
    }

    return NextResponse.redirect(BASE_URL);
  }
}
