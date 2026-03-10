"use client";

import { useEffect } from "react";

export default function DemoPage() {
  useEffect(() => {
    window.location.href = "/api/demo";
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <p className="text-gray-400">객실 페이지로 이동 중...</p>
    </div>
  );
}
