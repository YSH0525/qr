"use client";

import { useState, useEffect } from "react";
import { CLOSING_HOUR, CLOSING_MINUTE, CLOSING_TIME_LABEL } from "@/lib/constants";

function checkClosed(): boolean {
  const now = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" })
  );
  const h = now.getHours();
  const m = now.getMinutes();
  return h > CLOSING_HOUR || (h === CLOSING_HOUR && m >= CLOSING_MINUTE);
}

export function useClosingTime() {
  const [isClosed, setIsClosed] = useState(checkClosed);

  useEffect(() => {
    const interval = setInterval(() => {
      setIsClosed(checkClosed());
    }, 60_000);
    return () => clearInterval(interval);
  }, []);

  return { isClosed, closingLabel: CLOSING_TIME_LABEL };
}
