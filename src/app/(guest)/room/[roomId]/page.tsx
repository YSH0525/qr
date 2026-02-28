"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { useCartStore } from "@/stores/cart-store";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ShoppingCart, Plus, Minus, ImageIcon } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

interface Category {
  id: number;
  name: string;
  items: MenuItem[];
}

interface MenuItem {
  id: number;
  name: string;
  description: string | null;
  price: number;
  imageUrl: string | null;
  isAvailable: boolean;
}

interface Room {
  id: number;
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
  const [activeCategory, setActiveCategory] = useState<number | null>(null);
  const [error, setError] = useState("");
  const router = useRouter();

  const { items: cartItems, addItem, removeItem, updateQuantity, totalAmount, totalItems, setRoomId } =
    useCartStore();

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
  const getCartQuantity = (menuItemId: number) =>
    cartItems.find((i) => i.menuItemId === menuItemId)?.quantity || 0;

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
    categories.find((c) => c.id === activeCategory)?.items.filter((i) => i.isAvailable) || [];

  return (
    <div className="pb-24">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-bold">
                {process.env.NEXT_PUBLIC_HOTEL_NAME || "호텔 편의점"}
              </h1>
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
                {item.imageUrl ? (
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
                <div className="p-3">
                  <h3 className="font-medium text-sm">{item.name}</h3>
                  {item.description && (
                    <p className="text-xs text-gray-400 mt-0.5">
                      {item.description}
                    </p>
                  )}
                  <p className="text-sm font-semibold mt-1 text-blue-600">
                    {formatPrice(item.price)}원
                  </p>

                  {qty === 0 ? (
                    <Button
                      size="sm"
                      className="w-full mt-2"
                      onClick={() =>
                        addItem({
                          menuItemId: item.id,
                          name: item.name,
                          price: item.price,
                          imageUrl: item.imageUrl,
                        })
                      }
                    >
                      담기
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
                        onClick={() => updateQuantity(item.id, qty + 1)}
                      >
                        <Plus className="w-3 h-3" />
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Floating Cart Bar */}
      {totalItems() > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg z-20">
          <div className="max-w-lg mx-auto px-4 py-3">
            <Sheet>
              <SheetTrigger asChild>
                <button className="w-full bg-blue-600 text-white rounded-xl py-3 px-4 flex items-center justify-between hover:bg-blue-700 transition">
                  <div className="flex items-center gap-2">
                    <ShoppingCart className="w-5 h-5" />
                    <Badge variant="secondary" className="bg-white text-blue-600">
                      {totalItems()}
                    </Badge>
                  </div>
                  <span className="font-semibold">
                    {formatPrice(totalAmount())}원 주문하기
                  </span>
                </button>
              </SheetTrigger>
              <SheetContent side="bottom" className="h-[80vh]">
                <SheetHeader>
                  <SheetTitle>장바구니</SheetTitle>
                </SheetHeader>
                <div className="mt-4 space-y-3 overflow-y-auto flex-1">
                  {cartItems.map((item) => (
                    <div
                      key={item.menuItemId}
                      className="flex items-center justify-between py-3 border-b"
                    >
                      <div className="flex-1">
                        <p className="font-medium">{item.name}</p>
                        <p className="text-sm text-gray-500">
                          {formatPrice(item.price)}원
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 w-8 p-0"
                          onClick={() =>
                            updateQuantity(item.menuItemId, item.quantity - 1)
                          }
                        >
                          <Minus className="w-3 h-3" />
                        </Button>
                        <span className="w-6 text-center font-semibold">
                          {item.quantity}
                        </span>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 w-8 p-0"
                          onClick={() =>
                            updateQuantity(item.menuItemId, item.quantity + 1)
                          }
                        >
                          <Plus className="w-3 h-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-red-500"
                          onClick={() => removeItem(item.menuItemId)}
                        >
                          삭제
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-4 pt-4 border-t">
                  <div className="flex justify-between items-center mb-4">
                    <span className="text-lg font-semibold">총 금액</span>
                    <span className="text-xl font-bold text-blue-600">
                      {formatPrice(totalAmount())}원
                    </span>
                  </div>
                  <Button
                    className="w-full h-12 text-lg"
                    onClick={() => router.push(`/room/${roomId}/cart`)}
                  >
                    주문하기
                  </Button>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      )}
    </div>
  );
}
