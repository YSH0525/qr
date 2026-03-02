import { NextRequest, NextResponse } from "next/server";
import { firestore } from "@/lib/firebase";
import {
  collection,
  getDocs,
  addDoc,
  doc,
  getDoc,
  query,
  where,
} from "firebase/firestore";
import { orderEvents } from "@/lib/sse";
import { format } from "date-fns";
import type { ServiceType } from "@/types/service";

function generateRequestId(): string {
  const date = format(new Date(), "yyyyMMdd");
  const rand = Math.floor(Math.random() * 1000)
    .toString()
    .padStart(3, "0");
  return `SRV-${date}-${rand}`;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const roomId = searchParams.get("roomId");

    const constraints: ReturnType<typeof where>[] = [];
    if (status) constraints.push(where("status", "==", status));
    if (roomId) constraints.push(where("roomUuid", "==", roomId));

    const snap = await getDocs(
      query(
        collection(firestore, "serviceRequests"),
        ...constraints
      )
    );

    const result = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

    // Sort by createdAt descending (newest first)
    result.sort((a, b) => {
      const aTime = (a as Record<string, unknown>).createdAt as string;
      const bTime = (b as Record<string, unknown>).createdAt as string;
      return bTime > aTime ? 1 : bTime < aTime ? -1 : 0;
    });

    return NextResponse.json(result);
  } catch (e) {
    console.error("Service requests fetch error:", e);
    return NextResponse.json({ error: "서비스 요청 목록 조회 실패" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { roomId: roomUuid, categoryId, note, items, extensionHours, freeExtension, cleaningOptions } = body;

    // Find room
    const roomSnap = await getDocs(
      query(
        collection(firestore, "rooms"),
        where("roomId", "==", roomUuid)
      )
    );
    if (roomSnap.empty) {
      return NextResponse.json({ error: "객실을 찾을 수 없습니다" }, { status: 404 });
    }
    const roomDoc = roomSnap.docs[0];
    const roomData = roomDoc.data() as { roomNumber: string; roomId: string };

    // Find service category
    const catDoc = await getDoc(doc(firestore, "serviceCategories", categoryId));
    if (!catDoc.exists()) {
      return NextResponse.json({ error: "서비스를 찾을 수 없습니다" }, { status: 404 });
    }
    const catData = catDoc.data() as {
      name: string;
      type: ServiceType;
      icon: string;
      hourlyRate?: number;
    };

    // Calculate extension amount
    let extensionAmount: number | null = null;
    if (catData.type === "checkout_extension" && extensionHours) {
      extensionAmount = freeExtension ? 0 : (catData.hourlyRate || 0) * extensionHours;
    }

    const requestId = generateRequestId();
    const now = new Date().toISOString();

    const requestData = {
      requestId,
      categoryId,
      categoryName: catData.name,
      categoryIcon: catData.icon,
      type: catData.type,
      roomId: roomDoc.id,
      roomUuid: roomData.roomId,
      roomNumber: roomData.roomNumber,
      status: "requested",
      note: note || null,
      items: items || [],
      cleaningOptions: catData.type === "cleaning" && cleaningOptions ? cleaningOptions : null,
      extensionHours: extensionHours || null,
      extensionAmount,
      freeExtension: freeExtension || false,
      paymentStatus:
        catData.type === "checkout_extension" && extensionHours && !freeExtension
          ? "deferred"
          : null,
      createdAt: now,
      updatedAt: now,
    };

    const docRef = await addDoc(
      collection(firestore, "serviceRequests"),
      requestData
    );

    const fullRequest = { id: docRef.id, ...requestData };

    // SSE broadcast
    orderEvents.broadcast("new-service-request", fullRequest);

    return NextResponse.json(fullRequest, { status: 201 });
  } catch (e) {
    console.error("Service request error:", e);
    return NextResponse.json({ error: "서비스 요청 실패" }, { status: 500 });
  }
}
