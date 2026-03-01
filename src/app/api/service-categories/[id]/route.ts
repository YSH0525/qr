import { NextRequest, NextResponse } from "next/server";
import { firestore } from "@/lib/firebase";
import { doc, updateDoc, deleteDoc } from "firebase/firestore";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();

  await updateDoc(doc(firestore, "serviceCategories", id), {
    ...body,
    updatedAt: new Date().toISOString(),
  });

  return NextResponse.json({ success: true });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await deleteDoc(doc(firestore, "serviceCategories", id));
  return NextResponse.json({ success: true });
}
