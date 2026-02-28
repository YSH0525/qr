import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { orders, rooms } from "@/db/schema";
import { eq } from "drizzle-orm";
import { verifySession } from "@/lib/auth";
import { orderEvents } from "@/lib/sse";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  const isAuth = await verifySession();
  if (!isAuth) {
    return NextResponse.json({ error: "인증이 필요합니다" }, { status: 401 });
  }

  const { orderId } = await params;
  const { status } = await req.json();

  const validStatuses = [
    "pending",
    "accepted",
    "rejected",
    "preparing",
    "completed",
    "cancelled",
  ];

  if (!validStatuses.includes(status)) {
    return NextResponse.json({ error: "잘못된 상태값입니다" }, { status: 400 });
  }

  const updated = db
    .update(orders)
    .set({ status, updatedAt: new Date().toISOString() })
    .where(eq(orders.orderId, orderId))
    .returning()
    .get();

  if (!updated) {
    return NextResponse.json({ error: "주문을 찾을 수 없습니다" }, { status: 404 });
  }

  const room = await db
    .select()
    .from(rooms)
    .where(eq(rooms.id, updated.roomId))
    .get();

  orderEvents.broadcast("order-updated", {
    ...updated,
    roomNumber: room?.roomNumber,
  });

  return NextResponse.json(updated);
}
