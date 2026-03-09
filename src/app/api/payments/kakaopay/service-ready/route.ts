import { NextRequest, NextResponse } from "next/server";
import { firestore } from "@/lib/firebase";
import {
  collection,
  addDoc,
  doc,
  getDoc,
  getDocs,
  query,
  where,
} from "firebase/firestore";
import { kakaoPayReady } from "@/lib/kakaopay";
import { getBaseUrlFromRequest } from "@/lib/constants";
import { format } from "date-fns";
import type { ServiceType } from "@/types/service";

function generateRequestId(): string {
  const date = format(new Date(), "yyyyMMdd");
  const rand = Math.floor(Math.random() * 1000)
    .toString()
    .padStart(3, "0");
  return `SRV-${date}-${rand}`;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { roomId: roomUuid, categoryId, note, items, extensionHours, freeExtension } = body;

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
    const extensionAmount = freeExtension ? 0 : (catData.hourlyRate || 0) * extensionHours;

    if (!extensionAmount || extensionAmount <= 0) {
      return NextResponse.json({ error: "결제 금액이 없습니다" }, { status: 400 });
    }

    const requestId = generateRequestId();
    const now = new Date().toISOString();

    // Save pending payment data (NOT in serviceRequests yet)
    const pendingData = {
      requestId,
      categoryId,
      categoryName: catData.name,
      categoryIcon: catData.icon,
      type: catData.type,
      roomId: roomDoc.id,
      roomUuid: roomData.roomId,
      roomNumber: roomData.roomNumber,
      note: note || null,
      items: items || [],
      extensionHours: extensionHours || null,
      extensionAmount,
      freeExtension: false,
      paymentMethod: "kakaopay",
      createdAt: now,
    };

    const pendingRef = await addDoc(
      collection(firestore, "pendingServicePayments"),
      pendingData
    );

    const baseUrl = getBaseUrlFromRequest(req);

    const result = await kakaoPayReady({
      orderId: requestId,
      itemName: `${roomData.roomNumber}호 ${catData.name} ${extensionHours}시간`,
      totalAmount: extensionAmount,
      roomId: roomData.roomId,
      baseUrl,
      callbackUrls: {
        approval: `${baseUrl}/api/payments/kakaopay/service-approve?requestId=${requestId}`,
        cancel: `${baseUrl}/api/payments/kakaopay/service-cancel?requestId=${requestId}`,
        fail: `${baseUrl}/api/payments/kakaopay/service-fail?requestId=${requestId}`,
      },
    });

    // Save TID to pending document
    const { updateDoc } = await import("firebase/firestore");
    await updateDoc(pendingRef, { kakaoTid: result.tid });

    return NextResponse.json({
      requestId,
      tid: result.tid,
      redirectUrl: result.next_redirect_mobile_url,
      redirectPcUrl: result.next_redirect_pc_url,
    });
  } catch (e) {
    console.error("KakaoPay service ready error:", e);
    const message =
      e instanceof Error ? e.message : "카카오페이 결제 준비 중 오류가 발생했습니다";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
