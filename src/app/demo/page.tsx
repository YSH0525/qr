"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function DemoPage() {
  const router = useRouter();

  useEffect(() => {
    fetch("/api/demo", { redirect: "manual" })
      .then((res) => {
        const location = res.headers.get("location");
        if (location) {
          router.replace(location);
        }
      })
      .catch(() => {
        // fallback: direct API call
        window.location.href = "/api/demo";
      });
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <p className="text-gray-400">객실 페이지로 이동 중...</p>
    </div>
  );
}
