"use client";

import { useEffect, useState, useCallback } from "react";
import { getSocket } from "@/lib/socket-client";
import type { OrderWithItems } from "@/types";

export function useSocketGuestOrders(roomId: string) {
  const [orders, setOrders] = useState<OrderWithItems[]>([]);

  const fetchData = useCallback(async () => {
    const res = await fetch(`/api/orders?roomId=${roomId}`);
    if (res.ok) setOrders(await res.json());
  }, [roomId]);

  useEffect(() => {
    const socket = getSocket();
    if (!socket.connected) socket.connect();

    socket.emit("join:room", { roomId });

    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data fetch
    void fetchData();

    const onOrderCreated = (order: OrderWithItems) => {
      setOrders((prev) => {
        if (prev.some((o) => o.orderId === order.orderId)) return prev;
        return [order, ...prev];
      });
    };

    const onOrderStatusChanged = (data: { orderId: string; status: string; updatedAt: string; rejectionReason?: string }) => {
      setOrders((prev) =>
        prev.map((o) =>
          o.orderId === data.orderId
            ? { ...o, status: data.status as OrderWithItems["status"], updatedAt: data.updatedAt, ...(data.rejectionReason ? { rejectionReason: data.rejectionReason } : {}) }
            : o
        )
      );
    };

    const onOrderDeleted = (data: { orderId: string }) => {
      setOrders((prev) => prev.filter((o) => o.orderId !== data.orderId));
    };

    const onReconnect = () => {
      socket.emit("join:room", { roomId });
      void fetchData();
    };

    socket.on("order:created", onOrderCreated);
    socket.on("order:status-changed", onOrderStatusChanged);
    socket.on("order:deleted", onOrderDeleted);
    socket.on("connect", onReconnect);

    // Polling fallback: refresh every 15s in case socket events are missed
    const pollInterval = setInterval(() => {
      void fetchData();
    }, 15_000);

    return () => {
      socket.off("order:created", onOrderCreated);
      socket.off("order:status-changed", onOrderStatusChanged);
      socket.off("order:deleted", onOrderDeleted);
      socket.off("connect", onReconnect);
      clearInterval(pollInterval);
    };
  }, [roomId, fetchData]);

  return { orders };
}
