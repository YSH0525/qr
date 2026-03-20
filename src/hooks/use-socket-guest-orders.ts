"use client";

import { useEffect, useState, useCallback } from "react";
import { getSocket } from "@/lib/socket-client";
import type { OrderWithItems } from "@/types";
import type { ServiceRequest } from "@/types/service";

export function useSocketGuestOrders(roomId: string) {
  const [orders, setOrders] = useState<OrderWithItems[]>([]);
  const [services, setServices] = useState<ServiceRequest[]>([]);

  const fetchData = useCallback(async () => {
    const [ordersRes, servicesRes] = await Promise.all([
      fetch(`/api/orders?roomId=${roomId}`),
      fetch(`/api/service-requests?roomId=${roomId}`),
    ]);
    if (ordersRes.ok) setOrders(await ordersRes.json());
    if (servicesRes.ok) setServices(await servicesRes.json());
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

    const onServiceStatusChanged = (data: { requestId: string; status: string; updatedAt: string }) => {
      setServices((prev) =>
        prev.map((s) =>
          s.requestId === data.requestId
            ? { ...s, status: data.status as ServiceRequest["status"], updatedAt: data.updatedAt }
            : s
        )
      );
    };

    const onReconnect = () => {
      socket.emit("join:room", { roomId });
      void fetchData();
    };

    socket.on("order:status-changed", onOrderStatusChanged);
    socket.on("service:status-changed", onServiceStatusChanged);
    socket.on("connect", onReconnect);

    return () => {
      socket.off("order:status-changed", onOrderStatusChanged);
      socket.off("service:status-changed", onServiceStatusChanged);
      socket.off("connect", onReconnect);
    };
  }, [roomId, fetchData]);

  return { orders, services };
}
