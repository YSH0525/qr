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

    const onOrderStatusChanged = (data: { orderId: string; status: string; updatedAt: string; rejectionReason?: string }) => {
      setOrders((prev) =>
        prev.map((o) =>
          o.orderId === data.orderId
            ? { ...o, status: data.status as OrderWithItems["status"], updatedAt: data.updatedAt, ...(data.rejectionReason ? { rejectionReason: data.rejectionReason } : {}) }
            : o
        )
      );
    };

    const onReconnect = () => {
      socket.emit("join:room", { roomId });
      void fetchData();
    };

    socket.on("order:status-changed", onOrderStatusChanged);
    socket.on("connect", onReconnect);

    return () => {
      socket.off("order:status-changed", onOrderStatusChanged);
      socket.off("connect", onReconnect);
    };
  }, [roomId, fetchData]);

  return { orders };
}
