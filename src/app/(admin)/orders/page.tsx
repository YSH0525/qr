"use client";

import { useState, useEffect, useCallback } from "react";
import { useOrderSSE } from "@/hooks/use-sse";
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
import type { OrderWithItems, OrderStatus, PaymentStatus } from "@/types";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { toast } from "sonner";

export default function OrdersPage() {
  const [orders, setOrders] = useState<OrderWithItems[]>([]);
  const { playNewOrderAlert } = useNotificationSound();
  const { notify } = useBrowserNotification();

  const fetchOrders = useCallback(async () => {
    const res = await fetch("/api/orders");
    if (res.ok) {
      setOrders(await res.json());
    }
  }, []);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

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
      [playNewOrderAlert, notify]
    )
  );

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
    <div className="p-6 h-full flex flex-col overflow-hidden">
      <h1 className="text-2xl font-bold mb-6 shrink-0">주문 내역</h1>
      <Card className="flex-1 min-h-0 flex flex-col">
        <CardHeader className="shrink-0">
          <CardTitle>전체 주문 목록</CardTitle>
        </CardHeader>
        <CardContent className="flex-1 min-h-0 overflow-y-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>주문번호</TableHead>
                <TableHead>객실</TableHead>
                <TableHead>상품</TableHead>
                <TableHead>금액</TableHead>
                <TableHead>결제</TableHead>
                <TableHead>상태</TableHead>
                <TableHead>결제상태</TableHead>
                <TableHead>주문일시</TableHead>
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
                  <TableCell className="font-mono text-xs">
                    {order.orderId}
                  </TableCell>
                  <TableCell className="font-semibold">
                    {order.roomNumber}호
                  </TableCell>
                  <TableCell className="text-sm">
                    {order.items
                      .map((i) => `${i.menuItemName}x${i.quantity}`)
                      .join(", ")}
                  </TableCell>
                  <TableCell>{formatPrice(order.totalAmount)}</TableCell>
                  <TableCell>
                    {PAYMENT_METHOD_LABELS[order.paymentMethod]}
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusColor(order.status)}>
                      {ORDER_STATUS_LABELS[order.status]}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={paymentStatusColor(order.paymentStatus)}>
                      {PAYMENT_STATUS_LABELS[order.paymentStatus]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-gray-500">
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
