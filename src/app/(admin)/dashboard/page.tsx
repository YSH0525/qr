"use client";

import { useState, useEffect, useCallback } from "react";
import { useOrderSSE } from "@/hooks/use-sse";
import { useNotificationSound } from "@/hooks/use-audio";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import type { OrderWithItems } from "@/types";
import {
  ORDER_STATUS_LABELS,
  PAYMENT_METHOD_LABELS,
} from "@/types";

export default function DashboardPage() {
  const [orders, setOrders] = useState<OrderWithItems[]>([]);
  const { play } = useNotificationSound();

  const fetchOrders = useCallback(async () => {
    const res = await fetch("/api/orders");
    if (res.ok) {
      setOrders(await res.json());
    }
  }, []);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  useOrderSSE(
    useCallback(
      (event: string, data: Record<string, unknown>) => {
        if (event === "new-order") {
          setOrders((prev) => [data as unknown as OrderWithItems, ...prev]);
          play();
          toast.success(
            `새 주문! ${(data as Record<string, unknown>).roomNumber}호`
          );
        } else if (event === "order-updated") {
          setOrders((prev) =>
            prev.map((o) =>
              o.orderId === (data as Record<string, unknown>).orderId
                ? { ...o, ...(data as Partial<OrderWithItems>) }
                : o
            )
          );
        }
      },
      [play]
    )
  );

  const updateStatus = async (orderId: string, status: string) => {
    const res = await fetch(`/api/orders/${orderId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (res.ok) {
      fetchOrders();
      toast.success(`주문 상태가 변경되었습니다`);
    }
  };

  const pendingOrders = orders.filter((o) => o.status === "pending");
  const preparingOrders = orders.filter(
    (o) => o.status === "accepted" || o.status === "preparing"
  );
  const completedOrders = orders.filter((o) => o.status === "completed").slice(0, 20);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">주문 대시보드</h1>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-3xl font-bold text-orange-500">
              {pendingOrders.length}
            </p>
            <p className="text-sm text-gray-500">신규 주문</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-3xl font-bold text-blue-500">
              {preparingOrders.length}
            </p>
            <p className="text-sm text-gray-500">준비중</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-3xl font-bold text-green-500">
              {completedOrders.length}
            </p>
            <p className="text-sm text-gray-500">완료</p>
          </CardContent>
        </Card>
      </div>

      {/* 3-Column Board */}
      <div className="grid grid-cols-3 gap-4">
        {/* Pending */}
        <div>
          <h2 className="text-lg font-semibold mb-3 text-orange-600">
            신규 주문
          </h2>
          <div className="space-y-3">
            {pendingOrders.map((order) => (
              <OrderCard
                key={order.orderId}
                order={order}
                actions={
                  <>
                    <Button
                      size="sm"
                      onClick={() => updateStatus(order.orderId, "accepted")}
                    >
                      접수
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => updateStatus(order.orderId, "rejected")}
                    >
                      거절
                    </Button>
                  </>
                }
              />
            ))}
            {pendingOrders.length === 0 && (
              <p className="text-gray-400 text-sm text-center py-8">
                대기중인 주문이 없습니다
              </p>
            )}
          </div>
        </div>

        {/* Preparing */}
        <div>
          <h2 className="text-lg font-semibold mb-3 text-blue-600">준비중</h2>
          <div className="space-y-3">
            {preparingOrders.map((order) => (
              <OrderCard
                key={order.orderId}
                order={order}
                actions={
                  <Button
                    size="sm"
                    className="bg-green-600 hover:bg-green-700"
                    onClick={() => updateStatus(order.orderId, "completed")}
                  >
                    완료
                  </Button>
                }
              />
            ))}
            {preparingOrders.length === 0 && (
              <p className="text-gray-400 text-sm text-center py-8">
                준비중인 주문이 없습니다
              </p>
            )}
          </div>
        </div>

        {/* Completed */}
        <div>
          <h2 className="text-lg font-semibold mb-3 text-green-600">완료</h2>
          <div className="space-y-3">
            {completedOrders.map((order) => (
              <OrderCard key={order.orderId} order={order} />
            ))}
            {completedOrders.length === 0 && (
              <p className="text-gray-400 text-sm text-center py-8">
                완료된 주문이 없습니다
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function OrderCard({
  order,
  actions,
}: {
  order: OrderWithItems;
  actions?: React.ReactNode;
}) {
  const formatPrice = (price: number) =>
    price.toLocaleString("ko-KR") + "원";

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "방금 전";
    if (mins < 60) return `${mins}분 전`;
    const hours = Math.floor(mins / 60);
    return `${hours}시간 전`;
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">{order.roomNumber}호</CardTitle>
          <Badge
            variant={
              order.paymentMethod === "kakaopay" ? "default" : "secondary"
            }
          >
            {PAYMENT_METHOD_LABELS[order.paymentMethod]}
          </Badge>
        </div>
        <p className="text-xs text-gray-400">{timeAgo(order.createdAt)}</p>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="space-y-1">
          {order.items.map((item, idx) => (
            <div key={idx} className="flex justify-between text-sm">
              <span>
                {item.menuItemName} x{item.quantity}
              </span>
              <span className="text-gray-500">
                {formatPrice(item.subtotal)}
              </span>
            </div>
          ))}
        </div>
        {order.note && (
          <p className="text-xs text-orange-600 bg-orange-50 p-2 rounded">
            요청: {order.note}
          </p>
        )}
        <div className="flex justify-between items-center pt-2 border-t">
          <span className="font-semibold">
            {formatPrice(order.totalAmount)}
          </span>
          <Badge variant="outline">{ORDER_STATUS_LABELS[order.status]}</Badge>
        </div>
        {actions && (
          <div className="flex gap-2 pt-2">{actions}</div>
        )}
      </CardContent>
    </Card>
  );
}
