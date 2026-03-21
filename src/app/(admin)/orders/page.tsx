"use client";

import { useEffect, useRef, useState } from "react";
import { useSocketOrders } from "@/hooks/use-socket-orders";
import { useNotificationSound, usePendingOrderAlert } from "@/hooks/use-audio";
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
  ORDER_TYPE_LABELS,
  PAYMENT_METHOD_LABELS,
} from "@/types";
import {
  CLEANING_LEVEL_LABELS,
  PREFERRED_TIME_LABELS,
  SUPPLY_ITEM_LABELS,
} from "@/types/service";
import type { OrderStatus, OrderType, OrderWithItems } from "@/types";
import { format } from "date-fns";
import { ko } from "date-fns/locale";

type ViewFilter = "all" | OrderType;

export default function OrdersPage() {
  const { orders } = useSocketOrders();
  const { playNewOrderAlert } = useNotificationSound();
  const hasPendingOrders = orders.some((o) => o.status === "pending");
  usePendingOrderAlert(hasPendingOrders);
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

  const summarize = (order: OrderWithItems) => {
    if (order.type === "product") {
      return order.items.map((i) => `${i.menuItemName}x${i.quantity}`).join(", ");
    }
    if (order.type === "checkout_extension" && order.extensionHours) {
      return `${order.extensionHours}시간 연장${order.freeExtension ? " (무료)" : order.extensionAmount ? ` (${formatPrice(order.extensionAmount)})` : ""}`;
    }
    if (order.type === "cleaning" && order.cleaningOptions) {
      const co = order.cleaningOptions;
      const parts: string[] = [CLEANING_LEVEL_LABELS[co.serviceLevel]];
      if (co.preferredTime && co.serviceLevel !== "dnd") {
        parts.push(PREFERRED_TIME_LABELS[co.preferredTime]);
      }
      if (co.contactlessSupplies.length > 0) {
        parts.push("비품: " + co.contactlessSupplies.map((i: keyof typeof SUPPLY_ITEM_LABELS) => SUPPLY_ITEM_LABELS[i]).join(", "));
      }
      return parts.join(" · ");
    }
    if (order.serviceItems?.length) return order.serviceItems.map((i) => `${i.name} x${i.quantity}`).join(", ");
    return order.categoryName || ORDER_TYPE_LABELS[order.type];
  };

  const filteredOrders = viewFilter === "all"
    ? orders
    : orders.filter((o) => o.type === viewFilter);

  const displayOrders = filteredOrders.slice(0, 10);

  const filterCounts: Record<string, number> = { all: orders.length };
  for (const o of orders) {
    filterCounts[o.type] = (filterCounts[o.type] || 0) + 1;
  }

  const filters: { key: ViewFilter; label: string }[] = [
    { key: "all", label: "전체" },
    { key: "product", label: "주문" },
    { key: "cleaning", label: "청소" },
    { key: "checkout_extension", label: "연장" },
    { key: "amenity", label: "비품" },
  ];

  return (
    <div className="p-3 md:p-6 h-full flex flex-col overflow-hidden">
      <h1 className="text-xl md:text-2xl font-bold mb-4 md:mb-6 shrink-0">주문/서비스 내역</h1>

      <div className="flex gap-2 mb-4 shrink-0 flex-wrap">
        {filters.map((f) => (
          <Button
            key={f.key}
            size="sm"
            variant={viewFilter === f.key ? "default" : "outline"}
            onClick={() => setViewFilter(f.key)}
          >
            {f.label}
            <Badge variant="secondary" className="ml-1">{filterCounts[f.key] || 0}</Badge>
          </Button>
        ))}
      </div>

      <Card className="flex-1 min-h-0 flex flex-col">
        <CardHeader className="shrink-0">
          <CardTitle>전체 목록 (최근 {Math.min(filteredOrders.length, 10)}건 / 총 {filteredOrders.length}건)</CardTitle>
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
              {displayOrders.map((order) => (
                <TableRow
                  key={order.orderId}
                  className={order.status === "pending" ? "bg-orange-50" : undefined}
                >
                  <TableCell>
                    <Badge variant="outline" className="text-[10px]">
                      {ORDER_TYPE_LABELS[order.type]}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-semibold">{order.roomNumber}호</TableCell>
                  <TableCell className="text-sm max-w-[120px] md:max-w-none truncate md:whitespace-normal">
                    {summarize(order)}
                    {order.note && <span className="text-orange-500 ml-1 text-xs">[{order.note}]</span>}
                  </TableCell>
                  <TableCell>
                    {order.totalAmount > 0 ? formatPrice(order.totalAmount) : <span className="text-gray-300">-</span>}
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    {order.paymentMethod ? PAYMENT_METHOD_LABELS[order.paymentMethod] : <span className="text-gray-300">-</span>}
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
              ))}
              {displayOrders.length === 0 && (
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
