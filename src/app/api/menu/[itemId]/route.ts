import { NextRequest, NextResponse } from "next/server";
import { firestore } from "@/lib/firebase";
import { doc, setDoc, getDoc, deleteDoc } from "firebase/firestore";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ itemId: string }> }
) {
  try {
    const { itemId } = await params;
    const body = await req.json();

    const ref = doc(firestore, "menuItems", itemId);
    const updateData: Record<string, unknown> = {};
    if (body.name !== undefined) updateData.name = body.name;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.price !== undefined) updateData.price = body.price;
    if (body.imageUrl !== undefined) updateData.imageUrl = body.imageUrl;
    if (body.isAvailable !== undefined) updateData.isAvailable = body.isAvailable;
    if (body.categoryId !== undefined) updateData.categoryId = body.categoryId;
    if (body.displayOrder !== undefined) updateData.displayOrder = body.displayOrder;
    if (body.isBest !== undefined) updateData.isBest = body.isBest;

    await setDoc(ref, updateData, { merge: true });

    const updated = await getDoc(ref);
    return NextResponse.json({ id: updated.id, ...updated.data() });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { error: `메뉴 수정 실패: ${message}` },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ itemId: string }> }
) {
  const { itemId } = await params;

  try {
    const ref = doc(firestore, "menuItems", itemId);
    await deleteDoc(ref);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "메뉴 삭제 실패" }, { status: 500 });
  }
}
