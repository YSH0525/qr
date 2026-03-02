"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Sparkles, Clock, Package, Plus, Minus } from "lucide-react";
import { toast } from "sonner";
import type { ServiceCategory, ServiceItem } from "@/types/service";

const ICON_MAP: Record<string, React.ElementType> = {
  Sparkles, Clock, Package,
  sparkles: Sparkles, clock: Clock, package: Package,
};

interface Room {
  id: string;
  roomNumber: string;
  roomId: string;
}

export default function ServiceRequestPage({
  params,
}: {
  params: Promise<{ roomId: string; categoryId: string }>;
}) {
  const { roomId, categoryId } = use(params);
  const router = useRouter();
  const [room, setRoom] = useState<Room | null>(null);
  const [category, setCategory] = useState<ServiceCategory | null>(null);
  const [serviceItems, setServiceItems] = useState<ServiceItem[]>([]);
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);

  // checkout_extension
  const [extensionHours, setExtensionHours] = useState(1);
  const [isFreeExtension, setIsFreeExtension] = useState(false);

  // amenity
  const [selectedItems, setSelectedItems] = useState<
    Record<string, { name: string; quantity: number }>
  >({});

  useEffect(() => {
    fetch(`/api/rooms/${roomId}`)
      .then((r) => r.json())
      .then(setRoom);

    fetch("/api/service-categories")
      .then((r) => r.json())
      .then((cats: ServiceCategory[]) => {
        const found = cats.find((c) => c.id === categoryId);
        setCategory(found || null);

        if (found) {
          fetch(`/api/service-items?categoryId=${categoryId}`)
            .then((r) => r.json())
            .then((items: ServiceItem[]) =>
              setServiceItems(items.filter((i) => i.isAvailable))
            );
        }
      });
  }, [roomId, categoryId]);

  const updateItemQty = (item: ServiceItem, delta: number) => {
    setSelectedItems((prev) => {
      const current = prev[item.id]?.quantity || 0;
      const next = current + delta;
      if (next <= 0) {
        const { [item.id]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [item.id]: { name: item.name, quantity: next } };
    });
  };

  const handleSubmit = async () => {
    if (!category) return;
    setLoading(true);

    try {
      const body: Record<string, unknown> = {
        roomId,
        categoryId,
        note: note || undefined,
      };

      if (category.type === "checkout_extension") {
        body.extensionHours = extensionHours;
        if (isFreeExtension) body.freeExtension = true;
      }

      const items = Object.entries(selectedItems).map(([itemId, data]) => ({
        itemId,
        name: data.name,
        quantity: data.quantity,
      }));
      if (items.length > 0) {
        body.items = items;
      } else if (category.type === "amenity" && serviceItems.length > 0) {
        toast.error("요청할 비품을 선택해주세요");
        setLoading(false);
        return;
      }

      const res = await fetch("/api/service-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) throw new Error("요청 실패");

      const data = await res.json();
      router.push(
        `/room/${roomId}/service/confirm?requestId=${data.requestId}&type=${category.type}&name=${encodeURIComponent(category.name)}`
      );
    } catch {
      toast.error("서비스 요청 중 오류가 발생했습니다");
    } finally {
      setLoading(false);
    }
  };

  if (!room || !category) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-400">로딩 중...</p>
      </div>
    );
  }

  const IconComponent = ICON_MAP[category.icon] || Package;
  const formatPrice = (n: number) => n.toLocaleString("ko-KR");

  return (
    <div className="min-h-screen bg-gray-50 pb-28">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-5 py-3 flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push(`/room/${roomId}`)}
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-lg font-bold">{category.name}</h1>
          <Badge variant="secondary" className="ml-auto">
            {room.roomNumber}호
          </Badge>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-5 py-6 space-y-4">
        {/* 서비스 설명 */}
        <Card>
          <CardContent className="p-6 text-center">
            <IconComponent className="w-12 h-12 mx-auto text-blue-500 mb-3" />
            <p className="text-gray-600">{category.description}</p>
          </CardContent>
        </Card>

        {/* 타입별 UI */}
        {category.type === "checkout_extension" && (
          <Card>
            <CardContent className="p-5">
              <h2 className="font-semibold mb-3">연장 시간 선택</h2>
              <div className="grid grid-cols-4 gap-2">
                <button
                  onClick={() => {
                    setExtensionHours(1);
                    setIsFreeExtension(true);
                  }}
                  className={`p-3 rounded-xl border-2 text-center transition ${
                    isFreeExtension
                      ? "border-green-400 bg-green-50"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <p className="text-lg font-bold">1시간</p>
                  <p className="text-xs text-green-600 font-semibold mt-1">무료</p>
                </button>
                {[1, 2, 3].map((h) => (
                  <button
                    key={h}
                    onClick={() => {
                      setExtensionHours(h);
                      setIsFreeExtension(false);
                    }}
                    className={`p-3 rounded-xl border-2 text-center transition ${
                      extensionHours === h && !isFreeExtension
                        ? "border-amber-400 bg-amber-50"
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <p className="text-lg font-bold">{h}시간</p>
                    {category.hourlyRate ? (
                      <p className="text-xs text-gray-500 mt-1">
                        {formatPrice(category.hourlyRate * h)}원
                      </p>
                    ) : null}
                  </button>
                ))}
              </div>
              {isFreeExtension ? (
                <div className="mt-3 bg-green-50 rounded-lg p-3 text-center">
                  <p className="text-sm text-green-700 font-medium">
                    리뷰작성 후 퇴실시 프런트에 확인 (일~목만 해당)
                  </p>
                </div>
              ) : category.hourlyRate ? (
                <div className="mt-3 bg-amber-50 rounded-lg p-3 text-center">
                  <p className="text-sm text-amber-700">
                    연장 요금{" "}
                    <strong>
                      {formatPrice(category.hourlyRate * extensionHours)}원
                    </strong>
                    <span className="text-xs ml-1">(퇴실 시 정산)</span>
                  </p>
                </div>
              ) : null}
            </CardContent>
          </Card>
        )}

        {serviceItems.length > 0 && (
          <Card>
            <CardContent className="p-5">
              <h2 className="font-semibold mb-3">
                {category.type === "amenity" ? "필요한 비품 선택" : category.type === "cleaning" ? "청소 옵션 선택" : "옵션 선택"}
              </h2>
              <div className="space-y-3">
                {serviceItems.map((item) => {
                  const qty = selectedItems[item.id]?.quantity || 0;
                  return (
                    <div
                      key={item.id}
                      className="flex items-center justify-between py-2"
                    >
                      <span className="font-medium">{item.name}</span>
                      <div className="flex items-center gap-2">
                        {qty > 0 ? (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 w-8 p-0"
                              onClick={() => updateItemQty(item, -1)}
                            >
                              <Minus className="w-3 h-3" />
                            </Button>
                            <span className="w-6 text-center font-semibold">
                              {qty}
                            </span>
                          </>
                        ) : null}
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 w-8 p-0"
                          onClick={() => updateItemQty(item, 1)}
                        >
                          <Plus className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* 메모 */}
        <Card>
          <CardContent className="p-5">
            <h2 className="font-semibold mb-2">요청사항</h2>
            <Input
              placeholder="추가 요청사항이 있으면 입력해주세요 (선택)"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </CardContent>
        </Card>
      </div>

      {/* Submit Button */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg">
        <div className="max-w-lg mx-auto px-5 py-3">
          <Button
            className="w-full h-12 text-lg"
            onClick={handleSubmit}
            disabled={loading}
          >
            {loading ? "요청 처리 중..." : `${category.name} 요청하기`}
          </Button>
        </div>
      </div>
    </div>
  );
}
