"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { getSocket } from "@/lib/socket-client";
import type { OrderWithItems } from "@/types";
import type { ServiceRequest } from "@/types/service";

/**
 * Socket.io로 관리자 주문을 실시간 구독합니다.
 * use-firestore-orders.ts의 useFirestoreOrders를 대체합니다.
 */
export function useSocketOrders(statusFilter?: string[]) {
  const [orders, setOrders] = useState<OrderWithItems[]>([]);
  const [loading, setLoading] = useState(true);
  const optimisticLockRef = useRef<Set<string>>(new Set());
  const lockTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const statusFilterRef = useRef(statusFilter);
  statusFilterRef.current = statusFilter;

  const optimisticUpdate = useCallback(
    (orderId: string, updates: Partial<OrderWithItems>) => {
      optimisticLockRef.current.add(orderId);
      const existingTimer = lockTimersRef.current.get(orderId);
      if (existingTimer) clearTimeout(existingTimer);
      const timer = setTimeout(() => {
        optimisticLockRef.current.delete(orderId);
        lockTimersRef.current.delete(orderId);
      }, 5000);
      lockTimersRef.current.set(orderId, timer);

      setOrders((prev) =>
        prev.map((o) =>
          o.orderId === orderId ? { ...o, ...updates } : o
        )
      );
    },
    []
  );

  const releaseOptimisticLock = useCallback((orderId: string) => {
    optimisticLockRef.current.delete(orderId);
    const timer = lockTimersRef.current.get(orderId);
    if (timer) {
      clearTimeout(timer);
      lockTimersRef.current.delete(orderId);
    }
  }, []);

  const fetchOrders = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (statusFilterRef.current && statusFilterRef.current.length > 0) {
        for (const s of statusFilterRef.current) {
          params.append("status", s);
        }
      }
      const res = await fetch(`/api/orders?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setOrders(data);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const socket = getSocket();
    if (!socket.connected) socket.connect();

    socket.emit("join:admin");

    // Initial fetch
    fetchOrders();

    const matchesFilter = (status: string) => {
      if (!statusFilterRef.current || statusFilterRef.current.length === 0) return true;
      return statusFilterRef.current.includes(status);
    };

    const onOrderCreated = (order: OrderWithItems) => {
      if (!matchesFilter(order.status)) return;
      setOrders((prev) => {
        if (prev.some((o) => o.orderId === order.orderId)) return prev;
        return [order, ...prev];
      });
    };

    const onOrderStatusChanged = (data: { orderId: string; status: string; updatedAt: string; rejectionReason?: string }) => {
      if (optimisticLockRef.current.has(data.orderId)) return;

      setOrders((prev) => {
        if (!matchesFilter(data.status)) {
          return prev.filter((o) => o.orderId !== data.orderId);
        }
        return prev.map((o) =>
          o.orderId === data.orderId
            ? { ...o, status: data.status as OrderWithItems["status"], updatedAt: data.updatedAt, ...(data.rejectionReason ? { rejectionReason: data.rejectionReason } : {}) }
            : o
        );
      });
    };

    const onOrderDeleted = (data: { orderId: string }) => {
      setOrders((prev) => prev.filter((o) => o.orderId !== data.orderId));
    };

    const onReconnect = () => {
      socket.emit("join:admin");
      fetchOrders();
    };

    socket.on("order:created", onOrderCreated);
    socket.on("order:status-changed", onOrderStatusChanged);
    socket.on("order:deleted", onOrderDeleted);
    socket.on("connect", onReconnect);

    const timers = lockTimersRef.current;
    return () => {
      socket.off("order:created", onOrderCreated);
      socket.off("order:status-changed", onOrderStatusChanged);
      socket.off("order:deleted", onOrderDeleted);
      socket.off("connect", onReconnect);
      for (const timer of timers.values()) clearTimeout(timer);
    };
  }, [fetchOrders]);

  return { orders, loading, optimisticUpdate, releaseOptimisticLock };
}

/**
 * Socket.io로 관리자 서비스 요청을 실시간 구독합니다.
 * use-firestore-orders.ts의 useFirestoreServiceRequests를 대체합니다.
 */
export function useSocketServiceRequests(statusFilter?: string[]) {
  const [serviceRequests, setServiceRequests] = useState<ServiceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const optimisticLockRef = useRef<Set<string>>(new Set());
  const lockTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const statusFilterRef = useRef(statusFilter);
  statusFilterRef.current = statusFilter;

  const optimisticUpdate = useCallback(
    (requestId: string, updates: Partial<ServiceRequest>) => {
      optimisticLockRef.current.add(requestId);
      const existingTimer = lockTimersRef.current.get(requestId);
      if (existingTimer) clearTimeout(existingTimer);
      const timer = setTimeout(() => {
        optimisticLockRef.current.delete(requestId);
        lockTimersRef.current.delete(requestId);
      }, 5000);
      lockTimersRef.current.set(requestId, timer);

      setServiceRequests((prev) =>
        prev.map((r) =>
          r.requestId === requestId ? { ...r, ...updates } : r
        )
      );
    },
    []
  );

  const releaseOptimisticLock = useCallback((requestId: string) => {
    optimisticLockRef.current.delete(requestId);
    const timer = lockTimersRef.current.get(requestId);
    if (timer) {
      clearTimeout(timer);
      lockTimersRef.current.delete(requestId);
    }
  }, []);

  const fetchServiceRequests = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (statusFilterRef.current && statusFilterRef.current.length > 0) {
        for (const s of statusFilterRef.current) {
          params.append("status", s);
        }
      }
      const res = await fetch(`/api/service-requests?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setServiceRequests(data);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const socket = getSocket();
    if (!socket.connected) socket.connect();

    socket.emit("join:admin");

    fetchServiceRequests();

    const matchesFilter = (status: string) => {
      if (!statusFilterRef.current || statusFilterRef.current.length === 0) return true;
      return statusFilterRef.current.includes(status);
    };

    const onServiceCreated = (request: ServiceRequest) => {
      if (!matchesFilter(request.status)) return;
      setServiceRequests((prev) => {
        if (prev.some((r) => r.requestId === request.requestId)) return prev;
        return [request, ...prev];
      });
    };

    const onServiceStatusChanged = (data: { requestId: string; status: string; updatedAt: string }) => {
      if (optimisticLockRef.current.has(data.requestId)) return;

      setServiceRequests((prev) => {
        if (!matchesFilter(data.status)) {
          return prev.filter((r) => r.requestId !== data.requestId);
        }
        return prev.map((r) =>
          r.requestId === data.requestId
            ? { ...r, status: data.status as ServiceRequest["status"], updatedAt: data.updatedAt }
            : r
        );
      });
    };

    const onServiceDeleted = (data: { requestId: string }) => {
      setServiceRequests((prev) => prev.filter((r) => r.requestId !== data.requestId));
    };

    const onReconnect = () => {
      socket.emit("join:admin");
      fetchServiceRequests();
    };

    socket.on("service:created", onServiceCreated);
    socket.on("service:status-changed", onServiceStatusChanged);
    socket.on("service:deleted", onServiceDeleted);
    socket.on("connect", onReconnect);

    const timers = lockTimersRef.current;
    return () => {
      socket.off("service:created", onServiceCreated);
      socket.off("service:status-changed", onServiceStatusChanged);
      socket.off("service:deleted", onServiceDeleted);
      socket.off("connect", onReconnect);
      for (const timer of timers.values()) clearTimeout(timer);
    };
  }, [fetchServiceRequests]);

  return { serviceRequests, loading, optimisticUpdate, releaseOptimisticLock };
}
