"use client";

import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { useSocketOrders } from "@/hooks/use-socket-orders";
import { useNotificationSound } from "@/hooks/use-audio";
import { toast } from "sonner";
import {
  ORDER_TYPE_LABELS,
  ORDER_STATUS_LABELS,
} from "@/types";
import {
  CLEANING_LEVEL_LABELS,
  PREFERRED_TIME_LABELS,
  SUPPLY_ITEM_LABELS,
} from "@/types/service";
import type { OrderWithItems, OrderStatus } from "@/types";

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-orange-100 text-orange-700",
  accepted: "bg-blue-100 text-blue-700",
  completed: "bg-green-100 text-green-700",
};

export default function ServicesPage() {
  // Only show non-product orders
  const { orders: allOrders } = useSocketOrders();
  const requests = allOrders.filter((o) => o.type !== "product");
  const [filter, setFilter] = useState<string>("all");
  const { playServiceRequestAlert, playAcceptSound, playCompleteSound } = useNotificationSound();

  // 새 서비스 요청 알림 감지
  const prevIdsRef = useRef<Set<string>>(new Set());
  const isFirstLoadRef = useRef(true);

  useEffect(() => {
    if (requests.length === 0 && isFirstLoadRef.current) return;

    const currentIds = new Set(requests.map((r) => r.orderId));

    if (isFirstLoadRef.current) {
      prevIdsRef.current = currentIds;
      isFirstLoadRef.current = false;
      return;
    }

    for (const req of requests) {
      if (!prevIdsRef.current.has(req.orderId)) {
        playServiceRequestAlert();
      }
    }

    prevIdsRef.current = currentIds;
  }, [requests, playServiceRequestAlert]);

  const updateStatus = async (orderId: string, status: string) => {
    if (status === "accepted") playAcceptSound();
    if (status === "completed") playCompleteSound();

    const res = await fetch(`/api/orders/${orderId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (res.ok) {
      toast.success(`요청 상태가 "${ORDER_STATUS_LABELS[status as OrderStatus]}"(으)로 변경되었습니다`);
    }
  };

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  };

  const summarize = (req: OrderWithItems) => {
    if (req.type === "checkout_extension" && req.extensionHours) {
      return `${req.extensionHours}시간 연장${req.freeExtension ? " (무료 - 리뷰)" : req.extensionAmount ? ` (${req.extensionAmount.toLocaleString()}원)` : ""}`;
    }
    if (req.type === "cleaning" && req.cleaningOptions) {
      const co = req.cleaningOptions;
      const parts: string[] = [CLEANING_LEVEL_LABELS[co.serviceLevel]];
      if (co.preferredTime && co.serviceLevel !== "dnd") {
        parts.push(PREFERRED_TIME_LABELS[co.preferredTime]);
      }
      if (co.contactlessSupplies.length > 0) {
        parts.push("비품: " + co.contactlessSupplies.map((s: keyof typeof SUPPLY_ITEM_LABELS) => SUPPLY_ITEM_LABELS[s]).join(", "));
      }
      return parts.join(" · ");
    }
    if (req.serviceItems?.length) return req.serviceItems.map((i) => `${i.name} x${i.quantity}`).join(", ");
    return req.categoryName || ORDER_TYPE_LABELS[req.type];
  };

  const filtered =
    filter === "all" ? requests : requests.filter((r) => r.status === filter);

  return (
    <div className="p-3 md:p-6 h-full flex flex-col overflow-hidden">
      <h1 className="text-xl md:text-2xl font-bold mb-4 md:mb-6 shrink-0">서비스 요청 내역</h1>

      <div className="flex gap-2 mb-4 shrink-0 flex-wrap">
        {(["all", "pending", "accepted", "completed"] as const).map((s) => (
          <Button
            key={s}
            size="sm"
            variant={filter === s ? "default" : "outline"}
            onClick={() => setFilter(s)}
          >
            {s === "all" ? "전체" : ORDER_STATUS_LABELS[s]}
            {s !== "all" && (
              <Badge variant="secondary" className="ml-1">
                {requests.filter((r) => r.status === s).length}
              </Badge>
            )}
          </Button>
        ))}
      </div>

      <Card className="flex-1 min-h-0 flex flex-col">
        <CardHeader className="shrink-0">
          <CardTitle>요청 목록</CardTitle>
        </CardHeader>
        <CardContent className="flex-1 min-h-0 overflow-y-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="hidden md:table-cell">주문 ID</TableHead>
                <TableHead>객실</TableHead>
                <TableHead>서비스</TableHead>
                <TableHead className="hidden md:table-cell">상세</TableHead>
                <TableHead>상태</TableHead>
                <TableHead className="hidden md:table-cell">요청 시간</TableHead>
                <TableHead>처리</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((req) => (
                <TableRow key={req.orderId}>
                  <TableCell className="font-mono text-xs hidden md:table-cell">
                    {req.orderId}
                  </TableCell>
                  <TableCell className="font-semibold">
                    {req.roomNumber}호
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {ORDER_TYPE_LABELS[req.type]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-gray-500 max-w-48 hidden md:table-cell">
                    {summarize(req)}
                    {req.note && (
                      <span className="block text-orange-500 truncate">{req.note}</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[req.status] || ""}`}
                    >
                      {ORDER_STATUS_LABELS[req.status]}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm hidden md:table-cell">
                    {formatTime(req.createdAt)}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {req.status === "pending" && (
                        <Button
                          size="sm"
                          onClick={() => updateStatus(req.orderId, "accepted")}
                        >
                          접수
                        </Button>
                      )}
                      {req.status === "accepted" && (
                        <Button
                          size="sm"
                          className="bg-green-600 hover:bg-green-700"
                          onClick={() => updateStatus(req.orderId, "completed")}
                        >
                          완료
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-gray-400 py-8">
                    서비스 요청이 없습니다
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
