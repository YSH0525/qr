"use client";

import { useState, useEffect, use } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";

interface Room {
  id: string;
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
        <div className="w-full max-w-md mx-auto text-center space-y-6 border-2 border-gray-200 rounded-2xl p-10 print:border-0">
          {/* Hotel Name & Branding */}
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              {process.env.NEXT_PUBLIC_HOTEL_NAME || "Easy Tap"}
            </h1>
            <p className="text-gray-500 mt-1">객실 서비스 안내</p>
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
                size={200}
                level="H"
              />
            </div>
          </div>

          {/* Available Services */}
          <div className="grid grid-cols-2 gap-3 text-center">
            <div className="bg-orange-50 rounded-xl p-3">
              <span className="text-2xl">🍽️</span>
              <p className="text-sm font-semibold text-gray-700 mt-1">룸 오더</p>
              <p className="text-xs text-gray-400">객실로 배달</p>
            </div>
            <div className="bg-sky-50 rounded-xl p-3">
              <span className="text-2xl">🧹</span>
              <p className="text-sm font-semibold text-gray-700 mt-1">연박 청소</p>
              <p className="text-xs text-gray-400">객실 청소 요청</p>
            </div>
            <div className="bg-purple-50 rounded-xl p-3">
              <span className="text-2xl">🕐</span>
              <p className="text-sm font-semibold text-gray-700 mt-1">레이트 체크아웃</p>
              <p className="text-xs text-gray-400">퇴실 시간 연장</p>
            </div>
            <div className="bg-green-50 rounded-xl p-3">
              <span className="text-2xl">🧴</span>
              <p className="text-sm font-semibold text-gray-700 mt-1">비품 요청</p>
              <p className="text-xs text-gray-400">어메니티·용품</p>
            </div>
          </div>

          {/* Instructions */}
          <div className="space-y-3 text-left bg-gray-50 rounded-xl p-5">
            <h2 className="text-base font-semibold text-center text-gray-800">
              이용 방법
            </h2>
            <div className="space-y-2 text-sm text-gray-600">
              <p className="flex items-start gap-2">
                <span className="bg-blue-100 text-blue-600 rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold shrink-0">
                  1
                </span>
                스마트폰 카메라로 QR코드를 스캔해주세요
              </p>
              <p className="flex items-start gap-2">
                <span className="bg-blue-100 text-blue-600 rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold shrink-0">
                  2
                </span>
                원하시는 서비스를 선택해주세요
              </p>
              <p className="flex items-start gap-2">
                <span className="bg-blue-100 text-blue-600 rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold shrink-0">
                  3
                </span>
                요청이 접수되면 신속하게 처리해 드립니다
              </p>
            </div>
            <p className="text-xs text-gray-400 text-center pt-1">
              룸 오더는 카카오페이 또는 퇴실시 후불결제가 가능합니다
            </p>
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
