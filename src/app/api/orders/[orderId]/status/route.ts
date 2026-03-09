import { NextRequest, NextResponse } from "next/server";
import { firestore } from "@/lib/firebase";
import {
  collection,
  getDocs,
  query,
  where,
  updateDoc,
} from "firebase/firestore";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  const { orderId } = await params;
  const { status } = await req.json();

  const validStatuses = [
    "pending",
    "accepted",
    "rejected",
    "preparing",
    "completed",
    "cancelled",
  ];

  if (!validStatuses.includes(status)) {
    return NextResponse.json(
      { error: "잘못된 상태값입니다" },
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
  const updatedAt = new Date().toISOString();

  await updateDoc(orderDoc.ref, { status, updatedAt });

  const updated = { id: orderDoc.id, ...orderDoc.data(), status, updatedAt };

  return NextResponse.json(updated);
}
