import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { orders, orderItems, menuItems, rooms } from "@/db/schema";
import { eq, desc, and } from "drizzle-orm";
import { orderEvents } from "@/lib/sse";
import { format } from "date-fns";

function generateOrderId(): string {
  const date = format(new Date(), "yyyyMMdd");
  const rand = Math.floor(Math.random() * 1000)
    .toString()
    .padStart(3, "0");
  return `ORD-${date}-${rand}`;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const roomId = searchParams.get("roomId");

  let query = db
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
      createdAt: orders.createdAt,
      updatedAt: orders.updatedAt,
    })
    .from(orders)
    .innerJoin(rooms, eq(orders.roomId, rooms.id))
    .orderBy(desc(orders.createdAt))
    .$dynamic();

  const conditions = [];
  if (status) {
    conditions.push(eq(orders.status, status));
  }
  if (roomId) {
    conditions.push(eq(rooms.roomId, roomId));
  }
  if (conditions.length > 0) {
    query = query.where(and(...conditions));
  }

  const orderList = await query;

  // Attach items to each order
  const result = await Promise.all(
    orderList.map(async (order) => {
      const items = await db
        .select()
        .from(orderItems)
        .where(eq(orderItems.orderId, order.id));
      return { ...order, items };
    })
  );

  return NextResponse.json(result);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { roomId: roomUuid, items, paymentMethod, note } = body;

    // Find room by UUID
    const room = await db
      .select()
      .from(rooms)
      .where(eq(rooms.roomId, roomUuid))
      .get();

    if (!room) {
      return NextResponse.json({ error: "객실을 찾을 수 없습니다" }, { status: 404 });
    }

    // Get menu items and calculate total
    let totalAmount = 0;
    const itemDetails = [];
    for (const item of items) {
      const menuItem = await db
        .select()
        .from(menuItems)
        .where(eq(menuItems.id, item.menuItemId))
        .get();

      if (!menuItem) {
        return NextResponse.json(
          { error: `메뉴를 찾을 수 없습니다 (ID: ${item.menuItemId})` },
          { status: 404 }
        );
      }

      const subtotal = menuItem.price * item.quantity;
      totalAmount += subtotal;
      itemDetails.push({
        menuItemId: menuItem.id,
        menuItemName: menuItem.name,
        menuItemPrice: menuItem.price,
        quantity: item.quantity,
        subtotal,
      });
    }

    const orderId = generateOrderId();
    const paymentStatus = paymentMethod === "deferred" ? "deferred" : "pending";

    // Create order
    const order = db
      .insert(orders)
      .values({
        orderId,
        roomId: room.id,
        status: "pending",
        paymentMethod,
        paymentStatus,
        totalAmount,
        note: note || null,
      })
      .returning()
      .get();

    // Create order items
    for (const item of itemDetails) {
      db.insert(orderItems)
        .values({ orderId: order.id, ...item })
        .run();
    }

    const fullOrder = {
      ...order,
      roomNumber: room.roomNumber,
      items: itemDetails,
    };

    // Broadcast to SSE clients
    orderEvents.broadcast("new-order", fullOrder);

    return NextResponse.json(fullOrder, { status: 201 });
  } catch (e) {
    console.error("Order creation error:", e);
    return NextResponse.json({ error: "주문 생성 실패" }, { status: 500 });
  }
}
