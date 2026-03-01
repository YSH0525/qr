import { NextRequest, NextResponse } from "next/server";
import { firestore } from "@/lib/firebase";
import {
  collection,
  getDocs,
  query,
  where,
  updateDoc,
} from "firebase/firestore";
import { orderEvents } from "@/lib/sse";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ requestId: string }> }
) {
  const { requestId } = await params;
  const { status } = await req.json();

  const validStatuses = ["requested", "accepted", "completed"];
  if (!validStatuses.includes(status)) {
    return NextResponse.json({ error: "유효하지 않은 상태입니다" }, { status: 400 });
  }

  const snap = await getDocs(
    query(
      collection(firestore, "serviceRequests"),
      where("requestId", "==", requestId)
    )
  );

  if (snap.empty) {
    return NextResponse.json({ error: "요청을 찾을 수 없습니다" }, { status: 404 });
  }

  const docRef = snap.docs[0].ref;
  const updatedAt = new Date().toISOString();

  await updateDoc(docRef, { status, updatedAt });

  const updated = { id: snap.docs[0].id, ...snap.docs[0].data(), status, updatedAt };

  orderEvents.broadcast("service-request-updated", updated);

  return NextResponse.json(updated);
}
