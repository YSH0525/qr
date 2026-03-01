"use client";

import { useState, useEffect, use } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Button } from "@/components/ui/button";
import {
  Printer,
  ScanLine,
  Smartphone,
  Sofa,
  SprayCan,
  Clock,
  ShoppingCart,
} from "lucide-react";

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
      {/* Print Styles */}
      <style jsx global>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 15mm;
          }
          body {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
        }
      `}</style>

      {/* Print Button - hidden in print */}
      <div className="print:hidden fixed top-4 right-4 z-50">
        <Button onClick={() => window.print()}>
          <Printer className="w-4 h-4 mr-2" />
          인쇄하기
        </Button>
      </div>

      {/* Printable Content */}
      <div className="min-h-screen flex items-center justify-center bg-white p-6 print:p-0">
        <div className="w-full max-w-2xl mx-auto text-center space-y-8 py-10 print:py-4 print:space-y-6">
          {/* Top Branding */}
          <p className="text-sm text-gray-400 tracking-widest uppercase">
            Easy Tap
          </p>

          {/* Main Headline */}
          <div className="space-y-3">
            <h1 className="text-3xl font-bold text-gray-900 leading-tight">
              말하지 말고, 이지탭!
              <span className="text-blue-600">(Easy Tap!)</span>
            </h1>
            <p className="text-base text-gray-600">
              전화 대신 스마트폰으로 간편하게 요청하세요.
            </p>
            <p className="text-sm text-gray-400">
              Request easily with your smartphone instead of the phone.
            </p>
          </div>

          {/* How to Use */}
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-gray-800">
              이용 방법{" "}
              <span className="text-gray-400 font-normal">| How to Use</span>
            </h2>
            <div className="grid grid-cols-3 gap-4 print:gap-3">
              {/* Step 1 */}
              <div className="bg-gray-50 rounded-xl p-5 print:p-3 space-y-2">
                <div className="flex items-center justify-center w-12 h-12 mx-auto bg-blue-100 rounded-full">
                  <ScanLine className="w-6 h-6 text-blue-600" />
                </div>
                <p className="text-sm font-bold text-gray-800">QR 스캔</p>
                <p className="text-xs text-gray-400">Scan QR</p>
                <p className="text-xs text-gray-500 leading-relaxed">
                  스마트폰 카메라로
                  <br />
                  QR코드를 스캔하세요
                </p>
              </div>

              {/* Step 2 */}
              <div className="bg-gray-50 rounded-xl p-5 print:p-3 space-y-2">
                <div className="flex items-center justify-center w-12 h-12 mx-auto bg-blue-100 rounded-full">
                  <Smartphone className="w-6 h-6 text-blue-600" />
                </div>
                <p className="text-sm font-bold text-gray-800">서비스 탭</p>
                <p className="text-xs text-gray-400">Tap Service</p>
                <p className="text-xs text-gray-500 leading-relaxed">
                  원하시는 서비스를
                  <br />
                  간편하게 선택하세요
                </p>
              </div>

              {/* Step 3 */}
              <div className="bg-gray-50 rounded-xl p-5 print:p-3 space-y-2">
                <div className="flex items-center justify-center w-12 h-12 mx-auto bg-blue-100 rounded-full">
                  <Sofa className="w-6 h-6 text-blue-600" />
                </div>
                <p className="text-sm font-bold text-gray-800">편하게 대기</p>
                <p className="text-xs text-gray-400">Relax &amp; Wait</p>
                <p className="text-xs text-gray-500 leading-relaxed">
                  요청 완료!
                  <br />
                  편하게 기다리세요
                </p>
              </div>
            </div>
          </div>

          {/* Key Features */}
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-gray-800">
              주요 기능{" "}
              <span className="text-gray-400 font-normal">
                | Key Features
              </span>
            </h2>
            <div className="grid grid-cols-3 gap-4 print:gap-3">
              {/* Feature 1: Cleaning & Towels */}
              <div className="bg-gray-50 rounded-xl p-5 print:p-3 space-y-2">
                <div className="flex items-center justify-center w-12 h-12 mx-auto bg-emerald-100 rounded-full">
                  <SprayCan className="w-6 h-6 text-emerald-600" />
                </div>
                <p className="text-sm font-bold text-gray-800">
                  청소 &middot; 타월
                </p>
                <p className="text-xs text-gray-400">Cleaning &amp; Towels</p>
              </div>

              {/* Feature 2: Time Extension */}
              <div className="bg-gray-50 rounded-xl p-5 print:p-3 space-y-2">
                <div className="flex items-center justify-center w-12 h-12 mx-auto bg-amber-100 rounded-full">
                  <Clock className="w-6 h-6 text-amber-600" />
                </div>
                <p className="text-sm font-bold text-gray-800">시간연장</p>
                <p className="text-xs text-gray-400">Time Extension</p>
              </div>

              {/* Feature 3: Ordering Service */}
              <div className="bg-gray-50 rounded-xl p-5 print:p-3 space-y-2">
                <div className="flex items-center justify-center w-12 h-12 mx-auto bg-violet-100 rounded-full">
                  <ShoppingCart className="w-6 h-6 text-violet-600" />
                </div>
                <p className="text-sm font-bold text-gray-800">주문서비스</p>
                <p className="text-xs text-gray-400">Ordering Service</p>
              </div>
            </div>
          </div>

          {/* QR Code */}
          <div className="flex flex-col items-center space-y-3">
            <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm inline-block">
              <QRCodeSVG
                value={`${baseUrl}/room/${room.roomId}`}
                size={180}
                level="H"
              />
            </div>
            <p className="text-xs text-gray-400">
              스마트폰 카메라로 스캔해주세요 | Scan with your smartphone
            </p>
          </div>

          {/* Room Number */}
          <div className="inline-block bg-gray-900 text-white rounded-xl px-8 py-4">
            <p className="text-xs text-gray-400 mb-1">ROOM</p>
            <p className="text-4xl font-bold tracking-wide">
              {room.roomNumber}
              <span className="text-xl ml-1">호</span>
            </p>
          </div>

          {/* Footer */}
          <div className="pt-4 border-t border-gray-100 space-y-1">
            <p className="text-base font-semibold text-gray-700">Easy Tap</p>
            <p className="text-xs text-gray-400">
              스마트한 객실 서비스의 시작 | Smart Room Service
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
