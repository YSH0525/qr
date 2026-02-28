import { NextResponse } from "next/server";
import { db } from "@/db";
import { orders, rooms } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { verifySession } from "@/lib/auth";

export async function GET() {
  const isAuth = await verifySession();
  if (!isAuth) {
    return NextResponse.json({ error: "인증이 필요합니다" }, { status: 401 });
  }

  // Get all rooms with deferred unpaid orders
  const allRooms = await db.select().from(rooms).where(eq(rooms.isActive, true));

  const result = await Promise.all(
    allRooms.map(async (room) => {
      const deferredOrders = await db
        .select()
        .from(orders)
        .where(
          and(
            eq(orders.roomId, room.id),
            eq(orders.paymentMethod, "deferred"),
            eq(orders.paymentStatus, "deferred")
          )
        );

      const totalDeferred = deferredOrders.reduce(
        (sum, o) => sum + o.totalAmount,
        0
      );

      return {
        room,
        deferredOrders,
        totalDeferred,
        orderCount: deferredOrders.length,
      };
    })
  );

  // Only return rooms with outstanding deferred payments
  return NextResponse.json(result.filter((r) => r.orderCount > 0));
}
