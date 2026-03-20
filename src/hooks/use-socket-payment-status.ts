"use client";

import { useEffect, useState, useRef } from "react";
import { getSocket } from "@/lib/socket-client";

type PaymentResult = "pending" | "completed" | "not_found" | "timeout";

export function useSocketPaymentStatus(orderId: string | null) {
  const [status, setStatus] = useState<PaymentResult>("pending");
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    if (!orderId) return;

    const socket = getSocket();
    if (!socket.connected) socket.connect();

    socket.emit("join:payment", { orderId });

    // 2분 타임아웃
    timeoutRef.current = setTimeout(() => {
      setStatus("timeout");
    }, 120000);

    const onPaymentStatusChanged = (data: { orderId: string; status: "completed" | "not_found" }) => {
      if (data.orderId !== orderId) return;
      setStatus(data.status);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };

    // 재연결 시 REST로 1회 확인 + room 재참여
    const onReconnect = async () => {
      socket.emit("join:payment", { orderId });
      try {
        const res = await fetch(`/api/payments/kakaopay/status?orderId=${orderId}`);
        if (res.ok) {
          const data = await res.json();
          if (data.status === "completed" || data.status === "not_found") {
            setStatus(data.status);
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
          }
        }
      } catch {
        // ignore
      }
    };

    socket.on("payment:status-changed", onPaymentStatusChanged);
    socket.on("connect", onReconnect);

    // 초기 상태도 1회 확인 (소켓 연결 전에 이미 완료되었을 수 있음)
    onReconnect();

    return () => {
      socket.off("payment:status-changed", onPaymentStatusChanged);
      socket.off("connect", onReconnect);
      socket.emit("leave:payment", { orderId });
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [orderId]);

  return { status };
}
