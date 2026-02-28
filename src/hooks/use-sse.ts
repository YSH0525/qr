"use client";

import { useEffect, useRef, useCallback } from "react";

export function useOrderSSE(
  onEvent: (event: string, data: Record<string, unknown>) => void
) {
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  const connect = useCallback(() => {
    const es = new EventSource("/api/sse/orders");

    es.addEventListener("new-order", (e) => {
      onEventRef.current("new-order", JSON.parse(e.data));
    });

    es.addEventListener("order-updated", (e) => {
      onEventRef.current("order-updated", JSON.parse(e.data));
    });

    es.onerror = () => {
      // EventSource auto-reconnects
    };

    return es;
  }, []);

  useEffect(() => {
    const es = connect();
    return () => es.close();
  }, [connect]);
}
