"use client";

import { useEffect, useRef, useCallback } from "react";

export function useOrderSSE(
  onEvent: (event: string, data: Record<string, unknown>) => void,
  onReconnect?: () => void
) {
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;
  const onReconnectRef = useRef(onReconnect);
  onReconnectRef.current = onReconnect;

  const connect = useCallback(() => {
    let isFirstConnect = true;
    const es = new EventSource("/api/sse/orders");

    es.addEventListener("connected", () => {
      if (!isFirstConnect) {
        // 재연결된 경우 — 끊긴 사이 누락된 데이터 복구
        onReconnectRef.current?.();
      }
      isFirstConnect = false;
    });

    es.addEventListener("new-order", (e) => {
      onEventRef.current("new-order", JSON.parse(e.data));
    });

    es.addEventListener("order-updated", (e) => {
      onEventRef.current("order-updated", JSON.parse(e.data));
    });

    es.onerror = () => {
      // EventSource auto-reconnects, 재연결 시 connected 이벤트로 감지
    };

    return es;
  }, []);

  useEffect(() => {
    const es = connect();
    return () => es.close();
  }, [connect]);
}
