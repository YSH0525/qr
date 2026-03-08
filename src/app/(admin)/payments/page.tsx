"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import {
  SettlementModal,
  type SettlementPreviewData,
} from "@/components/admin/settlement-modal";

interface DeferredPayment {
  room: {
    id: string;
    roomNumber: string;
    roomId: string;
    floor: string | null;
  };
  deferredOrders: {
    id: string;
    orderId: string;
    totalAmount: number;
    createdAt: string;
  }[];
  totalDeferred: number;
  orderCount: number;
}

export default function PaymentsPage() {
  const [payments, setPayments] = useState<DeferredPayment[]>([]);
  const [settlementPreview, setSettlementPreview] = useState<SettlementPreviewData | null>(null);
  const [settlementModalOpen, setSettlementModalOpen] = useState(false);

  const fetchPayments = () => {
    fetch("/api/payments/deferred")
      .then((r) => r.json())
      .then(setPayments);
  };

  useEffect(() => {
    fetchPayments();
  }, []);

  const settleRoom = async (roomId: string) => {
    const res = await fetch(`/api/payments/deferred/${roomId}/preview`);
    if (res.ok) {
      const data: SettlementPreviewData = await res.json();
      setSettlementPreview(data);
      setSettlementModalOpen(true);
    } else {
      toast.error("정산 내역 조회 실패");
    }
  };

  const handleSettleConfirm = async () => {
    if (!settlementPreview) return;

    const res = await fetch(
      `/api/payments/deferred/${settlementPreview.roomId}/settle`,
      { method: "POST" }
    );

    if (res.ok) {
      const data = await res.json();
      toast.success(
        `${settlementPreview.roomNumber}호 정산 완료: ${data.settled}건, ${data.totalAmount.toLocaleString()}원`
      );
      fetchPayments();
    } else {
      toast.error("정산 처리 실패");
    }
  };

  const formatPrice = (price: number) => price.toLocaleString("ko-KR") + "원";
  const totalAll = payments.reduce((sum, p) => sum + p.totalDeferred, 0);

  return (
    <div className="p-3 md:p-6 h-full flex flex-col overflow-hidden">
      <h1 className="text-xl md:text-2xl font-bold mb-4 md:mb-6 shrink-0">후불결제 정산</h1>

      <Card className="mb-4 md:mb-6 shrink-0">
        <CardContent className="p-4 md:p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs md:text-sm text-gray-500">총 미정산 금액</p>
              <p className="text-2xl md:text-3xl font-bold text-red-600">
                {formatPrice(totalAll)}
              </p>
            </div>
            <div>
              <p className="text-xs md:text-sm text-gray-500">미정산 객실</p>
              <p className="text-2xl md:text-3xl font-bold">{payments.length}개</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="flex-1 min-h-0 flex flex-col">
        <CardHeader className="shrink-0">
          <CardTitle>객실별 미정산 내역</CardTitle>
        </CardHeader>
        <CardContent className="flex-1 min-h-0 overflow-y-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>객실</TableHead>
                <TableHead>주문 건수</TableHead>
                <TableHead>미정산 금액</TableHead>
                <TableHead>정산</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payments.map((p) => (
                <TableRow key={p.room.id}>
                  <TableCell className="font-semibold">
                    {p.room.roomNumber}호
                  </TableCell>
                  <TableCell>{p.orderCount}건</TableCell>
                  <TableCell className="font-semibold text-red-600">
                    {formatPrice(p.totalDeferred)}
                  </TableCell>
                  <TableCell>
                    <Button
                      size="sm"
                      onClick={() => settleRoom(p.room.roomId)}
                    >
                      정산
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {payments.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={4}
                    className="text-center text-gray-400 py-8"
                  >
                    미정산 내역이 없습니다
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <SettlementModal
        open={settlementModalOpen}
        onClose={() => {
          setSettlementModalOpen(false);
          setSettlementPreview(null);
        }}
        preview={settlementPreview}
        onConfirm={handleSettleConfirm}
      />
    </div>
  );
}
