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
import { useFirestoreServiceRequests } from "@/hooks/use-firestore-orders";
import { useNotificationSound } from "@/hooks/use-audio";
import { toast } from "sonner";
import type { ServiceRequest } from "@/types/service";
import {
  SERVICE_TYPE_LABELS,
  SERVICE_STATUS_LABELS,
  CLEANING_LEVEL_LABELS,
  PREFERRED_TIME_LABELS,
  SUPPLY_ITEM_LABELS,
} from "@/types/service";

const STATUS_COLORS: Record<string, string> = {
  requested: "bg-orange-100 text-orange-700",
  accepted: "bg-blue-100 text-blue-700",
  completed: "bg-green-100 text-green-700",
};

export default function ServicesPage() {
  const { serviceRequests: requests } = useFirestoreServiceRequests();
  const [filter, setFilter] = useState<string>("all");
  const { playServiceRequestAlert, playAcceptSound, playCompleteSound } = useNotificationSound();

  // 새 서비스 요청 알림 감지
  const prevIdsRef = useRef<Set<string>>(new Set());
  const isFirstLoadRef = useRef(true);

  useEffect(() => {
    if (requests.length === 0 && isFirstLoadRef.current) return;

    const currentIds = new Set(requests.map((r) => r.requestId));

    if (isFirstLoadRef.current) {
      prevIdsRef.current = currentIds;
      isFirstLoadRef.current = false;
      return;
    }

    for (const req of requests) {
      if (!prevIdsRef.current.has(req.requestId)) {
        playServiceRequestAlert();
      }
    }

    prevIdsRef.current = currentIds;
  }, [requests, playServiceRequestAlert]);

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
    }
  };

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  };

  const filtered =
    filter === "all" ? requests : requests.filter((r) => r.status === filter);

  return (
    <div className="p-3 md:p-6 h-full flex flex-col overflow-hidden">
      <h1 className="text-xl md:text-2xl font-bold mb-4 md:mb-6 shrink-0">서비스 요청 내역</h1>

      <div className="flex gap-2 mb-4 shrink-0 flex-wrap">
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

      <Card className="flex-1 min-h-0 flex flex-col">
        <CardHeader className="shrink-0">
          <CardTitle>요청 목록</CardTitle>
        </CardHeader>
        <CardContent className="flex-1 min-h-0 overflow-y-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="hidden md:table-cell">요청 ID</TableHead>
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
                <TableRow key={req.id}>
                  <TableCell className="font-mono text-xs hidden md:table-cell">
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
                  <TableCell className="text-sm text-gray-500 max-w-48 hidden md:table-cell">
                    {req.type === "checkout_extension" && req.extensionHours && (
                      <span className="block">{req.extensionHours}시간 연장{req.freeExtension ? " (무료 - 리뷰)" : req.extensionAmount ? ` (${req.extensionAmount.toLocaleString()}원)` : ""}</span>
                    )}
                    {req.type === "cleaning" && req.cleaningOptions && (
                      <>
                        <span className="block font-medium">
                          {CLEANING_LEVEL_LABELS[req.cleaningOptions.serviceLevel]}
                        </span>
                        {req.cleaningOptions.preferredTime &&
                          req.cleaningOptions.serviceLevel !== "dnd" && (
                            <span className="block text-xs">
                              {PREFERRED_TIME_LABELS[req.cleaningOptions.preferredTime]}
                            </span>
                          )}
                        {!req.cleaningOptions.linenChange &&
                          req.cleaningOptions.serviceLevel !== "dnd" && (
                            <span className="block text-xs text-green-600">
                              시트 교체 없음 (Eco)
                            </span>
                          )}
                        {req.cleaningOptions.contactlessSupplies.length > 0 && (
                          <span className="block text-xs truncate">
                            비품: {req.cleaningOptions.contactlessSupplies
                              .map((s) => SUPPLY_ITEM_LABELS[s])
                              .join(", ")}
                            {req.cleaningOptions.leaveAtDoor && " (문 앞)"}
                          </span>
                        )}
                        {req.cleaningOptions.trashRemovalOnly && (
                          <span className="block text-xs text-orange-500">
                            쓰레기 수거만
                          </span>
                        )}
                      </>
                    )}
                    {req.items && req.items.length > 0 && (
                      <span className="block truncate">{req.items.map((i) => `${i.name} x${i.quantity}`).join(", ")}</span>
                    )}
                    {req.note && (
                      <span className="block text-orange-500 truncate">{req.note}</span>
                    )}
                    {!req.items?.length && !req.extensionHours && !req.cleaningOptions && !req.note && "-"}
                  </TableCell>
                  <TableCell>
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[req.status]}`}
                    >
                      {SERVICE_STATUS_LABELS[req.status]}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm hidden md:table-cell">
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
