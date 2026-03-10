import { NextRequest, NextResponse, after } from "next/server";
import { firestore } from "@/lib/firebase";
import {
  collection,
  getDocs,
  addDoc,
  deleteDoc,
  query,
  where,
} from "firebase/firestore";
import { kakaoPayApprove, kakaoPayCancel } from "@/lib/kakaopay";
import { getNextDailySeq } from "@/lib/daily-seq";
import { getCallbackBaseUrl } from "@/lib/constants";

export async function GET(req: NextRequest) {
  const baseUrl = getCallbackBaseUrl(req);

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

    // Look up pending payment data
    const snap = await getDocs(
      query(
        collection(firestore, "pendingServicePayments"),
        where("requestId", "==", requestId)
      )
    );

    if (snap.empty) {
      return NextResponse.json(
        { error: "결제 정보를 찾을 수 없습니다" },
        { status: 404 }
      );
    }

    const pendingDoc = snap.docs[0];
    const data = pendingDoc.data() as {
      requestId: string;
      categoryId: string;
      categoryName: string;
      categoryIcon: string;
      type: string;
      roomId: string;
      roomUuid: string;
      roomNumber: string;
      note: string | null;
      items: unknown[];
      extensionHours: number;
      extensionAmount: number;
      freeExtension: boolean;
      paymentMethod: string;
      kakaoTid: string | null;
      createdAt: string;
    };

    if (!data.kakaoTid) {
      return NextResponse.json(
        { error: "결제 정보를 찾을 수 없습니다" },
        { status: 404 }
      );
    }

    // Approve payment with Kakao (minimum work before redirect)
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
      after(async () => {
        try {
          await kakaoPayCancel({
            tid: data.kakaoTid!,
            cancelAmount: approveResult.amount?.total ?? data.extensionAmount,
          });
        } catch (cancelErr) {
          console.error("Failed to cancel mismatched payment:", cancelErr);
        }
        await deleteDoc(pendingDoc.ref);
      });
      return NextResponse.redirect(
        `${baseUrl}/room/${data.roomUuid}?payment=fail`
      );
    }

    // Redirect immediately — defer Firestore writes to after()
    after(async () => {
      try {
        const dailySeq = await getNextDailySeq();
        const now = new Date().toISOString();
        await addDoc(collection(firestore, "serviceRequests"), {
          requestId: data.requestId,
          dailySeq,
          categoryId: data.categoryId,
          categoryName: data.categoryName,
          categoryIcon: data.categoryIcon,
          type: data.type,
          roomId: data.roomId,
          roomUuid: data.roomUuid,
          roomNumber: data.roomNumber,
          status: "accepted",
          note: data.note,
          items: data.items,
          cleaningOptions: null,
          extensionHours: data.extensionHours,
          extensionAmount: data.extensionAmount,
          freeExtension: false,
          paymentMethod: "kakaopay",
          paymentStatus: "paid",
          kakaoTid: data.kakaoTid,
          createdAt: data.createdAt,
          updatedAt: now,
        });
        await deleteDoc(pendingDoc.ref);
      } catch (err) {
        console.error("Failed to create service request after approve:", err);
      }
    });

    return NextResponse.redirect(
      `${baseUrl}/room/${data.roomUuid}?payment=success`
    );
  } catch (e) {
    console.error("KakaoPay service approve error:", e);
    const { searchParams } = new URL(req.url);
    const failRequestId = searchParams.get("requestId") || "";

    try {
      const failSnap = await getDocs(
        query(
          collection(firestore, "pendingServicePayments"),
          where("requestId", "==", failRequestId)
        )
      );
      if (!failSnap.empty) {
        const failData = failSnap.docs[0].data() as { roomUuid: string; categoryName: string; type: string };
        await deleteDoc(failSnap.docs[0].ref);
        return NextResponse.redirect(
          `${baseUrl}/room/${failData.roomUuid}?payment=fail`
        );
      }
    } catch {
      // Fall through to generic redirect
    }

    return NextResponse.redirect(baseUrl);
  }
}
