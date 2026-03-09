"use client";

import { useState, useEffect } from "react";
import { AdminSidebar } from "@/components/admin/sidebar";
import { BluetoothPrinterProvider } from "@/components/admin/bluetooth-printer-provider";
import { Menu, LogIn } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const AUTH_KEY = "admin_auth";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [authed, setAuthed] = useState(false);
  const [id, setId] = useState("");
  const [pw, setPw] = useState("");
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    setAuthed(sessionStorage.getItem(AUTH_KEY) === "1");
    setChecking(false);
  }, []);

  const handleLogin = () => {
    if (id === "admin" && pw === "1234") {
      sessionStorage.setItem(AUTH_KEY, "1");
      setAuthed(true);
      setError("");
    } else {
      setError("아이디 또는 비밀번호가 틀렸습니다");
    }
  };

  if (checking) return null;

  if (!authed) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <div className="w-full max-w-xs bg-white rounded-lg shadow p-6 space-y-4">
          <h1 className="text-xl font-bold text-center">Easy Tap 관리자</h1>
          <div className="space-y-3">
            <Input
              placeholder="아이디"
              value={id}
              onChange={(e) => setId(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleLogin()}
              autoFocus
            />
            <Input
              type="password"
              placeholder="비밀번호"
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleLogin()}
            />
            {error && <p className="text-sm text-red-500">{error}</p>}
            <Button className="w-full" onClick={handleLogin}>
              <LogIn className="w-4 h-4 mr-2" />
              로그인
            </Button>
          </div>
        </div>
      </div>
    );
  }

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
