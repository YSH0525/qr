import { NextRequest, NextResponse } from "next/server";
import { firestore } from "@/lib/firebase";
import {
  collection,
  getDocs,
  addDoc,
  query,
  orderBy,
} from "firebase/firestore";

export async function GET() {
  const snap = await getDocs(
    query(collection(firestore, "menuCategories"), orderBy("displayOrder"))
  );
  const categories = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  return NextResponse.json(categories);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    if (!body.name) {
      return NextResponse.json(
        { error: "카테고리 이름은 필수입니다" },
        { status: 400 }
      );
    }

    const data = {
      name: body.name,
      displayOrder: body.displayOrder || 0,
      isActive: true,
    };
    const docRef = await addDoc(
      collection(firestore, "menuCategories"),
      data
    );

    return NextResponse.json({ id: docRef.id, ...data }, { status: 201 });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "카테고리 생성 실패";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
