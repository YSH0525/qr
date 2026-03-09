import { NextRequest, NextResponse } from "next/server";
import { firestore } from "@/lib/firebase";
import {
  collection,
  getDocs,
  query,
  where,
  updateDoc,
} from "firebase/firestore";
import { kakaoPayApprove } from "@/lib/kakaopay";
import { orderEvents } from "@/lib/sse";
import { getBaseUrlFromRequest } from "@/lib/constants";

export async function GET(req: NextRequest) {
  const baseUrl = getBaseUrlFromRequest(req);

  try {
    const { searchParams } = new URL(req.url);
    const pgToken = searchParams.get("pg_token");
    const requestId = searchParams.get("requestId");

    if (!pgToken || !requestId) {
      return NextResponse.json(
        { error: "필수 파라미터가 누락되었습니다" },
        { status: 400 }
      );
    }

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
      kakaoTid: string | null;
      extensionAmount: number;
      type: string;
      categoryName: string;
    };

    if (!data.kakaoTid) {
      return NextResponse.json(
        { error: "결제 정보를 찾을 수 없습니다" },
        { status: 404 }
      );
    }

    const approveResult = await kakaoPayApprove({
      tid: data.kakaoTid,
      orderId: data.requestId,
      roomId: data.roomUuid,
      pgToken,
    });

    // Verify approved amount matches extension amount
    if (approveResult.amount?.total !== data.extensionAmount) {
      console.error(
        `Service payment amount mismatch: expected ${data.extensionAmount}, got ${approveResult.amount?.total}`
      );
      await updateDoc(docRef.ref, {
        paymentStatus: "failed",
        updatedAt: new Date().toISOString(),
      });
      return NextResponse.redirect(
        `${baseUrl}/room/${data.roomUuid}/service/confirm?requestId=${requestId}&failed=true&name=${encodeURIComponent(data.categoryName)}&type=${data.type}`
      );
    }

    // Update payment status
    const updatedAt = new Date().toISOString();
    await updateDoc(docRef.ref, {
      paymentStatus: "paid",
      updatedAt,
    });

    orderEvents.broadcast("service-request-updated", {
      id: docRef.id,
      ...data,
      paymentStatus: "paid",
    });

    // Redirect to confirmation page
    return NextResponse.redirect(
      `${baseUrl}/room/${data.roomUuid}/service/confirm?requestId=${requestId}&paid=true&name=${encodeURIComponent(data.categoryName)}&type=${data.type}`
    );
  } catch (e) {
    console.error("KakaoPay service approve error:", e);
    const { searchParams } = new URL(req.url);
    const failRequestId = searchParams.get("requestId") || "";

    try {
      const failSnap = await getDocs(
        query(
          collection(firestore, "serviceRequests"),
          where("requestId", "==", failRequestId)
        )
      );
      if (!failSnap.empty) {
        const failData = failSnap.docs[0].data() as { roomUuid: string; categoryName: string; type: string };
        await updateDoc(failSnap.docs[0].ref, {
          paymentStatus: "failed",
          updatedAt: new Date().toISOString(),
        });
        return NextResponse.redirect(
          `${baseUrl}/room/${failData.roomUuid}/service/confirm?requestId=${failRequestId}&failed=true&name=${encodeURIComponent(failData.categoryName)}&type=${failData.type}`
        );
      }
    } catch {
      // Fall through to generic redirect
    }

    return NextResponse.redirect(baseUrl);
  }
}
