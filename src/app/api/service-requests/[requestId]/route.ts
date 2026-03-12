import { NextRequest, NextResponse } from "next/server";
import { firestore } from "@/lib/firebase";
import {
  collection,
  getDocs,
  query,
  where,
  deleteDoc,
} from "firebase/firestore";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ requestId: string }> }
) {
  const { requestId } = await params;

  const snap = await getDocs(
    query(
      collection(firestore, "serviceRequests"),
      where("requestId", "==", requestId)
    )
  );

  if (snap.empty) {
    return NextResponse.json({ error: "요청을 찾을 수 없습니다" }, { status: 404 });
  }

  await deleteDoc(snap.docs[0].ref);

  return NextResponse.json({ success: true });
}
