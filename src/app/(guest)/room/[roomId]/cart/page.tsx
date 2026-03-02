"use client";

import { useState, use } from "react";
import { useRouter } from "next/navigation";
import { useCartStore } from "@/stores/cart-store";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, CreditCard, Clock, Minus, Plus, Trash2, ShoppingBag } from "lucide-react";
import { toast } from "sonner";
import type { PaymentMethod } from "@/types";

export default function CartPage({
  params,
}: {
  params: Promise<{ roomId: string }>;
}) {
  const { roomId } = use(params);
  const router = useRouter();
  const { items, totalAmount, clearCart, updateQuantity, removeItem } = useCartStore();
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(null);
  const [loading, setLoading] = useState(false);

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
    if (!paymentMethod) {
      toast.error("결제 방식을 선택해주세요");
      return;
    }

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
          paymentMethod,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "주문 실패");
      }

      const order = await res.json();

      if (paymentMethod === "kakaopay") {
        // Initiate KakaoPay
        const payRes = await fetch("/api/payments/kakaopay/ready", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderId: order.orderId }),
        });

        if (payRes.ok) {
          const payData = await payRes.json();
          clearCart();
          // Redirect to KakaoPay
          const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
          window.location.href = isMobile
            ? payData.redirectUrl
            : payData.redirectPcUrl;
          return;
        } else {
          toast.error("카카오페이 결제 준비 중 오류가 발생했습니다");
          setLoading(false);
          return;
        }
      }

      // Deferred payment - go to confirmation
      clearCart();
      router.push(`/room/${roomId}/order/${order.orderId}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "주문 처리 중 오류가 발생했습니다");
    } finally {
      setLoading(false);
    }
  };

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
          <h1 className="text-lg font-bold">주문 확인</h1>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-5 py-4 space-y-4">
        {/* Order Items — 개별 카드 */}
        <div className="space-y-3">
          {items.map((item) => (
            <Card key={item.menuItemId}>
              <CardContent className="p-4 flex gap-3">
                {/* 이미지 */}
                {item.imageUrl ? (
                  <img
                    src={item.imageUrl}
                    alt={item.name}
                    className="w-16 h-16 rounded-lg object-cover shrink-0"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
                    <ShoppingBag className="w-6 h-6 text-gray-300" />
                  </div>
                )}

                {/* 상품 정보 */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-medium text-sm leading-tight">
                      {item.name}
                    </p>
                    <button
                      onClick={() => removeItem(item.menuItemId)}
                      className="shrink-0 p-1 text-gray-300 hover:text-red-400 transition"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {formatPrice(item.price)}원
                  </p>

                  {/* 수량 조절 + 소계 */}
                  <div className="flex items-center justify-between mt-2">
                    <div className="flex items-center gap-1.5">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 w-7 p-0"
                        onClick={() =>
                          updateQuantity(item.menuItemId, item.quantity - 1)
                        }
                      >
                        <Minus className="w-3 h-3" />
                      </Button>
                      <span className="w-6 text-center text-sm font-semibold">
                        {item.quantity}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 w-7 p-0"
                        onClick={() =>
                          updateQuantity(item.menuItemId, item.quantity + 1)
                        }
                      >
                        <Plus className="w-3 h-3" />
                      </Button>
                    </div>
                    <span className="font-semibold text-sm">
                      {formatPrice(item.price * item.quantity)}원
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* 총 금액 요약 */}
        <div className="flex items-center justify-between px-1">
          <span className="text-sm text-gray-500">
            총 {items.length}종류 {items.reduce((s, i) => s + i.quantity, 0)}개
          </span>
          <span className="text-lg font-bold text-blue-600">
            {formatPrice(totalAmount())}원
          </span>
        </div>

        {/* Payment Method */}
        <Card>
          <CardContent className="p-5">
            <h2 className="font-semibold mb-3">결제 방식</h2>
            <div className="grid grid-cols-2 gap-3">
              <button
                className={`p-4 rounded-xl border-2 text-center transition ${
                  paymentMethod === "kakaopay"
                    ? "border-yellow-400 bg-yellow-50"
                    : "border-gray-200 hover:border-gray-300"
                }`}
                onClick={() => setPaymentMethod("kakaopay")}
              >
                <CreditCard className="w-8 h-8 mx-auto mb-2 text-yellow-600" />
                <p className="font-semibold text-sm">카카오페이</p>
                <p className="text-xs text-gray-500 mt-1">즉시 결제</p>
              </button>
              <button
                className={`p-4 rounded-xl border-2 text-center transition ${
                  paymentMethod === "deferred"
                    ? "border-blue-400 bg-blue-50"
                    : "border-gray-200 hover:border-gray-300"
                }`}
                onClick={() => setPaymentMethod("deferred")}
              >
                <Clock className="w-8 h-8 mx-auto mb-2 text-blue-600" />
                <p className="font-semibold text-sm">후불결제</p>
                <p className="text-xs text-gray-500 mt-1">퇴실시 정산</p>
              </button>
            </div>
            {paymentMethod && (
              <Badge
                variant="outline"
                className="mt-3"
              >
                {paymentMethod === "kakaopay"
                  ? "카카오페이로 바로 결제합니다"
                  : "퇴실 시 프런트에서 정산합니다"}
              </Badge>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Order Button */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg">
        <div className="max-w-lg mx-auto px-5 py-3">
          <Button
            className="w-full h-12 text-lg"
            onClick={handleOrder}
            disabled={loading || !paymentMethod}
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
