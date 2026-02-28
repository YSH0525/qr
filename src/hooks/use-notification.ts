"use client";

import { useCallback, useEffect, useRef } from "react";

export function useBrowserNotification() {
  const permissionRef = useRef<NotificationPermission>("default");

  useEffect(() => {
    if (!("Notification" in window)) return;

    permissionRef.current = Notification.permission;

    if (Notification.permission === "default") {
      Notification.requestPermission().then((perm) => {
        permissionRef.current = perm;
      });
    }
  }, []);

  const notify = useCallback(
    (title: string, body: string) => {
      if (!("Notification" in window)) return;

      if (permissionRef.current !== "granted") {
        // 권한 재요청
        Notification.requestPermission().then((perm) => {
          permissionRef.current = perm;
          if (perm === "granted") {
            new Notification(title, {
              body,
              icon: "/favicon.ico",
              tag: "new-order",
              requireInteraction: true,
            });
          }
        });
        return;
      }

      new Notification(title, {
        body,
        icon: "/favicon.ico",
        tag: "new-order",
        requireInteraction: true, // 수동으로 닫기 전까지 유지
      });
    },
    []
  );

  return { notify };
}
