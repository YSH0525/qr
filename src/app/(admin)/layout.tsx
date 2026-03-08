"use client";

import { useState } from "react";
import { AdminSidebar } from "@/components/admin/sidebar";
import { BluetoothPrinterProvider } from "@/components/admin/bluetooth-printer-provider";
import { Menu } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetTitle,
} from "@/components/ui/sheet";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <BluetoothPrinterProvider>
      <div className="flex h-screen overflow-hidden">
        {/* Desktop sidebar */}
        <div className="hidden md:block">
          <AdminSidebar />
        </div>

        {/* Mobile sidebar (Sheet) */}
        <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
          <SheetContent side="left" className="w-64 p-0 bg-gray-900" showCloseButton={false}>
            <SheetTitle className="sr-only">메뉴</SheetTitle>
            <AdminSidebar onNavigate={() => setSidebarOpen(false)} />
          </SheetContent>
        </Sheet>

        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Mobile header */}
          <header className="md:hidden bg-white border-b px-4 py-3 flex items-center gap-3 shrink-0 print:hidden">
            <button
              onClick={() => setSidebarOpen(true)}
              className="p-1 -ml-1 text-gray-600 hover:text-gray-900"
            >
              <Menu className="w-6 h-6" />
            </button>
            <h1 className="text-lg font-bold text-gray-900">Easy Tap</h1>
          </header>

          <main className="flex-1 bg-gray-50 overflow-y-auto print:bg-white">
            {children}
          </main>
        </div>
      </div>
    </BluetoothPrinterProvider>
  );
}
