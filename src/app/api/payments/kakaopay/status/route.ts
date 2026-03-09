import { NextRequest, NextResponse } from "next/server";
import { firestore } from "@/lib/firebase";
import {
  collection,
  getDocs,
  query,
  where,
} from "firebase/firestore";

/**
 * 결제 상태를 확인합니다.
 * - pending: pendingOrderPayments에 존재 → 아직 결제 진행 중
 * - completed: orders 컬렉션에 존재 → 결제 완료
 * - not_found: 어디에도 없음 → 취소/실패/만료
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const orderId = searchParams.get("orderId");

  if (!orderId) {
    return NextResponse.json({ error: "orderId가 필요합니다" }, { status: 400 });
  }

  // 1. 완료된 주문인지 확인
  const orderSnap = await getDocs(
    query(
      collection(firestore, "orders"),
      where("orderId", "==", orderId)
    )
  );

  if (!orderSnap.empty) {
    const order = orderSnap.docs[0].data();
    return NextResponse.json({
      status: "completed",
      paymentStatus: order.paymentStatus,
      roomUuid: order.roomUuid,
    });
  }

  // 2. 대기 중인 결제인지 확인
  const pendingSnap = await getDocs(
    query(
      collection(firestore, "pendingOrderPayments"),
      where("orderId", "==", orderId)
    )
  );

  if (!pendingSnap.empty) {
    return NextResponse.json({ status: "pending" });
  }

  // 3. 어디에도 없음
  return NextResponse.json({ status: "not_found" });
}
