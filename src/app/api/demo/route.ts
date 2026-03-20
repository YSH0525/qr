import { NextRequest, NextResponse } from "next/server";
import { firestore } from "@/lib/firebase";
import { collection, getDocs, query, orderBy } from "firebase/firestore";
import { BASE_URL } from "@/lib/constants";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  void req;
  const baseUrl = BASE_URL;

  try {
    const snap = await getDocs(
      query(collection(firestore, "rooms"), orderBy("roomNumber"))
    );

    const activeRoom = snap.docs.find(
      (d) => d.data().isActive !== false
    );

    if (!activeRoom) {
      return new NextResponse(
        "<html><body style='display:flex;justify-content:center;align-items:center;height:100vh;font-family:sans-serif'>" +
        "<div style='text-align:center'><h1>객실이 없습니다</h1><p>관리자 페이지에서 객실을 먼저 추가해주세요.</p></div>" +
        "</body></html>",
        { headers: { "Content-Type": "text/html; charset=utf-8" } }
      );
    }

    const room = activeRoom.data() as { roomId: string };
    return NextResponse.redirect(`${baseUrl}/room/${room.roomId}`);
  } catch (e) {
    console.error("Demo redirect error:", e);
    return NextResponse.redirect(baseUrl);
  }
}
