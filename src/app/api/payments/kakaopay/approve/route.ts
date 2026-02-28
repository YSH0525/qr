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
    };

    if (!order.kakaoTid) {
      return NextResponse.json(
        { error: "주문을 찾을 수 없습니다" },
        { status: 404 }
      );
    }

    await kakaoPayApprove({
      tid: order.kakaoTid,
      orderId: order.orderId,
      roomId: order.roomUuid,
      pgToken,
    });

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
    const baseUrl =
      process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
    return NextResponse.redirect(
      `${baseUrl}/room/${order.roomUuid}/payment/success?orderId=${orderId}`
    );
  } catch (e) {
    console.error("KakaoPay approve error:", e);
    return NextResponse.json(
      { error: "카카오페이 결제 승인 중 오류가 발생했습니다" },
      { status: 500 }
    );
  }
}
