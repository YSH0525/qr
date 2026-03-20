"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  Sparkles,
  Package,
  Plus,
  Minus,
  Moon,
  Leaf,
  Droplets,
  Trash2,
  DoorOpen,
  Check,
} from "lucide-react";
import { toast } from "sonner";
import type {
  ServiceCategory,
  ServiceItem,
  CleaningOptions,
  CleaningLevel,
  PreferredTime,
  SupplyItem,
} from "@/types/service";
import {
  CLEANING_LEVEL_LABELS,
  CLEANING_LEVEL_DESCRIPTIONS,
  PREFERRED_TIME_LABELS,
  SUPPLY_ITEM_LABELS,
} from "@/types/service";
import { useClosingTime } from "@/hooks/use-closing-time";

interface Room {
  id: string;
  roomNumber: string;
  roomId: string;
}

const CLEANING_LEVEL_STYLES: Record<CleaningLevel, { border: string; bg: string; icon: React.ElementType }> = {
  full: { border: "border-emerald-400", bg: "bg-emerald-50", icon: Sparkles },
  light: { border: "border-amber-400", bg: "bg-amber-50", icon: Droplets },
  dnd: { border: "border-gray-400", bg: "bg-gray-50", icon: Moon },
};

const SUPPLY_ICONS: Record<SupplyItem, React.ElementType> = {
  towel: Droplets,
  water: Droplets,
  amenity: Package,
};

const CLEANING_LEVEL_EN: Record<CleaningLevel, string> = {
  full: "Full Cleaning",
  light: "Light Cleaning",
  dnd: "Do Not Disturb",
};

const CLEANING_DESC_EN: Record<CleaningLevel, string> = {
  full: "Includes linen change",
  light: "Towel change, trash, floor tidy",
  dnd: "Do not disturb",
};

const PREFERRED_TIME_EN: Record<PreferredTime, string> = {
  morning: "AM (10-12)",
  afternoon: "PM (12-14)",
  anytime: "Anytime",
};

const SUPPLY_ITEM_EN: Record<SupplyItem, string> = {
  towel: "Extra Towels",
  water: "Bottled Water",
  amenity: "Amenity Refill",
};

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
  const [loading, setLoading] = useState(false);
  const { isClosed, closingLabel } = useClosingTime();

  // checkout_extension
  const [extensionHours, setExtensionHours] = useState(1);

  // amenity
  const [selectedItems, setSelectedItems] = useState<
    Record<string, { name: string; quantity: number }>
  >({});

  // cleaning options
  const [cleaningOptions, setCleaningOptions] = useState<CleaningOptions>({
    serviceLevel: "full",
    preferredTime: "anytime",
    linenChange: true,
    contactlessSupplies: [],
    leaveAtDoor: false,
    trashRemovalOnly: false,
  });

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
        const { [item.id]: _removed, ...rest } = prev;
        void _removed;
        return rest;
      }
      return { ...prev, [item.id]: { name: item.name, quantity: next } };
    });
  };

  const toggleSupplyItem = (item: SupplyItem) => {
    setCleaningOptions((prev) => {
      const has = prev.contactlessSupplies.includes(item);
      const next = has
        ? prev.contactlessSupplies.filter((s) => s !== item)
        : [...prev.contactlessSupplies, item];
      return {
        ...prev,
        contactlessSupplies: next,
        leaveAtDoor: next.length > 0 ? prev.leaveAtDoor : false,
      };
    });
  };

  const handleSubmit = async () => {
    if (!category) return;
    setLoading(true);

    try {
      const body: Record<string, unknown> = {
        roomId,
        categoryId,
      };

      if (category.type === "checkout_extension") {
        body.extensionHours = extensionHours;
        body.paymentMethod = "deferred";
      }

      if (category.type === "cleaning") {
        body.cleaningOptions = cleaningOptions;
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

      // 후불결제: 즉시 주문 생성
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...body, type: category.type }),
      });

      if (!res.ok) throw new Error("요청 실패");

      await res.json();

      router.push(`/room/${roomId}/orders`);
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

  const formatPrice = (n: number) => n.toLocaleString("ko-KR");
  const isCleaning = category.type === "cleaning";
  const showFullLightOptions =
    isCleaning && (cleaningOptions.serviceLevel === "full" || cleaningOptions.serviceLevel === "light");
  const showDndOptions = isCleaning && cleaningOptions.serviceLevel === "dnd";

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
        {/* === 청소 타입 전용 UI === */}
        {isCleaning && (
          <>
            {/* 카드 1: 청소 모드 선택 */}
            <Card>
              <CardContent className="p-5">
                <h2 className="font-semibold mb-3">청소 모드 선택 <span className="text-xs font-normal text-gray-400">Cleaning Mode</span></h2>
                <div className="space-y-2">
                  {(["full", "light", "dnd"] as CleaningLevel[]).map((level) => {
                    const selected = cleaningOptions.serviceLevel === level;
                    const style = CLEANING_LEVEL_STYLES[level];
                    const LevelIcon = style.icon;
                    return (
                      <button
                        key={level}
                        onClick={() =>
                          setCleaningOptions((prev) => ({
                            ...prev,
                            serviceLevel: level,
                            linenChange: level === "full",
                            trashRemovalOnly: false,
                          }))
                        }
                        className={`w-full p-4 rounded-xl border-2 text-left transition flex items-center gap-3 ${
                          selected
                            ? `${style.border} ${style.bg}`
                            : "border-gray-200 hover:border-gray-300"
                        }`}
                      >
                        <div
                          className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                            selected ? style.bg : "bg-gray-100"
                          }`}
                        >
                          <LevelIcon
                            className={`w-5 h-5 ${
                              selected
                                ? level === "full"
                                  ? "text-emerald-600"
                                  : level === "light"
                                  ? "text-amber-600"
                                  : "text-gray-600"
                                : "text-gray-400"
                            }`}
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm">
                            {CLEANING_LEVEL_LABELS[level]}
                          </p>
                          <p className="text-xs text-gray-400">
                            {CLEANING_LEVEL_EN[level]}
                          </p>
                          <p className="text-xs text-gray-500 mt-0.5">
                            {CLEANING_LEVEL_DESCRIPTIONS[level]} · {CLEANING_DESC_EN[level]}
                          </p>
                        </div>
                        {selected && (
                          <Check className="w-5 h-5 text-emerald-500 shrink-0" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* 카드 2: 정비 희망 시간 (Full/Light만) */}
            {showFullLightOptions && (
              <Card>
                <CardContent className="p-5">
                  <h2 className="font-semibold mb-3">정비 희망 시간 <span className="text-xs font-normal text-gray-400">Preferred Time</span></h2>
                  <div className="grid grid-cols-3 gap-2">
                    {(["morning", "afternoon", "anytime"] as PreferredTime[]).map(
                      (time) => {
                        const selected = cleaningOptions.preferredTime === time;
                        return (
                          <button
                            key={time}
                            onClick={() =>
                              setCleaningOptions((prev) => ({
                                ...prev,
                                preferredTime: time,
                              }))
                            }
                            className={`p-3 rounded-xl border-2 text-center transition ${
                              selected
                                ? "border-blue-400 bg-blue-50 font-semibold text-blue-700"
                                : "border-gray-200 hover:border-gray-300 text-gray-600"
                            }`}
                          >
                            <p className="text-sm">{PREFERRED_TIME_LABELS[time]}</p>
                            <p className="text-[10px] text-gray-400 mt-0.5">{PREFERRED_TIME_EN[time]}</p>
                          </button>
                        );
                      }
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* 카드 3: 침구 시트 교체 (Full/Light만) */}
            {showFullLightOptions && (
              <Card>
                <CardContent className="p-5">
                  <h2 className="font-semibold mb-3">침구 시트 교체 <span className="text-xs font-normal text-gray-400">Linen Change</span></h2>
                  <button
                    onClick={() =>
                      setCleaningOptions((prev) => ({
                        ...prev,
                        linenChange: !prev.linenChange,
                      }))
                    }
                    className={`w-full p-4 rounded-xl border-2 text-left transition flex items-center gap-3 ${
                      !cleaningOptions.linenChange
                        ? "border-green-400 bg-green-50"
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <div
                      className={`w-6 h-6 rounded-md border-2 flex items-center justify-center shrink-0 transition ${
                        !cleaningOptions.linenChange
                          ? "border-green-500 bg-green-500"
                          : "border-gray-300"
                      }`}
                    >
                      {!cleaningOptions.linenChange && (
                        <Check className="w-4 h-4 text-white" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">
                        시트 교체 없이 정리만 요청
                      </p>
                      <p className="text-xs text-gray-500">
                        Tidy up without linen change
                      </p>
                    </div>
                    <Leaf className="w-5 h-5 text-green-500 shrink-0" />
                  </button>
                  {!cleaningOptions.linenChange && (
                    <div className="mt-2 bg-green-50 rounded-lg p-2 text-center">
                      <p className="text-xs text-green-600 font-medium">
                        Eco-Friendly Choice
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* 카드 4: 비대면 비품 요청 (DND일 때만) */}
            {showDndOptions && (<Card>
              <CardContent className="p-5">
                <h2 className="font-semibold mb-3">비대면 비품 요청 <span className="text-xs font-normal text-gray-400">Contactless Supply</span></h2>
                <div className="space-y-2">
                  {(["towel", "water", "amenity"] as SupplyItem[]).map((item) => {
                    const selected = cleaningOptions.contactlessSupplies.includes(item);
                    const SupplyIcon = SUPPLY_ICONS[item];
                    return (
                      <button
                        key={item}
                        onClick={() => toggleSupplyItem(item)}
                        className={`w-full p-3 rounded-xl border-2 text-left transition flex items-center gap-3 ${
                          selected
                            ? "border-sky-400 bg-sky-50"
                            : "border-gray-200 hover:border-gray-300"
                        }`}
                      >
                        <div
                          className={`w-6 h-6 rounded-md border-2 flex items-center justify-center shrink-0 transition ${
                            selected
                              ? "border-sky-500 bg-sky-500"
                              : "border-gray-300"
                          }`}
                        >
                          {selected && <Check className="w-4 h-4 text-white" />}
                        </div>
                        <SupplyIcon
                          className={`w-4 h-4 ${selected ? "text-sky-600" : "text-gray-400"}`}
                        />
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-medium ${selected ? "text-sky-700" : "text-gray-600"}`}>
                            {SUPPLY_ITEM_LABELS[item]}
                          </p>
                          <p className="text-xs text-gray-400">
                            {SUPPLY_ITEM_EN[item]}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* 문 앞에 놓아주세요 토글 */}
                {cleaningOptions.contactlessSupplies.length > 0 && (
                  <button
                    onClick={() =>
                      setCleaningOptions((prev) => ({
                        ...prev,
                        leaveAtDoor: !prev.leaveAtDoor,
                      }))
                    }
                    className={`w-full mt-3 p-3 rounded-xl border-2 text-left transition flex items-center gap-3 ${
                      cleaningOptions.leaveAtDoor
                        ? "border-violet-400 bg-violet-50"
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <div
                      className={`w-6 h-6 rounded-md border-2 flex items-center justify-center shrink-0 transition ${
                        cleaningOptions.leaveAtDoor
                          ? "border-violet-500 bg-violet-500"
                          : "border-gray-300"
                      }`}
                    >
                      {cleaningOptions.leaveAtDoor && (
                        <Check className="w-4 h-4 text-white" />
                      )}
                    </div>
                    <DoorOpen
                      className={`w-4 h-4 ${
                        cleaningOptions.leaveAtDoor ? "text-violet-600" : "text-gray-400"
                      }`}
                    />
                    <span
                      className={`text-sm font-medium ${
                        cleaningOptions.leaveAtDoor ? "text-violet-700" : "text-gray-600"
                      }`}
                    >
                      문 앞에 놓아주세요 Please leave at the door
                    </span>
                  </button>
                )}
              </CardContent>
            </Card>)}

            {/* 카드 5: 쓰레기 수거만 (DND일 때만) */}
            {showDndOptions && (
              <Card>
                <CardContent className="p-5">
                  <h2 className="font-semibold mb-3">쓰레기 수거 요청 <span className="text-xs font-normal text-gray-400">Trash Collection</span></h2>
                  <button
                    onClick={() =>
                      setCleaningOptions((prev) => ({
                        ...prev,
                        trashRemovalOnly: !prev.trashRemovalOnly,
                      }))
                    }
                    className={`w-full p-4 rounded-xl border-2 text-left transition flex items-center gap-3 ${
                      cleaningOptions.trashRemovalOnly
                        ? "border-orange-400 bg-orange-50"
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <div
                      className={`w-6 h-6 rounded-md border-2 flex items-center justify-center shrink-0 transition ${
                        cleaningOptions.trashRemovalOnly
                          ? "border-orange-500 bg-orange-500"
                          : "border-gray-300"
                      }`}
                    >
                      {cleaningOptions.trashRemovalOnly && (
                        <Check className="w-4 h-4 text-white" />
                      )}
                    </div>
                    <Trash2
                      className={`w-4 h-4 ${
                        cleaningOptions.trashRemovalOnly ? "text-orange-600" : "text-gray-400"
                      }`}
                    />
                    <div className="flex-1 min-w-0">
                      <p
                        className={`text-sm font-medium ${
                          cleaningOptions.trashRemovalOnly ? "text-orange-700" : "text-gray-600"
                        }`}
                      >
                        쓰레기통만 비워주세요
                      </p>
                      <p className="text-xs text-gray-500">
                        Please empty the trash only
                      </p>
                    </div>
                  </button>
                </CardContent>
              </Card>
            )}
          </>
        )}

        {/* 타입별 UI: checkout_extension */}
        {category.type === "checkout_extension" && (
          <Card>
            <CardContent className="p-5">
              <h2 className="font-semibold mb-3">연장 시간 선택 <span className="text-xs font-normal text-gray-400">Select Extension</span></h2>
              <div className="grid grid-cols-3 gap-2">
                {[1, 2, 3].map((h) => (
                  <button
                    key={h}
                    onClick={() => setExtensionHours(h)}
                    className={`p-3 rounded-xl border-2 text-center transition ${
                      extensionHours === h
                        ? "border-amber-400 bg-amber-50"
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <p className="text-lg font-bold">{h}hr</p>
                    {category.hourlyRate ? (
                      <p className="text-xs text-gray-500 mt-1">
                        {formatPrice(category.hourlyRate * h)}원
                      </p>
                    ) : null}
                  </button>
                ))}
              </div>
              {category.hourlyRate ? (
                <>
                  <div className="mt-3 bg-amber-50 rounded-lg p-3 text-center">
                    <p className="text-sm text-amber-700">
                      연장 요금{" "}
                      <strong>
                        {formatPrice(category.hourlyRate * extensionHours)}원
                      </strong>
                    </p>
                  </div>
                  <div className="mt-4">
                    <div className="p-3 rounded-xl border-2 border-blue-400 bg-blue-50 text-center">
                      <p className="text-sm font-bold">퇴실 시 정산</p>
                      <p className="text-xs text-gray-500 mt-0.5">후불 결제</p>
                    </div>
                  </div>
                </>
              ) : null}
            </CardContent>
          </Card>
        )}

        {/* 기존 serviceItems (amenity 등 cleaning 이외 타입) */}
        {!isCleaning && serviceItems.length > 0 && (
          <Card>
            <CardContent className="p-5">
              <h2 className="font-semibold mb-3">
                {category.type === "amenity" ? <>필요한 비품 선택 <span className="text-xs font-normal text-gray-400">Select Amenities</span></> : "옵션 선택"}
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

      </div>

      {/* Submit Button */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg">
        <div className="max-w-lg mx-auto px-5 py-3">
          {isClosed && (
            <>
              <p className="text-center text-red-500 text-sm font-semibold mb-1">
                영업이 마감되었습니다 ({closingLabel} 마감)
              </p>
              <p className="text-center text-red-400 text-xs mb-2">Service is currently closed</p>
            </>
          )}
          <Button
            className="w-full h-12 text-lg"
            onClick={handleSubmit}
            disabled={loading || isClosed}
          >
            {loading ? "요청 처리 중..." : `${category.name} 요청하기`}
          </Button>
        </div>
      </div>
    </div>
  );
}
