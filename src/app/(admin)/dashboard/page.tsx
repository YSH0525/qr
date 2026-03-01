"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useOrderSSE } from "@/hooks/use-sse";
import { useNotificationSound } from "@/hooks/use-audio";
import { useBrowserNotification } from "@/hooks/use-notification";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import confetti from "canvas-confetti";
import { CheckCircle } from "lucide-react";
import type { OrderWithItems } from "@/types";
import {
  ORDER_STATUS_LABELS,
  PAYMENT_METHOD_LABELS,
} from "@/types";

export default function DashboardPage() {
  const [orders, setOrders] = useState<OrderWithItems[]>([]);
  const [animatingCards, setAnimatingCards] = useState<Set<string>>(new Set());
  const { playNewOrderAlert, playAcceptSound, playCompleteSound } =
    useNotificationSound();
  const { notify } = useBrowserNotification();

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
          const order = data as unknown as OrderWithItems;
          setOrders((prev) => [order, ...prev]);

          playNewOrderAlert(order.roomNumber, order.items || []);

          const itemText = (order.items || [])
            .map((i) => `${i.menuItemName} x${i.quantity}`)
            .join(", ");
          notify(
            `새 주문! ${order.roomNumber}호`,
            itemText || "새로운 주문이 들어왔습니다"
          );

          toast.success(`새 주문! ${order.roomNumber}호`);
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
      [playNewOrderAlert, notify]
    )
  );

  const handleAccept = async (order: OrderWithItems) => {
    // 카드 애니메이션 시작
    setAnimatingCards((prev) => new Set(prev).add(order.orderId));
    playAcceptSound();

    const res = await fetch(`/api/orders/${order.orderId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "accepted" }),
    });

    if (res.ok) {
      toast(`${order.roomNumber}호 주문 접수!`, {
        description: "조리를 시작합니다",
        icon: <CheckCircle className="text-green-500" />,
      });

      // 애니메이션 후 데이터 갱신
      setTimeout(() => {
        fetchOrders();
        setAnimatingCards((prev) => {
          const next = new Set(prev);
          next.delete(order.orderId);
          return next;
        });
      }, 400);
    }
  };

  const handleComplete = async (
    order: OrderWithItems,
    e: React.MouseEvent
  ) => {
    setAnimatingCards((prev) => new Set(prev).add(order.orderId));
    playCompleteSound();

    // 버튼 위치에서 컨페티 발사
    const rect = (e.target as HTMLElement).getBoundingClientRect();
    const x = (rect.left + rect.width / 2) / window.innerWidth;
    const y = (rect.top + rect.height / 2) / window.innerHeight;

    confetti({
      particleCount: 80,
      spread: 60,
      origin: { x, y },
      colors: ["#22c55e", "#16a34a", "#4ade80", "#86efac", "#fbbf24"],
      ticks: 150,
      gravity: 1.2,
      scalar: 0.9,
    });

    const res = await fetch(`/api/orders/${order.orderId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "completed" }),
    });

    if (res.ok) {
      toast(`${order.roomNumber}호 주문 완료!`, {
        description: "고객에게 전달해주세요",
        icon: <span className="text-xl">🎉</span>,
      });

      setTimeout(() => {
        fetchOrders();
        setAnimatingCards((prev) => {
          const next = new Set(prev);
          next.delete(order.orderId);
          return next;
        });
      }, 500);
    }
  };

  const handleReject = async (orderId: string) => {
    const res = await fetch(`/api/orders/${orderId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "rejected" }),
    });
    if (res.ok) {
      fetchOrders();
      toast.error("주문이 거절되었습니다");
    }
  };

  const pendingOrders = orders.filter((o) => o.status === "pending");
  const preparingOrders = orders.filter(
    (o) => o.status === "accepted" || o.status === "preparing"
  );
  const completedOrders = orders
    .filter((o) => o.status === "completed")
    .slice(0, 20);

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
                isAnimating={animatingCards.has(order.orderId)}
                animationType="accept"
                actions={
                  <>
                    <Button
                      size="sm"
                      className="transition-all duration-150 active:scale-90 hover:shadow-lg"
                      onClick={() => handleAccept(order)}
                    >
                      접수
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      className="transition-all duration-150 active:scale-90"
                      onClick={() => handleReject(order.orderId)}
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
                isAnimating={animatingCards.has(order.orderId)}
                animationType="complete"
                actions={
                  <Button
                    size="sm"
                    className="bg-green-600 hover:bg-green-700 transition-all duration-150 active:scale-90 hover:shadow-lg"
                    onClick={(e) => handleComplete(order, e)}
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
  isAnimating,
  animationType,
}: {
  order: OrderWithItems;
  actions?: React.ReactNode;
  isAnimating?: boolean;
  animationType?: "accept" | "complete";
}) {
  const cardRef = useRef<HTMLDivElement>(null);
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

  const animClass = isAnimating
    ? animationType === "accept"
      ? "scale-95 opacity-50 border-green-400 shadow-green-200 shadow-lg"
      : "scale-90 opacity-0 translate-y-4"
    : "scale-100 opacity-100 translate-y-0";

  return (
    <Card
      ref={cardRef}
      className={`transition-all duration-400 ease-in-out ${animClass}`}
    >
      {/* 접수 시 체크 오버레이 */}
      {isAnimating && animationType === "accept" && (
        <div className="absolute inset-0 flex items-center justify-center bg-green-50/80 rounded-lg z-10 animate-in fade-in duration-200">
          <CheckCircle className="w-12 h-12 text-green-500 animate-in zoom-in duration-300" />
        </div>
      )}

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
        {actions && <div className="flex gap-2 pt-2">{actions}</div>}
      </CardContent>
    </Card>
  );
}
