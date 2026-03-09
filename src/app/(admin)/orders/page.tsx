"use client";

import { useEffect, useRef } from "react";
import { useFirestoreOrders } from "@/hooks/use-firestore-orders";
import { useNotificationSound } from "@/hooks/use-audio";
import { useBrowserNotification } from "@/hooks/use-notification";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
} from "@/types";
import type { OrderStatus, PaymentStatus } from "@/types";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { toast } from "sonner";

export default function OrdersPage() {
  const { orders } = useFirestoreOrders();
  const { playNewOrderAlert } = useNotificationSound();
  const { notify } = useBrowserNotification();

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
        playNewOrderAlert(order.roomNumber, order.items || []);

        const itemText = (order.items || [])
          .map((i) => `${i.menuItemName} x${i.quantity}`)
          .join(", ");
        notify(
          `새 주문! ${order.roomNumber}호`,
          itemText || "새로운 주문이 들어왔습니다"
        );
        toast.success(`새 주문! ${order.roomNumber}호`);
      }
    }

    prevOrderIdsRef.current = currentIds;
  }, [orders, playNewOrderAlert, notify]);

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

  return (
    <div className="p-3 md:p-6 h-full flex flex-col overflow-hidden">
      <h1 className="text-xl md:text-2xl font-bold mb-4 md:mb-6 shrink-0">주문 내역</h1>
      <Card className="flex-1 min-h-0 flex flex-col">
        <CardHeader className="shrink-0">
          <CardTitle>전체 주문 목록</CardTitle>
        </CardHeader>
        <CardContent className="flex-1 min-h-0 overflow-y-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="hidden md:table-cell">주문번호</TableHead>
                <TableHead>객실</TableHead>
                <TableHead>상품</TableHead>
                <TableHead>금액</TableHead>
                <TableHead className="hidden md:table-cell">결제</TableHead>
                <TableHead>상태</TableHead>
                <TableHead className="hidden md:table-cell">결제상태</TableHead>
                <TableHead className="hidden md:table-cell">주문일시</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map((order) => (
                <TableRow
                  key={order.orderId}
                  className={
                    order.status === "pending"
                      ? "bg-orange-50"
                      : undefined
                  }
                >
                  <TableCell className="font-mono text-xs hidden md:table-cell">
                    {order.orderId}
                  </TableCell>
                  <TableCell className="font-semibold">
                    {order.roomNumber}호
                  </TableCell>
                  <TableCell className="text-sm max-w-[120px] md:max-w-none truncate md:whitespace-normal">
                    {order.items
                      .map((i) => `${i.menuItemName}x${i.quantity}`)
                      .join(", ")}
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
                  <TableCell className="hidden md:table-cell">
                    <Badge variant={paymentStatusColor(order.paymentStatus)}>
                      {PAYMENT_STATUS_LABELS[order.paymentStatus]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-gray-500 hidden md:table-cell">
                    {format(new Date(order.createdAt), "MM/dd HH:mm", {
                      locale: ko,
                    })}
                  </TableCell>
                </TableRow>
              ))}
              {orders.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-gray-400 py-8">
                    주문 내역이 없습니다
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
