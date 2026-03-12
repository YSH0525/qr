"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useFirestoreOrders, useFirestoreServiceRequests } from "@/hooks/use-firestore-orders";
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
import { Volume2, X } from "lucide-react";
import type { OrderWithItems } from "@/types";
import type { ServiceRequest } from "@/types/service";
import {
  ORDER_STATUS_LABELS,
  PAYMENT_METHOD_LABELS,
  SERVICE_TYPE_LABELS,
  SERVICE_STATUS_LABELS,
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

interface DeferredPayment {
  room: { id: string; roomNumber: string; roomId: string };
  totalDeferred: number;
  orderCount: number;
}

const DASHBOARD_ORDER_STATUSES = ["pending", "accepted", "preparing"];
const DASHBOARD_SERVICE_STATUSES = ["requested", "accepted"];

/* ── 상태별 행 배경색 ── */
const ORDER_ROW_BG: Record<string, string> = {
  pending: "bg-red-50",
  accepted: "bg-blue-50",
  preparing: "bg-yellow-50",
};
const SERVICE_ROW_BG: Record<string, string> = {
  requested: "bg-red-50",
  accepted: "bg-blue-50",
};

/* ── 통합 행 타입 ── */
type RowItem =
  | { kind: "order"; data: OrderWithItems; key: string; priority: number; time: string }
  | { kind: "service"; data: ServiceRequest; key: string; priority: number; time: string };

export default function DashboardPage() {
  const {
    orders,
    optimisticUpdate: optimisticOrderUpdate,
    releaseOptimisticLock: releaseOrderLock,
  } = useFirestoreOrders(DASHBOARD_ORDER_STATUSES);

  const {
    serviceRequests,
    optimisticUpdate: optimisticServiceUpdate,
    releaseOptimisticLock: releaseServiceLock,
  } = useFirestoreServiceRequests(DASHBOARD_SERVICE_STATUSES);

  const [audioEnabled, setAudioEnabled] = useState(false);
  const [deferredPayments, setDeferredPayments] = useState<DeferredPayment[]>([]);
  const [settlementPreview, setSettlementPreview] = useState<SettlementPreviewData | null>(null);
  const [settlementModalOpen, setSettlementModalOpen] = useState(false);
  const { playNewOrderAlert, playAcceptSound, playCompleteSound, playServiceRequestAlert } =
    useNotificationSound();

  // 새 주문/서비스 감지
  const prevOrderIdsRef = useRef<Set<string>>(new Set());
  const prevServiceIdsRef = useRef<Set<string>>(new Set());
  const isFirstLoadRef = useRef(true);
  const isFirstServiceLoadRef = useRef(true);

  useEffect(() => {
    if (orders.length === 0 && isFirstLoadRef.current) return;
    const currentIds = new Set(orders.map((o) => o.orderId));
    if (isFirstLoadRef.current) {
      prevOrderIdsRef.current = currentIds;
      isFirstLoadRef.current = false;
      return;
    }
    for (const order of orders) {
      if (!prevOrderIdsRef.current.has(order.orderId)) {
        playNewOrderAlert();
      }
    }
    prevOrderIdsRef.current = currentIds;
  }, [orders, playNewOrderAlert]);

  useEffect(() => {
    if (serviceRequests.length === 0 && isFirstServiceLoadRef.current) return;
    const currentIds = new Set(serviceRequests.map((r) => r.requestId));
    if (isFirstServiceLoadRef.current) {
      prevServiceIdsRef.current = currentIds;
      isFirstServiceLoadRef.current = false;
      return;
    }
    for (const req of serviceRequests) {
      if (!prevServiceIdsRef.current.has(req.requestId)) {
        playServiceRequestAlert();
      }
    }
    prevServiceIdsRef.current = currentIds;
  }, [serviceRequests, playServiceRequestAlert]);

  const enableAudio = useCallback(() => {
    playAcceptSound();
    setAudioEnabled(true);
  }, [playAcceptSound]);

  // 후불 정산 폴링
  const fetchDeferred = useCallback(async () => {
    const res = await fetch("/api/payments/deferred");
    if (res.ok) setDeferredPayments(await res.json());
  }, []);

  useEffect(() => {
    fetchDeferred();
    const poll = setInterval(fetchDeferred, 10000);
    return () => clearInterval(poll);
  }, [fetchDeferred]);

  /* ── 핸들러 ── */
  const patchOrder = async (orderId: string, status: string, rollback: string, extra?: Record<string, unknown>) => {
    try {
      const res = await fetch(`/api/orders/${orderId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, ...extra }),
      });
      if (res.ok) {
        releaseOrderLock(orderId);
        return true;
      }
      optimisticOrderUpdate(orderId, { status: rollback as OrderWithItems["status"] });
      releaseOrderLock(orderId);
      return false;
    } catch {
      optimisticOrderUpdate(orderId, { status: rollback as OrderWithItems["status"] });
      releaseOrderLock(orderId);
      return false;
    }
  };

  const handleAccept = async (order: OrderWithItems) => {
    playAcceptSound();
    optimisticOrderUpdate(order.orderId, { status: "accepted", updatedAt: new Date().toISOString() });
    const ok = await patchOrder(order.orderId, "accepted", "pending");
    toast[ok ? "success" : "error"](ok ? `${order.roomNumber}호 주문 접수!` : "주문 접수에 실패했습니다");
  };

  const handlePrepare = async (order: OrderWithItems) => {
    playAcceptSound();
    optimisticOrderUpdate(order.orderId, { status: "preparing", updatedAt: new Date().toISOString() });
    const ok = await patchOrder(order.orderId, "preparing", "accepted");
    toast[ok ? "success" : "error"](ok ? `${order.roomNumber}호 처리 시작!` : "상태 변경에 실패했습니다");
  };

  const handleComplete = async (order: OrderWithItems) => {
    playCompleteSound();
    optimisticOrderUpdate(order.orderId, { status: "completed", updatedAt: new Date().toISOString() });
    const ok = await patchOrder(order.orderId, "completed", "preparing");
    toast[ok ? "success" : "error"](ok ? `${order.roomNumber}호 주문 완료!` : "주문 완료 처리에 실패했습니다");
  };

  const handleReject = async (orderId: string, rejectionReason: string) => {
    optimisticOrderUpdate(orderId, { status: "rejected" as OrderWithItems["status"], updatedAt: new Date().toISOString() });
    const ok = await patchOrder(orderId, "rejected", "pending", { rejectionReason });
    if (ok) toast.error("주문이 거절되었습니다");
    else toast.error("주문 거절에 실패했습니다");
  };

  const handleServiceAccept = async (req: ServiceRequest) => {
    playAcceptSound();
    optimisticServiceUpdate(req.requestId, { status: "accepted", updatedAt: new Date().toISOString() });
    const res = await fetch(`/api/service-requests/${req.requestId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "accepted" }),
    });
    if (res.ok) {
      releaseServiceLock(req.requestId);
      toast.success(`${req.roomNumber}호 ${req.categoryName} 접수!`);
    } else {
      optimisticServiceUpdate(req.requestId, { status: "requested" });
      releaseServiceLock(req.requestId);
      toast.error("서비스 접수에 실패했습니다");
    }
  };

  const handleServiceComplete = async (req: ServiceRequest) => {
    playCompleteSound();
    optimisticServiceUpdate(req.requestId, { status: "completed", updatedAt: new Date().toISOString() });
    const res = await fetch(`/api/service-requests/${req.requestId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "completed" }),
    });
    if (res.ok) {
      releaseServiceLock(req.requestId);
      toast.success(`${req.roomNumber}호 ${req.categoryName} 완료!`);
      fetchDeferred();
    } else {
      optimisticServiceUpdate(req.requestId, { status: "accepted" });
      releaseServiceLock(req.requestId);
      toast.error("서비스 완료 처리에 실패했습니다");
    }
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

  const handleDeleteOrder = async (order: OrderWithItems) => {
    optimisticOrderUpdate(order.orderId, { status: "rejected" as OrderWithItems["status"] });
    const res = await fetch(`/api/orders/${order.orderId}`, { method: "DELETE" });
    if (res.ok) {
      releaseOrderLock(order.orderId);
      toast.success(`${order.roomNumber}호 주문 삭제됨`);
    } else {
      optimisticOrderUpdate(order.orderId, { status: order.status });
      releaseOrderLock(order.orderId);
      toast.error("주문 삭제에 실패했습니다");
    }
  };

  const handleDeleteService = async (req: ServiceRequest) => {
    optimisticServiceUpdate(req.requestId, { status: "completed" });
    const res = await fetch(`/api/service-requests/${req.requestId}`, { method: "DELETE" });
    if (res.ok) {
      releaseServiceLock(req.requestId);
      toast.success(`${req.roomNumber}호 ${req.categoryName} 삭제됨`);
    } else {
      optimisticServiceUpdate(req.requestId, { status: req.status });
      releaseServiceLock(req.requestId);
      toast.error("서비스 요청 삭제에 실패했습니다");
    }
  };

  /* ── 통합 행 (최신순 정렬) ── */
  const activeOrders = orders.filter((o) => o.status !== "rejected" && o.status !== "cancelled");
  const activeServices = serviceRequests;

  const buildRows = (
    ords: OrderWithItems[],
    srvs: ServiceRequest[],
  ): RowItem[] => {
    const rows: RowItem[] = [
      ...ords.map((o) => ({
        kind: "order" as const,
        data: o,
        key: o.orderId,
        priority: 0,
        time: o.createdAt,
      })),
      ...srvs.map((s) => ({
        kind: "service" as const,
        data: s,
        key: s.requestId,
        priority: 0,
        time: s.createdAt,
      })),
    ];
    rows.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
    return rows;
  };

  const activeRows = buildRows(activeOrders, activeServices);

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "방금 전";
    if (mins < 60) return `${mins}분 전`;
    return `${Math.floor(mins / 60)}시간 전`;
  };

  const formatPrice = (n: number) => n.toLocaleString("ko-KR") + "원";

  const summarize = (row: RowItem) => {
    if (row.kind === "order") {
      const o = row.data;
      return o.items.map((i) => `${i.menuItemName}x${i.quantity}`).join(", ");
    }
    const s = row.data;
    if (s.type === "checkout_extension" && s.extensionHours) {
      return `+${s.extensionHours}h 연장${s.freeExtension ? " (무료)" : s.extensionAmount ? ` ${formatPrice(s.extensionAmount)}` : ""}`;
    }
    if (s.type === "cleaning" && s.cleaningOptions) {
      const parts: string[] = [CLEANING_LEVEL_LABELS[s.cleaningOptions.serviceLevel]];
      if (s.cleaningOptions.preferredTime && s.cleaningOptions.serviceLevel !== "dnd") {
        parts.push(PREFERRED_TIME_LABELS[s.cleaningOptions.preferredTime]);
      }
      if (!s.cleaningOptions.linenChange && s.cleaningOptions.serviceLevel !== "dnd") {
        parts.push("시트교체 없음");
      }
      if (s.cleaningOptions.contactlessSupplies.length > 0) {
        parts.push("비품: " + s.cleaningOptions.contactlessSupplies.map((i) => SUPPLY_ITEM_LABELS[i]).join(", "));
      }
      if (s.cleaningOptions.trashRemovalOnly) {
        parts.push("쓰레기 수거만");
      }
      return parts.join(" · ");
    }
    if (s.items?.length) return s.items.map((i) => `${i.name}x${i.quantity}`).join(", ");
    return s.categoryName;
  };

  /* ── 렌더 ── */
  return (
    <div className="p-3 md:p-6 h-full min-h-0 flex flex-col overflow-auto md:overflow-hidden">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-3 shrink-0 flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <h1 className="text-lg md:text-xl font-bold">운영 현황</h1>
          <Badge variant="secondary" className="text-xs">
            활성 {activeRows.length}
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

      {/* 활성 목록 — 데스크탑: 테이블, 모바일: 컴팩트 리스트 */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {activeRows.length > 0 ? (
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
                  {activeRows.map((row, idx) => {
                    const isOrder = row.kind === "order";
                    const status = isOrder ? row.data.status : row.data.status;
                    const bg = isOrder ? ORDER_ROW_BG[status] : SERVICE_ROW_BG[status];
                    return (
                      <TableRow key={row.key} className={bg}>
                        <TableCell className="font-mono text-xs text-gray-400">
                          {(isOrder ? row.data.dailySeq : row.data.dailySeq) ?? idx + 1}
                        </TableCell>
                        <TableCell className="font-semibold">
                          {isOrder ? row.data.roomNumber : row.data.roomNumber}호
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-[10px]">
                            {isOrder ? "주문" : SERVICE_TYPE_LABELS[row.data.type]}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm max-w-xs truncate">
                          {summarize(row)}
                          {((isOrder && row.data.note) || (!isOrder && row.data.note)) && (
                            <span className="text-orange-500 ml-2 text-xs">
                              [{isOrder ? row.data.note : row.data.note}]
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-xs">
                          {isOrder ? (
                            <Badge variant="secondary" className="text-[10px]">
                              {PAYMENT_METHOD_LABELS[row.data.paymentMethod]}
                            </Badge>
                          ) : row.data.paymentMethod ? (
                            <Badge variant="secondary" className="text-[10px]">
                              {row.data.paymentMethod === "kakaopay" ? "카카오페이" : "후불"}
                            </Badge>
                          ) : (
                            <span className="text-gray-300">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              (isOrder && status === "pending") || (!isOrder && status === "requested")
                                ? "destructive"
                                : "secondary"
                            }
                            className="text-[10px]"
                          >
                            {isOrder ? ORDER_STATUS_LABELS[row.data.status] : SERVICE_STATUS_LABELS[row.data.status]}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-gray-400">
                          {timeAgo(row.time)}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex gap-1 justify-end">
                            {isOrder ? (
                              <OrderActions order={row.data} onAccept={handleAccept} onPrepare={handlePrepare} onComplete={handleComplete} onReject={handleReject} onDelete={handleDeleteOrder} />
                            ) : (
                              <ServiceActions request={row.data} onAccept={handleServiceAccept} onComplete={handleServiceComplete} onDelete={handleDeleteService} />
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            {/* 모바일 리스트 */}
            <div className="md:hidden space-y-2">
              {activeRows.map((row, idx) => {
                const isOrder = row.kind === "order";
                const status = isOrder ? row.data.status : row.data.status;
                const bg = isOrder ? ORDER_ROW_BG[status] : SERVICE_ROW_BG[status];
                return (
                  <div key={row.key} className={`rounded-lg border p-3 ${bg}`}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-400 font-mono">
                          #{(isOrder ? row.data.dailySeq : row.data.dailySeq) ?? idx + 1}
                        </span>
                        <span className="font-semibold text-sm">
                          {isOrder ? row.data.roomNumber : row.data.roomNumber}호
                        </span>
                        <Badge variant="outline" className="text-[10px]">
                          {isOrder ? "주문" : SERVICE_TYPE_LABELS[row.data.type]}
                        </Badge>
                      </div>
                      <span className="text-xs text-gray-400">{timeAgo(row.time)}</span>
                    </div>
                    <p className="text-sm text-gray-700 truncate mb-2">{summarize(row)}</p>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1">
                        <Badge
                          variant={
                            (isOrder && status === "pending") || (!isOrder && status === "requested")
                              ? "destructive"
                              : "secondary"
                          }
                          className="text-[10px]"
                        >
                          {isOrder ? ORDER_STATUS_LABELS[row.data.status] : SERVICE_STATUS_LABELS[row.data.status]}
                        </Badge>
                        {isOrder && (
                          <Badge variant="secondary" className="text-[10px]">
                            {PAYMENT_METHOD_LABELS[row.data.paymentMethod]}
                          </Badge>
                        )}
                      </div>
                      <div className="flex gap-1">
                        {isOrder ? (
                          <OrderActions order={row.data} onAccept={handleAccept} onPrepare={handlePrepare} onComplete={handleComplete} onReject={handleReject} onDelete={handleDeleteOrder} />
                        ) : (
                          <ServiceActions request={row.data} onAccept={handleServiceAccept} onComplete={handleServiceComplete} onDelete={handleDeleteService} />
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
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

/* ── 주문 액션 버튼 ── */
function OrderActions({
  order,
  onAccept,
  onPrepare,
  onComplete,
  onReject,
  onDelete,
}: {
  order: OrderWithItems;
  onAccept: (o: OrderWithItems) => void;
  onPrepare: (o: OrderWithItems) => void;
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
          <Button size="sm" variant="destructive" onClick={() => setShowRejectReasons(true)}>거절</Button>
        </>
      )}
      {order.status === "accepted" && (
        <Button size="sm" className="bg-blue-600 hover:bg-blue-700" onClick={() => onPrepare(order)}>처리</Button>
      )}
      {order.status === "preparing" && (
        <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={() => onComplete(order)}>완료</Button>
      )}
      <Button size="sm" variant="ghost" className="text-gray-400 hover:text-red-500 px-1" onClick={() => onDelete(order)}>
        <X className="w-4 h-4" />
      </Button>
    </>
  );
}

/* ── 서비스 액션 버튼 ── */
function ServiceActions({
  request: req,
  onAccept,
  onComplete,
  onDelete,
}: {
  request: ServiceRequest;
  onAccept: (r: ServiceRequest) => void;
  onComplete: (r: ServiceRequest) => void;
  onDelete: (r: ServiceRequest) => void;
}) {
  return (
    <>
      {req.status === "requested" && (
        <Button size="sm" onClick={() => onAccept(req)}>접수</Button>
      )}
      {req.status === "accepted" && (
        <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={() => onComplete(req)}>완료</Button>
      )}
      <Button size="sm" variant="ghost" className="text-gray-400 hover:text-red-500 px-1" onClick={() => onDelete(req)}>
        <X className="w-4 h-4" />
      </Button>
    </>
  );
}
