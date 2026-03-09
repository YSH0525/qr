import { NextRequest, NextResponse } from "next/server";
import { firestore } from "@/lib/firebase";
import {
  collection,
  getDocs,
  query,
  where,
  updateDoc,
} from "firebase/firestore";
import { kakaoPayReady } from "@/lib/kakaopay";
import { getBaseUrlFromRequest } from "@/lib/constants";

export async function POST(req: NextRequest) {
  try {
    const { requestId } = await req.json();

    const snap = await getDocs(
      query(
        collection(firestore, "serviceRequests"),
        where("requestId", "==", requestId)
      )
    );

    if (snap.empty) {
      return NextResponse.json(
        { error: "서비스 요청을 찾을 수 없습니다" },
        { status: 404 }
      );
    }

    const docRef = snap.docs[0];
    const data = docRef.data() as {
      requestId: string;
      roomUuid: string;
      roomNumber: string;
      extensionHours: number;
      extensionAmount: number;
      categoryName: string;
    };

    if (!data.extensionAmount || data.extensionAmount <= 0) {
      return NextResponse.json(
        { error: "결제 금액이 없습니다" },
        { status: 400 }
      );
    }

    const baseUrl = getBaseUrlFromRequest(req);

    const result = await kakaoPayReady({
      orderId: data.requestId,
      itemName: `${data.roomNumber}호 ${data.categoryName} ${data.extensionHours}시간`,
      totalAmount: data.extensionAmount,
      roomId: data.roomUuid,
      baseUrl,
      callbackUrls: {
        approval: `${baseUrl}/api/payments/kakaopay/service-approve?requestId=${data.requestId}`,
        cancel: `${baseUrl}/api/payments/kakaopay/service-cancel?requestId=${data.requestId}`,
        fail: `${baseUrl}/api/payments/kakaopay/service-fail?requestId=${data.requestId}`,
      },
    });

    // Save TID for approval step
    await updateDoc(docRef.ref, { kakaoTid: result.tid });

    return NextResponse.json({
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
