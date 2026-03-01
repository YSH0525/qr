import { NextRequest, NextResponse } from "next/server";
import { firestore } from "@/lib/firebase";
import {
  collection,
  getDocs,
  query,
  where,
  updateDoc,
} from "firebase/firestore";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const orderId = searchParams.get("orderId");
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";

  if (!orderId) {
    return NextResponse.redirect(baseUrl);
  }

  const orderSnap = await getDocs(
    query(
      collection(firestore, "orders"),
      where("orderId", "==", orderId)
    )
  );

  if (orderSnap.empty) {
    return NextResponse.redirect(baseUrl);
  }

  const orderDoc = orderSnap.docs[0];
  const order = orderDoc.data() as { roomUuid: string };

  await updateDoc(orderDoc.ref, {
    paymentStatus: "failed",
    updatedAt: new Date().toISOString(),
  });

  return NextResponse.redirect(
    `${baseUrl}/room/${order.roomUuid}/payment/fail?orderId=${orderId}`
  );
}
