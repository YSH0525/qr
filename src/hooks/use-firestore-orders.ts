"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { firestore } from "@/lib/firebase";
import {
  collection,
  query,
  where,
  onSnapshot,
  getDocs,
  orderBy,
} from "firebase/firestore";
import type { OrderWithItems } from "@/types";
import type { ServiceRequest } from "@/types/service";

/**
 * Firestore onSnapshot으로 활성 주문을 실시간 구독합니다.
 * items 서브컬렉션도 함께 로드합니다.
 */
export function useFirestoreOrders(
  statusFilter?: string[],
) {
  const [orders, setOrders] = useState<OrderWithItems[]>([]);
  const [loading, setLoading] = useState(true);
  // 낙관적 업데이트 시 onSnapshot 결과를 무시하기 위한 잠금
  const optimisticLockRef = useRef<Set<string>>(new Set());
  const lockTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  // 낙관적 업데이트: 로컬 상태를 즉시 변경하고 잠금
  const optimisticUpdate = useCallback(
    (orderId: string, updates: Partial<OrderWithItems>) => {
      optimisticLockRef.current.add(orderId);
      // 기존 타이머가 있다면 클리어
      const existingTimer = lockTimersRef.current.get(orderId);
      if (existingTimer) clearTimeout(existingTimer);
      // 5초 후 잠금 해제 (Firestore 반영 대기)
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

  // 낙관적 업데이트 해제 (API 성공/실패 후 호출)
  const releaseOptimisticLock = useCallback((orderId: string) => {
    optimisticLockRef.current.delete(orderId);
    const timer = lockTimersRef.current.get(orderId);
    if (timer) {
      clearTimeout(timer);
      lockTimersRef.current.delete(orderId);
    }
  }, []);

  useEffect(() => {
    const constraints = [];
    if (statusFilter && statusFilter.length > 0) {
      constraints.push(where("status", "in", statusFilter));
    }

    const q = query(
      collection(firestore, "orders"),
      ...constraints,
    );

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      // items 서브컬렉션을 병렬로 로드
      const ordersWithItems = await Promise.all(
        snapshot.docs.map(async (d) => {
          const data = d.data();
          const itemsSnap = await getDocs(
            collection(firestore, "orders", d.id, "items")
          );
          const items = itemsSnap.docs.map((item) => ({
            id: item.id,
            ...item.data(),
          }));
          return { id: d.id, ...data, items } as unknown as OrderWithItems;
        })
      );

      // createdAt 기준 내림차순 정렬
      ordersWithItems.sort((a, b) =>
        b.createdAt > a.createdAt ? 1 : b.createdAt < a.createdAt ? -1 : 0
      );

      // 낙관적 잠금된 주문은 서버 데이터로 덮어쓰지 않음
      setOrders((prev) => {
        const lockedIds = optimisticLockRef.current;
        if (lockedIds.size === 0) return ordersWithItems;

        const lockedOrders = new Map(
          prev.filter((o) => lockedIds.has(o.orderId)).map((o) => [o.orderId, o])
        );

        return ordersWithItems.map((o) =>
          lockedOrders.has(o.orderId) ? lockedOrders.get(o.orderId)! : o
        );
      });

      setLoading(false);
    });

    return () => {
      unsubscribe();
      // 클린업 시 모든 타이머 해제
      for (const timer of lockTimersRef.current.values()) {
        clearTimeout(timer);
      }
    };
  }, [statusFilter]);

  return { orders, loading, optimisticUpdate, releaseOptimisticLock };
}

/**
 * Firestore onSnapshot으로 서비스 요청을 실시간 구독합니다.
 */
export function useFirestoreServiceRequests(
  statusFilter?: string[],
) {
  const [serviceRequests, setServiceRequests] = useState<ServiceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const optimisticLockRef = useRef<Set<string>>(new Set());
  const lockTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

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

  useEffect(() => {
    const constraints = [];
    if (statusFilter && statusFilter.length > 0) {
      constraints.push(where("status", "in", statusFilter));
    }

    const q = query(
      collection(firestore, "serviceRequests"),
      ...constraints,
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const requests = snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      })) as unknown as ServiceRequest[];

      requests.sort((a, b) =>
        b.createdAt > a.createdAt ? 1 : b.createdAt < a.createdAt ? -1 : 0
      );

      setServiceRequests((prev) => {
        const lockedIds = optimisticLockRef.current;
        if (lockedIds.size === 0) return requests;

        const lockedRequests = new Map(
          prev.filter((r) => lockedIds.has(r.requestId)).map((r) => [r.requestId, r])
        );

        return requests.map((r) =>
          lockedRequests.has(r.requestId) ? lockedRequests.get(r.requestId)! : r
        );
      });

      setLoading(false);
    });

    return () => {
      unsubscribe();
      for (const timer of lockTimersRef.current.values()) {
        clearTimeout(timer);
      }
    };
  }, [statusFilter]);

  return { serviceRequests, loading, optimisticUpdate, releaseOptimisticLock };
}
