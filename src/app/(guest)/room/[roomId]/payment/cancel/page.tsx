"use client";

import { use } from "react";
import { Button } from "@/components/ui/button";
import { XCircle } from "lucide-react";
import Link from "next/link";

export default function PaymentCancelPage({
  params,
}: {
  params: Promise<{ roomId: string }>;
}) {
  const { roomId } = use(params);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="max-w-lg mx-auto px-4 text-center">
        <XCircle className="w-20 h-20 text-gray-400 mx-auto mb-4" />
        <h1 className="text-2xl font-bold mb-2">결제 취소</h1>
        <p className="text-gray-500 mb-6">결제가 취소되었습니다</p>
        <div className="space-y-3">
          <Link href={`/room/${roomId}/menu`}>
            <Button className="w-full">메뉴에서 다시 주문하기</Button>
          </Link>
          <Link href={`/room/${roomId}`}>
            <Button variant="outline" className="w-full">홈으로 돌아가기</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
