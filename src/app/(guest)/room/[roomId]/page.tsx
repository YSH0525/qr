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
  MessageCircle,
  X,
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

const TYPE_EN_DESC: Record<string, string> = {
  cleaning: "Request room cleaning service",
  checkout_extension: "Extend your checkout time",
  amenity: "Request additional amenities",
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
  const [showTowelPicker, setShowTowelPicker] = useState(false);
  const [towelQty, setTowelQty] = useState(2);
  const [showInquiry, setShowInquiry] = useState(false);
  const [inquiryText, setInquiryText] = useState("");
  const [inquiryLoading, setInquiryLoading] = useState(false);

  const TOWEL_PICKER_ROOMS = ["101", "601"];
  const canPickTowelQty = room ? TOWEL_PICKER_ROOMS.includes(room.roomNumber) : false;

  const submitTowelRequest = async (qty: number) => {
    if (isClosed || towelLoading) return;
    setTowelLoading(true);
    try {
      const res = await fetch("/api/service-requests/quick", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomId, type: "towel", quantity: qty }),
      });
      if (res.ok) {
        router.push(`/room/${roomId}/orders`);
        return;
      } else {
        const data = await res.json().catch(() => null);
        setToast({ message: data?.error || "요청 실패", type: "error" });
      }
    } catch {
      setToast({ message: "네트워크 오류가 발생했습니다", type: "error" });
    } finally {
      setTowelLoading(false);
      setShowTowelPicker(false);
      setTimeout(() => setToast(null), 3000);
    }
  };

  const handleTowelRequest = () => {
    if (isClosed || towelLoading) return;
    if (canPickTowelQty) {
      setTowelQty(2);
      setShowTowelPicker(true);
    } else {
      submitTowelRequest(2);
    }
  };

  const handleInquirySubmit = async () => {
    if (!inquiryText.trim() || inquiryLoading) return;
    setInquiryLoading(true);
    try {
      const res = await fetch("/api/service-requests/quick", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomId, type: "inquiry", note: inquiryText.trim() }),
      });
      if (res.ok) {
        setToast({ message: "문의가 접수되었습니다", type: "success" });
        setShowInquiry(false);
        setInquiryText("");
      } else {
        const data = await res.json().catch(() => null);
        setToast({ message: data?.error || "요청 실패", type: "error" });
      }
    } catch {
      setToast({ message: "네트워크 오류가 발생했습니다", type: "error" });
    } finally {
      setInquiryLoading(false);
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
          <div className="bg-red-500 text-white text-center py-3 px-4 rounded-xl mb-4">
            <p className="text-sm font-semibold">영업이 마감되었습니다 ({closingLabel} 마감)</p>
            <p className="text-xs text-white/80">Service is currently closed</p>
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
                  {TYPE_EN_DESC[cat.type] && (
                    <p className="text-xs text-gray-300 mt-0.5">
                      {TYPE_EN_DESC[cat.type]}
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
                Towel Request
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
                Room Order
              </p>
            </div>
          </button>

          {/* 기타문의 */}
          <button
            onClick={() => setShowInquiry(true)}
            className="bg-white rounded-2xl border border-gray-100 p-4 flex flex-col items-center gap-2 shadow-sm hover:shadow-md hover:scale-[1.02] active:scale-95 transition-all duration-200"
          >
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-400 to-violet-600 flex items-center justify-center shadow-sm">
              <MessageCircle className="w-6 h-6 text-white" />
            </div>
            <div className="text-center">
              <p className="font-semibold text-gray-900">기타문의</p>
              <p className="text-xs text-gray-400 mt-0.5">
                General Inquiry
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
                Order Status
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

      {/* 수건 장수 선택 모달 */}
      {showTowelPicker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-5">
          <div className="bg-white rounded-2xl w-full max-w-xs p-5 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-bold">수건 요청</h2>
                <p className="text-xs text-gray-400">Towel Request</p>
              </div>
              <button
                onClick={() => setShowTowelPicker(false)}
                className="p-1 rounded-lg hover:bg-gray-100"
              >
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            <p className="text-sm text-gray-600 mb-4">수건 장수를 선택해주세요</p>
            <div className="flex items-center justify-center gap-4 mb-5">
              <button
                onClick={() => setTowelQty(Math.max(1, towelQty - 1))}
                className="w-10 h-10 rounded-full border-2 border-gray-300 text-lg font-bold text-gray-600 hover:bg-gray-100 transition"
              >
                −
              </button>
              <span className="text-3xl font-bold w-12 text-center">{towelQty}</span>
              <button
                onClick={() => setTowelQty(Math.min(10, towelQty + 1))}
                className="w-10 h-10 rounded-full border-2 border-gray-300 text-lg font-bold text-gray-600 hover:bg-gray-100 transition"
              >
                +
              </button>
            </div>
            <button
              onClick={() => submitTowelRequest(towelQty)}
              disabled={towelLoading}
              className="w-full py-3 rounded-xl text-white font-semibold text-sm bg-cyan-500 hover:bg-cyan-600 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {towelLoading ? "요청 중..." : `수건 ${towelQty}장 요청`}
            </button>
          </div>
        </div>
      )}

      {/* 기타문의 모달 */}
      {showInquiry && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-5">
          <div className="bg-white rounded-2xl w-full max-w-md p-5 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-bold">기타문의</h2>
                <p className="text-xs text-gray-400">General Inquiry</p>
              </div>
              <button
                onClick={() => { setShowInquiry(false); setInquiryText(""); }}
                className="p-1 rounded-lg hover:bg-gray-100"
              >
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            <textarea
              value={inquiryText}
              onChange={(e) => setInquiryText(e.target.value)}
              placeholder="문의 내용을 입력해주세요 / Please enter your inquiry"
              className="w-full border rounded-xl p-3 text-sm resize-none h-32 focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-transparent"
              maxLength={500}
            />
            <p className="text-right text-xs text-gray-400 mt-1">{inquiryText.length}/500</p>
            <button
              onClick={handleInquirySubmit}
              disabled={!inquiryText.trim() || inquiryLoading}
              className="w-full mt-3 py-3 rounded-xl text-white font-semibold text-sm bg-violet-500 hover:bg-violet-600 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {inquiryLoading ? "전송 중... Sending..." : "전송 Send"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
