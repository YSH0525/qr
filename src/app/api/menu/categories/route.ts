import { NextRequest, NextResponse } from "next/server";
import { firestore } from "@/lib/firebase";
import { collection, getDocs, addDoc, query, orderBy } from "firebase/firestore";

export async function GET() {
  const snap = await getDocs(
    query(collection(firestore, "menuCategories"), orderBy("displayOrder"))
  );
  const categories = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  return NextResponse.json(categories);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const data = {
    name: body.name,
    displayOrder: body.displayOrder || 0,
    isActive: true,
  };
  const docRef = await addDoc(collection(firestore, "menuCategories"), data);

  return NextResponse.json({ id: docRef.id, ...data }, { status: 201 });
}
