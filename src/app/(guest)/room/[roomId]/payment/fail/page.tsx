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
        <h1 className="text-2xl font-bold mb-2">결제 실패</h1>
        <p className="text-gray-500 mb-6">결제 처리 중 오류가 발생했습니다</p>
        <Link href={`/room/${roomId}`}>
          <Button className="w-full">메뉴로 돌아가기</Button>
        </Link>
      </div>
    </div>
  );
}
