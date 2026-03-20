"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { getSocket } from "@/lib/socket-client";
import type { Socket } from "socket.io-client";

let globalSocket: Socket | null = null;

function subscribe(callback: () => void) {
  const socket = getSocket();
  globalSocket = socket;

  socket.on("connect", callback);
  socket.on("disconnect", callback);

  if (!socket.connected) {
    socket.connect();
  }

  return () => {
    socket.off("connect", callback);
    socket.off("disconnect", callback);
  };
}

function getSnapshot(): Socket | null {
  return globalSocket;
}

function getServerSnapshot(): Socket | null {
  return null;
}

export function useSocket() {
  const socket = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const s = getSocket();

    function onConnect() {
      setIsConnected(true);
    }
    function onDisconnect() {
      setIsConnected(false);
    }

    s.on("connect", onConnect);
    s.on("disconnect", onDisconnect);

    if (s.connected) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- sync initial connection state
      setIsConnected(true);
    }

    return () => {
      s.off("connect", onConnect);
      s.off("disconnect", onDisconnect);
    };
  }, []);

  return { socket, isConnected };
}
