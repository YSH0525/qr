"use client";

import { useState, use } from "react";
import { useRouter } from "next/navigation";
import { useCartStore } from "@/stores/cart-store";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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

  const isFreeOrder = totalAmount() === 0;

  const handleOrder = async () => {
    const effectivePaymentMethod = isFreeOrder ? "deferred" : paymentMethod;

    if (!effectivePaymentMethod) {
      toast.error("결제 방식을 선택해주세요");
      return;
    }

    setLoading(true);
    try {
      if (effectivePaymentMethod === "kakaopay") {
        // KakaoPay: send order data directly to ready (no order created yet)
        const payRes = await fetch("/api/payments/kakaopay/ready", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            roomId,
            items: items.map((i) => ({
              menuItemId: i.menuItemId,
              quantity: i.quantity,
            })),
          }),
        });

        if (payRes.ok) {
          const payData = await payRes.json();
          clearCart();

          // 결제 대기 페이지를 현재 탭에 먼저 표시한 뒤 카카오페이로 이동
          // 카카오톡 앱에서 결제 후 브라우저로 돌아오면 대기 페이지가 polling으로 결과 감지
          const waitingUrl = `/room/${roomId}/payment/waiting?orderId=${payData.orderId}`;
          const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
          const kakaoUrl = isMobile ? payData.redirectUrl : payData.redirectPcUrl;

          // 모바일: 현재 탭을 대기 페이지로 교체 후 카카오페이 열기
          // PC: 새 탭에서 카카오페이 열고 현재 탭은 대기 페이지
          if (isMobile) {
            router.replace(waitingUrl);
            // 짧은 딜레이 후 카카오페이 열기 (대기 페이지 로드 보장)
            setTimeout(() => {
              window.location.href = kakaoUrl;
            }, 100);
          } else {
            window.open(kakaoUrl, "_blank");
            router.replace(waitingUrl);
          }
          return;
        } else {
          const payError = await payRes.json().catch(() => null);
          toast.error(
            payError?.error || "카카오페이 결제 준비 중 오류가 발생했습니다"
          );
          setLoading(false);
          return;
        }
      }

      // Deferred payment: create order directly
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomId,
          items: items.map((i) => ({
            menuItemId: i.menuItemId,
            quantity: i.quantity,
          })),
          paymentMethod: effectivePaymentMethod,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "주문 실패");
      }

      const order = await res.json();
      clearCart();
      router.push(`/room/${roomId}/order/${order.orderId}`);
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
          <h1 className="text-lg font-bold">주문내역서</h1>
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
              <span>합계</span>
              <span>{formatPrice(totalAmount())}원</span>
            </div>
          </div>
        </div>

        {/* Payment Method - 0원이면 숨김 */}
        {!isFreeOrder && (
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
        )}
      </div>

      {/* Order Button */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg">
        <div className="max-w-lg mx-auto px-5 py-3">
          <Button
            className="w-full h-12 text-lg"
            onClick={handleOrder}
            disabled={loading || (!isFreeOrder && !paymentMethod)}
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
