"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSocketOrders } from "@/hooks/use-socket-orders";
import { useSocketDeferred } from "@/hooks/use-socket-deferred";
import { useNotificationSound } from "@/hooks/use-audio";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { Volume2, Trash2 } from "lucide-react";
import type { OrderWithItems } from "@/types";
import {
  ORDER_STATUS_LABELS,
  ORDER_TYPE_LABELS,
  PAYMENT_METHOD_LABELS,
  REJECTION_REASONS,
} from "@/types";
import {
  CLEANING_LEVEL_LABELS,
  PREFERRED_TIME_LABELS,
  SUPPLY_ITEM_LABELS,
} from "@/types/service";
import {
  SettlementModal,
  type SettlementPreviewData,
} from "@/components/admin/settlement-modal";

const DASHBOARD_STATUSES = ["pending", "accepted", "preparing"];

/* ── 상태별 행 배경색 ── */
const ROW_BG: Record<string, string> = {
  pending: "bg-red-50",
  accepted: "bg-blue-50",
  preparing: "bg-yellow-50",
};

export default function DashboardPage() {
  const {
    orders,
    optimisticUpdate,
    releaseOptimisticLock,
  } = useSocketOrders(DASHBOARD_STATUSES);

  const [audioEnabled, setAudioEnabled] = useState(false);
  const [flashScreen, setFlashScreen] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(interval);
  }, []);
  const { deferredPayments, fetchDeferred } = useSocketDeferred();
  const [settlementPreview, setSettlementPreview] = useState<SettlementPreviewData | null>(null);
  const [settlementModalOpen, setSettlementModalOpen] = useState(false);
  const { playNewOrderAlert, playAcceptSound, playCompleteSound } =
    useNotificationSound();

  // 새 주문 감지
  const prevOrderIdsRef = useRef<Set<string>>(new Set());
  const isFirstLoadRef = useRef(true);

  useEffect(() => {
    if (orders.length === 0 && isFirstLoadRef.current) return;
    const currentIds = new Set(orders.map((o) => o.orderId));
    if (isFirstLoadRef.current) {
      prevOrderIdsRef.current = currentIds;
      isFirstLoadRef.current = false;
      return;
    }
    let hasNew = false;
    for (const order of orders) {
      if (!prevOrderIdsRef.current.has(order.orderId)) {
        playNewOrderAlert();
        hasNew = true;
      }
    }
    if (hasNew) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- flash screen on new order notification
      setFlashScreen(true);
      setTimeout(() => setFlashScreen(false), 2000);
    }
    prevOrderIdsRef.current = currentIds;
  }, [orders, playNewOrderAlert]);

  const enableAudio = useCallback(() => {
    playAcceptSound();
    setAudioEnabled(true);
  }, [playAcceptSound]);

  /* ── 핸들러 ── */
  const patchOrder = async (orderId: string, status: string, rollback: string, extra?: Record<string, unknown>) => {
    try {
      const res = await fetch(`/api/orders/${orderId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, ...extra }),
      });
      if (res.ok) {
        releaseOptimisticLock(orderId);
        return true;
      }
      optimisticUpdate(orderId, { status: rollback as OrderWithItems["status"] });
      releaseOptimisticLock(orderId);
      return false;
    } catch {
      optimisticUpdate(orderId, { status: rollback as OrderWithItems["status"] });
      releaseOptimisticLock(orderId);
      return false;
    }
  };

  const handleAccept = async (order: OrderWithItems) => {
    playAcceptSound();
    const nextStatus = order.type === "product" ? "preparing" : "accepted";
    optimisticUpdate(order.orderId, { status: nextStatus as OrderWithItems["status"], updatedAt: new Date().toISOString() });
    const ok = await patchOrder(order.orderId, nextStatus, "pending");
    const label = order.type === "product" ? "주문" : ORDER_TYPE_LABELS[order.type];
    toast[ok ? "success" : "error"](ok ? `${order.roomNumber}호 ${label} 접수!` : "접수에 실패했습니다");
  };

  const handleComplete = async (order: OrderWithItems) => {
    playCompleteSound();
    const prevStatus = order.status;
    optimisticUpdate(order.orderId, { status: "completed", updatedAt: new Date().toISOString() });
    const ok = await patchOrder(order.orderId, "completed", prevStatus);
    const label = order.type === "product" ? "주문" : ORDER_TYPE_LABELS[order.type];
    toast[ok ? "success" : "error"](ok ? `${order.roomNumber}호 ${label} 완료!` : "완료 처리에 실패했습니다");
    if (ok) fetchDeferred();
  };

  const handleReject = async (orderId: string, rejectionReason: string) => {
    optimisticUpdate(orderId, { status: "rejected" as OrderWithItems["status"], updatedAt: new Date().toISOString() });
    const ok = await patchOrder(orderId, "rejected", "pending", { rejectionReason });
    if (ok) toast.error("주문이 거절되었습니다");
    else toast.error("주문 거절에 실패했습니다");
  };

  const handleSettle = async (roomId: string) => {
    const res = await fetch(`/api/payments/deferred/${roomId}/preview`);
    if (res.ok) {
      setSettlementPreview(await res.json());
      setSettlementModalOpen(true);
    } else {
      toast.error("정산 내역 조회 실패");
    }
  };

  const handleSettleConfirm = async () => {
    if (!settlementPreview) return;
    const res = await fetch(`/api/payments/deferred/${settlementPreview.roomId}/settle`, { method: "POST" });
    if (res.ok) {
      const data = await res.json();
      toast.success(`${settlementPreview.roomNumber}호 정산 완료: ${data.settled}건, ${data.totalAmount.toLocaleString()}원`);
      fetchDeferred();
    } else {
      toast.error("정산 처리 실패");
    }
  };

  const handleDelete = async (order: OrderWithItems) => {
    optimisticUpdate(order.orderId, { status: "rejected" as OrderWithItems["status"] });
    const res = await fetch(`/api/orders/${order.orderId}`, { method: "DELETE" });
    if (res.ok) {
      releaseOptimisticLock(order.orderId);
      const label = order.type === "product" ? "주문" : ORDER_TYPE_LABELS[order.type];
      toast.success(`${order.roomNumber}호 ${label} 삭제됨`);
    } else {
      optimisticUpdate(order.orderId, { status: order.status });
      releaseOptimisticLock(order.orderId);
      toast.error("삭제에 실패했습니다");
    }
  };

  /* ── 활성 주문 (최신순) ── */
  const activeOrders = orders
    .filter((o) => o.status !== "rejected" && o.status !== "cancelled")
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const timeAgo = useCallback((dateStr: string) => {
    const diff = now - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "방금 전";
    if (mins < 60) return `${mins}분 전`;
    return `${Math.floor(mins / 60)}시간 전`;
  }, [now]);

  const formatPrice = (n: number) => n.toLocaleString("ko-KR") + "원";

  const summarize = (order: OrderWithItems) => {
    if (order.type === "product") {
      return order.items.map((i) => `${i.menuItemName}x${i.quantity}`).join(", ");
    }
    if (order.type === "checkout_extension" && order.extensionHours) {
      return `+${order.extensionHours}h 연장${order.freeExtension ? " (무료)" : order.extensionAmount ? ` ${formatPrice(order.extensionAmount)}` : ""}`;
    }
    if (order.type === "cleaning" && order.cleaningOptions) {
      const co = order.cleaningOptions;
      const parts: string[] = [CLEANING_LEVEL_LABELS[co.serviceLevel]];
      if (co.preferredTime && co.serviceLevel !== "dnd") {
        parts.push(PREFERRED_TIME_LABELS[co.preferredTime]);
      }
      if (!co.linenChange && co.serviceLevel !== "dnd") {
        parts.push("시트교체 없음");
      }
      if (co.contactlessSupplies.length > 0) {
        parts.push("비품: " + co.contactlessSupplies.map((i: keyof typeof SUPPLY_ITEM_LABELS) => SUPPLY_ITEM_LABELS[i]).join(", "));
      }
      if (co.trashRemovalOnly) {
        parts.push("쓰레기 수거만");
      }
      return parts.join(" · ");
    }
    if (order.serviceItems?.length) return order.serviceItems.map((i) => `${i.name}x${i.quantity}`).join(", ");
    return order.categoryName || ORDER_TYPE_LABELS[order.type];
  };

  /* ── 렌더 ── */
  return (
    <div className="relative p-3 md:p-6 h-full min-h-0 flex flex-col overflow-auto md:overflow-hidden">
      {flashScreen && (
        <div className="absolute inset-0 z-50 pointer-events-none animate-flash-overlay rounded-lg" />
      )}
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-3 shrink-0 flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <h1 className="text-lg md:text-xl font-bold">운영 현황</h1>
          <Badge variant="secondary" className="text-xs">
            활성 {activeOrders.length}
          </Badge>
        </div>
        {!audioEnabled && (
          <Button variant="outline" onClick={enableAudio} className="animate-pulse border-orange-300 text-orange-600 hover:bg-orange-50">
            <Volume2 className="w-4 h-4 mr-2" />
            알림 소리 켜기
          </Button>
        )}
      </div>

      {/* 후불 미정산 */}
      {deferredPayments.length > 0 && (
        <div className="mb-3 shrink-0 flex gap-2 overflow-x-auto pb-1">
          {deferredPayments.map((p) => (
            <button
              key={p.room.id}
              onClick={() => handleSettle(p.room.roomId)}
              className="shrink-0 flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 hover:bg-red-100 transition"
            >
              <span className="text-sm font-bold">{p.room.roomNumber}호</span>
              <span className="text-sm font-bold text-red-600">{p.totalDeferred.toLocaleString()}원</span>
              <span className="text-[10px] text-gray-400">{p.orderCount}건</span>
            </button>
          ))}
        </div>
      )}

      {/* 활성 목록 */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {activeOrders.length > 0 ? (
          <>
            {/* 데스크탑 테이블 */}
            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">#</TableHead>
                    <TableHead className="w-16">객실</TableHead>
                    <TableHead className="w-16">유형</TableHead>
                    <TableHead>내용</TableHead>
                    <TableHead className="w-20">결제</TableHead>
                    <TableHead className="w-16">상태</TableHead>
                    <TableHead className="w-16">시간</TableHead>
                    <TableHead className="w-36 text-right">처리</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activeOrders.map((order, idx) => (
                    <TableRow key={order.orderId} className={ROW_BG[order.status]}>
                      <TableCell className="font-mono text-xs text-gray-400">
                        {order.dailySeq ?? idx + 1}
                      </TableCell>
                      <TableCell className="font-semibold">
                        {order.roomNumber}호
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px]">
                          {ORDER_TYPE_LABELS[order.type]}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm max-w-xs truncate">
                        {summarize(order)}
                        {order.note && (
                          <span className="text-orange-500 ml-2 text-xs">
                            [{order.note}]
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs">
                        {order.paymentMethod ? (
                          <Badge variant="secondary" className="text-[10px]">
                            {PAYMENT_METHOD_LABELS[order.paymentMethod]}
                          </Badge>
                        ) : (
                          <span className="text-gray-300">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={order.status === "pending" ? "destructive" : "secondary"}
                          className="text-[10px]"
                        >
                          {ORDER_STATUS_LABELS[order.status]}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-gray-400">
                        {timeAgo(order.createdAt)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-1 justify-end">
                          <OrderActions
                            order={order}
                            onAccept={handleAccept}
                            onComplete={handleComplete}
                            onReject={handleReject}
                            onDelete={handleDelete}
                          />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* 모바일 리스트 */}
            <div className="md:hidden space-y-2">
              {activeOrders.map((order, idx) => (
                <div key={order.orderId} className={`rounded-lg border p-3 ${ROW_BG[order.status]}`}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-400 font-mono">
                        #{order.dailySeq ?? idx + 1}
                      </span>
                      <span className="font-semibold text-sm">
                        {order.roomNumber}호
                      </span>
                      <Badge variant="outline" className="text-[10px]">
                        {ORDER_TYPE_LABELS[order.type]}
                      </Badge>
                    </div>
                    <span className="text-xs text-gray-400">{timeAgo(order.createdAt)}</span>
                  </div>
                  <p className="text-sm text-gray-700 truncate mb-2">{summarize(order)}</p>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1">
                      <Badge
                        variant={order.status === "pending" ? "destructive" : "secondary"}
                        className="text-[10px]"
                      >
                        {ORDER_STATUS_LABELS[order.status]}
                      </Badge>
                      {order.paymentMethod && (
                        <Badge variant="secondary" className="text-[10px]">
                          {PAYMENT_METHOD_LABELS[order.paymentMethod]}
                        </Badge>
                      )}
                    </div>
                    <div className="flex gap-1">
                      <OrderActions
                        order={order}
                        onAccept={handleAccept}
                        onComplete={handleComplete}
                        onReject={handleReject}
                        onDelete={handleDelete}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <p className="text-gray-400 text-sm text-center py-12">주문 및 서비스 요청이 없습니다</p>
        )}
      </div>

      <SettlementModal
        open={settlementModalOpen}
        onClose={() => { setSettlementModalOpen(false); setSettlementPreview(null); }}
        preview={settlementPreview}
        onConfirm={handleSettleConfirm}
      />
    </div>
  );
}

/* ── 주문 액션 버튼 (통합) ── */
function OrderActions({
  order,
  onAccept,
  onComplete,
  onReject,
  onDelete,
}: {
  order: OrderWithItems;
  onAccept: (o: OrderWithItems) => void;
  onComplete: (o: OrderWithItems) => void;
  onReject: (id: string, reason: string) => void;
  onDelete: (o: OrderWithItems) => void;
}) {
  const [showRejectReasons, setShowRejectReasons] = useState(false);

  if (showRejectReasons) {
    return (
      <div className="flex flex-wrap gap-1">
        {REJECTION_REASONS.map((r) => (
          <Button
            key={r.value}
            size="sm"
            variant="destructive"
            className="text-xs px-2 py-1 h-7"
            onClick={() => {
              onReject(order.orderId, r.value);
              setShowRejectReasons(false);
            }}
          >
            {r.label}
          </Button>
        ))}
        <Button
          size="sm"
          variant="outline"
          className="text-xs px-2 py-1 h-7"
          onClick={() => setShowRejectReasons(false)}
        >
          취소
        </Button>
      </div>
    );
  }

  return (
    <>
      {order.status === "pending" && (
        <>
          <Button size="sm" onClick={() => onAccept(order)}>접수</Button>
          {order.type === "product" && (
            <Button size="sm" variant="destructive" onClick={() => setShowRejectReasons(true)}>거절</Button>
          )}
        </>
      )}
      {(order.status === "accepted" || order.status === "preparing") && (
        <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={() => onComplete(order)}>완료</Button>
      )}
      <Button
        size="sm"
        variant="ghost"
        className="text-gray-400 hover:text-red-500 px-1"
        onClick={() => {
          if (window.confirm(`${order.roomNumber}호 주문을 삭제하시겠습니까?`)) {
            onDelete(order);
          }
        }}
      >
        <Trash2 className="w-4 h-4" />
      </Button>
    </>
  );
}
