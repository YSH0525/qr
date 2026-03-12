import { NextRequest, NextResponse } from "next/server";
import { firestore } from "@/lib/firebase";
import {
  collection,
  getDocs,
  addDoc,
  query,
  where,
} from "firebase/firestore";
import { getNextDailySeq } from "@/lib/daily-seq";
import { format } from "date-fns";

function generateRequestId(): string {
  const date = format(new Date(), "yyyyMMdd");
  const rand = Math.floor(Math.random() * 1000)
    .toString()
    .padStart(3, "0");
  return `SRV-${date}-${rand}`;
}

const QUICK_TYPES = {
  towel: {
    categoryName: "수건 요청",
    categoryIcon: "Droplets",
    type: "amenity" as const,
    items: [{ itemId: "towel", name: "수건", quantity: 1 }],
  },
  inquiry: {
    categoryName: "기타문의",
    categoryIcon: "MessageCircle",
    type: "amenity" as const,
    items: [],
  },
} as const;

export async function POST(req: NextRequest) {
  try {
    const { roomId: roomUuid, type, note } = await req.json();

    if (!roomUuid || !type) {
      return NextResponse.json({ error: "roomId와 type이 필요합니다" }, { status: 400 });
    }

    const quickType = QUICK_TYPES[type as keyof typeof QUICK_TYPES];
    if (!quickType) {
      return NextResponse.json({ error: "지원하지 않는 요청 타입입니다" }, { status: 400 });
    }

    const roomSnap = await getDocs(
      query(collection(firestore, "rooms"), where("roomId", "==", roomUuid))
    );
    if (roomSnap.empty) {
      return NextResponse.json({ error: "객실을 찾을 수 없습니다" }, { status: 404 });
    }
    const roomDoc = roomSnap.docs[0];
    const roomData = roomDoc.data() as { roomNumber: string; roomId: string };

    const requestId = generateRequestId();
    const now = new Date().toISOString();
    const dailySeq = await getNextDailySeq();

    const requestData = {
      requestId,
      dailySeq,
      categoryId: `quick-${type}`,
      categoryName: quickType.categoryName,
      categoryIcon: quickType.categoryIcon,
      type: quickType.type,
      roomId: roomDoc.id,
      roomUuid: roomData.roomId,
      roomNumber: roomData.roomNumber,
      status: "accepted",
      note: note || null,
      items: quickType.items,
      cleaningOptions: null,
      extensionHours: null,
      extensionAmount: null,
      freeExtension: false,
      paymentMethod: null,
      paymentStatus: null,
      createdAt: now,
      updatedAt: now,
    };

    const docRef = await addDoc(
      collection(firestore, "serviceRequests"),
      requestData
    );

    return NextResponse.json({ id: docRef.id, ...requestData }, { status: 201 });
  } catch (e) {
    console.error("Quick service request error:", e);
    return NextResponse.json({ error: "서비스 요청 실패" }, { status: 500 });
  }
}
