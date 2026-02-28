import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { orders, rooms } from "@/db/schema";
import { eq } from "drizzle-orm";
import { kakaoPayReady } from "@/lib/kakaopay";

export async function POST(req: NextRequest) {
  try {
    const { orderId } = await req.json();

    const order = await db
      .select({
        id: orders.id,
        orderId: orders.orderId,
        roomId: orders.roomId,
        totalAmount: orders.totalAmount,
        paymentMethod: orders.paymentMethod,
      })
      .from(orders)
      .where(eq(orders.orderId, orderId))
      .get();

    if (!order) {
      return NextResponse.json({ error: "주문을 찾을 수 없습니다" }, { status: 404 });
    }

    const room = await db
      .select()
      .from(rooms)
      .where(eq(rooms.id, order.roomId))
      .get();

    if (!room) {
      return NextResponse.json({ error: "객실을 찾을 수 없습니다" }, { status: 404 });
    }

    const result = await kakaoPayReady({
      orderId: order.orderId,
      itemName: `${room.roomNumber}호 주문`,
      totalAmount: order.totalAmount,
      roomId: room.roomId,
    });

    // Save TID for approval step
    db.update(orders)
      .set({ kakaoTid: result.tid })
      .where(eq(orders.id, order.id))
      .run();

    return NextResponse.json({
      tid: result.tid,
      redirectUrl: result.next_redirect_mobile_url,
      redirectPcUrl: result.next_redirect_pc_url,
    });
  } catch (e) {
    console.error("KakaoPay ready error:", e);
    return NextResponse.json(
      { error: "카카오페이 결제 준비 중 오류가 발생했습니다" },
      { status: 500 }
    );
  }
}
