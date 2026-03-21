import { NextRequest, NextResponse } from "next/server";
import { firestore } from "@/lib/firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";

const INCENTIVE_DOC = doc(firestore, "settings", "incentive");
const DEFAULT_RATE = 10;

export async function GET() {
  try {
    const snap = await getDoc(INCENTIVE_DOC);
    const incentiveRate = snap.exists()
      ? (snap.data().incentiveRate ?? DEFAULT_RATE)
      : DEFAULT_RATE;
    return NextResponse.json({ incentiveRate });
  } catch {
    return NextResponse.json({ incentiveRate: DEFAULT_RATE });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const rate = Number(body.incentiveRate);

    if (isNaN(rate) || rate < 0 || rate > 100) {
      return NextResponse.json(
        { error: "인센티브 비율은 0~100 사이여야 합니다" },
        { status: 400 }
      );
    }

    await setDoc(INCENTIVE_DOC, { incentiveRate: rate }, { merge: true });
    return NextResponse.json({ incentiveRate: rate });
  } catch {
    return NextResponse.json(
      { error: "설정 저장 실패" },
      { status: 500 }
    );
  }
}
