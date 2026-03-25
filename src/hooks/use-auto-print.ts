"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useBluetoothPrinterContext } from "@/components/admin/bluetooth-printer-provider";
import { buildOrderReceiptRaster } from "@/lib/escpos-order";
import type { OrderWithItems } from "@/types";
import { toast } from "sonner";

const AUTO_PRINT_KEY = "auto_print_enabled";

/**
 * 새 주문이 들어올 때 자동으로 블루투스 프린터로 영수증을 출력하는 훅.
 * 대시보드에서 사용하며, 주문 목록 변경을 감지하여 새 주문만 출력합니다.
 */
export function useAutoPrint(orders: OrderWithItems[]) {
  const printer = useBluetoothPrinterContext();
  const [autoPrintEnabled, setAutoPrintEnabled] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(AUTO_PRINT_KEY) === "1";
  });

  const prevOrderIdsRef = useRef<Set<string>>(new Set());
  const isFirstLoadRef = useRef(true);
  const printQueueRef = useRef<OrderWithItems[]>([]);
  const isPrintingRef = useRef(false);

  const hotelName =
    typeof window !== "undefined"
      ? (process.env.NEXT_PUBLIC_HOTEL_NAME || "")
      : "";

  const toggleAutoPrint = useCallback(() => {
    setAutoPrintEnabled((prev) => {
      const next = !prev;
      localStorage.setItem(AUTO_PRINT_KEY, next ? "1" : "0");
      if (next) {
        toast.success("자동 출력이 활성화되었습니다");
      } else {
        toast.info("자동 출력이 비활성화되었습니다");
      }
      return next;
    });
  }, []);

  // 큐에서 하나씩 출력
  const processQueue = useCallback(async () => {
    if (isPrintingRef.current) return;
    if (printQueueRef.current.length === 0) return;
    if (!printer.isConnected) return;

    isPrintingRef.current = true;

    while (printQueueRef.current.length > 0) {
      const order = printQueueRef.current.shift()!;
      try {
        const receiptData = buildOrderReceiptRaster(order, hotelName);
        const success = await printer.print(receiptData);
        if (success) {
          toast.success(`${order.roomNumber}호 주문 영수증 출력 완료`);
        } else {
          toast.error(`${order.roomNumber}호 영수증 출력 실패`);
        }
      } catch {
        toast.error(`${order.roomNumber}호 영수증 출력 중 오류`);
      }
      // 다음 출력 전 잠깐 대기 (프린터 버퍼 안정화)
      if (printQueueRef.current.length > 0) {
        await new Promise((r) => setTimeout(r, 1000));
      }
    }

    isPrintingRef.current = false;
  }, [printer, hotelName]);

  // 새 주문 감지
  useEffect(() => {
    if (orders.length === 0 && isFirstLoadRef.current) return;

    const currentIds = new Set(orders.map((o) => o.orderId));

    if (isFirstLoadRef.current) {
      prevOrderIdsRef.current = currentIds;
      isFirstLoadRef.current = false;
      return;
    }

    if (!autoPrintEnabled || !printer.isConnected) {
      prevOrderIdsRef.current = currentIds;
      return;
    }

    // 새로 추가된 주문만 큐에 넣기
    for (const order of orders) {
      if (
        !prevOrderIdsRef.current.has(order.orderId) &&
        order.status === "pending"
      ) {
        printQueueRef.current.push(order);
      }
    }

    prevOrderIdsRef.current = currentIds;

    // 큐 처리 시작
    processQueue();
  }, [orders, autoPrintEnabled, printer.isConnected, processQueue]);

  return {
    autoPrintEnabled,
    toggleAutoPrint,
    isAutoPrintSupported: printer.isSupported,
    isPrinterConnected: printer.isConnected,
    printerName: printer.printerName,
    connectPrinter: printer.connect,
    disconnectPrinter: printer.disconnect,
    isPrinting: printer.isPrinting,
    // 수동 출력
    printOrder: async (order: OrderWithItems) => {
      if (!printer.isConnected) {
        const connected = await printer.connect();
        if (!connected) return false;
      }
      const receiptData = buildOrderReceiptRaster(order, hotelName);
      const success = await printer.print(receiptData);
      if (success) {
        toast.success(`${order.roomNumber}호 주문 영수증 출력 완료`);
      } else {
        toast.error(printer.error || "영수증 출력에 실패했습니다");
      }
      return success;
    },
  };
}
