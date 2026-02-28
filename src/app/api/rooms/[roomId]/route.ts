import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { rooms } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const { roomId } = await params;
  const room = await db
    .select()
    .from(rooms)
    .where(eq(rooms.roomId, roomId))
    .get();

  if (!room) {
    return NextResponse.json({ error: "객실을 찾을 수 없습니다" }, { status: 404 });
  }

  return NextResponse.json(room);
}
