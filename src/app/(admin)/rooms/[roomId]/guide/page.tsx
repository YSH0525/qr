"use client";

import { useState, useEffect, use } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";

interface Room {
  id: number;
  roomNumber: string;
  roomId: string;
  floor: string | null;
}

export default function RoomGuidePage({
  params,
}: {
  params: Promise<{ roomId: string }>;
}) {
  const { roomId } = use(params);
  const [room, setRoom] = useState<Room | null>(null);

  useEffect(() => {
    fetch(`/api/rooms/${roomId}`)
      .then((r) => r.json())
      .then(setRoom);
  }, [roomId]);

  const baseUrl =
    typeof window !== "undefined" ? window.location.origin : "";

  if (!room) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p>로딩 중...</p>
      </div>
    );
  }

  return (
    <>
      {/* Print Button - hidden in print */}
      <div className="print:hidden fixed top-4 right-4 z-50">
        <Button onClick={() => window.print()}>
          <Printer className="w-4 h-4 mr-2" />
          인쇄하기
        </Button>
      </div>

      {/* Printable Content */}
      <div className="min-h-screen flex items-center justify-center bg-white p-8">
        <div className="w-full max-w-md mx-auto text-center space-y-8 border-2 border-gray-200 rounded-2xl p-10 print:border-0">
          {/* Hotel Name */}
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              {process.env.NEXT_PUBLIC_HOTEL_NAME || "호텔 편의점"}
            </h1>
            <p className="text-gray-500 mt-1">객실 주문 서비스</p>
          </div>

          {/* Room Number */}
          <div className="bg-blue-50 rounded-xl py-4 px-6 inline-block">
            <p className="text-5xl font-bold text-blue-600">
              {room.roomNumber}
              <span className="text-2xl">호</span>
            </p>
          </div>

          {/* QR Code */}
          <div className="flex justify-center">
            <div className="bg-white p-4 rounded-xl shadow-sm border">
              <QRCodeSVG
                value={`${baseUrl}/room/${room.roomId}`}
                size={220}
                level="H"
              />
            </div>
          </div>

          {/* Instructions */}
          <div className="space-y-3 text-left bg-gray-50 rounded-xl p-6">
            <h2 className="text-lg font-semibold text-center text-gray-800">
              이용 안내
            </h2>
            <div className="space-y-2 text-sm text-gray-600">
              <p className="flex items-start gap-2">
                <span className="bg-blue-100 text-blue-600 rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold shrink-0">
                  1
                </span>
                스마트폰 카메라로 위 QR코드를 스캔해주세요
              </p>
              <p className="flex items-start gap-2">
                <span className="bg-blue-100 text-blue-600 rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold shrink-0">
                  2
                </span>
                원하시는 상품을 장바구니에 담아주세요
              </p>
              <p className="flex items-start gap-2">
                <span className="bg-blue-100 text-blue-600 rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold shrink-0">
                  3
                </span>
                카카오페이 또는 퇴실시 후불결제를 선택해주세요
              </p>
              <p className="flex items-start gap-2">
                <span className="bg-blue-100 text-blue-600 rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold shrink-0">
                  4
                </span>
                주문이 완료되면 객실로 배달해 드립니다
              </p>
            </div>
          </div>

          {/* Footer */}
          <p className="text-xs text-gray-400">
            문의사항은 프런트 데스크로 연락해 주세요
          </p>
        </div>
      </div>
    </>
  );
}
