"use client";

import { useState, use } from "react";
import { useRouter } from "next/navigation";
import { useCartStore } from "@/stores/cart-store";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, CreditCard, Clock } from "lucide-react";
import { toast } from "sonner";
import type { PaymentMethod } from "@/types";

export default function CartPage({
  params,
}: {
  params: Promise<{ roomId: string }>;
}) {
  const { roomId } = use(params);
  const router = useRouter();
  const { items, totalAmount, clearCart } = useCartStore();
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(null);
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);

  const formatPrice = (price: number) => price.toLocaleString("ko-KR");

  if (items.length === 0) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4">
        <p className="text-gray-400 mb-4">장바구니가 비어있습니다</p>
        <Button variant="outline" onClick={() => router.push(`/room/${roomId}`)}>
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
          note: note || undefined,
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
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push(`/room/${roomId}`)}
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-lg font-bold">주문 확인</h1>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-4 space-y-4">
        {/* Order Items */}
        <Card>
          <CardContent className="p-4">
            <h2 className="font-semibold mb-3">주문 내역</h2>
            <div className="space-y-2">
              {items.map((item) => (
                <div
                  key={item.menuItemId}
                  className="flex justify-between text-sm"
                >
                  <span>
                    {item.name} x {item.quantity}
                  </span>
                  <span className="font-medium">
                    {formatPrice(item.price * item.quantity)}원
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-3 pt-3 border-t flex justify-between">
              <span className="font-semibold">총 금액</span>
              <span className="text-lg font-bold text-blue-600">
                {formatPrice(totalAmount())}원
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Note */}
        <Card>
          <CardContent className="p-4">
            <h2 className="font-semibold mb-2">요청사항</h2>
            <Input
              placeholder="요청사항이 있으시면 입력해주세요 (선택)"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </CardContent>
        </Card>

        {/* Payment Method */}
        <Card>
          <CardContent className="p-4">
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
        <div className="max-w-lg mx-auto px-4 py-3">
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
