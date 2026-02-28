import { NextRequest, NextResponse } from "next/server";
import { firestore } from "@/lib/firebase";
import { doc, updateDoc, getDoc } from "firebase/firestore";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ itemId: string }> }
) {
  const { itemId } = await params;
  const body = await req.json();

  try {
    const ref = doc(firestore, "menuItems", itemId);
    await updateDoc(ref, {
      name: body.name,
      description: body.description,
      price: body.price,
      imageUrl: body.imageUrl,
      isAvailable: body.isAvailable,
      categoryId: body.categoryId,
      displayOrder: body.displayOrder,
    });

    const updated = await getDoc(ref);
    return NextResponse.json({ id: updated.id, ...updated.data() });
  } catch {
    return NextResponse.json({ error: "메뉴 수정 실패" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ itemId: string }> }
) {
  const { itemId } = await params;

  const ref = doc(firestore, "menuItems", itemId);
  await updateDoc(ref, { isAvailable: false });

  return NextResponse.json({ success: true });
}
