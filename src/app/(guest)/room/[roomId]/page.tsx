"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import {
  Sparkles,
  Clock,
  Package,
  ConciergeBell,
  ClipboardList,
  SprayCan,
} from "lucide-react";
import type { ServiceCategory } from "@/types/service";

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
  const { roomId } = use(params);
  const [room, setRoom] = useState<Room | null>(null);
  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [error, setError] = useState("");
  const router = useRouter();

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
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      <div className="max-w-lg mx-auto px-5 py-6">
        {/* Header */}
        <div className="mb-6 -mx-5 -mt-6">
          <div className="px-6 pt-8 pb-5 bg-gradient-to-br from-slate-800 via-slate-900 to-slate-950">
            <div className="flex items-end justify-between">
              <div>
                <p className="text-base font-light tracking-[0.25em] text-white">더반스테이</p>
                <p className="text-[9px] tracking-[0.15em] text-slate-400 uppercase mt-0.5">THE VAN STAY</p>
              </div>
              <div className="text-right">
                <h1 className="text-xl font-bold text-amber-300 tracking-wide">Easy Tap</h1>
                <p className="text-[10px] text-slate-400 mt-0.5">{room.roomNumber}호</p>
              </div>
            </div>
          </div>
        </div>

        {/* Service Grid */}
        <div className="grid grid-cols-2 gap-4">
          {categories.map((cat) => {
            const IconComponent = ICON_MAP[cat.icon] || Package;
            const colorClass = TYPE_COLORS[cat.type] || "from-gray-400 to-gray-600";

            return (
              <button
                key={cat.id}
                onClick={() =>
                  router.push(`/room/${roomId}/service/${cat.id}`)
                }
                className="bg-white rounded-2xl border border-gray-100 p-6 flex flex-col items-center gap-3 shadow-sm hover:shadow-md hover:scale-[1.02] active:scale-95 transition-all duration-200"
              >
                <div
                  className={`w-14 h-14 rounded-xl bg-gradient-to-br ${colorClass} flex items-center justify-center shadow-sm`}
                >
                  <IconComponent className="w-7 h-7 text-white" />
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

          {/* 룸 오더 (고정) */}
          <button
            onClick={() => router.push(`/room/${roomId}/menu`)}
            className="bg-white rounded-2xl border border-gray-100 p-6 flex flex-col items-center gap-3 shadow-sm hover:shadow-md hover:scale-[1.02] active:scale-95 transition-all duration-200"
          >
            <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center shadow-sm">
              <ConciergeBell className="w-7 h-7 text-white" />
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
            <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-indigo-400 to-indigo-600 flex items-center justify-center shadow-sm">
              <ClipboardList className="w-7 h-7 text-white" />
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
        <div className="text-center mt-10">
          <p className="text-xs text-black">
            더반스테이 · Easy Tap
          </p>
        </div>
      </div>
    </div>
  );
}
