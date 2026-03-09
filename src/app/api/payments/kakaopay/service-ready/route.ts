import { NextRequest, NextResponse } from "next/server";
import { firestore } from "@/lib/firebase";
import {
  collection,
  addDoc,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  where,
} from "firebase/firestore";
import { kakaoPayReady } from "@/lib/kakaopay";
import { getBaseUrlFromRequest, getCallbackBaseUrl } from "@/lib/constants";
import { format } from "date-fns";
import type { ServiceType } from "@/types/service";

function generateRequestId(): string {
  const date = format(new Date(), "yyyyMMdd");
  const rand = Math.floor(Math.random() * 1000)
    .toString()
    .padStart(3, "0");
  return `SRV-${date}-${rand}`;
}

const THIRTY_MINUTES_MS = 30 * 60 * 1000;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { roomId: roomUuid, categoryId, note, items, extensionHours, freeExtension } = body;

    // Input validation
    if (!roomUuid || typeof roomUuid !== "string") {
      return NextResponse.json({ error: "객실 ID가 필요합니다" }, { status: 400 });
    }
    if (!categoryId || typeof categoryId !== "string") {
      return NextResponse.json({ error: "카테고리 ID가 필요합니다" }, { status: 400 });
    }
    if (
      extensionHours == null ||
      typeof extensionHours !== "number" ||
      !Number.isInteger(extensionHours) ||
      extensionHours < 1 ||
      extensionHours > 6
    ) {
      return NextResponse.json(
        { error: "연장 시간은 1~6시간 사이의 정수여야 합니다" },
        { status: 400 }
      );
    }

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

    // Verify category is checkout_extension
    if (catData.type !== "checkout_extension") {
      return NextResponse.json(
        { error: "시간연장 카테고리만 결제할 수 있습니다" },
        { status: 400 }
      );
    }

    // Verify hourlyRate is configured
    if (catData.hourlyRate == null || catData.hourlyRate <= 0) {
      return NextResponse.json(
        { error: "시간당 요금이 설정되지 않았습니다" },
        { status: 400 }
      );
    }

    // Calculate extension amount
    const extensionAmount = freeExtension ? 0 : catData.hourlyRate * extensionHours;

    if (!extensionAmount || extensionAmount <= 0) {
      return NextResponse.json({ error: "결제 금액이 없습니다" }, { status: 400 });
    }

    // Clean up stale or duplicate pending payments for same room + category
    const existingPending = await getDocs(
      query(
        collection(firestore, "pendingServicePayments"),
        where("roomUuid", "==", roomData.roomId),
        where("categoryId", "==", categoryId)
      )
    );
    const now = new Date();
    for (const pendingDoc of existingPending.docs) {
      const pendingCreatedAt = pendingDoc.data().createdAt as string;
      const elapsed = now.getTime() - new Date(pendingCreatedAt).getTime();
      // Clean up stale entries (>30 min) or any existing entries for same room+category
      if (elapsed > THIRTY_MINUTES_MS || existingPending.size > 0) {
        await deleteDoc(pendingDoc.ref);
      }
    }

    const requestId = generateRequestId();
    const nowIso = now.toISOString();

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
      extensionHours,
      extensionAmount,
      freeExtension: false,
      paymentMethod: "kakaopay",
      createdAt: nowIso,
    };

    const pendingRef = await addDoc(
      collection(firestore, "pendingServicePayments"),
      pendingData
    );

    const baseUrl = getBaseUrlFromRequest(req);
    const callbackBaseUrl = getCallbackBaseUrl(req);

    console.log("[KakaoPay service-ready] baseUrl:", baseUrl, "callbackBaseUrl:", callbackBaseUrl);

    const result = await kakaoPayReady({
      orderId: requestId,
      itemName: `${roomData.roomNumber}호 ${catData.name} ${extensionHours}시간`,
      totalAmount: extensionAmount,
      roomId: roomData.roomId,
      baseUrl: callbackBaseUrl,
      callbackUrls: {
        approval: `${callbackBaseUrl}/api/payments/kakaopay/service-approve?requestId=${requestId}`,
        cancel: `${callbackBaseUrl}/api/payments/kakaopay/service-cancel?requestId=${requestId}`,
        fail: `${callbackBaseUrl}/api/payments/kakaopay/service-fail?requestId=${requestId}`,
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
