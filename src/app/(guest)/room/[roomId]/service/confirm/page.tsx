"use client";

import { use } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

function ConfirmContent({ roomId }: { roomId: string }) {
  const searchParams = useSearchParams();
  const requestId = searchParams.get("requestId");
  const name = searchParams.get("name");

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-sm w-full">
        <Card>
          <CardContent className="p-8 text-center space-y-4">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle className="w-10 h-10 text-green-500" />
            </div>
            <h1 className="text-xl font-bold">요청 완료</h1>
            <p className="text-gray-500">
              {name || "서비스"} 요청이 접수되었습니다.
              <br />
              잠시만 기다려 주세요.
            </p>
            {requestId && (
              <p className="text-xs text-gray-400 font-mono">{requestId}</p>
            )}
            <Link href={`/room/${roomId}/orders`}>
              <Button className="w-full mt-4">주문현황 보기</Button>
            </Link>
            <Link href={`/room/${roomId}`}>
              <Button variant="outline" className="w-full mt-2">
                서비스 홈으로
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function ServiceConfirmPage({
  params,
}: {
  params: Promise<{ roomId: string }>;
}) {
  const { roomId } = use(params);

  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <p className="text-gray-400">로딩 중...</p>
        </div>
      }
    >
      <ConfirmContent roomId={roomId} />
    </Suspense>
  );
}
