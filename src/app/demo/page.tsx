import { redirect } from "next/navigation";
import { firestore } from "@/lib/firebase";
import { collection, getDocs, query, where, orderBy, limit } from "firebase/firestore";

export const dynamic = "force-dynamic";

export default async function DemoPage() {
  // 첫 번째 활성 객실을 찾아 고객 페이지로 리다이렉트
  const snap = await getDocs(
    query(
      collection(firestore, "rooms"),
      where("isActive", "==", true),
      orderBy("roomNumber"),
      limit(1)
    )
  );

  if (snap.empty) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center space-y-4 p-8">
          <h1 className="text-2xl font-bold text-gray-900">객실이 없습니다</h1>
          <p className="text-gray-500">관리자 페이지에서 객실을 먼저 추가해주세요.</p>
        </div>
      </div>
    );
  }

  const room = snap.docs[0].data() as { roomId: string };
  redirect(`/room/${room.roomId}`);
}
