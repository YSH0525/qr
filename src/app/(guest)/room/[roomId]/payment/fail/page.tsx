"use client";

import { use } from "react";
import { Button } from "@/components/ui/button";
import { AlertCircle } from "lucide-react";
import Link from "next/link";

export default function PaymentFailPage({
  params,
}: {
  params: Promise<{ roomId: string }>;
}) {
  const { roomId } = use(params);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="max-w-lg mx-auto px-4 text-center">
        <AlertCircle className="w-20 h-20 text-red-500 mx-auto mb-4" />
        <h1 className="text-2xl font-bold mb-1">결제 실패</h1>
        <p className="text-sm text-gray-400 mb-1">Payment Failed</p>
        <p className="text-gray-500 mb-6">결제 처리 중 오류가 발생했습니다</p>
        <p className="text-sm text-gray-400 mb-6">
          다시 시도하시거나, 후불결제를 이용해주세요
        </p>
        <div className="space-y-3">
          <Link href={`/room/${roomId}/menu`}>
            <Button className="w-full">메뉴에서 다시 주문하기 Reorder</Button>
          </Link>
          <Link href={`/room/${roomId}`}>
            <Button variant="outline" className="w-full">홈으로 돌아가기 Back to Home</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
