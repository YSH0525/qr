import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { orders, orderItems, rooms } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  const { orderId } = await params;

  const order = await db
    .select({
      id: orders.id,
      orderId: orders.orderId,
      roomId: orders.roomId,
      roomNumber: rooms.roomNumber,
      status: orders.status,
      paymentMethod: orders.paymentMethod,
      paymentStatus: orders.paymentStatus,
      totalAmount: orders.totalAmount,
      note: orders.note,
      kakaoTid: orders.kakaoTid,
      createdAt: orders.createdAt,
      updatedAt: orders.updatedAt,
    })
    .from(orders)
    .innerJoin(rooms, eq(orders.roomId, rooms.id))
    .where(eq(orders.orderId, orderId))
    .get();

  if (!order) {
    return NextResponse.json({ error: "주문을 찾을 수 없습니다" }, { status: 404 });
  }

  const items = await db
    .select()
    .from(orderItems)
    .where(eq(orderItems.orderId, order.id));

  return NextResponse.json({ ...order, items });
}
