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
