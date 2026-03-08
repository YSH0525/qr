import { AdminSidebar } from "@/components/admin/sidebar";
import { BluetoothPrinterProvider } from "@/components/admin/bluetooth-printer-provider";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <BluetoothPrinterProvider>
      <div className="flex h-screen overflow-hidden">
        <AdminSidebar />
        <main className="flex-1 bg-gray-50 overflow-y-auto print:bg-white">{children}</main>
      </div>
    </BluetoothPrinterProvider>
  );
}
