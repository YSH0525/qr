import { NextRequest, NextResponse } from "next/server";
import { firestore } from "@/lib/firebase";
import {
  collection,
  getDocs,
  query,
  where,
  updateDoc,
} from "firebase/firestore";
import { getBaseUrlFromRequest } from "@/lib/constants";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const requestId = searchParams.get("requestId");
  const baseUrl = getBaseUrlFromRequest(req);
  if (!requestId) {
    return NextResponse.redirect(baseUrl);
  }

  const snap = await getDocs(
    query(
      collection(firestore, "serviceRequests"),
      where("requestId", "==", requestId)
    )
  );

  if (snap.empty) {
    return NextResponse.redirect(baseUrl);
  }

  const docRef = snap.docs[0];
  const data = docRef.data() as { roomUuid: string; categoryName: string; type: string };

  await updateDoc(docRef.ref, {
    paymentStatus: "failed",
    updatedAt: new Date().toISOString(),
  });

  return NextResponse.redirect(
    `${baseUrl}/room/${data.roomUuid}/service/confirm?requestId=${requestId}&failed=true&name=${encodeURIComponent(data.categoryName)}&type=${data.type}`
  );
}
