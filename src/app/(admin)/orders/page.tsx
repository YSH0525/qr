"use client";

import { useState, useEffect } from "react";
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

export default function OrdersPage() {
  const [orders, setOrders] = useState<OrderWithItems[]>([]);

  useEffect(() => {
    fetch("/api/orders")
      .then((r) => r.json())
      .then(setOrders);
  }, []);

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
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">주문 내역</h1>
      <Card>
        <CardHeader>
          <CardTitle>전체 주문 목록</CardTitle>
        </CardHeader>
        <CardContent>
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
                <TableRow key={order.orderId}>
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
