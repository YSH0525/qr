"use client";

import { useState, use } from "react";
import { useRouter } from "next/navigation";
import { useCartStore } from "@/stores/cart-store";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
// TODO: 카카오페이 연동 시 복원 — CreditCard, Clock, ChevronDown, ChevronUp, Check
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import type { PaymentMethod } from "@/types";
// TODO: 카카오페이 연동 시 복원
// import { KAKAOPAY_ENABLED } from "@/lib/constants";
import { useClosingTime } from "@/hooks/use-closing-time";

export default function CartPage({
  params,
}: {
  params: Promise<{ roomId: string }>;
}) {
  const { roomId } = use(params);
  const router = useRouter();
  const { items, totalAmount, clearCart } = useCartStore();
  // TODO: 카카오페이 연동 시 복원 — 결제방식 선택 & 이용약관
  // const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(KAKAOPAY_ENABLED ? null : "deferred");
  // const [agreedTerms, setAgreedTerms] = useState(false);
  // const [showTerms, setShowTerms] = useState(false);
  const paymentMethod: PaymentMethod = "deferred";
  const agreedTerms = true;
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

  const isFreeOrder = totalAmount() === 0;

  const handleOrder = async () => {
    setLoading(true);
    try {
      // TODO: 카카오페이 연동 시 복원 — effectivePaymentMethod 분기 & 이용약관 검증
      // const effectivePaymentMethod = isFreeOrder ? "deferred" : paymentMethod;
      // if (!effectivePaymentMethod) { toast.error("결제 방식을 선택해주세요"); return; }
      // if (!agreedTerms) { toast.error("이용약관에 동의해주세요"); return; }
      // if (effectivePaymentMethod === "kakaopay") { ... }

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
          paymentMethod: "deferred",
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

          {/* 서비스 제공기간 안내 */}
          <div className="border-t border-dashed border-gray-300 pt-3 mt-3 text-xs text-gray-400">
            <p>* 주문 접수 후 약 15~30분 내 객실로 제공됩니다.</p>
            <p className="text-gray-300">  Delivered to your room in approx. 15-30 min.</p>
            <p>* 호텔 운영 상황에 따라 제공 시간이 변동될 수 있습니다.</p>
            <p className="text-gray-300">  Delivery time may vary depending on hotel operations.</p>
          </div>
        </div>

        {/* TODO: 카카오페이 연동 시 결제방식 선택 & 이용약관 UI 복원
        {!isFreeOrder && (
          <Card>
            <CardContent className="p-5">
              <h2 className="font-semibold mb-3">결제 방식</h2>
              {KAKAOPAY_ENABLED ? (
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
              ) : (
                <div className="p-4 rounded-xl border-2 border-blue-400 bg-blue-50 text-center">
                  <Clock className="w-8 h-8 mx-auto mb-2 text-blue-600" />
                  <p className="font-semibold text-sm">후불결제</p>
                  <p className="text-xs text-gray-500 mt-1">퇴실시 프런트에서 정산합니다</p>
                </div>
              )}
              {KAKAOPAY_ENABLED && paymentMethod && (
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
        <Card>
          <CardContent className="p-5">
            <button
              className="flex items-center gap-3 w-full text-left"
              onClick={() => setAgreedTerms(!agreedTerms)}
            >
              <div
                className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition ${
                  agreedTerms
                    ? "bg-blue-500 border-blue-500"
                    : "border-gray-300"
                }`}
              >
                {agreedTerms && <Check className="w-3.5 h-3.5 text-white" />}
              </div>
              <span className="font-semibold text-sm flex-1">
                주문 및 결제 이용약관에 동의합니다
              </span>
              <button
                className="text-gray-400 p-1"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowTerms(!showTerms);
                }}
              >
                {showTerms ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
              </button>
            </button>
            {showTerms && (
              <div className="mt-3 p-3 bg-gray-50 rounded-lg text-xs text-gray-500 space-y-2 max-h-48 overflow-y-auto">
                <p className="font-semibold text-gray-700">이용약관</p>
                <p>1. 주문한 상품은 객실로 제공되며, 주문 접수 후 취소가 불가할 수 있습니다.</p>
                <p>2. 카카오페이 결제 시 결제 완료 후 환불은 호텔 정책에 따릅니다.</p>
                <p>3. 후불결제 선택 시 퇴실 시 프런트에서 정산합니다.</p>
                <p>4. 상품 제공 시간은 호텔 운영 상황에 따라 변동될 수 있습니다.</p>
                <p>5. 개인정보는 주문 처리 목적으로만 사용되며, 결제 정보는 카카오페이를 통해 안전하게 처리됩니다.</p>
                <p>6. 기타 문의사항은 프런트 데스크로 연락해주세요.</p>
              </div>
            )}
          </CardContent>
        </Card>
        */}
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
