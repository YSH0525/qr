import { GuestFooter } from "@/components/guest/footer";

export default function GuestLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <div className="flex-1">{children}</div>
      <GuestFooter />
    </div>
  );
}
