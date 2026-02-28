import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { orders, rooms } from "@/db/schema";
import { eq } from "drizzle-orm";
import { kakaoPayApprove } from "@/lib/kakaopay";
import { orderEvents } from "@/lib/sse";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const pgToken = searchParams.get("pg_token");
    const orderId = searchParams.get("orderId");

    if (!pgToken || !orderId) {
      return NextResponse.json(
        { error: "필수 파라미터가 누락되었습니다" },
        { status: 400 }
      );
    }

    const order = await db
      .select()
      .from(orders)
      .where(eq(orders.orderId, orderId))
      .get();

    if (!order || !order.kakaoTid) {
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

    await kakaoPayApprove({
      tid: order.kakaoTid,
      orderId: order.orderId,
      roomId: room.roomId,
      pgToken,
    });

    // Update payment status
    db.update(orders)
      .set({
        paymentStatus: "paid",
        updatedAt: new Date().toISOString(),
      })
      .where(eq(orders.id, order.id))
      .run();

    orderEvents.broadcast("order-updated", {
      ...order,
      paymentStatus: "paid",
      roomNumber: room.roomNumber,
    });

    // Redirect to success page
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
    return NextResponse.redirect(
      `${baseUrl}/room/${room.roomId}/payment/success?orderId=${orderId}`
    );
  } catch (e) {
    console.error("KakaoPay approve error:", e);
    return NextResponse.json(
      { error: "카카오페이 결제 승인 중 오류가 발생했습니다" },
      { status: 500 }
    );
  }
}
