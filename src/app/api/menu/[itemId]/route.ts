import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { menuItems } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ itemId: string }> }
) {
  const { itemId } = await params;
  const body = await req.json();

  try {
    const result = db
      .update(menuItems)
      .set({
        name: body.name,
        description: body.description,
        price: body.price,
        imageUrl: body.imageUrl,
        isAvailable: body.isAvailable,
        categoryId: body.categoryId,
        displayOrder: body.displayOrder,
      })
      .where(eq(menuItems.id, parseInt(itemId)))
      .returning()
      .get();

    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: "메뉴 수정 실패" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ itemId: string }> }
) {
  const { itemId } = await params;

  db.update(menuItems)
    .set({ isAvailable: false })
    .where(eq(menuItems.id, parseInt(itemId)))
    .run();

  return NextResponse.json({ success: true });
}
