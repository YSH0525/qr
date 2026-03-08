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
    };

    const result = await kakaoPayReady({
      orderId: order.orderId,
      itemName: `${order.roomNumber}호 주문`,
      totalAmount: order.totalAmount,
      roomId: order.roomUuid,
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
