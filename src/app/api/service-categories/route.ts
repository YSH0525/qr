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
  try {
    const snap = await getDocs(
      query(
        collection(firestore, "serviceCategories"),
        orderBy("displayOrder", "asc")
      )
    );

    const categories = snap.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    }));

    return NextResponse.json(categories);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "서비스 카테고리 조회 실패";
    console.error("Service categories fetch error:", e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const now = new Date().toISOString();

  const docRef = await addDoc(collection(firestore, "serviceCategories"), {
    name: body.name,
    type: body.type,
    icon: body.icon,
    description: body.description || "",
    isActive: body.isActive ?? true,
    displayOrder: body.displayOrder ?? 0,
    hourlyRate: body.type === "checkout_extension" ? (body.hourlyRate ?? 0) : null,
    createdAt: now,
  });

  return NextResponse.json({ id: docRef.id, ...body }, { status: 201 });
}
