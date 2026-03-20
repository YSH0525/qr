import { NextRequest, NextResponse } from "next/server";
import { firestore } from "@/lib/firebase";
import {
  collection,
  getDocs,
  deleteDoc,
  query,
  where,
} from "firebase/firestore";
import { getCallbackBaseUrl } from "@/lib/constants";
import { emitToPayment } from "@/lib/socket-server";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const orderId = searchParams.get("orderId");
  const baseUrl = getCallbackBaseUrl(req);
  if (!orderId) {
    return NextResponse.redirect(baseUrl);
  }

  // Clean up pending payment data
  const snap = await getDocs(
    query(
      collection(firestore, "pendingOrderPayments"),
      where("orderId", "==", orderId)
    )
  );

  if (snap.empty) {
    return NextResponse.redirect(baseUrl);
  }

  const docRef = snap.docs[0];
  const data = docRef.data() as { roomUuid: string };

  await deleteDoc(docRef.ref);

  emitToPayment(orderId, "payment:status-changed", { orderId, status: "not_found" });

  return NextResponse.redirect(
    `${baseUrl}/room/${data.roomUuid}?payment=fail`
  );
}
