"use client";

import { useState, use } from "react";
import { useRouter } from "next/navigation";
import { useCartStore } from "@/stores/cart-store";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { useClosingTime } from "@/hooks/use-closing-time";

export default function CartPage({
  params,
}: {
  params: Promise<{ roomId: string }>;
}) {
  const { roomId } = use(params);
  const router = useRouter();
  const { items, totalAmount, clearCart } = useCartStore();
  const [loading, setLoading] = useState(false);
  const { isClosed, closingLabel } = useClosingTime();

  const formatPrice = (price: number) => price.toLocaleString("ko-KR");

  if (items.length === 0) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4">
        <p className="text-gray-400 mb-4">장바구니가 비어있습니다</p>
        <Button variant="outline" onClick={() => router.push(`/room/${roomId}/menu`)}>
          메뉴로 돌아가기
        </Button>
      </div>
    );
  }

  const handleOrder = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomId,
          items: items.map((i) => ({
            menuItemId: i.menuItemId,
            quantity: i.quantity,
          })),
          paymentMethod: "deferred",
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "주문 실패");
      }

      await res.json();
      clearCart();
      router.push(`/room/${roomId}/orders`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "주문 처리 중 오류가 발생했습니다");
    } finally {
      setLoading(false);
    }
  };

  const totalQty = items.reduce((s, i) => s + i.quantity, 0);

  return (
    <div className="min-h-screen bg-gray-50 pb-32">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-5 py-3 flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push(`/room/${roomId}/menu`)}
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-lg font-bold">주문내역서 <span className="text-xs font-normal text-gray-400">Order Receipt</span></h1>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-5 py-4 space-y-4">
        {/* 주문내역서 — 영수증 텍스트 스타일 */}
        <div className="bg-white rounded-xl p-5 font-mono text-sm">
          {/* 내역서 헤더 */}
          <div className="text-center border-b-2 border-dashed border-gray-300 pb-3 mb-3">
            <h2 className="text-base font-bold tracking-wide">주문내역서</h2>
            <p className="text-xs text-gray-400 mt-1">ORDER RECEIPT</p>
          </div>

          {/* 아이템 목록 */}
          <div className="border-b border-dashed border-gray-300 pb-3 mb-3 space-y-1.5">
            {items.map((item) => (
              <div key={item.menuItemId} className="flex justify-between">
                <span className="text-gray-700">
                  {item.name} x{item.quantity}
                </span>
                <span className="text-gray-900">
                  {formatPrice(item.price * item.quantity)}원
                </span>
              </div>
            ))}
          </div>

          {/* 수량 합계 */}
          <div className="flex justify-between text-xs text-gray-400 mb-1">
            <span>총 {items.length}종류 {totalQty}개</span>
          </div>

          {/* 합계 */}
          <div className="border-t-2 border-dashed border-gray-300 pt-3 mt-1">
            <div className="flex justify-between text-base font-bold">
              <span>합계 Total</span>
              <span>{formatPrice(totalAmount())}원</span>
            </div>
          </div>

          {/* 결제 안내 */}
          <div className="border-t-2 border-dashed border-gray-300 pt-3 mt-3 text-center">
            <p className="text-sm font-semibold text-gray-700">후불결제</p>
            <p className="text-xs text-gray-400 mt-0.5">Deferred Payment</p>
            <p className="text-xs text-gray-500 mt-1">퇴실 시 프런트에서 정산합니다</p>
            <p className="text-xs text-gray-300">Payment will be settled at the front desk upon checkout.</p>
          </div>

          {/* 서비스 제공기간 안내 */}
          <div className="border-t border-dashed border-gray-300 pt-3 mt-3 text-xs text-gray-400">
            <p>* 주문 접수 후 약 15~30분 내 객실로 제공됩니다.</p>
            <p className="text-gray-300">  Delivered to your room in approx. 15-30 min.</p>
            <p>* 호텔 운영 상황에 따라 제공 시간이 변동될 수 있습니다.</p>
            <p className="text-gray-300">  Delivery time may vary depending on hotel operations.</p>
          </div>
        </div>
      </div>

      {/* Order Button */}
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
            onClick={handleOrder}
            disabled={loading || isClosed}
          >
            {loading
              ? "주문 처리 중..."
              : `${formatPrice(totalAmount())}원 주문하기`}
          </Button>
        </div>
      </div>
    </div>
  );
}
