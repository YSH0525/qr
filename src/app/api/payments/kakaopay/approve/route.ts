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

interface PendingOrderData {
  orderId: string;
  roomId: string;
  roomUuid: string;
  roomNumber: string;
  items: {
    menuItemId: string;
    menuItemName: string;
    menuItemPrice: number;
    quantity: number;
    subtotal: number;
  }[];
  totalAmount: number;
  note: string | null;
  paymentMethod: string;
  kakaoTid: string | null;
  createdAt: string;
}

export async function GET(req: NextRequest) {
  const baseUrl = getCallbackBaseUrl(req);

  try {
    const { searchParams } = new URL(req.url);
    const pgToken = searchParams.get("pg_token");
    const orderId = searchParams.get("orderId");

    if (!pgToken || !orderId) {
      console.error("[KakaoPay approve] Missing params - pgToken:", !!pgToken, "orderId:", !!orderId);
      return NextResponse.redirect(baseUrl);
    }

    // Look up pending payment data
    const snap = await getDocs(
      query(
        collection(firestore, "pendingOrderPayments"),
        where("orderId", "==", orderId)
      )
    );

    if (snap.empty) {
      console.error(`Pending order not found for orderId: ${orderId}`);
      return NextResponse.redirect(baseUrl);
    }

    const pendingDoc = snap.docs[0];
    const data = pendingDoc.data() as PendingOrderData;

    if (!data.kakaoTid) {
      console.error(`No kakaoTid in pending order: ${orderId}`);
      return NextResponse.redirect(
        `${baseUrl}/room/${data.roomUuid}?payment=fail`
      );
    }

    // Approve payment with Kakao (minimum work before redirect)
    const approveResult = await kakaoPayApprove({
      tid: data.kakaoTid,
      orderId: data.orderId,
      roomId: data.roomUuid,
      pgToken,
    });

    // Verify approved amount matches order amount
    if (approveResult.amount?.total !== data.totalAmount) {
      console.error(
        `Payment amount mismatch: expected ${data.totalAmount}, got ${approveResult.amount?.total}`
      );
      after(async () => {
        try {
          await kakaoPayCancel({
            tid: data.kakaoTid!,
            cancelAmount: approveResult.amount?.total ?? data.totalAmount,
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

        const orderRef = await addDoc(collection(firestore, "orders"), {
          orderId: data.orderId,
          dailySeq,
          roomId: data.roomId,
          roomUuid: data.roomUuid,
          roomNumber: data.roomNumber,
          status: "pending",
          paymentMethod: "kakaopay",
          paymentStatus: "paid",
          totalAmount: data.totalAmount,
          note: data.note,
          kakaoTid: data.kakaoTid,
          createdAt: data.createdAt,
          updatedAt: now,
        });

        await Promise.all(
          data.items.map((item) =>
            addDoc(collection(firestore, "orders", orderRef.id, "items"), item)
          )
        );

        await deleteDoc(pendingDoc.ref);
      } catch (err) {
        console.error("Failed to create order after approve:", err);
      }
    });

    return NextResponse.redirect(
      `${baseUrl}/room/${data.roomUuid}?payment=success`
    );
  } catch (e) {
    console.error("KakaoPay approve error:", e);
    const { searchParams } = new URL(req.url);
    const failOrderId = searchParams.get("orderId") || "";

    try {
      const failSnap = await getDocs(
        query(
          collection(firestore, "pendingOrderPayments"),
          where("orderId", "==", failOrderId)
        )
      );
      if (!failSnap.empty) {
        const failData = failSnap.docs[0].data() as { roomUuid: string };
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
