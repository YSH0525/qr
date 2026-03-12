"use client";

import { useState, useEffect, use, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Sparkles,
  Clock,
  Package,
  ConciergeBell,
  ClipboardList,
  SprayCan,
  Droplets,
  Loader2,
} from "lucide-react";
import type { ServiceCategory } from "@/types/service";
import { useClosingTime } from "@/hooks/use-closing-time";

const ICON_MAP: Record<string, React.ElementType> = {
  Sparkles,
  Clock,
  Package,
  SprayCan,
  sparkles: Sparkles,
  clock: Clock,
  package: Package,
  sprayCan: SprayCan,
};

const TYPE_COLORS: Record<string, string> = {
  cleaning: "from-emerald-400 to-emerald-600",
  checkout_extension: "from-amber-400 to-amber-600",
  amenity: "from-sky-400 to-sky-600",
};

interface Room {
  id: string;
  roomNumber: string;
  roomId: string;
}

export default function EasyTapHub({
  params,
}: {
  params: Promise<{ roomId: string }>;
}) {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-400">로딩 중...</p>
      </div>
    }>
      <EasyTapHubContent params={params} />
    </Suspense>
  );
}

function EasyTapHubContent({
  params,
}: {
  params: Promise<{ roomId: string }>;
}) {
  const { roomId } = use(params);
  const [room, setRoom] = useState<Room | null>(null);
  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [error, setError] = useState("");
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "warning" } | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isClosed, closingLabel } = useClosingTime();
  const [towelLoading, setTowelLoading] = useState(false);

  const handleTowelRequest = async () => {
    if (isClosed || towelLoading) return;
    setTowelLoading(true);
    try {
      const res = await fetch("/api/service-requests/quick", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomId, type: "towel" }),
      });
      if (res.ok) {
        setToast({ message: "수건 요청이 접수되었습니다", type: "success" });
      } else {
        const data = await res.json().catch(() => null);
        setToast({ message: data?.error || "요청 실패", type: "error" });
      }
    } catch {
      setToast({ message: "네트워크 오류가 발생했습니다", type: "error" });
    } finally {
      setTowelLoading(false);
      setTimeout(() => setToast(null), 3000);
    }
  };

  useEffect(() => {
    fetch(`/api/rooms/${roomId}`)
      .then((r) => {
        if (!r.ok) throw new Error("객실을 찾을 수 없습니다");
        return r.json();
      })
      .then(setRoom)
      .catch((e) => setError(e.message));

    fetch("/api/service-categories")
      .then((r) => r.json())
      .then((data: ServiceCategory[]) => {
        setCategories(data.filter((c) => c.isActive));
      });
  }, [roomId]);

  // Show toast for payment results
  useEffect(() => {
    const payment = searchParams.get("payment");
    if (!payment) return;

    const messages: Record<string, { message: string; type: "success" | "error" | "warning" }> = {
      success: { message: "결제가 완료되었습니다", type: "success" },
      cancel: { message: "결제가 취소되었습니다", type: "warning" },
      fail: { message: "결제에 실패했습니다", type: "error" },
    };

    const toastInfo = messages[payment];
    if (toastInfo) {
      setToast(toastInfo);
      // Remove query param from URL without reload
      router.replace(`/room/${roomId}`, { scroll: false });
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [searchParams, roomId, router]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center">
          <p className="text-red-500 text-lg">{error}</p>
          <p className="text-gray-400 mt-2">QR 코드를 다시 스캔해주세요</p>
        </div>
      </div>
    );
  }

  if (!room) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-400">로딩 중...</p>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-b from-gray-50 to-white">
      {/* Payment Toast */}
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 animate-slide-down">
          <div
            className={`px-5 py-3 rounded-xl shadow-lg text-white text-sm font-medium ${
              toast.type === "success"
                ? "bg-emerald-500"
                : toast.type === "warning"
                ? "bg-amber-500"
                : "bg-red-500"
            }`}
          >
            {toast.message}
          </div>
        </div>
      )}

      <div className="max-w-lg mx-auto px-5 py-4">
        {/* Header */}
        <div className="mb-4 -mx-5 -mt-4">
          <div className="px-5 pt-6 pb-4 bg-gradient-to-br from-emerald-500 via-emerald-600 to-emerald-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-light tracking-[0.2em] text-white">더반스테이</p>
                <p className="text-[8px] tracking-[0.12em] text-emerald-200 uppercase mt-0.5">THE VAN STAY</p>
              </div>
              <h1 className="text-2xl font-bold text-white tracking-wide">Easy Tap</h1>
              <p className="text-sm font-medium text-white/90">{room.roomNumber}호</p>
            </div>
          </div>
        </div>

        {/* Closing Banner */}
        {isClosed && (
          <div className="bg-red-500 text-white text-center py-3 px-4 rounded-xl mb-4 text-sm font-semibold">
            영업이 마감되었습니다 ({closingLabel} 마감)
          </div>
        )}

        {/* Service Grid */}
        <div className="grid grid-cols-2 gap-3">
          {categories.map((cat) => {
            const IconComponent = ICON_MAP[cat.icon] || Package;
            const colorClass = TYPE_COLORS[cat.type] || "from-gray-400 to-gray-600";

            return (
              <button
                key={cat.id}
                onClick={() => {
                  if (!isClosed) router.push(`/room/${roomId}/service/${cat.id}`);
                }}
                disabled={isClosed}
                className={`bg-white rounded-2xl border border-gray-100 p-4 flex flex-col items-center gap-2 shadow-sm transition-all duration-200 ${
                  isClosed
                    ? "opacity-50 cursor-not-allowed"
                    : "hover:shadow-md hover:scale-[1.02] active:scale-95"
                }`}
              >
                <div
                  className={`w-12 h-12 rounded-xl bg-gradient-to-br ${colorClass} flex items-center justify-center shadow-sm`}
                >
                  <IconComponent className="w-6 h-6 text-white" />
                </div>
                <div className="text-center">
                  <p className="font-semibold text-gray-900">{cat.name}</p>
                  {cat.description && (
                    <p className="text-xs text-gray-400 mt-0.5">
                      {cat.description}
                    </p>
                  )}
                </div>
              </button>
            );
          })}

          {/* 수건 요청 (고정) */}
          <button
            onClick={handleTowelRequest}
            disabled={isClosed || towelLoading}
            className={`bg-white rounded-2xl border border-gray-100 p-4 flex flex-col items-center gap-2 shadow-sm transition-all duration-200 ${
              isClosed
                ? "opacity-50 cursor-not-allowed"
                : towelLoading
                ? "opacity-70 cursor-wait"
                : "hover:shadow-md hover:scale-[1.02] active:scale-95"
            }`}
          >
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-400 to-cyan-600 flex items-center justify-center shadow-sm">
              {towelLoading ? (
                <Loader2 className="w-6 h-6 text-white animate-spin" />
              ) : (
                <Droplets className="w-6 h-6 text-white" />
              )}
            </div>
            <div className="text-center">
              <p className="font-semibold text-gray-900">수건 요청</p>
              <p className="text-xs text-gray-400 mt-0.5">
                원탭으로 수건을 요청합니다
              </p>
            </div>
          </button>

          {/* 룸 오더 (고정) */}
          <button
            onClick={() => { if (!isClosed) router.push(`/room/${roomId}/menu`); }}
            disabled={isClosed}
            className={`bg-white rounded-2xl border border-gray-100 p-6 flex flex-col items-center gap-3 shadow-sm transition-all duration-200 ${
              isClosed
                ? "opacity-50 cursor-not-allowed"
                : "hover:shadow-md hover:scale-[1.02] active:scale-95"
            }`}
          >
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center shadow-sm">
              <ConciergeBell className="w-6 h-6 text-white" />
            </div>
            <div className="text-center">
              <p className="font-semibold text-gray-900">룸 오더</p>
              <p className="text-xs text-gray-400 mt-0.5">
                물품구매 및 물품요청을 할 수 있습니다.
              </p>
            </div>
          </button>

          {/* 주문현황 */}
          <button
            onClick={() => router.push(`/room/${roomId}/orders`)}
            className="bg-white rounded-2xl border border-gray-100 p-6 flex flex-col items-center gap-3 shadow-sm hover:shadow-md hover:scale-[1.02] active:scale-95 transition-all duration-200"
          >
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-400 to-indigo-600 flex items-center justify-center shadow-sm">
              <ClipboardList className="w-6 h-6 text-white" />
            </div>
            <div className="text-center">
              <p className="font-semibold text-gray-900">주문현황</p>
              <p className="text-xs text-gray-400 mt-0.5">
                주문 및 서비스 요청 상태 확인
              </p>
            </div>
          </button>
        </div>

        {/* Footer */}
        <div className="text-center mt-6">
          <p className="text-xs text-black">
            더반스테이 · Easy Tap
          </p>
        </div>
      </div>
    </div>
  );
}
