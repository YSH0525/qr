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
  const { searchParams } = new URL(req.url);
  const categoryId = searchParams.get("categoryId");

  const constraints: ReturnType<typeof where>[] = [];
  if (categoryId) {
    constraints.push(where("categoryId", "==", categoryId));
  }

  const snap = await getDocs(
    query(
      collection(firestore, "serviceItems"),
      ...constraints,
      orderBy("displayOrder", "asc")
    )
  );

  const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  return NextResponse.json(items);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const now = new Date().toISOString();

  const docRef = await addDoc(collection(firestore, "serviceItems"), {
    name: body.name,
    icon: body.icon,
    categoryId: body.categoryId,
    isAvailable: body.isAvailable ?? true,
    displayOrder: body.displayOrder ?? 0,
    createdAt: now,
  });

  return NextResponse.json({ id: docRef.id, ...body }, { status: 201 });
}
