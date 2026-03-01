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
import {
  CheckCircle,
  Volume2,
  Wallet,
  ChevronDown,
  ChevronUp,
  TrendingUp,
  TrendingDown,
  Clock,
} from "lucide-react";
import type { OrderWithItems } from "@/types";
import {
  ORDER_STATUS_LABELS,
  PAYMENT_METHOD_LABELS,
} from "@/types";

interface DeferredPayment {
  room: {
    id: string;
    roomNumber: string;
    roomId: string;
  };
  totalDeferred: number;
  orderCount: number;
}

interface TodaySummary {
  totalRevenue: number;
  orderCount: number;
  avgOrderValue: number;
  completionRate: number;
  comparison: {
    revenueDiff: number;
    revenueChangePercent: number;
    orderCountDiff: number;
  };
  hourlyRevenue: { hour: number; revenue: number; orders: number }[];
  paymentBreakdown: {
    kakaopay: { count: number; amount: number };
    deferred: { count: number; amount: number };
  };
}

export default function DashboardPage() {
  const [orders, setOrders] = useState<OrderWithItems[]>([]);
  const [animatingCards, setAnimatingCards] = useState<Set<string>>(new Set());
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [deferredPayments, setDeferredPayments] = useState<DeferredPayment[]>([]);
  const [showDeferred, setShowDeferred] = useState(true);
  const [todaySummary, setTodaySummary] = useState<TodaySummary | null>(null);
  const { playNewOrderAlert, playAcceptSound, playCompleteSound } =
    useNotificationSound();
  const { notify } = useBrowserNotification();

  // 사용자 클릭으로 오디오 + TTS 활성화
  const enableAudio = useCallback(() => {
    // AudioContext 활성화
    playAcceptSound();
    // TTS 활성화 (빈 텍스트로 워밍업)
    if ("speechSynthesis" in window) {
      const warm = new SpeechSynthesisUtterance("");
      warm.volume = 0;
      window.speechSynthesis.speak(warm);
    }
    setAudioEnabled(true);
    toast.success("알림 소리가 활성화되었습니다");
  }, [playAcceptSound]);

  const fetchOrders = useCallback(async () => {
    const res = await fetch("/api/orders");
    if (res.ok) {
      setOrders(await res.json());
    }
  }, []);

  const fetchDeferred = useCallback(async () => {
    const res = await fetch("/api/payments/deferred");
    if (res.ok) {
      setDeferredPayments(await res.json());
    }
  }, []);

  const fetchTodaySummary = useCallback(async () => {
    const today = new Date().toISOString().split("T")[0];
    const res = await fetch(`/api/analytics?mode=daily&date=${today}`);
    if (res.ok) {
      setTodaySummary(await res.json());
    }
  }, []);

  useEffect(() => {
    fetchOrders();
    fetchDeferred();
    fetchTodaySummary();
  }, [fetchOrders, fetchDeferred, fetchTodaySummary]);

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

          // 매출 요약 갱신
          fetchTodaySummary();

          // 후불 주문이면 미정산 현황 갱신
          if (order.paymentMethod === "deferred") {
            fetchDeferred();
          }
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
      [playNewOrderAlert, notify, fetchDeferred, fetchTodaySummary]
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
        description: "처리를 시작합니다",
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

  const handleSettle = async (roomId: string, roomNumber: string) => {
    if (!confirm(`${roomNumber}호의 후불결제를 모두 정산하시겠습니까?`)) return;

    const res = await fetch(`/api/payments/deferred/${roomId}/settle`, {
      method: "POST",
    });

    if (res.ok) {
      const data = await res.json();
      toast.success(
        `${roomNumber}호 정산 완료: ${data.settled}건, ${data.totalAmount.toLocaleString()}원`
      );
      fetchDeferred();
      fetchTodaySummary();

      // 정산내역서 새 탭으로 열기
      sessionStorage.setItem("settlementReceipt", JSON.stringify(data));
      window.open("/settlement/receipt", "_blank");
    } else {
      toast.error("정산 처리 실패");
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
    <div className="p-6 h-screen flex flex-col overflow-hidden">
      <div className="flex items-center justify-between mb-4 shrink-0">
        <h1 className="text-2xl font-bold">주문 대시보드</h1>
        {!audioEnabled && (
          <Button
            variant="outline"
            onClick={enableAudio}
            className="animate-pulse border-orange-300 text-orange-600 hover:bg-orange-50"
          >
            <Volume2 className="w-4 h-4 mr-2" />
            알림 소리 켜기
          </Button>
        )}
      </div>

      {/* 오늘 매출 요약 바 */}
      {todaySummary && (
        <div className="mb-4 shrink-0 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 rounded-xl px-5 py-3">
          <div className="flex items-center justify-between flex-wrap gap-x-6 gap-y-1">
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500">오늘 매출</span>
              <span className="text-xl font-bold text-blue-700">
                {todaySummary.totalRevenue.toLocaleString()}원
              </span>
              {todaySummary.comparison.revenueDiff !== 0 && (
                <span
                  className={`flex items-center gap-0.5 text-xs font-medium ${
                    todaySummary.comparison.revenueDiff > 0
                      ? "text-green-600"
                      : "text-red-500"
                  }`}
                >
                  {todaySummary.comparison.revenueDiff > 0 ? (
                    <TrendingUp className="w-3 h-3" />
                  ) : (
                    <TrendingDown className="w-3 h-3" />
                  )}
                  {todaySummary.comparison.revenueDiff > 0 ? "+" : ""}
                  {todaySummary.comparison.revenueChangePercent}% vs 어제
                </span>
              )}
            </div>
            <div className="flex items-center gap-5 text-sm text-gray-600">
              <span>
                주문 <strong className="text-gray-900">{todaySummary.orderCount}건</strong>
                {todaySummary.comparison.orderCountDiff !== 0 && (
                  <span
                    className={`ml-1 text-xs ${
                      todaySummary.comparison.orderCountDiff > 0
                        ? "text-green-600"
                        : "text-red-500"
                    }`}
                  >
                    ({todaySummary.comparison.orderCountDiff > 0 ? "+" : ""}
                    {todaySummary.comparison.orderCountDiff})
                  </span>
                )}
              </span>
              <span className="text-gray-300">|</span>
              <span>
                객단가 <strong className="text-gray-900">{todaySummary.avgOrderValue.toLocaleString()}원</strong>
              </span>
              <span className="text-gray-300">|</span>
              <span>
                완료율 <strong className="text-gray-900">{todaySummary.completionRate}%</strong>
              </span>
              <span className="text-gray-300">|</span>
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                피크{" "}
                <strong className="text-gray-900">
                  {todaySummary.hourlyRevenue.reduce(
                    (max, h) => (h.orders > max.orders ? h : max),
                    todaySummary.hourlyRevenue[0]
                  ).hour}시
                </strong>
              </span>
              <span className="text-gray-300">|</span>
              <span>
                카카오페이{" "}
                <strong className="text-yellow-600">
                  {todaySummary.paymentBreakdown.kakaopay.count}건
                </strong>
                {" / "}후불{" "}
                <strong className="text-blue-600">
                  {todaySummary.paymentBreakdown.deferred.count}건
                </strong>
              </span>
            </div>
          </div>
        </div>
      )}

      {/* 운영 현황 Stats */}
      <div className="grid grid-cols-4 gap-4 mb-4 shrink-0">
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
        <Card className={deferredPayments.length > 0 ? "border-red-200 bg-red-50/30" : ""}>
          <CardContent className="p-4 text-center">
            <p className={`text-3xl font-bold ${deferredPayments.length > 0 ? "text-red-500" : "text-gray-400"}`}>
              {deferredPayments.reduce((sum, p) => sum + p.totalDeferred, 0).toLocaleString()}
              <span className="text-base">원</span>
            </p>
            <p className="text-sm text-gray-500">후불 미정산</p>
          </CardContent>
        </Card>
      </div>

      {/* 후불 미정산 현황 — Stats 바로 아래 */}
      {deferredPayments.length > 0 && (
        <div className="mb-4 shrink-0">
          <button
            onClick={() => setShowDeferred((v) => !v)}
            className="flex items-center gap-2 text-sm font-semibold text-red-600 mb-2 hover:text-red-700 transition"
          >
            <Wallet className="w-4 h-4" />
            후불 미정산 현황
            <Badge variant="destructive" className="ml-1 text-xs">
              {deferredPayments.length}개 객실
            </Badge>
            {showDeferred ? (
              <ChevronUp className="w-3 h-3" />
            ) : (
              <ChevronDown className="w-3 h-3" />
            )}
          </button>

          {showDeferred && (
            <div className="flex gap-3 overflow-x-auto pb-1">
              {deferredPayments.map((p) => (
                <Card key={p.room.id} className="border-red-100 shrink-0 w-52">
                  <CardContent className="p-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-bold">{p.room.roomNumber}호 <span className="text-xs font-normal text-gray-400">{p.orderCount}건</span></p>
                      <p className="text-lg font-bold text-red-600">{p.totalDeferred.toLocaleString()}원</p>
                    </div>
                    <Button
                      size="sm"
                      className="shrink-0"
                      onClick={() =>
                        handleSettle(p.room.roomId, p.room.roomNumber)
                      }
                    >
                      정산
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 3-Column Kanban Board — 남은 공간 전부 사용, 각 컬럼 개별 스크롤 */}
      <div className="grid grid-cols-3 gap-4 min-h-0 flex-1">
        {/* Pending */}
        <div className="flex flex-col min-h-0">
          <h2 className="text-lg font-semibold mb-3 text-orange-600 shrink-0">
            신규 주문
          </h2>
          <div className="space-y-3 overflow-y-auto flex-1 pr-1">
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
        <div className="flex flex-col min-h-0">
          <h2 className="text-lg font-semibold mb-3 text-blue-600 shrink-0">준비중</h2>
          <div className="space-y-3 overflow-y-auto flex-1 pr-1">
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
        <div className="flex flex-col min-h-0">
          <h2 className="text-lg font-semibold mb-3 text-green-600 shrink-0">완료</h2>
          <div className="space-y-3 overflow-y-auto flex-1 pr-1">
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
