import { NextRequest, NextResponse } from "next/server";
import { firestore } from "@/lib/firebase";
import {
  collection,
  getDocs,
  query,
  where,
  updateDoc,
} from "firebase/firestore";
import { kakaoPayReady } from "@/lib/kakaopay";
import { getBaseUrlFromRequest } from "@/lib/constants";

export async function POST(req: NextRequest) {
  try {
    const { orderId } = await req.json();

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
      roomId: string;
      roomNumber: string;
      roomUuid: string;
      totalAmount: number;
      paymentMethod: string;
      paymentStatus: string;
      status: string;
      kakaoTid: string | null;
    };

    // Validate order is eligible for KakaoPay payment
    if (order.paymentMethod !== "kakaopay") {
      return NextResponse.json(
        { error: "카카오페이 결제 대상 주문이 아닙니다" },
        { status: 400 }
      );
    }

    if (order.paymentStatus !== "pending") {
      return NextResponse.json(
        { error: "결제 대기 상태의 주문만 결제할 수 있습니다" },
        { status: 400 }
      );
    }

    if (order.status === "cancelled" || order.status === "rejected") {
      return NextResponse.json(
        { error: "취소되거나 거부된 주문은 결제할 수 없습니다" },
        { status: 400 }
      );
    }

    if (!order.totalAmount || order.totalAmount <= 0) {
      return NextResponse.json(
        { error: "결제 금액이 올바르지 않습니다" },
        { status: 400 }
      );
    }

    // Prevent duplicate payment preparation
    if (order.kakaoTid) {
      return NextResponse.json(
        { error: "이미 결제가 진행 중입니다" },
        { status: 409 }
      );
    }

    const baseUrl = getBaseUrlFromRequest(req);

    const result = await kakaoPayReady({
      orderId: order.orderId,
      itemName: `${order.roomNumber}호 주문`,
      totalAmount: order.totalAmount,
      roomId: order.roomUuid,
      baseUrl,
    });

    // Save TID for approval step
    await updateDoc(orderDoc.ref, { kakaoTid: result.tid });

    return NextResponse.json({
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
