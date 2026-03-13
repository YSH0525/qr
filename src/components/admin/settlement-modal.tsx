"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Bluetooth } from "lucide-react";
import { useBluetoothPrinterContext } from "./bluetooth-printer-provider";
import { buildSettlementReceiptRaster } from "@/lib/escpos-raster";
import { toast } from "sonner";

interface SettlementItem {
  menuItemName: string;
  menuItemPrice: number;
  quantity: number;
  subtotal: number;
}

interface PreviewOrder {
  orderId: string;
  totalAmount: number;
  createdAt: string;
  note: string | null;
  items: SettlementItem[];
}

interface PreviewExtension {
  requestId: string;
  categoryName: string;
  extensionHours: number;
  extensionAmount: number;
  createdAt: string;
}

export interface SettlementPreviewData {
  totalAmount: number;
  roomNumber: string;
  roomId: string;
  orderCount: number;
  orders: PreviewOrder[];
  extensions?: PreviewExtension[];
}

interface SettlementModalProps {
  open: boolean;
  onClose: () => void;
  preview: SettlementPreviewData | null;
  onConfirm: () => Promise<void>;
}

export function SettlementModal({
  open,
  onClose,
  preview,
  onConfirm,
}: SettlementModalProps) {
  const [settling, setSettling] = useState(false);
  const [settled, setSettled] = useState(false);
  const printer = useBluetoothPrinterContext();

  const formatPrice = (n: number) => n.toLocaleString("ko-KR") + "원";
  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
  };
  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  };

  const handleConfirm = async () => {
    setSettling(true);
    try {
      await onConfirm();
      setSettled(true);
    } finally {
      setSettling(false);
    }
  };

  const handleBluetoothPrint = async () => {
    if (!preview) return;

    // 프린터 미연결 시 연결 시도
    if (!printer.isConnected) {
      const connected = await printer.connect();
      if (!connected) return;
    }

    const receiptPayload = {
      settled: preview.orderCount,
      totalAmount: preview.totalAmount,
      roomNumber: preview.roomNumber,
      settledAt: new Date().toISOString(),
      orders: preview.orders,
      extensions: preview.extensions,
    };

    const receiptData = buildSettlementReceiptRaster(receiptPayload);

    const success = await printer.print(receiptData);
    if (success) {
      toast.success("영수증이 출력되었습니다.");
    } else {
      toast.error(printer.error || "영수증 출력에 실패했습니다.");
    }
  };

  const handleClose = () => {
    setSettled(false);
    onClose();
  };

  if (!preview) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="max-w-md max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>
            {settled ? "정산 완료" : "정산 내역 확인"} — {preview.roomNumber}호
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 py-2">
          {/* 요약 */}
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-500">총 정산 금액</span>
              <span className="text-2xl font-bold">
                {formatPrice(preview.totalAmount)}
              </span>
            </div>
            <div className="flex justify-between items-center mt-1">
              <span className="text-sm text-gray-500">건수</span>
              <span className="text-sm">{preview.orderCount}건</span>
            </div>
          </div>

          {/* 주문 내역 */}
          {preview.orders.map((order) => (
            <div key={order.orderId} className="border rounded-lg p-3">
              <div className="flex justify-between text-xs text-gray-400 mb-2">
                <span>#{order.orderId}</span>
                <span>
                  {formatDate(order.createdAt)} {formatTime(order.createdAt)}
                </span>
              </div>
              {order.items.map((item, i) => (
                <div key={i} className="flex justify-between py-0.5 text-sm">
                  <span>
                    {item.menuItemName} x{item.quantity}
                  </span>
                  <span>{formatPrice(item.subtotal)}</span>
                </div>
              ))}
              {order.note && (
                <p className="text-xs text-gray-400 mt-1">* {order.note}</p>
              )}
              <div className="flex justify-between border-t mt-2 pt-1 font-semibold text-sm">
                <span>소계</span>
                <span>{formatPrice(order.totalAmount)}</span>
              </div>
            </div>
          ))}

          {/* 체크아웃 연장 */}
          {preview.extensions && preview.extensions.length > 0 && (
            <div className="border rounded-lg p-3">
              <p className="text-xs font-semibold text-gray-500 mb-2">
                체크아웃 연장
              </p>
              {preview.extensions.map((ext) => (
                <div key={ext.requestId} className="mb-1">
                  <div className="flex justify-between text-xs text-gray-400">
                    <span>#{ext.requestId}</span>
                    <span>
                      {formatDate(ext.createdAt)} {formatTime(ext.createdAt)}
                    </span>
                  </div>
                  <div className="flex justify-between py-0.5 text-sm">
                    <span>
                      {ext.categoryName} +{ext.extensionHours}시간
                    </span>
                    <span>{formatPrice(ext.extensionAmount)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          {settled ? (
            <div className="flex flex-col gap-3 w-full">
              <div className="flex gap-2 justify-end">
                {printer.isSupported && (
                  <Button
                    variant="outline"
                    onClick={handleBluetoothPrint}
                    disabled={printer.isPrinting}
                  >
                    {printer.isPrinting ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Bluetooth className="w-4 h-4 mr-2" />
                    )}
                    {printer.isPrinting
                      ? "인쇄 중..."
                      : printer.isConnected
                        ? "블루투스 인쇄"
                        : "프린터 연결 후 인쇄"}
                  </Button>
                )}
                <Button onClick={handleClose}>닫기</Button>
              </div>
            </div>
          ) : (
            <>
              <Button variant="outline" onClick={handleClose}>
                취소
              </Button>
              <Button onClick={handleConfirm} disabled={settling}>
                {settling && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                정산 확인
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
