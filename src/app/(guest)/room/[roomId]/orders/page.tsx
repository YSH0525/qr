"use client";

import { use } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, UtensilsCrossed, Clock, Sparkles, Package } from "lucide-react";
import {
  ORDER_STATUS_LABELS,
  ORDER_TYPE_LABELS,
  PAYMENT_METHOD_LABELS,
  REJECTION_REASON_LABELS,
} from "@/types";
import type { RejectionReasonValue, OrderWithItems } from "@/types";
import { CLEANING_LEVEL_LABELS } from "@/types/service";
import { useSocketGuestOrders } from "@/hooks/use-socket-guest-orders";

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
const PRODUCT_STEPS = ["pending", "accepted", "preparing", "completed"] as const;
const PRODUCT_STEP_LABELS = ["대기중\nPending", "접수\nAccepted", "준비중\nPreparing", "완료\nDone"];

// Service stepper: 대기중 → 접수 → 완료
const SERVICE_STEPS = ["pending", "accepted", "completed"] as const;
const SERVICE_STEP_LABELS = ["대기중\nPending", "접수\nProcessing", "완료\nDone"];

function OrderStepper({ order }: { order: OrderWithItems }) {
  const { status, rejectionReason, type } = order;

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

  const isProduct = type === "product";
  const steps = isProduct ? PRODUCT_STEPS : SERVICE_STEPS;
  const labels = isProduct ? PRODUCT_STEP_LABELS : SERVICE_STEP_LABELS;
  const currentIdx = (steps as readonly string[]).indexOf(status);

  return (
    <div className="flex items-center gap-1">
      {steps.map((step, i) => {
        const isActive = i <= currentIdx;
        const isCurrent = i === currentIdx;
        return (
          <div key={step} className="flex items-center gap-1">
            {i > 0 && (
              <div
                className={`h-0.5 w-4 transition-colors duration-500 ${isActive ? "bg-blue-500" : "bg-gray-200"}`}
              />
            )}
            <div className="flex flex-col items-center">
              <div
                className={`w-3 h-3 rounded-full border-2 transition-all duration-500 ${
                  isActive
                    ? isCurrent
                      ? "bg-blue-500 border-blue-500 scale-125"
                      : "bg-blue-500 border-blue-500"
                    : "bg-white border-gray-300"
                }`}
              />
              <span
                className={`text-[10px] mt-0.5 whitespace-pre-line text-center transition-colors duration-500 ${
                  isActive ? "text-blue-600 font-semibold" : "text-gray-400"
                }`}
              >
                {labels[i]}
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
  const { orders } = useSocketGuestOrders(roomId);

  const formatPrice = (n: number) => n.toLocaleString("ko-KR");

  const activeOrders = orders.filter(
    (o) => !["completed", "cancelled", "rejected"].includes(o.status)
  ).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  function getOrderDetail(order: OrderWithItems): string {
    if (order.type === "product") {
      return order.items.map((i) => `${i.menuItemName} x${i.quantity}`).join(", ");
    }
    const parts: string[] = [];
    if (order.cleaningOptions) {
      parts.push(CLEANING_LEVEL_LABELS[order.cleaningOptions.serviceLevel]);
    }
    if (order.extensionHours) {
      parts.push(`${order.extensionHours}시간 연장${order.freeExtension ? " (무료)" : ""}`);
    }
    if (order.serviceItems && order.serviceItems.length > 0) {
      parts.push(order.serviceItems.map((it) => `${it.name} x${it.quantity}`).join(", "));
    }
    if (order.note) {
      parts.push(order.note);
    }
    return parts.join(", ");
  }

  function getOrderIcon(order: OrderWithItems) {
    if (order.type === "product") return UtensilsCrossed;
    if (order.categoryIcon) return SERVICE_ICON_MAP[order.categoryIcon] || Package;
    return Package;
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
        {activeOrders.length === 0 && (
          <div className="text-center py-16">
            <p className="text-gray-400">진행중인 주문이 없습니다</p>
            <p className="text-gray-300 text-sm mt-1">No active orders</p>
          </div>
        )}

        {activeOrders.length > 0 && (
          <div>
            <h2 className="text-sm font-semibold text-gray-500 mb-3">진행중 <span className="font-normal text-gray-400">In Progress</span></h2>
            <div className="space-y-3">
              {activeOrders.map((order) => {
                const IconComponent = getOrderIcon(order);
                const detail = getOrderDetail(order);
                const iconColor = order.type === "product" ? "text-orange-500" : "text-blue-500";

                return (
                  <Card key={order.orderId} className={order.status === "rejected" ? "border-red-300 bg-red-50" : ""}>
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <IconComponent className={`w-4 h-4 ${iconColor}`} />
                          <span className="text-xs font-mono text-gray-500">
                            {order.orderId}
                          </span>
                        </div>
                        <span className="text-xs text-gray-400">
                          {timeAgo(order.createdAt)}
                        </span>
                      </div>

                      <OrderStepper order={order} />

                      {detail && (
                        <div className="text-sm text-gray-600">{detail}</div>
                      )}

                      <div className="flex items-center justify-between">
                        <Badge variant="outline" className="text-xs">
                          {ORDER_TYPE_LABELS[order.type]}
                        </Badge>
                        {order.totalAmount > 0 && (
                          <span className="font-semibold text-sm">
                            {formatPrice(order.totalAmount)}원
                          </span>
                        )}
                        {order.paymentMethod && (
                          <Badge variant="outline" className="text-xs ml-1">
                            {PAYMENT_METHOD_LABELS[order.paymentMethod]}
                          </Badge>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
