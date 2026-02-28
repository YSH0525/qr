import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { rooms } from "@/db/schema";
import { v4 as uuidv4 } from "uuid";

export async function GET() {
  const allRooms = await db.select().from(rooms).orderBy(rooms.roomNumber);
  return NextResponse.json(allRooms);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const result = db
      .insert(rooms)
      .values({
        roomNumber: body.roomNumber,
        roomId: uuidv4(),
        floor: body.floor || null,
      })
      .returning()
      .get();

    return NextResponse.json(result, { status: 201 });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "객실 생성 실패";
    if (message.includes("UNIQUE")) {
      return NextResponse.json(
        { error: "이미 존재하는 객실 번호입니다" },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
