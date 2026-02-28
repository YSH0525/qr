import { NextRequest, NextResponse } from "next/server";
import { firestore } from "@/lib/firebase";
import { collection, getDocs, query, where } from "firebase/firestore";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const { roomId } = await params;

  const snap = await getDocs(
    query(collection(firestore, "rooms"), where("roomId", "==", roomId))
  );

  if (snap.empty) {
    return NextResponse.json(
      { error: "객실을 찾을 수 없습니다" },
      { status: 404 }
    );
  }

  const room = { id: snap.docs[0].id, ...snap.docs[0].data() };
  return NextResponse.json(room);
}
