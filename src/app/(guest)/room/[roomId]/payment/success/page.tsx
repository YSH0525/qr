"use client";

import { use } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function SuccessContent({ roomId }: { roomId: string }) {
  const searchParams = useSearchParams();
  const orderId = searchParams.get("orderId");

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="max-w-lg mx-auto px-4 text-center">
        <CheckCircle className="w-20 h-20 text-green-500 mx-auto mb-4" />
        <h1 className="text-2xl font-bold mb-1">결제 완료</h1>
        <p className="text-sm text-gray-400 mb-1">Payment Complete</p>
        <p className="text-gray-500 mb-6">카카오페이 결제가 완료되었습니다</p>

        <Card>
          <CardContent className="p-4">
            {orderId && (
              <p className="text-sm text-gray-500 mb-2">
                주문번호: <span className="font-mono">{orderId}</span>
              </p>
            )}
            <p className="text-sm text-gray-600">
              주문이 확인되면 객실로 배달해 드립니다<br />
              Your order will be delivered to your room.
            </p>
          </CardContent>
        </Card>

        <div className="mt-6 space-y-3">
          {orderId && (
            <Link href={`/room/${roomId}/order/${orderId}`}>
              <Button className="w-full">주문 상세 보기 View Order</Button>
            </Link>
          )}
          <Link href={`/room/${roomId}`}>
            <Button variant="outline" className="w-full">
              메뉴로 돌아가기 Back to Menu
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function PaymentSuccessPage({
  params,
}: {
  params: Promise<{ roomId: string }>;
}) {
  const { roomId } = use(params);
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><p>로딩 중...</p></div>}>
      <SuccessContent roomId={roomId} />
    </Suspense>
  );
}
