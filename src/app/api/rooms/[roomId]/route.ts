import { NextRequest, NextResponse } from "next/server";
import { firestore } from "@/lib/firebase";
import {
  collection,
  getDocs,
  query,
  where,
  doc,
  deleteDoc,
  updateDoc,
} from "firebase/firestore";

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

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const { roomId } = await params;
  const body = await req.json();

  try {
    const snap = await getDocs(
      query(collection(firestore, "rooms"), where("roomId", "==", roomId))
    );

    if (snap.empty) {
      return NextResponse.json(
        { error: "객실을 찾을 수 없습니다" },
        { status: 404 }
      );
    }

    const roomDoc = snap.docs[0];
    const ref = doc(firestore, "rooms", roomDoc.id);
    await updateDoc(ref, { isActive: body.isActive });

    return NextResponse.json({
      id: roomDoc.id,
      ...roomDoc.data(),
      isActive: body.isActive,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "객실 상태 변경 실패";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const { roomId } = await params;

  try {
    const snap = await getDocs(
      query(collection(firestore, "rooms"), where("roomId", "==", roomId))
    );

    if (snap.empty) {
      return NextResponse.json(
        { error: "객실을 찾을 수 없습니다" },
        { status: 404 }
      );
    }

    // Check for pending orders
    const orderSnap = await getDocs(
      query(
        collection(firestore, "orders"),
        where("roomUuid", "==", roomId),
        where("status", "in", ["pending", "accepted", "preparing"])
      )
    );

    if (!orderSnap.empty) {
      return NextResponse.json(
        { error: "처리 중인 주문이 있는 객실은 삭제할 수 없습니다" },
        { status: 409 }
      );
    }

    const roomDoc = snap.docs[0];
    await deleteDoc(doc(firestore, "rooms", roomDoc.id));

    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "객실 삭제 실패";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
