"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  ClipboardList,
  DoorOpen,
  UtensilsCrossed,
  CreditCard,
  BarChart3,
  ConciergeBell,
  Settings,
  Bluetooth,
  BluetoothConnected,
  Loader2,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useBluetoothPrinterContext } from "./bluetooth-printer-provider";

const navItems = [
  { href: "/dashboard", label: "대시보드", icon: LayoutDashboard },
  { href: "/orders", label: "주문 내역", icon: ClipboardList },
  { href: "/services", label: "서비스 요청", icon: ConciergeBell },
  { href: "/rooms", label: "객실 관리", icon: DoorOpen },
  { href: "/menu", label: "메뉴 관리", icon: UtensilsCrossed },
  { href: "/service-settings", label: "서비스 설정", icon: Settings },
  { href: "/payments", label: "후불 정산", icon: CreditCard },
  { href: "/sales", label: "매출 분석", icon: BarChart3 },
];

export function AdminSidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const printer = useBluetoothPrinterContext();

  return (
    <aside className="w-64 bg-gray-900 text-white h-full shrink-0 flex flex-col overflow-y-auto print:hidden">
      <div className="p-6 border-b border-gray-700">
        <h1 className="text-xl font-bold">Easy Tap</h1>
        <p className="text-sm text-gray-400 mt-1">관리자 시스템</p>
      </div>
      <nav className="flex-1 p-4 space-y-1">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-3 px-4 py-3 rounded-lg text-sm transition",
              pathname === item.href
                ? "bg-blue-600 text-white"
                : "text-gray-300 hover:bg-gray-800 hover:text-white"
            )}
          >
            <item.icon className="w-5 h-5" />
            {item.label}
          </Link>
        ))}
      </nav>

      {/* 블루투스 프린터 연결 상태 */}
      {printer.isSupported && (
        <div className="p-4 border-t border-gray-700">
          {printer.isConnected ? (
            <div className="flex items-center gap-2 px-3 py-2 bg-gray-800 rounded-lg">
              <BluetoothConnected className="w-4 h-4 text-green-400 shrink-0" />
              <span className="text-xs text-green-400 truncate flex-1">
                {printer.printerName}
              </span>
              <button
                onClick={printer.disconnect}
                className="text-gray-500 hover:text-gray-300 transition shrink-0"
                title="연결 해제"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              onClick={printer.connect}
              disabled={printer.isConnecting}
              className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition disabled:opacity-50"
            >
              {printer.isConnecting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Bluetooth className="w-4 h-4" />
              )}
              {printer.isConnecting ? "연결 중..." : "프린터 연결"}
            </button>
          )}
        </div>
      )}
    </aside>
  );
}
