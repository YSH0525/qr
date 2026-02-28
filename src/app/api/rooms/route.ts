import { NextRequest, NextResponse } from "next/server";
import { firestore } from "@/lib/firebase";
import {
  collection,
  getDocs,
  query,
  orderBy,
  where,
  doc,
  setDoc,
} from "firebase/firestore";
import { v4 as uuidv4 } from "uuid";

export async function GET() {
  const snap = await getDocs(
    query(collection(firestore, "rooms"), orderBy("roomNumber"))
  );
  const allRooms = snap.docs.map((d) => ({ ...d.data(), id: d.id }));
  return NextResponse.json(allRooms);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Check for duplicate room number
    const existing = await getDocs(
      query(
        collection(firestore, "rooms"),
        where("roomNumber", "==", body.roomNumber)
      )
    );
    if (!existing.empty) {
      return NextResponse.json(
        { error: "이미 존재하는 객실 번호입니다" },
        { status: 409 }
      );
    }

    const roomId = uuidv4();
    const data = {
      roomNumber: body.roomNumber,
      roomId,
      floor: body.floor || null,
      isActive: true,
      createdAt: new Date().toISOString(),
    };
    await setDoc(doc(firestore, "rooms", roomId), data);

    return NextResponse.json(data, { status: 201 });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "객실 생성 실패";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
