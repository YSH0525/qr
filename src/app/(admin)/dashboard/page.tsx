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
  const [animatingCards, setAnimatingCards] = useState<Set<string>>(new Set());
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [deferredPayments, setDeferredPayments] = useState<DeferredPayment[]>([]);
  const [showDeferred, setShowDeferred] = useState(true);
  const [todaySummary, setTodaySummary] = useState<TodaySummary | null>(null);
  const [activeTab, setActiveTab] = useState<"orders" | "services">("orders");
  const [serviceRequests, setServiceRequests] = useState<ServiceRequest[]>([]);
  const [settlementPreview, setSettlementPreview] = useState<SettlementPreviewData | null>(null);
  const [settlementModalOpen, setSettlementModalOpen] = useState(false);
  const { playNewOrderAlert, playAcceptSound, playCompleteSound, playServiceRequestAlert, speak } =
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

  const fetchServiceRequests = useCallback(async () => {
    const res = await fetch("/api/service-requests");
    if (res.ok) {
      setServiceRequests(await res.json());
    }
  }, []);

  useEffect(() => {
    fetchOrders();
    fetchDeferred();
    fetchTodaySummary();
    fetchServiceRequests();

    // SSE가 동작하지 않을 경우를 대비한 폴링 백업 (5초)
    const poll = setInterval(() => {
      fetchOrders();
      fetchDeferred();
      fetchServiceRequests();
    }, 5000);
    // 매출 요약은 30초마다 (비용이 큰 쿼리)
    const summaryPoll = setInterval(fetchTodaySummary, 30000);

    return () => {
      clearInterval(poll);
      clearInterval(summaryPoll);
    };
  }, [fetchOrders, fetchDeferred, fetchTodaySummary, fetchServiceRequests]);

  // SSE 재연결 시 전체 데이터 동기화
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
          setActiveTab("orders");

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
          fetchDeferred();
          fetchTodaySummary();
        } else if (event === "new-service-request") {
          const req = data as unknown as ServiceRequest;
          setServiceRequests((prev) => [req, ...prev]);
          setActiveTab("services");
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

  const clearAnim = (orderId: string) => {
    setAnimatingCards((prev) => {
      const next = new Set(prev);
      next.delete(orderId);
      return next;
    });
  };

  const handleAccept = async (order: OrderWithItems) => {
    setAnimatingCards((prev) => new Set(prev).add(order.orderId));
    playAcceptSound();

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
        setTimeout(() => {
          fetchOrders();
          clearAnim(order.orderId);
        }, 400);
      } else {
        toast.error("주문 접수에 실패했습니다");
        clearAnim(order.orderId);
        fetchOrders();
      }
    } catch {
      toast.error("네트워크 오류가 발생했습니다");
      clearAnim(order.orderId);
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
        setTimeout(() => {
          fetchOrders();
          clearAnim(order.orderId);
        }, 500);
      } else {
        toast.error("주문 완료 처리에 실패했습니다");
        clearAnim(order.orderId);
        fetchOrders();
      }
    } catch {
      toast.error("네트워크 오류가 발생했습니다");
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
    try {
      const res = await fetch(`/api/orders/${orderId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "rejected" }),
      });
      if (res.ok) {
        fetchOrders();
        toast.error("주문이 거절되었습니다");
      } else {
        toast.error("주문 거절에 실패했습니다");
      }
    } catch {
      toast.error("네트워크 오류가 발생했습니다");
    }
  };

  const handleServiceAccept = async (req: ServiceRequest) => {
    playAcceptSound();
    const res = await fetch(`/api/service-requests/${req.requestId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "accepted" }),
    });
    if (res.ok) {
      toast.success(`${req.roomNumber}호 ${req.categoryName} 접수!`);
      fetchServiceRequests();
    }
  };

  const handleServiceComplete = async (req: ServiceRequest) => {
    playCompleteSound();
    const res = await fetch(`/api/service-requests/${req.requestId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "completed" }),
    });
    if (res.ok) {
      toast.success(`${req.roomNumber}호 ${req.categoryName} 완료!`);
      fetchServiceRequests();
      // 유료 연장 등 후불 항목이 있을 수 있으므로 미정산 현황 갱신
      fetchDeferred();
    }
  };

  const pendingServices = serviceRequests.filter((r) => r.status === "requested");
  const acceptedServices = serviceRequests.filter((r) => r.status === "accepted");
  const allCompletedServices = serviceRequests.filter((r) => r.status === "completed");
  const completedServices = allCompletedServices.slice(0, 20);

  const pendingOrders = orders.filter((o) => o.status === "pending");
  const preparingOrders = orders.filter(
    (o) => o.status === "accepted" || o.status === "preparing"
  );
  const allCompletedOrders = orders.filter((o) => o.status === "completed");
  const completedOrders = allCompletedOrders.slice(0, 20);

  return (
    <div className="p-3 md:p-6 h-full min-h-0 flex flex-col overflow-auto md:overflow-hidden">
      <div className="flex items-center justify-between mb-4 shrink-0 flex-wrap gap-2">
        <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => setActiveTab("orders")}
            className={`px-3 md:px-4 py-2 rounded-md text-sm font-semibold transition ${
              activeTab === "orders"
                ? "bg-white shadow text-gray-900"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            주문
            {pendingOrders.length > 0 && (
              <Badge variant="destructive" className="ml-2 text-xs">
                {pendingOrders.length}
              </Badge>
            )}
          </button>
          <button
            onClick={() => setActiveTab("services")}
            className={`px-3 md:px-4 py-2 rounded-md text-sm font-semibold transition ${
              activeTab === "services"
                ? "bg-white shadow text-gray-900"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            서비스 요청
            {pendingServices.length > 0 && (
              <Badge variant="destructive" className="ml-2 text-xs">
                {pendingServices.length}
              </Badge>
            )}
          </button>
        </div>
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
          <div className="flex items-center justify-between flex-wrap gap-x-4 md:gap-x-6 gap-y-1">
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
            <div className="flex items-center gap-3 md:gap-5 text-xs md:text-sm text-gray-600 flex-wrap">
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

      {/* === 주문 탭 === */}
      {activeTab === "orders" && (
        <>
          {/* 운영 현황 Stats - 컴팩트 바 */}
          <div className="mb-4 shrink-0 bg-white border rounded-xl px-3 md:px-4 py-2.5 flex items-center gap-0 flex-wrap">
            <div className="flex items-center gap-1.5 md:gap-2 pr-3 md:pr-5">
              <span className="w-2 md:w-2.5 h-2 md:h-2.5 rounded-full bg-orange-400" />
              <span className="text-xs md:text-sm text-gray-500">신규</span>
              <span className="text-base md:text-lg font-bold text-orange-500">{pendingOrders.length}</span>
            </div>
            <div className="border-l h-5" />
            <div className="flex items-center gap-1.5 md:gap-2 px-3 md:px-5">
              <span className="w-2 md:w-2.5 h-2 md:h-2.5 rounded-full bg-blue-400" />
              <span className="text-xs md:text-sm text-gray-500">준비중</span>
              <span className="text-base md:text-lg font-bold text-blue-500">{preparingOrders.length}</span>
            </div>
            <div className="border-l h-5" />
            <div className="flex items-center gap-1.5 md:gap-2 px-3 md:px-5">
              <span className="w-2 md:w-2.5 h-2 md:h-2.5 rounded-full bg-green-400" />
              <span className="text-xs md:text-sm text-gray-500">완료</span>
              <span className="text-base md:text-lg font-bold text-green-500">{allCompletedOrders.length}</span>
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

          {/* 주문 리스트 */}
          <div className="flex flex-col min-h-0 flex-1">
            <div className="space-y-3 overflow-y-auto flex-1 pr-1">
              {/* 신규 주문 */}
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
              {/* 준비중 */}
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
              {/* 완료 */}
              {completedOrders.map((order) => (
                <OrderCard key={order.orderId} order={order} />
              ))}
              {pendingOrders.length === 0 && preparingOrders.length === 0 && allCompletedOrders.length === 0 && (
                <p className="text-gray-400 text-sm text-center py-8">
                  주문이 없습니다
                </p>
              )}
              {allCompletedOrders.length > 20 && (
                <p className="text-xs text-center text-gray-400 py-2">
                  완료된 주문 최근 20건만 표시
                </p>
              )}
            </div>
          </div>
        </>
      )}

      {/* === 서비스 요청 탭 === */}
      {activeTab === "services" && (
        <>
          {/* 서비스 현황 Stats - 컴팩트 바 */}
          <div className="mb-4 shrink-0 bg-white border rounded-xl px-3 md:px-4 py-2.5 flex items-center gap-0 flex-wrap">
            <div className="flex items-center gap-1.5 md:gap-2 pr-3 md:pr-5">
              <span className="w-2 md:w-2.5 h-2 md:h-2.5 rounded-full bg-orange-400" />
              <span className="text-xs md:text-sm text-gray-500">신규</span>
              <span className="text-base md:text-lg font-bold text-orange-500">{pendingServices.length}</span>
            </div>
            <div className="border-l h-5" />
            <div className="flex items-center gap-1.5 md:gap-2 px-3 md:px-5">
              <span className="w-2 md:w-2.5 h-2 md:h-2.5 rounded-full bg-blue-400" />
              <span className="text-xs md:text-sm text-gray-500">처리중</span>
              <span className="text-base md:text-lg font-bold text-blue-500">{acceptedServices.length}</span>
            </div>
            <div className="border-l h-5" />
            <div className="flex items-center gap-1.5 md:gap-2 pl-3 md:pl-5">
              <span className="w-2 md:w-2.5 h-2 md:h-2.5 rounded-full bg-green-400" />
              <span className="text-xs md:text-sm text-gray-500">완료</span>
              <span className="text-base md:text-lg font-bold text-green-500">{allCompletedServices.length}</span>
            </div>
          </div>

          {/* 서비스 리스트 (주문 탭과 동일한 단일 리스트) */}
          <div className="flex flex-col min-h-0 flex-1">
            <div className="space-y-3 overflow-y-auto flex-1 pr-1">
              {/* 신규 요청 */}
              {pendingServices.map((req) => (
                <ServiceCard
                  key={req.id}
                  request={req}
                  actions={
                    <Button
                      size="sm"
                      className="transition-all duration-150 active:scale-90 hover:shadow-lg"
                      onClick={() => handleServiceAccept(req)}
                    >
                      접수
                    </Button>
                  }
                />
              ))}
              {/* 처리중 */}
              {acceptedServices.map((req) => (
                <ServiceCard
                  key={req.id}
                  request={req}
                  actions={
                    <Button
                      size="sm"
                      className="bg-green-600 hover:bg-green-700 transition-all duration-150 active:scale-90 hover:shadow-lg"
                      onClick={() => handleServiceComplete(req)}
                    >
                      완료
                    </Button>
                  }
                />
              ))}
              {/* 완료 */}
              {completedServices.map((req) => (
                <ServiceCard key={req.id} request={req} />
              ))}
              {pendingServices.length === 0 && acceptedServices.length === 0 && allCompletedServices.length === 0 && (
                <p className="text-gray-400 text-sm text-center py-8">
                  서비스 요청이 없습니다
                </p>
              )}
              {allCompletedServices.length > 20 && (
                <p className="text-xs text-center text-gray-400 py-2">
                  완료된 요청 최근 20건만 표시
                </p>
              )}
            </div>
          </div>
        </>
      )}
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

  const isCompleted = order.status === "completed";
  const isPreparing = order.status === "accepted" || order.status === "preparing";

  // 스텝 계산: 0 = pending, 1 = accepted/preparing, 2 = completed
  const step = isCompleted ? 2 : isPreparing ? 1 : 0;

  const stepLabels = ["접수", "처리", "완료"];

  return (
    <Card
      ref={cardRef}
      className={`transition-all duration-400 ease-in-out ${animClass} ${isCompleted ? "opacity-60" : ""}`}
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
          <div className="flex items-center gap-2">
            <Badge
              variant={
                order.paymentMethod === "kakaopay" ? "default" : "secondary"
              }
            >
              {PAYMENT_METHOD_LABELS[order.paymentMethod]}
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
        </div>
        {actions && <div className="flex gap-2 pt-1">{actions}</div>}
      </CardContent>
    </Card>
  );
}

function ServiceCard({
  request,
  actions,
}: {
  request: ServiceRequest;
  actions?: React.ReactNode;
}) {
  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "방금 전";
    if (mins < 60) return `${mins}분 전`;
    const hours = Math.floor(mins / 60);
    return `${hours}시간 전`;
  };

  const isCompleted = request.status === "completed";
  const isAccepted = request.status === "accepted";
  const step = isCompleted ? 2 : isAccepted ? 1 : 0;
  const stepLabels = ["접수", "처리", "완료"];

  return (
    <Card className={`transition-all duration-400 ${isCompleted ? "opacity-60" : ""}`}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <span className="text-xl">{request.categoryIcon}</span>
            {request.roomNumber}호
          </CardTitle>
          <Badge variant="outline">
            {SERVICE_TYPE_LABELS[request.type]}
          </Badge>
        </div>
        <p className="text-xs text-gray-400">{timeAgo(request.createdAt)}</p>
      </CardHeader>
      <CardContent className="space-y-2">
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

        <p className="text-sm font-medium">{request.categoryName}</p>

        {/* 비품 요청 아이템 목록 */}
        {request.items && request.items.length > 0 && (
          <div className="space-y-1">
            {request.items.map((item, idx) => (
              <div key={idx} className="flex justify-between text-sm text-gray-600">
                <span>{item.name}</span>
                <span>x{item.quantity}</span>
              </div>
            ))}
          </div>
        )}

        {/* 체크아웃 연장 정보 */}
        {request.type === "checkout_extension" && request.extensionHours && (
          <div className={`text-sm p-2 rounded ${request.freeExtension ? "bg-green-50" : "bg-blue-50"}`}>
            <span className={`font-medium ${request.freeExtension ? "text-green-700" : "text-blue-700"}`}>
              +{request.extensionHours}시간 연장
            </span>
            {request.freeExtension ? (
              <span className="text-green-600 ml-2">(무료 - 리뷰)</span>
            ) : request.extensionAmount ? (
              <span className="text-blue-500 ml-2">
                ({request.extensionAmount.toLocaleString()}원 후불)
              </span>
            ) : null}
          </div>
        )}

        {/* 청소 옵션 상세 */}
        {request.type === "cleaning" && request.cleaningOptions && (
          <div className="space-y-1 text-sm">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge
                variant={
                  request.cleaningOptions.serviceLevel === "dnd"
                    ? "destructive"
                    : request.cleaningOptions.serviceLevel === "full"
                    ? "default"
                    : "secondary"
                }
              >
                {CLEANING_LEVEL_LABELS[request.cleaningOptions.serviceLevel]}
              </Badge>
              {request.cleaningOptions.preferredTime &&
                request.cleaningOptions.serviceLevel !== "dnd" && (
                  <span className="text-xs text-gray-500">
                    {PREFERRED_TIME_LABELS[request.cleaningOptions.preferredTime]}
                  </span>
                )}
            </div>
            {!request.cleaningOptions.linenChange &&
              request.cleaningOptions.serviceLevel !== "dnd" && (
                <p className="text-xs text-green-600">시트 교체 없이 정리 (Eco)</p>
              )}
            {request.cleaningOptions.contactlessSupplies.length > 0 && (
              <p className="text-xs text-sky-600">
                비대면 비품:{" "}
                {request.cleaningOptions.contactlessSupplies
                  .map((s) => SUPPLY_ITEM_LABELS[s])
                  .join(", ")}
                {request.cleaningOptions.leaveAtDoor && " (문 앞)"}
              </p>
            )}
            {request.cleaningOptions.trashRemovalOnly && (
              <p className="text-xs text-orange-600">쓰레기 수거만 요청</p>
            )}
          </div>
        )}

        {/* 메모 */}
        {request.note && (
          <p className="text-xs text-orange-600 bg-orange-50 p-2 rounded">
            메모: {request.note}
          </p>
        )}

        <div className="flex justify-between items-center pt-2 border-t">
          <span className="text-xs text-gray-400">{request.requestId}</span>
        </div>
        {actions && <div className="flex gap-2 pt-1">{actions}</div>}
      </CardContent>
    </Card>
  );
}
