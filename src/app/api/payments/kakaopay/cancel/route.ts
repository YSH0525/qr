import { NextRequest, NextResponse } from "next/server";
import { firestore } from "@/lib/firebase";
import {
  collection,
  getDocs,
  query,
  where,
  updateDoc,
} from "firebase/firestore";
import { BASE_URL } from "@/lib/constants";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const orderId = searchParams.get("orderId");
  if (!orderId) {
    return NextResponse.redirect(BASE_URL);
  }

  const orderSnap = await getDocs(
    query(
      collection(firestore, "orders"),
      where("orderId", "==", orderId)
    )
  );

  if (orderSnap.empty) {
    return NextResponse.redirect(BASE_URL);
  }

  const orderDoc = orderSnap.docs[0];
  const order = orderDoc.data() as { roomUuid: string };

  await updateDoc(orderDoc.ref, {
    paymentStatus: "failed",
    status: "cancelled",
    updatedAt: new Date().toISOString(),
  });

  return NextResponse.redirect(
    `${BASE_URL}/room/${order.roomUuid}/payment/cancel?orderId=${orderId}`
  );
}
