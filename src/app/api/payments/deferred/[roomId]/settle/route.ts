import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { orders, rooms } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { verifySession } from "@/lib/auth";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const isAuth = await verifySession();
  if (!isAuth) {
    return NextResponse.json({ error: "인증이 필요합니다" }, { status: 401 });
  }

  const { roomId } = await params;

  const room = await db
    .select()
    .from(rooms)
    .where(eq(rooms.roomId, roomId))
    .get();

  if (!room) {
    return NextResponse.json({ error: "객실을 찾을 수 없습니다" }, { status: 404 });
  }

  // Settle all deferred orders for this room
  const updated = db
    .update(orders)
    .set({
      paymentStatus: "paid",
      updatedAt: new Date().toISOString(),
    })
    .where(
      and(
        eq(orders.roomId, room.id),
        eq(orders.paymentMethod, "deferred"),
        eq(orders.paymentStatus, "deferred")
      )
    )
    .returning()
    .all();

  return NextResponse.json({
    settled: updated.length,
    totalAmount: updated.reduce((sum, o) => sum + o.totalAmount, 0),
  });
}
