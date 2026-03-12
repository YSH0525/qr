"use client";

import { useEffect, useRef, useState } from "react";
import { useFirestoreOrders, useFirestoreServiceRequests } from "@/hooks/use-firestore-orders";
import { useNotificationSound } from "@/hooks/use-audio";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ORDER_STATUS_LABELS,
  PAYMENT_METHOD_LABELS,
  PAYMENT_STATUS_LABELS,
  SERVICE_TYPE_LABELS,
  SERVICE_STATUS_LABELS,
} from "@/types";
import {
  CLEANING_LEVEL_LABELS,
  PREFERRED_TIME_LABELS,
  SUPPLY_ITEM_LABELS,
} from "@/types/service";
import type { OrderStatus, PaymentStatus } from "@/types";
import type { ServiceRequest } from "@/types/service";
import { format } from "date-fns";
import { ko } from "date-fns/locale";

type ViewFilter = "all" | "orders" | "services";

export default function OrdersPage() {
  const { orders } = useFirestoreOrders();
  const { serviceRequests } = useFirestoreServiceRequests();
  const { playNewOrderAlert, playServiceRequestAlert } = useNotificationSound();
  const [viewFilter, setViewFilter] = useState<ViewFilter>("all");

  // 새 주문 알림 감지
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
    for (const order of orders) {
      if (!prevOrderIdsRef.current.has(order.orderId)) {
        playNewOrderAlert();
      }
    }
    prevOrderIdsRef.current = currentIds;
  }, [orders, playNewOrderAlert]);

  // 새 서비스 요청 알림 감지
  const prevServiceIdsRef = useRef<Set<string>>(new Set());
  const isFirstServiceLoadRef = useRef(true);

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

  const formatPrice = (price: number) => price.toLocaleString("ko-KR") + "원";

  const statusColor = (status: OrderStatus) => {
    const colors: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      pending: "default",
      accepted: "secondary",
      preparing: "secondary",
      completed: "outline",
      rejected: "destructive",
      cancelled: "destructive",
    };
    return colors[status] || "default";
  };

  const paymentStatusColor = (status: PaymentStatus) => {
    const colors: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      pending: "default",
      paid: "outline",
      failed: "destructive",
      deferred: "secondary",
    };
    return colors[status] || "default";
  };

  const serviceStatusColor = (status: string): "default" | "secondary" | "destructive" | "outline" => {
    const colors: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      requested: "default",
      accepted: "secondary",
      completed: "outline",
    };
    return colors[status] || "default";
  };

  const summarizeService = (req: ServiceRequest) => {
    if (req.type === "checkout_extension" && req.extensionHours) {
      return `${req.extensionHours}시간 연장${req.freeExtension ? " (무료)" : req.extensionAmount ? ` (${formatPrice(req.extensionAmount)})` : ""}`;
    }
    if (req.type === "cleaning" && req.cleaningOptions) {
      const parts: string[] = [CLEANING_LEVEL_LABELS[req.cleaningOptions.serviceLevel]];
      if (req.cleaningOptions.preferredTime && req.cleaningOptions.serviceLevel !== "dnd") {
        parts.push(PREFERRED_TIME_LABELS[req.cleaningOptions.preferredTime]);
      }
      if (req.cleaningOptions.contactlessSupplies.length > 0) {
        parts.push("비품: " + req.cleaningOptions.contactlessSupplies.map((i) => SUPPLY_ITEM_LABELS[i]).join(", "));
      }
      return parts.join(" · ");
    }
    if (req.items?.length) return req.items.map((i) => `${i.name} x${i.quantity}`).join(", ");
    return req.categoryName;
  };

  // 통합 행 생성
  type UnifiedRow =
    | { kind: "order"; data: typeof orders[number]; time: string }
    | { kind: "service"; data: ServiceRequest; time: string };

  const allRows: UnifiedRow[] = [];

  if (viewFilter === "all" || viewFilter === "orders") {
    allRows.push(...orders.map((o) => ({ kind: "order" as const, data: o, time: o.createdAt })));
  }
  if (viewFilter === "all" || viewFilter === "services") {
    allRows.push(...serviceRequests.map((s) => ({ kind: "service" as const, data: s, time: s.createdAt })));
  }

  allRows.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());

  return (
    <div className="p-3 md:p-6 h-full flex flex-col overflow-hidden">
      <h1 className="text-xl md:text-2xl font-bold mb-4 md:mb-6 shrink-0">주문/서비스 내역</h1>

      <div className="flex gap-2 mb-4 shrink-0 flex-wrap">
        {([
          { key: "all", label: "전체", count: orders.length + serviceRequests.length },
          { key: "orders", label: "주문", count: orders.length },
          { key: "services", label: "서비스", count: serviceRequests.length },
        ] as const).map((f) => (
          <Button
            key={f.key}
            size="sm"
            variant={viewFilter === f.key ? "default" : "outline"}
            onClick={() => setViewFilter(f.key)}
          >
            {f.label}
            <Badge variant="secondary" className="ml-1">{f.count}</Badge>
          </Button>
        ))}
      </div>

      <Card className="flex-1 min-h-0 flex flex-col">
        <CardHeader className="shrink-0">
          <CardTitle>전체 목록</CardTitle>
        </CardHeader>
        <CardContent className="flex-1 min-h-0 overflow-y-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>유형</TableHead>
                <TableHead>객실</TableHead>
                <TableHead>내용</TableHead>
                <TableHead>금액</TableHead>
                <TableHead className="hidden md:table-cell">결제</TableHead>
                <TableHead>상태</TableHead>
                <TableHead className="hidden md:table-cell">일시</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {allRows.map((row) => {
                if (row.kind === "order") {
                  const order = row.data;
                  return (
                    <TableRow
                      key={order.orderId}
                      className={order.status === "pending" ? "bg-orange-50" : undefined}
                    >
                      <TableCell>
                        <Badge variant="outline" className="text-[10px]">주문</Badge>
                      </TableCell>
                      <TableCell className="font-semibold">{order.roomNumber}호</TableCell>
                      <TableCell className="text-sm max-w-[120px] md:max-w-none truncate md:whitespace-normal">
                        {order.items.map((i) => `${i.menuItemName}x${i.quantity}`).join(", ")}
                      </TableCell>
                      <TableCell>{formatPrice(order.totalAmount)}</TableCell>
                      <TableCell className="hidden md:table-cell">
                        {PAYMENT_METHOD_LABELS[order.paymentMethod]}
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusColor(order.status)}>
                          {ORDER_STATUS_LABELS[order.status]}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-gray-500 hidden md:table-cell">
                        {format(new Date(order.createdAt), "MM/dd HH:mm", { locale: ko })}
                      </TableCell>
                    </TableRow>
                  );
                } else {
                  const req = row.data;
                  return (
                    <TableRow
                      key={req.requestId}
                      className={req.status === "requested" ? "bg-orange-50" : undefined}
                    >
                      <TableCell>
                        <Badge variant="outline" className="text-[10px]">
                          {SERVICE_TYPE_LABELS[req.type]}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-semibold">{req.roomNumber}호</TableCell>
                      <TableCell className="text-sm max-w-[120px] md:max-w-none truncate md:whitespace-normal">
                        {summarizeService(req)}
                        {req.note && <span className="text-orange-500 ml-1 text-xs">[{req.note}]</span>}
                      </TableCell>
                      <TableCell className="text-gray-300">-</TableCell>
                      <TableCell className="hidden md:table-cell text-gray-300">-</TableCell>
                      <TableCell>
                        <Badge variant={serviceStatusColor(req.status)}>
                          {SERVICE_STATUS_LABELS[req.status]}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-gray-500 hidden md:table-cell">
                        {format(new Date(req.createdAt), "MM/dd HH:mm", { locale: ko })}
                      </TableCell>
                    </TableRow>
                  );
                }
              })}
              {allRows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-gray-400 py-8">
                    내역이 없습니다
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
