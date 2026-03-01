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
} from "lucide-react";
import { cn } from "@/lib/utils";

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

export function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 bg-gray-900 text-white min-h-screen flex flex-col print:hidden">
      <div className="p-6 border-b border-gray-700">
        <h1 className="text-xl font-bold">Easy Tap</h1>
        <p className="text-sm text-gray-400 mt-1">관리자 시스템</p>
      </div>
      <nav className="flex-1 p-4 space-y-1">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
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
    </aside>
  );
}
