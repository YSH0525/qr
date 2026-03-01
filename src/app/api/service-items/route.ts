import { NextRequest, NextResponse } from "next/server";
import { firestore } from "@/lib/firebase";
import {
  collection,
  getDocs,
  addDoc,
  query,
  where,
  orderBy,
} from "firebase/firestore";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const categoryId = searchParams.get("categoryId");

    let snap;
    if (categoryId) {
      snap = await getDocs(
        query(
          collection(firestore, "serviceItems"),
          where("categoryId", "==", categoryId)
        )
      );
    } else {
      snap = await getDocs(
        query(
          collection(firestore, "serviceItems"),
          orderBy("displayOrder", "asc")
        )
      );
    }

    const items = snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .sort((a, b) => ((a as unknown as Record<string, number>).displayOrder ?? 0) - ((b as unknown as Record<string, number>).displayOrder ?? 0));
    return NextResponse.json(items);
  } catch (e) {
    console.error("Service items GET error:", e);
    return NextResponse.json([], { status: 200 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const now = new Date().toISOString();

    const docRef = await addDoc(collection(firestore, "serviceItems"), {
      name: body.name,
      icon: body.icon || "package",
      categoryId: body.categoryId,
      isAvailable: body.isAvailable ?? true,
      displayOrder: body.displayOrder ?? 0,
      createdAt: now,
    });

    return NextResponse.json({ id: docRef.id, ...body }, { status: 201 });
  } catch (e) {
    console.error("Service item POST error:", e);
    return NextResponse.json({ error: "아이템 등록 실패" }, { status: 500 });
  }
}
