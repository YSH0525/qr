"use client";

import { useState, useEffect, useCallback, use } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, UtensilsCrossed, Clock, Sparkles, Package } from "lucide-react";
import {
  ORDER_STATUS_LABELS,
  PAYMENT_METHOD_LABELS,
  REJECTION_REASON_LABELS,
} from "@/types";
import type { OrderStatus, OrderWithItems, RejectionReasonValue } from "@/types";
import type { ServiceRequest, ServiceRequestStatus } from "@/types/service";
import { SERVICE_TYPE_LABELS, CLEANING_LEVEL_LABELS } from "@/types/service";

const SERVICE_ICON_MAP: Record<string, React.ElementType> = {
  Sparkles,
  Clock,
  Package,
  sparkles: Sparkles,
  clock: Clock,
  package: Package,
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "방금 전";
  if (minutes < 60) return `${minutes}분 전`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}시간 전`;
  return `${Math.floor(hours / 24)}일 전`;
}

// Order stepper: 대기중 → 접수 → 준비중 → 완료
const ORDER_STEPS = ["pending", "accepted", "preparing", "completed"] as const;
const ORDER_STEP_LABELS = ["대기중\nPending", "접수\nAccepted", "준비중\nPreparing", "완료\nDone"];

// Service stepper: 접수 → 처리중 → 완료
const SERVICE_STEPS = ["requested", "accepted", "completed"] as const;
const SERVICE_STEP_LABELS = ["접수\nReceived", "처리중\nProcessing", "완료\nDone"];

function OrderStepper({ status, rejectionReason }: { status: OrderStatus; rejectionReason?: string }) {
  if (status === "rejected" || status === "cancelled") {
    return (
      <div className="space-y-1">
        <Badge variant="destructive" className="text-xs">
          {ORDER_STATUS_LABELS[status]}
        </Badge>
        {status === "rejected" && rejectionReason && (
          <p className="text-xs text-red-600">
            사유: {REJECTION_REASON_LABELS[rejectionReason as RejectionReasonValue] || rejectionReason}
          </p>
        )}
      </div>
    );
  }
  const currentIdx = ORDER_STEPS.indexOf(status as typeof ORDER_STEPS[number]);

  return (
    <div className="flex items-center gap-1">
      {ORDER_STEPS.map((step, i) => {
        const isActive = i <= currentIdx;
        const isCurrent = i === currentIdx;
        return (
          <div key={step} className="flex items-center gap-1">
            {i > 0 && (
              <div
                className={`h-0.5 w-4 ${isActive ? "bg-blue-500" : "bg-gray-200"}`}
              />
            )}
            <div className="flex flex-col items-center">
              <div
                className={`w-3 h-3 rounded-full border-2 ${
                  isActive
                    ? isCurrent
                      ? "bg-blue-500 border-blue-500"
                      : "bg-blue-500 border-blue-500"
                    : "bg-white border-gray-300"
                }`}
              />
              <span
                className={`text-[10px] mt-0.5 whitespace-pre-line text-center ${
                  isActive ? "text-blue-600 font-semibold" : "text-gray-400"
                }`}
              >
                {ORDER_STEP_LABELS[i]}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ServiceStepper({ status }: { status: ServiceRequestStatus }) {
  const currentIdx = SERVICE_STEPS.indexOf(status);

  return (
    <div className="flex items-center gap-1">
      {SERVICE_STEPS.map((step, i) => {
        const isActive = i <= currentIdx;
        const isCurrent = i === currentIdx;
        return (
          <div key={step} className="flex items-center gap-1">
            {i > 0 && (
              <div
                className={`h-0.5 w-4 ${isActive ? "bg-blue-500" : "bg-gray-200"}`}
              />
            )}
            <div className="flex flex-col items-center">
              <div
                className={`w-3 h-3 rounded-full border-2 ${
                  isActive
                    ? isCurrent
                      ? "bg-blue-500 border-blue-500"
                      : "bg-blue-500 border-blue-500"
                    : "bg-white border-gray-300"
                }`}
              />
              <span
                className={`text-[10px] mt-0.5 whitespace-pre-line text-center ${
                  isActive ? "text-blue-600 font-semibold" : "text-gray-400"
                }`}
              >
                {SERVICE_STEP_LABELS[i]}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function GuestOrdersPage({
  params,
}: {
  params: Promise<{ roomId: string }>;
}) {
  const { roomId } = use(params);
  const router = useRouter();
  const [orders, setOrders] = useState<OrderWithItems[]>([]);
  const [services, setServices] = useState<ServiceRequest[]>([]);

  const formatPrice = (n: number) => n.toLocaleString("ko-KR");

  const fetchData = useCallback(async () => {
    const [ordersRes, servicesRes] = await Promise.all([
      fetch(`/api/orders?roomId=${roomId}`),
      fetch(`/api/service-requests?roomId=${roomId}`),
    ]);
    if (ordersRes.ok) setOrders(await ordersRes.json());
    if (servicesRes.ok) setServices(await servicesRes.json());
  }, [roomId]);

  useEffect(() => {
    fetchData();
    const poll = setInterval(fetchData, 10000);
    return () => clearInterval(poll);
  }, [fetchData]);

  const activeOrders = orders.filter(
    (o) => !["completed", "cancelled", "rejected"].includes(o.status)
  );
  const activeServices = services.filter((s) => s.status !== "completed");

  const hasActive = activeOrders.length + activeServices.length > 0;

  // 주문과 서비스요청을 하나의 리스트로 합쳐서 시간순 정렬
  const activeItems = [
    ...activeOrders.map((o) => ({ type: "order" as const, data: o, createdAt: o.createdAt })),
    ...activeServices.map((s) => ({ type: "service" as const, data: s, createdAt: s.createdAt })),
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  function getServiceDetail(svc: ServiceRequest): string {
    const parts: string[] = [];
    if (svc.cleaningOptions) {
      parts.push(CLEANING_LEVEL_LABELS[svc.cleaningOptions.serviceLevel]);
    }
    if (svc.extensionHours) {
      parts.push(`${svc.extensionHours}시간 연장${svc.freeExtension ? " (무료)" : ""}`);
    }
    if (svc.items.length > 0) {
      parts.push(svc.items.map((it) => `${it.name} x${it.quantity}`).join(", "));
    }
    if (svc.note) {
      parts.push(svc.note);
    }
    return parts.join(", ");
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-8">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-5 py-3 flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push(`/room/${roomId}`)}
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-lg font-bold">주문현황 <span className="text-xs font-normal text-gray-400">Order Status</span></h1>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-5 py-4 space-y-6">
        {!hasActive && (
          <div className="text-center py-16">
            <p className="text-gray-400">진행중인 주문이 없습니다</p>
            <p className="text-gray-300 text-sm mt-1">No active orders</p>
          </div>
        )}

        {/* 진행중 */}
        {hasActive && (
          <div>
            <h2 className="text-sm font-semibold text-gray-500 mb-3">진행중 <span className="font-normal text-gray-400">In Progress</span></h2>
            <div className="space-y-3">
              {activeItems.map((item) => {
                if (item.type === "order") {
                  const order = item.data;
                  return (
                    <Card key={`order-${order.orderId}`} className={order.status === "rejected" ? "border-red-300 bg-red-50" : ""}>
                      <CardContent className="p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <UtensilsCrossed className="w-4 h-4 text-orange-500" />
                            <span className="text-xs font-mono text-gray-500">
                              {order.orderId}
                            </span>
                          </div>
                          <span className="text-xs text-gray-400">
                            {timeAgo(order.createdAt)}
                          </span>
                        </div>

                        <OrderStepper status={order.status} rejectionReason={order.rejectionReason} />

                        <div className="text-sm text-gray-600">
                          {order.items.map((mi, i) => (
                            <span key={i}>
                              {i > 0 && ", "}
                              {mi.menuItemName} x{mi.quantity}
                            </span>
                          ))}
                        </div>

                        <div className="flex items-center justify-between">
                          <Badge variant="outline" className="text-xs">
                            {PAYMENT_METHOD_LABELS[order.paymentMethod]}
                          </Badge>
                          <span className="font-semibold text-sm">
                            {formatPrice(order.totalAmount)}원
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  );
                } else {
                  const svc = item.data;
                  const SvcIcon = SERVICE_ICON_MAP[svc.categoryIcon] || Package;
                  const detail = getServiceDetail(svc);
                  return (
                    <Card key={`svc-${svc.requestId}`}>
                      <CardContent className="p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <SvcIcon className="w-4 h-4 text-blue-500" />
                            <span className="text-xs font-mono text-gray-500">
                              {svc.requestId}
                            </span>
                          </div>
                          <span className="text-xs text-gray-400">
                            {timeAgo(svc.createdAt)}
                          </span>
                        </div>

                        <ServiceStepper status={svc.status} />

                        {detail && (
                          <div className="text-sm text-gray-600">{detail}</div>
                        )}

                        <div className="flex items-center justify-between">
                          <Badge variant="outline" className="text-xs">
                            {SERVICE_TYPE_LABELS[svc.type]}
                          </Badge>
                          {svc.extensionAmount != null && svc.extensionAmount > 0 && (
                            <span className="font-semibold text-sm">
                              {formatPrice(svc.extensionAmount)}원
                            </span>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                }
              })}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
