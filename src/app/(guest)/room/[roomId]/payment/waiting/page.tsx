"use client";

import { use, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle, XCircle } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

type PaymentResult = "pending" | "completed" | "not_found" | "timeout";

function WaitingContent({ roomId }: { roomId: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const orderId = searchParams.get("orderId");
  const [result, setResult] = useState<PaymentResult>("pending");
  const pollCountRef = useRef(0);

  useEffect(() => {
    if (!orderId) return;

    const poll = setInterval(async () => {
      pollCountRef.current++;

      // 최대 60회 (2초 간격 × 60 = 2분) 후 타임아웃
      if (pollCountRef.current > 60) {
        clearInterval(poll);
        setResult("timeout");
        return;
      }

      try {
        const res = await fetch(`/api/payments/kakaopay/status?orderId=${orderId}`);
        if (!res.ok) return;
        const data = await res.json();

        if (data.status === "completed") {
          clearInterval(poll);
          setResult("completed");
          // 1초 후 성공 페이지로 이동
          setTimeout(() => {
            router.replace(`/room/${roomId}/payment/success?orderId=${orderId}`);
          }, 1000);
        } else if (data.status === "not_found") {
          clearInterval(poll);
          setResult("not_found");
        }
      } catch {
        // 네트워크 오류는 무시하고 계속 polling
      }
    }, 2000);

    return () => clearInterval(poll);
  }, [orderId, roomId, router]);

  if (!orderId) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <p className="text-gray-400">잘못된 접근입니다</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-sm w-full text-center">
        {result === "pending" && (
          <>
            <Loader2 className="w-16 h-16 text-yellow-500 mx-auto mb-4 animate-spin" />
            <h1 className="text-xl font-bold mb-2">결제 진행 중</h1>
            <p className="text-gray-500 mb-6 text-sm">
              카카오페이에서 결제를 완료해주세요.<br />
              결제가 완료되면 자동으로 이동합니다.
            </p>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-gray-400">
                  주문번호: <span className="font-mono">{orderId}</span>
                </p>
              </CardContent>
            </Card>
          </>
        )}

        {result === "completed" && (
          <>
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h1 className="text-xl font-bold mb-2">결제 완료</h1>
            <p className="text-gray-500 text-sm">잠시 후 이동합니다...</p>
          </>
        )}

        {(result === "not_found" || result === "timeout") && (
          <>
            <XCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
            <h1 className="text-xl font-bold mb-2">
              {result === "timeout" ? "결제 시간 초과" : "결제를 찾을 수 없습니다"}
            </h1>
            <p className="text-gray-500 mb-6 text-sm">
              {result === "timeout"
                ? "2분 내에 결제가 완료되지 않았습니다."
                : "결제가 취소되었거나 만료되었습니다."}
            </p>
            <div className="space-y-3">
              <Link href={`/room/${roomId}/cart`}>
                <Button className="w-full">다시 시도하기</Button>
              </Link>
              <Link href={`/room/${roomId}`}>
                <Button variant="outline" className="w-full">메뉴로 돌아가기</Button>
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function PaymentWaitingPage({
  params,
}: {
  params: Promise<{ roomId: string }>;
}) {
  const { roomId } = use(params);
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-gray-400" /></div>}>
      <WaitingContent roomId={roomId} />
    </Suspense>
  );
}
