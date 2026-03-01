"use client";

import { useEffect, useState } from "react";

interface SettlementItem {
  menuItemName: string;
  menuItemPrice: number;
  quantity: number;
  subtotal: number;
}

interface SettledOrder {
  orderId: string;
  totalAmount: number;
  createdAt: string;
  note: string | null;
  items: SettlementItem[];
}

interface SettledExtension {
  requestId: string;
  categoryName: string;
  extensionHours: number;
  extensionAmount: number;
  createdAt: string;
}

interface SettlementData {
  settled: number;
  totalAmount: number;
  roomNumber: string;
  settledAt: string;
  orders: SettledOrder[];
  extensions?: SettledExtension[];
}

export default function SettlementReceiptPage() {
  const [data, setData] = useState<SettlementData | null>(null);

  useEffect(() => {
    const raw = sessionStorage.getItem("settlementReceipt");
    if (raw) {
      setData(JSON.parse(raw));
      sessionStorage.removeItem("settlementReceipt");
    }
  }, []);

  useEffect(() => {
    if (data) {
      // 렌더링 후 자동 인쇄 다이얼로그
      const timer = setTimeout(() => window.print(), 300);
      return () => clearTimeout(timer);
    }
  }, [data]);

  if (!data) {
    return (
      <div className="flex items-center justify-center min-h-screen text-gray-500">
        정산 데이터가 없습니다
      </div>
    );
  }

  const formatPrice = (n: number) => n.toLocaleString("ko-KR") + "원";
  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
  };
  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  };

  return (
    <>
      <style jsx global>{`
        @media print {
          @page {
            size: 80mm auto;
            margin: 4mm;
          }
          body {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      <div className="max-w-[320px] mx-auto py-6 px-4 font-mono text-sm">
        {/* 인쇄 버튼 (화면에서만 보임) */}
        <div className="no-print flex gap-2 mb-4">
          <button
            onClick={() => window.print()}
            className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-sm font-semibold hover:bg-blue-700 transition"
          >
            인쇄하기
          </button>
          <button
            onClick={() => window.close()}
            className="flex-1 bg-gray-200 text-gray-700 py-2 rounded-lg text-sm font-semibold hover:bg-gray-300 transition"
          >
            닫기
          </button>
        </div>

        {/* 영수증 헤더 */}
        <div className="text-center border-b-2 border-dashed border-gray-400 pb-3 mb-3">
          <h1 className="text-lg font-bold tracking-wide">정산내역서</h1>
          <p className="text-xs text-gray-500 mt-1">SETTLEMENT RECEIPT</p>
        </div>

        {/* 기본 정보 */}
        <div className="border-b border-dashed border-gray-300 pb-3 mb-3 space-y-1">
          <div className="flex justify-between">
            <span className="text-gray-500">객실</span>
            <span className="font-bold text-base">{data.roomNumber}호</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">정산일시</span>
            <span>{formatDate(data.settledAt)} {formatTime(data.settledAt)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">주문건수</span>
            <span>{data.settled}건</span>
          </div>
        </div>

        {/* 주문별 상세 내역 */}
        {data.orders.map((order, idx) => (
          <div key={order.orderId} className="mb-3">
            <div className="flex justify-between text-xs text-gray-400 mb-1">
              <span>#{order.orderId}</span>
              <span>{formatDate(order.createdAt)} {formatTime(order.createdAt)}</span>
            </div>
            {order.items.map((item, i) => (
              <div key={i} className="flex justify-between py-0.5">
                <span>
                  {item.menuItemName} x{item.quantity}
                </span>
                <span>{formatPrice(item.subtotal)}</span>
              </div>
            ))}
            {order.note && (
              <p className="text-xs text-gray-400 mt-0.5">* {order.note}</p>
            )}
            <div className="flex justify-between border-t border-dotted border-gray-200 mt-1 pt-1 font-semibold text-xs">
              <span>소계</span>
              <span>{formatPrice(order.totalAmount)}</span>
            </div>
            {idx < data.orders.length - 1 && (
              <div className="border-b border-dashed border-gray-200 mt-2" />
            )}
          </div>
        ))}

        {/* 체크아웃 연장 요금 */}
        {data.extensions && data.extensions.length > 0 && (
          <div className="border-t border-dashed border-gray-300 pt-3 mt-2">
            <p className="text-xs text-gray-500 font-semibold mb-2">체크아웃 연장</p>
            {data.extensions.map((ext) => (
              <div key={ext.requestId} className="mb-2">
                <div className="flex justify-between text-xs text-gray-400 mb-0.5">
                  <span>#{ext.requestId}</span>
                  <span>{formatDate(ext.createdAt)} {formatTime(ext.createdAt)}</span>
                </div>
                <div className="flex justify-between py-0.5">
                  <span>{ext.categoryName} +{ext.extensionHours}시간</span>
                  <span>{formatPrice(ext.extensionAmount)}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 합계 */}
        <div className="border-t-2 border-dashed border-gray-400 pt-3 mt-2">
          <div className="flex justify-between text-base font-bold">
            <span>합계</span>
            <span>{formatPrice(data.totalAmount)}</span>
          </div>
          <div className="flex justify-between text-xs text-gray-400 mt-1">
            <span>결제방법</span>
            <span>후불결제 (체크아웃 정산)</span>
          </div>
        </div>

        {/* 푸터 */}
        <div className="text-center mt-6 pt-3 border-t border-dashed border-gray-300">
          <p className="text-xs text-gray-400">이용해 주셔서 감사합니다</p>
          <p className="text-xs text-gray-300 mt-1">Thank you for your stay</p>
        </div>
      </div>
    </>
  );
}
