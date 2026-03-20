"use client";

import { useEffect, useState, useCallback } from "react";
import { getSocket } from "@/lib/socket-client";

interface DeferredPayment {
  room: { id: string; roomNumber: string; roomId: string };
  totalDeferred: number;
  orderCount: number;
}

export function useSocketDeferred() {
  const [deferredPayments, setDeferredPayments] = useState<DeferredPayment[]>([]);

  const fetchDeferred = useCallback(async () => {
    try {
      const res = await fetch("/api/payments/deferred");
      if (res.ok) setDeferredPayments(await res.json());
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    const socket = getSocket();
    if (!socket.connected) socket.connect();

    socket.emit("join:admin");

    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data fetch
    void fetchDeferred();

    const onDeferredUpdated = () => {
      void fetchDeferred();
    };

    const onReconnect = () => {
      socket.emit("join:admin");
      void fetchDeferred();
    };

    socket.on("deferred:updated", onDeferredUpdated);
    socket.on("connect", onReconnect);

    return () => {
      socket.off("deferred:updated", onDeferredUpdated);
      socket.off("connect", onReconnect);
    };
  }, [fetchDeferred]);

  return { deferredPayments, fetchDeferred };
}
