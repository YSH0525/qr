"use client";

import { useState, useEffect, useCallback } from "react";
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
import { useOrderSSE } from "@/hooks/use-sse";
import { useNotificationSound } from "@/hooks/use-audio";
import { useBrowserNotification } from "@/hooks/use-notification";
import { toast } from "sonner";
import type { ServiceRequest } from "@/types/service";
import { SERVICE_TYPE_LABELS, SERVICE_STATUS_LABELS } from "@/types/service";

const STATUS_COLORS: Record<string, string> = {
  requested: "bg-orange-100 text-orange-700",
  accepted: "bg-blue-100 text-blue-700",
  completed: "bg-green-100 text-green-700",
};

export default function ServicesPage() {
  const [requests, setRequests] = useState<ServiceRequest[]>([]);
  const [filter, setFilter] = useState<string>("all");
  const { playServiceRequestAlert, playAcceptSound, playCompleteSound } = useNotificationSound();
  const { notify } = useBrowserNotification();

  const fetchRequests = useCallback(async () => {
    const res = await fetch("/api/service-requests");
    if (res.ok) setRequests(await res.json());
  }, []);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  useOrderSSE(
    useCallback(
      (event: string, data: Record<string, unknown>) => {
        if (event === "new-service-request") {
          const req = data as unknown as ServiceRequest;
          setRequests((prev) => [req, ...prev]);
          playServiceRequestAlert(req.roomNumber, req.categoryName);
          notify(`서비스 요청! ${req.roomNumber}호`, req.categoryName);
          toast.success(`서비스 요청! ${req.roomNumber}호 — ${req.categoryName}`);
        } else if (event === "service-request-updated") {
          setRequests((prev) =>
            prev.map((r) =>
              r.requestId === (data as Record<string, unknown>).requestId
                ? { ...r, ...(data as Partial<ServiceRequest>) }
                : r
            )
          );
        }
      },
      [playServiceRequestAlert, notify]
    ),
    fetchRequests
  );

  const updateStatus = async (requestId: string, status: string) => {
    if (status === "accepted") playAcceptSound();
    if (status === "completed") playCompleteSound();

    const res = await fetch(`/api/service-requests/${requestId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (res.ok) {
      toast.success(`요청 상태가 "${SERVICE_STATUS_LABELS[status as keyof typeof SERVICE_STATUS_LABELS]}"(으)로 변경되었습니다`);
      fetchRequests();
    }
  };

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  };

  const filtered =
    filter === "all" ? requests : requests.filter((r) => r.status === filter);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">서비스 요청 내역</h1>

      <div className="flex gap-2 mb-4">
        {["all", "requested", "accepted", "completed"].map((s) => (
          <Button
            key={s}
            size="sm"
            variant={filter === s ? "default" : "outline"}
            onClick={() => setFilter(s)}
          >
            {s === "all" ? "전체" : SERVICE_STATUS_LABELS[s as keyof typeof SERVICE_STATUS_LABELS]}
            {s !== "all" && (
              <Badge variant="secondary" className="ml-1">
                {requests.filter((r) => r.status === s).length}
              </Badge>
            )}
          </Button>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>요청 목록</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>요청 ID</TableHead>
                <TableHead>객실</TableHead>
                <TableHead>서비스</TableHead>
                <TableHead>상세</TableHead>
                <TableHead>상태</TableHead>
                <TableHead>요청 시간</TableHead>
                <TableHead>처리</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((req) => (
                <TableRow key={req.id}>
                  <TableCell className="font-mono text-xs">
                    {req.requestId}
                  </TableCell>
                  <TableCell className="font-semibold">
                    {req.roomNumber}호
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {SERVICE_TYPE_LABELS[req.type]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-gray-500 max-w-48">
                    {req.type === "checkout_extension" && req.extensionHours && (
                      <span className="block">{req.extensionHours}시간 연장{req.extensionAmount ? ` (${req.extensionAmount.toLocaleString()}원)` : ""}</span>
                    )}
                    {req.items && req.items.length > 0 && (
                      <span className="block truncate">{req.items.map((i) => `${i.name} x${i.quantity}`).join(", ")}</span>
                    )}
                    {req.note && (
                      <span className="block text-orange-500 truncate">{req.note}</span>
                    )}
                    {!req.items?.length && !req.extensionHours && !req.note && "-"}
                  </TableCell>
                  <TableCell>
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[req.status]}`}
                    >
                      {SERVICE_STATUS_LABELS[req.status]}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm">
                    {formatTime(req.createdAt)}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {req.status === "requested" && (
                        <Button
                          size="sm"
                          onClick={() => updateStatus(req.requestId, "accepted")}
                        >
                          접수
                        </Button>
                      )}
                      {req.status === "accepted" && (
                        <Button
                          size="sm"
                          className="bg-green-600 hover:bg-green-700"
                          onClick={() => updateStatus(req.requestId, "completed")}
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
