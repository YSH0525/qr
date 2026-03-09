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
import type { ServiceRequest } from "@/types/service";
import {
  CLEANING_LEVEL_LABELS,
  PREFERRED_TIME_LABELS,
  SUPPLY_ITEM_LABELS,
} from "@/types/service";
import {
  ORDER_STATUS_LABELS,
  PAYMENT_METHOD_LABELS,
  SERVICE_TYPE_LABELS,
  SERVICE_STATUS_LABELS,
} from "@/types";
import {
  SettlementModal,
  type SettlementPreviewData,
} from "@/components/admin/settlement-modal";

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
  const [animatingCards, setAnimatingCards] = useState<Map<string, "accept" | "complete">>(new Map());
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [deferredPayments, setDeferredPayments] = useState<DeferredPayment[]>([]);
  const [showDeferred, setShowDeferred] = useState(true);
  const [showSummary, setShowSummary] = useState(true);
  const [todaySummary, setTodaySummary] = useState<TodaySummary | null>(null);
  const [serviceRequests, setServiceRequests] = useState<ServiceRequest[]>([]);
  const [settlementPreview, setSettlementPreview] = useState<SettlementPreviewData | null>(null);
  const [settlementModalOpen, setSettlementModalOpen] = useState(false);
  const { playNewOrderAlert, playAcceptSound, playCompleteSound, playServiceRequestAlert, speak } =
    useNotificationSound();
  const { notify } = useBrowserNotification();

  // 낙관적 업데이트 시 진행 중인 폴링 응답을 무효화하는 버전 카운터
  const ordersVersionRef = useRef(0);
  const servicesVersionRef = useRef(0);

  // 사용자 클릭으로 오디오 + TTS 활성화
  const enableAudio = useCallback(() => {
    playAcceptSound();
    if ("speechSynthesis" in window) {
      const warm = new SpeechSynthesisUtterance("");
      warm.volume = 0;
      window.speechSynthesis.speak(warm);
    }
    setAudioEnabled(true);
    toast.success("알림 소리가 활성화되었습니다");
  }, [playAcceptSound]);

  const fetchOrders = useCallback(async () => {
    const version = ordersVersionRef.current;
    const res = await fetch("/api/orders");
    if (res.ok) {
      const data = await res.json();
      if (version !== ordersVersionRef.current) return;
      setOrders(data);
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

  const fetchServiceRequests = useCallback(async () => {
    const version = servicesVersionRef.current;
    const res = await fetch("/api/service-requests");
    if (res.ok) {
      const data = await res.json();
      if (version !== servicesVersionRef.current) return;
      setServiceRequests(data);
    }
  }, []);

  useEffect(() => {
    fetchOrders();
    fetchDeferred();
    fetchTodaySummary();
    fetchServiceRequests();

    const poll = setInterval(() => {
      fetchOrders();
      fetchDeferred();
      fetchServiceRequests();
    }, 5000);
    const summaryPoll = setInterval(fetchTodaySummary, 30000);

    return () => {
      clearInterval(poll);
      clearInterval(summaryPoll);
    };
  }, [fetchOrders, fetchDeferred, fetchTodaySummary, fetchServiceRequests]);

  const handleSSEReconnect = useCallback(() => {
    fetchOrders();
    fetchDeferred();
    fetchTodaySummary();
    fetchServiceRequests();
  }, [fetchOrders, fetchDeferred, fetchTodaySummary, fetchServiceRequests]);

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

          toast.success(`새 주문! ${order.roomNumber}호`, {
            description: itemText || undefined,
          });

          fetchTodaySummary();

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
          fetchDeferred();
          fetchTodaySummary();
        } else if (event === "new-service-request") {
          const req = data as unknown as ServiceRequest;
          setServiceRequests((prev) => [req, ...prev]);
          playServiceRequestAlert(req.roomNumber, req.categoryName);
          notify(`서비스 요청! ${req.roomNumber}호`, req.categoryName);
          toast.success(`서비스 요청! ${req.roomNumber}호 — ${req.categoryName}`);
          if (req.freeExtension === false && req.extensionAmount) {
            fetchDeferred();
          }
        } else if (event === "service-request-updated") {
          setServiceRequests((prev) =>
            prev.map((r) =>
              r.requestId === (data as Record<string, unknown>).requestId
                ? { ...r, ...(data as Partial<ServiceRequest>) }
                : r
            )
          );
          fetchDeferred();
        }
      },
      [playNewOrderAlert, playServiceRequestAlert, notify, fetchDeferred, fetchTodaySummary]
    ),
    handleSSEReconnect
  );

  const clearAnim = (id: string) => {
    setAnimatingCards((prev) => {
      const next = new Map(prev);
      next.delete(id);
      return next;
    });
  };

  const updateOrderStatus = (orderId: string, status: string) => {
    ordersVersionRef.current++;
    setOrders((prev) =>
      prev.map((o) =>
        o.orderId === orderId
          ? { ...o, status: status as OrderWithItems["status"], updatedAt: new Date().toISOString() }
          : o
      )
    );
  };

  const updateServiceStatus = (requestId: string, status: string) => {
    servicesVersionRef.current++;
    setServiceRequests((prev) =>
      prev.map((r) =>
        r.requestId === requestId
          ? { ...r, status: status as ServiceRequest["status"], updatedAt: new Date().toISOString() }
          : r
      )
    );
  };

  const handleAccept = async (order: OrderWithItems) => {
    setAnimatingCards((prev) => new Map(prev).set(order.orderId, "accept"));
    playAcceptSound();
    updateOrderStatus(order.orderId, "accepted");

    try {
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
        setTimeout(() => clearAnim(order.orderId), 400);
      } else {
        toast.error("주문 접수에 실패했습니다");
        updateOrderStatus(order.orderId, "pending");
        clearAnim(order.orderId);
      }
    } catch {
      toast.error("네트워크 오류가 발생했습니다");
      updateOrderStatus(order.orderId, "pending");
      clearAnim(order.orderId);
    }
  };

  const handleComplete = async (
    order: OrderWithItems,
    e: React.MouseEvent
  ) => {
    setAnimatingCards((prev) => new Map(prev).set(order.orderId, "complete"));
    playCompleteSound();

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

    const prevStatus = order.status;
    updateOrderStatus(order.orderId, "completed");

    try {
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
        setTimeout(() => clearAnim(order.orderId), 500);
      } else {
        toast.error("주문 완료 처리에 실패했습니다");
        updateOrderStatus(order.orderId, prevStatus);
        clearAnim(order.orderId);
      }
    } catch {
      toast.error("네트워크 오류가 발생했습니다");
      updateOrderStatus(order.orderId, prevStatus);
      clearAnim(order.orderId);
    }
  };

  const handleSettle = async (roomId: string, _roomNumber: string) => {
    const res = await fetch(`/api/payments/deferred/${roomId}/preview`);
    if (res.ok) {
      const data: SettlementPreviewData = await res.json();
      setSettlementPreview(data);
      setSettlementModalOpen(true);
    } else {
      toast.error("정산 내역 조회 실패");
    }
  };

  const handleSettleConfirm = async () => {
    if (!settlementPreview) return;

    const res = await fetch(
      `/api/payments/deferred/${settlementPreview.roomId}/settle`,
      { method: "POST" }
    );

    if (res.ok) {
      const data = await res.json();
      toast.success(
        `${settlementPreview.roomNumber}호 정산 완료: ${data.settled}건, ${data.totalAmount.toLocaleString()}원`
      );
      fetchDeferred();
      fetchTodaySummary();
    } else {
      toast.error("정산 처리 실패");
    }
  };

  const handleReject = async (orderId: string) => {
    updateOrderStatus(orderId, "rejected");

    try {
      const res = await fetch(`/api/orders/${orderId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "rejected" }),
      });
      if (res.ok) {
        toast.error("주문이 거절되었습니다");
      } else {
        toast.error("주문 거절에 실패했습니다");
        updateOrderStatus(orderId, "pending");
      }
    } catch {
      toast.error("네트워크 오류가 발생했습니다");
      updateOrderStatus(orderId, "pending");
    }
  };

  const handleServiceAccept = async (req: ServiceRequest) => {
    playAcceptSound();
    updateServiceStatus(req.requestId, "accepted");

    const res = await fetch(`/api/service-requests/${req.requestId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "accepted" }),
    });
    if (res.ok) {
      toast.success(`${req.roomNumber}호 ${req.categoryName} 접수!`);
    } else {
      toast.error("서비스 접수에 실패했습니다");
      updateServiceStatus(req.requestId, "requested");
    }
  };

  const handleServiceComplete = async (req: ServiceRequest) => {
    playCompleteSound();
    updateServiceStatus(req.requestId, "completed");

    const res = await fetch(`/api/service-requests/${req.requestId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "completed" }),
    });
    if (res.ok) {
      toast.success(`${req.roomNumber}호 ${req.categoryName} 완료!`);
      fetchDeferred();
    } else {
      toast.error("서비스 완료 처리에 실패했습니다");
      updateServiceStatus(req.requestId, "accepted");
    }
  };

  // 주문 분류: 활성 상태만 표시 (rejected/cancelled 제외)
  const activeOrders = orders.filter(
    (o) => o.status !== "rejected" && o.status !== "cancelled"
  );
  const pendingOrders = activeOrders.filter((o) => o.status === "pending");
  const preparingOrders = activeOrders.filter(
    (o) => o.status === "accepted" || o.status === "preparing"
  );
  const completedOrders = activeOrders.filter((o) => o.status === "completed").slice(0, 10);

  // 서비스 분류
  const pendingServices = serviceRequests.filter((r) => r.status === "requested");
  const acceptedServices = serviceRequests.filter((r) => r.status === "accepted");
  const completedServices = serviceRequests.filter((r) => r.status === "completed").slice(0, 10);

  const totalPending = pendingOrders.length + pendingServices.length;
  const totalProcessing = preparingOrders.length + acceptedServices.length;
  const totalCompleted = completedOrders.length + completedServices.length;

  // 정렬된 개별 카드 목록: 대기 → 처리중 → 완료
  const sortedOrders = [...pendingOrders, ...preparingOrders, ...completedOrders];
  const sortedServices = [...pendingServices, ...acceptedServices, ...completedServices];

  return (
    <div className="p-3 md:p-6 h-full min-h-0 flex flex-col overflow-auto md:overflow-hidden">
      <div className="flex items-center justify-between mb-4 shrink-0 flex-wrap gap-2">
        <h1 className="text-lg md:text-xl font-bold">운영 현황</h1>
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
          <button
            onClick={() => setShowSummary((v) => !v)}
            className="w-full flex items-center justify-between"
          >
            <div className="flex items-center gap-2">
              <span className="text-xs md:text-sm text-gray-500">오늘 매출</span>
              <span className="text-lg md:text-xl font-bold text-blue-700">
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
            {showSummary ? (
              <ChevronUp className="w-4 h-4 text-gray-400 shrink-0" />
            ) : (
              <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />
            )}
          </button>
          {showSummary && (
            <div className="flex items-center gap-3 md:gap-5 text-xs md:text-sm text-gray-600 flex-wrap mt-2">
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
          )}
        </div>
      )}

      {/* Stats 바 */}
      <div className="mb-4 shrink-0 bg-white border rounded-xl px-3 md:px-4 py-2.5 flex items-center gap-0 flex-wrap">
        <div className="flex items-center gap-1.5 md:gap-2 pr-3 md:pr-5">
          <span className="w-2 md:w-2.5 h-2 md:h-2.5 rounded-full bg-orange-400" />
          <span className="text-xs md:text-sm text-gray-500">신규</span>
          <span className="text-base md:text-lg font-bold text-orange-500">{totalPending}</span>
        </div>
        <div className="border-l h-5" />
        <div className="flex items-center gap-1.5 md:gap-2 px-3 md:px-5">
          <span className="w-2 md:w-2.5 h-2 md:h-2.5 rounded-full bg-blue-400" />
          <span className="text-xs md:text-sm text-gray-500">처리중</span>
          <span className="text-base md:text-lg font-bold text-blue-500">{totalProcessing}</span>
        </div>
        <div className="border-l h-5" />
        <div className="flex items-center gap-1.5 md:gap-2 px-3 md:px-5">
          <span className="w-2 md:w-2.5 h-2 md:h-2.5 rounded-full bg-green-400" />
          <span className="text-xs md:text-sm text-gray-500">완료</span>
          <span className="text-base md:text-lg font-bold text-green-500">{totalCompleted}</span>
        </div>
        <div className="border-l h-5 hidden md:block" />
        <div className={`flex items-center gap-1.5 md:gap-2 pl-3 md:pl-5 ${deferredPayments.length > 0 ? "" : "opacity-40"}`}>
          <span className={`w-2 md:w-2.5 h-2 md:h-2.5 rounded-full ${deferredPayments.length > 0 ? "bg-red-400" : "bg-gray-300"}`} />
          <span className="text-xs md:text-sm text-gray-500">미정산</span>
          <span className={`text-base md:text-lg font-bold ${deferredPayments.length > 0 ? "text-red-500" : "text-gray-400"}`}>
            {deferredPayments.reduce((sum, p) => sum + p.totalDeferred, 0).toLocaleString()}
            <span className="text-xs font-normal ml-0.5">원</span>
          </span>
        </div>
      </div>

      {/* 후불 미정산 현황 */}
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
                <Card key={p.room.id} className="border-red-100 shrink-0 w-44 md:w-52">
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

      {/* 개별 카드 리스트 */}
      <div className="flex flex-col min-h-0 flex-1">
        <div className="space-y-3 overflow-y-auto flex-1 pr-1">
          {/* 주문 카드 (건별) */}
          {sortedOrders.map((order) => (
            <OrderCard
              key={order.orderId}
              order={order}
              animatingCards={animatingCards}
              onAccept={handleAccept}
              onComplete={handleComplete}
              onReject={handleReject}
            />
          ))}

          {/* 서비스 요청 카드 (건별) */}
          {sortedServices.map((req) => (
            <ServiceCard
              key={req.requestId}
              request={req}
              onAccept={handleServiceAccept}
              onComplete={handleServiceComplete}
            />
          ))}

          {sortedOrders.length === 0 && sortedServices.length === 0 && (
            <p className="text-gray-400 text-sm text-center py-8">
              주문 및 서비스 요청이 없습니다
            </p>
          )}
        </div>
      </div>

      <SettlementModal
        open={settlementModalOpen}
        onClose={() => {
          setSettlementModalOpen(false);
          setSettlementPreview(null);
        }}
        preview={settlementPreview}
        onConfirm={handleSettleConfirm}
      />
    </div>
  );
}

/* ── 주문 개별 카드 ── */
function OrderCard({
  order,
  animatingCards,
  onAccept,
  onComplete,
  onReject,
}: {
  order: OrderWithItems;
  animatingCards: Map<string, "accept" | "complete">;
  onAccept: (order: OrderWithItems) => void;
  onComplete: (order: OrderWithItems, e: React.MouseEvent) => void;
  onReject: (orderId: string) => void;
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

  const animType = animatingCards.get(order.orderId);
  const isAnimating = !!animType;

  const animClass = isAnimating
    ? animType === "accept"
      ? "scale-95 opacity-50 border-green-400 shadow-green-200 shadow-lg"
      : "scale-90 opacity-0 translate-y-4"
    : "scale-100 opacity-100 translate-y-0";

  const isCompleted = order.status === "completed";

  // 스텝 인디케이터
  const step = order.status === "pending" ? 0
    : order.status === "completed" ? 2
    : 1;
  const stepLabels = ["접수", "처리", "완료"];

  return (
    <Card
      className={`relative transition-all duration-300 ease-in-out ${animClass} ${isCompleted ? "opacity-60" : ""}`}
    >
      {/* 접수 시 체크 오버레이 */}
      {isAnimating && animType === "accept" && (
        <div className="absolute inset-0 flex items-center justify-center bg-green-50/80 rounded-lg z-10 animate-in fade-in duration-200">
          <CheckCircle className="w-12 h-12 text-green-500 animate-in zoom-in duration-300" />
        </div>
      )}

      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">{order.roomNumber}호</CardTitle>
          <div className="flex items-center gap-2">
            <Badge
              variant={order.paymentMethod === "kakaopay" ? "default" : "secondary"}
              className="text-[10px]"
            >
              {PAYMENT_METHOD_LABELS[order.paymentMethod]}
            </Badge>
            <Badge
              variant={
                order.status === "pending" ? "destructive"
                  : order.status === "completed" ? "outline"
                  : "secondary"
              }
              className="text-[10px]"
            >
              {ORDER_STATUS_LABELS[order.status]}
            </Badge>
          </div>
        </div>
        <p className="text-xs text-gray-400">{timeAgo(order.createdAt)}</p>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* 스텝 인디케이터 */}
        <div className="flex items-center gap-0 px-2">
          {stepLabels.map((label, i) => (
            <div key={label} className="flex items-center flex-1 last:flex-none">
              <div className="flex flex-col items-center">
                <div
                  className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white ${
                    i <= step
                      ? isCompleted
                        ? "bg-green-500"
                        : "bg-blue-500"
                      : "bg-gray-200"
                  }`}
                >
                  {i <= step ? "✓" : i + 1}
                </div>
                <span
                  className={`text-[10px] mt-1 ${
                    i <= step
                      ? isCompleted
                        ? "text-green-600 font-semibold"
                        : "text-blue-600 font-semibold"
                      : "text-gray-400"
                  }`}
                >
                  {label}
                </span>
              </div>
              {i < stepLabels.length - 1 && (
                <div
                  className={`flex-1 h-0.5 mx-1 mt-[-12px] ${
                    i < step
                      ? isCompleted
                        ? "bg-green-500"
                        : "bg-blue-500"
                      : "bg-gray-200"
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        {/* 메뉴 아이템 */}
        <div className="space-y-1">
          {order.items.map((item, idx) => (
            <div key={idx} className="flex justify-between text-sm">
              <span>{item.menuItemName} x{item.quantity}</span>
              <span className="text-gray-500">{formatPrice(item.subtotal)}</span>
            </div>
          ))}
        </div>

        {order.note && (
          <p className="text-xs text-orange-600 bg-orange-50 p-2 rounded">
            요청: {order.note}
          </p>
        )}

        <div className="flex justify-between items-center">
          <span className="font-semibold">{formatPrice(order.totalAmount)}</span>
          <div className="flex gap-2">
            {order.status === "pending" && (
              <>
                <Button
                  size="sm"
                  className="transition-all duration-150 active:scale-90 hover:shadow-lg"
                  onClick={() => onAccept(order)}
                >
                  접수
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  className="transition-all duration-150 active:scale-90"
                  onClick={() => onReject(order.orderId)}
                >
                  거절
                </Button>
              </>
            )}
            {(order.status === "accepted" || order.status === "preparing") && (
              <Button
                size="sm"
                className="bg-green-600 hover:bg-green-700 transition-all duration-150 active:scale-90 hover:shadow-lg"
                onClick={(e) => onComplete(order, e)}
              >
                완료
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/* ── 서비스 요청 개별 카드 ── */
function ServiceCard({
  request: req,
  onAccept,
  onComplete,
}: {
  request: ServiceRequest;
  onAccept: (req: ServiceRequest) => void;
  onComplete: (req: ServiceRequest) => void;
}) {
  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "방금 전";
    if (mins < 60) return `${mins}분 전`;
    const hours = Math.floor(mins / 60);
    return `${hours}시간 전`;
  };

  const isCompleted = req.status === "completed";

  return (
    <Card className={`transition-all duration-300 ${isCompleted ? "opacity-60" : ""}`}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">{req.categoryIcon}</span>
            <CardTitle className="text-lg">{req.roomNumber}호</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-[10px]">
              {SERVICE_TYPE_LABELS[req.type]}
            </Badge>
            <Badge
              variant={
                req.status === "requested" ? "destructive"
                  : req.status === "completed" ? "outline"
                  : "secondary"
              }
              className="text-[10px]"
            >
              {SERVICE_STATUS_LABELS[req.status]}
            </Badge>
          </div>
        </div>
        <p className="text-xs text-gray-400">{timeAgo(req.createdAt)}</p>
      </CardHeader>

      <CardContent className="space-y-2">
        <p className="text-sm font-medium">{req.categoryName}</p>

        {/* 비품 요청 아이템 */}
        {req.items && req.items.length > 0 && (
          <div className="space-y-1">
            {req.items.map((item, idx) => (
              <div key={idx} className="flex justify-between text-sm text-gray-600">
                <span>{item.name}</span>
                <span>x{item.quantity}</span>
              </div>
            ))}
          </div>
        )}

        {/* 체크아웃 연장 정보 */}
        {req.type === "checkout_extension" && req.extensionHours && (
          <div className={`text-sm p-2 rounded ${req.freeExtension ? "bg-green-50" : "bg-blue-50"}`}>
            <span className={`font-medium ${req.freeExtension ? "text-green-700" : "text-blue-700"}`}>
              +{req.extensionHours}시간 연장
            </span>
            {req.freeExtension ? (
              <span className="text-green-600 ml-2">(무료 - 리뷰)</span>
            ) : req.extensionAmount ? (
              <span className="text-blue-500 ml-2">
                ({req.extensionAmount.toLocaleString()}원 후불)
              </span>
            ) : null}
          </div>
        )}

        {/* 청소 옵션 상세 */}
        {req.type === "cleaning" && req.cleaningOptions && (
          <div className="space-y-1 text-sm">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge
                variant={
                  req.cleaningOptions.serviceLevel === "dnd"
                    ? "destructive"
                    : req.cleaningOptions.serviceLevel === "full"
                    ? "default"
                    : "secondary"
                }
              >
                {CLEANING_LEVEL_LABELS[req.cleaningOptions.serviceLevel]}
              </Badge>
              {req.cleaningOptions.preferredTime &&
                req.cleaningOptions.serviceLevel !== "dnd" && (
                  <span className="text-xs text-gray-500">
                    {PREFERRED_TIME_LABELS[req.cleaningOptions.preferredTime]}
                  </span>
                )}
            </div>
            {!req.cleaningOptions.linenChange &&
              req.cleaningOptions.serviceLevel !== "dnd" && (
                <p className="text-xs text-green-600">시트 교체 없이 정리 (Eco)</p>
              )}
            {req.cleaningOptions.contactlessSupplies.length > 0 && (
              <p className="text-xs text-sky-600">
                비대면 비품:{" "}
                {req.cleaningOptions.contactlessSupplies
                  .map((s) => SUPPLY_ITEM_LABELS[s])
                  .join(", ")}
                {req.cleaningOptions.leaveAtDoor && " (문 앞)"}
              </p>
            )}
            {req.cleaningOptions.trashRemovalOnly && (
              <p className="text-xs text-orange-600">쓰레기 수거만 요청</p>
            )}
          </div>
        )}

        {/* 메모 */}
        {req.note && (
          <p className="text-xs text-orange-600 bg-orange-50 p-2 rounded">
            메모: {req.note}
          </p>
        )}

        {/* 액션 버튼 */}
        <div className="flex justify-end gap-2">
          {req.status === "requested" && (
            <Button
              size="sm"
              className="transition-all duration-150 active:scale-90 hover:shadow-lg"
              onClick={() => onAccept(req)}
            >
              접수
            </Button>
          )}
          {req.status === "accepted" && (
            <Button
              size="sm"
              className="bg-green-600 hover:bg-green-700 transition-all duration-150 active:scale-90 hover:shadow-lg"
              onClick={() => onComplete(req)}
            >
              완료
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
