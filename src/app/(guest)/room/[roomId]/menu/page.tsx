"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { useCartStore } from "@/stores/cart-store";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ShoppingCart, Plus, Minus, ImageIcon, ArrowLeft, Clock } from "lucide-react";
import { useClosingTime } from "@/hooks/use-closing-time";

interface Category {
  id: string;
  name: string;
  items: MenuItem[];
}

interface MenuItem {
  id: string;
  name: string;
  description: string | null;
  price: number;
  imageUrl: string | null;
  isAvailable: boolean;
  isBest?: boolean;
  stock?: number | null;
  stockUsed?: number;
}

interface Room {
  id: string;
  roomNumber: string;
  roomId: string;
}

export default function RoomMenuPage({
  params,
}: {
  params: Promise<{ roomId: string }>;
}) {
  const { roomId } = use(params);
  const [room, setRoom] = useState<Room | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [error, setError] = useState("");
  const router = useRouter();

  const { items, addItem, updateQuantity, totalAmount, totalItems, setRoomId } =
    useCartStore();
  const { isClosed, closingLabel } = useClosingTime();

  useEffect(() => {
    setRoomId(roomId);
    fetch(`/api/rooms/${roomId}`)
      .then((r) => {
        if (!r.ok) throw new Error("객실을 찾을 수 없습니다");
        return r.json();
      })
      .then(setRoom)
      .catch((e) => setError(e.message));

    fetch("/api/menu")
      .then((r) => r.json())
      .then((data: Category[]) => {
        setCategories(data);
        if (data.length > 0) setActiveCategory(data[0].id);
      });
  }, [roomId, setRoomId]);

  const formatPrice = (price: number) => price.toLocaleString("ko-KR");
  const getCartQuantity = (menuItemId: string) =>
    items.find((i) => i.menuItemId === menuItemId)?.quantity || 0;

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

  const activeItems =
    categories.find((c) => c.id === activeCategory)?.items.filter((i) => {
      if (!i.isAvailable) return false;
      if (i.stock !== null && i.stock !== undefined && (i.stock - (i.stockUsed || 0)) <= 0) return false;
      return true;
    }) || [];

  const getRemaining = (item: MenuItem) =>
    item.stock !== null && item.stock !== undefined ? item.stock - (item.stockUsed || 0) : null;

  return (
    <div className="pb-24">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-4 py-3">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              className="p-0 h-auto"
              onClick={() => router.push(`/room/${roomId}`)}
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-lg font-bold">룸 오더 <span className="text-xs font-normal text-gray-400">Room Order</span></h1>
              <Badge variant="secondary" className="mt-1">
                {room.roomNumber}호
              </Badge>
            </div>
          </div>
        </div>

        {/* Category Tabs */}
        <div className="max-w-lg mx-auto overflow-x-auto">
          <div className="flex px-4 gap-2 pb-3">
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`px-4 py-2 rounded-full text-sm whitespace-nowrap transition ${
                  activeCategory === cat.id
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Closing Notice */}
      <div className="max-w-lg mx-auto px-4 pt-3">
        {isClosed ? (
          <div className="bg-red-500 text-white text-center py-2 px-3 rounded-lg">
            <p className="text-sm font-semibold">영업이 마감되었습니다 ({closingLabel} 마감)</p>
            <p className="text-xs text-white/80">Service is currently closed</p>
          </div>
        ) : (
          <div className="bg-amber-50 border border-amber-200 text-amber-700 text-center py-2 px-3 rounded-lg text-xs font-medium flex items-center justify-center gap-1">
            <Clock className="w-3.5 h-3.5" />
            주문마감 {closingLabel} · Order Deadline
          </div>
        )}
      </div>

      {/* Menu Grid */}
      <div className="max-w-lg mx-auto px-4 py-4">
        <div className="grid grid-cols-2 gap-3">
          {activeItems.map((item) => {
            const qty = getCartQuantity(item.id);
            return (
              <div
                key={item.id}
                className="bg-white rounded-xl border overflow-hidden"
              >
                <div className="relative">
                  {item.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.imageUrl}
                      alt={item.name}
                      className="w-full h-32 object-cover"
                    />
                  ) : (
                    <div className="w-full h-32 bg-gray-100 flex items-center justify-center">
                      <ImageIcon className="w-8 h-8 text-gray-300" />
                    </div>
                  )}
                  {item.isBest && (
                    <span className="absolute top-2 left-2 bg-yellow-400 text-yellow-900 text-[10px] font-bold px-1.5 py-0.5 rounded">BEST</span>
                  )}
                </div>
                <div className="p-3">
                  <h3 className="font-medium text-sm">{item.name}</h3>
                  {item.description && (
                    <p className="text-xs text-gray-400 mt-0.5">
                      {item.description}
                    </p>
                  )}
                  <div className="flex items-center gap-1 mt-1">
                    <p className="text-sm font-semibold text-blue-600">
                      {formatPrice(item.price)}원
                    </p>
                    {(() => {
                      const remaining = getRemaining(item);
                      if (remaining !== null && remaining <= 3) {
                        return (
                          <span className="text-xs text-red-500 font-semibold">
                            {remaining}개 남음
                          </span>
                        );
                      }
                      return null;
                    })()}
                  </div>

                  {(() => {
                    const remaining = getRemaining(item);
                    const maxQty = remaining !== null ? remaining : 99;
                    return qty === 0 ? (
                      <Button
                        size="sm"
                        className="w-full mt-2"
                        disabled={isClosed}
                        onClick={() =>
                          addItem({
                            menuItemId: item.id,
                            name: item.name,
                            price: item.price,
                            imageUrl: item.imageUrl,
                          })
                        }
                      >
                        담기 Add
                      </Button>
                    ) : (
                      <div className="flex items-center justify-center gap-3 mt-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 w-8 p-0"
                          onClick={() => updateQuantity(item.id, qty - 1)}
                        >
                          <Minus className="w-3 h-3" />
                        </Button>
                        <span className="font-semibold text-sm w-6 text-center">
                          {qty}
                        </span>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 w-8 p-0"
                          disabled={qty >= maxQty}
                          onClick={() => updateQuantity(item.id, qty + 1)}
                        >
                          <Plus className="w-3 h-3" />
                        </Button>
                      </div>
                    );
                  })()}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Floating Cart Bar */}
      {totalItems() > 0 && !isClosed && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg z-20">
          <div className="max-w-lg mx-auto px-4 py-3">
            <button
              className="w-full bg-blue-600 text-white rounded-xl py-3 px-4 flex items-center justify-between hover:bg-blue-700 transition"
              onClick={() => router.push(`/room/${roomId}/cart`)}
            >
              <div className="flex items-center gap-2">
                <ShoppingCart className="w-5 h-5" />
                <Badge variant="secondary" className="bg-white text-blue-600">
                  {totalItems()}
                </Badge>
              </div>
              <span className="font-semibold">
                {formatPrice(totalAmount())}원 주문하기 Order
              </span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
