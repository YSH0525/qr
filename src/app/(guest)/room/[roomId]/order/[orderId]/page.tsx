"use client";

import { useState, useEffect, use } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle } from "lucide-react";
import Link from "next/link";
import {
  ORDER_STATUS_LABELS,
  PAYMENT_METHOD_LABELS,
  PAYMENT_STATUS_LABELS,
} from "@/types";
import type { OrderWithItems } from "@/types";

export default function OrderConfirmPage({
  params,
}: {
  params: Promise<{ roomId: string; orderId: string }>;
}) {
  const { roomId, orderId } = use(params);
  const [order, setOrder] = useState<OrderWithItems | null>(null);

  useEffect(() => {
    fetch(`/api/orders/${orderId}`)
      .then((r) => r.json())
      .then(setOrder);
  }, [orderId]);

  const formatPrice = (price: number) => price.toLocaleString("ko-KR");

  if (!order) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-400">로딩 중...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-lg mx-auto px-4 py-8">
        {/* Success Icon */}
        <div className="text-center mb-6">
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-3" />
          <h1 className="text-2xl font-bold">주문 완료</h1>
          <p className="text-gray-500 mt-1">주문이 접수되었습니다</p>
        </div>

        <Card>
          <CardContent className="p-4 space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-500">주문번호</span>
              <span className="font-mono text-sm">{order.orderId}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-500">객실</span>
              <span className="font-semibold">{order.roomNumber}호</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-500">상태</span>
              <Badge>{ORDER_STATUS_LABELS[order.status]}</Badge>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-500">결제</span>
              <Badge variant="secondary">
                {PAYMENT_METHOD_LABELS[order.paymentMethod]} -{" "}
                {PAYMENT_STATUS_LABELS[order.paymentStatus]}
              </Badge>
            </div>

            <div className="border-t pt-3 space-y-2">
              {order.items.map((item, idx) => (
                <div key={idx} className="flex justify-between text-sm">
                  <span>
                    {item.menuItemName} x{item.quantity}
                  </span>
                  <span>{formatPrice(item.subtotal)}원</span>
                </div>
              ))}
            </div>

            <div className="border-t pt-3 flex justify-between">
              <span className="font-semibold">총 금액</span>
              <span className="text-lg font-bold text-blue-600">
                {formatPrice(order.totalAmount)}원
              </span>
            </div>
          </CardContent>
        </Card>

        <div className="mt-6 space-y-2">
          <Link href={`/room/${roomId}/orders`}>
            <Button className="w-full">주문현황 보기</Button>
          </Link>
          <Link href={`/room/${roomId}`}>
            <Button variant="outline" className="w-full">
              홈으로 돌아가기
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
