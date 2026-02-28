import { NextRequest, NextResponse } from "next/server";
import { firestore } from "@/lib/firebase";
import {
  collection,
  getDocs,
  query,
  where,
  updateDoc,
} from "firebase/firestore";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const { roomId } = await params;

  // Find room by UUID
  const roomSnap = await getDocs(
    query(
      collection(firestore, "rooms"),
      where("roomId", "==", roomId)
    )
  );

  if (roomSnap.empty) {
    return NextResponse.json(
      { error: "객실을 찾을 수 없습니다" },
      { status: 404 }
    );
  }

  const roomDoc = roomSnap.docs[0];

  // Get all deferred orders for this room
  const deferredSnap = await getDocs(
    query(
      collection(firestore, "orders"),
      where("roomId", "==", roomDoc.id),
      where("paymentMethod", "==", "deferred"),
      where("paymentStatus", "==", "deferred")
    )
  );

  const updatedAt = new Date().toISOString();
  let totalAmount = 0;

  for (const orderDoc of deferredSnap.docs) {
    await updateDoc(orderDoc.ref, {
      paymentStatus: "paid",
      updatedAt,
    });
    const data = orderDoc.data() as { totalAmount: number };
    totalAmount += data.totalAmount;
  }

  return NextResponse.json({
    settled: deferredSnap.size,
    totalAmount,
  });
}
