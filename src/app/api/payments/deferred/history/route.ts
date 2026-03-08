import { NextResponse } from "next/server";
import { firestore } from "@/lib/firebase";
import { collection, getDocs, orderBy, query } from "firebase/firestore";

export async function GET() {
  const snap = await getDocs(
    query(
      collection(firestore, "settlements"),
      orderBy("settledAt", "desc")
    )
  );

  const settlements = snap.docs.map((doc) => ({
    id: doc.id,
    ...(doc.data() as {
      roomNumber: string;
      roomId: string;
      totalAmount: number;
      orderCount: number;
      settledAt: string;
    }),
  }));

  return NextResponse.json(settlements);
}
