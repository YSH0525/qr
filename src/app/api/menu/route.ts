import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { menuCategories, menuItems } from "@/db/schema";
import { eq, asc } from "drizzle-orm";

export async function GET() {
  const categories = await db
    .select()
    .from(menuCategories)
    .where(eq(menuCategories.isActive, true))
    .orderBy(asc(menuCategories.displayOrder));

  const items = await db
    .select()
    .from(menuItems)
    .orderBy(asc(menuItems.displayOrder));

  const result = categories.map((cat) => ({
    ...cat,
    items: items.filter((item) => item.categoryId === cat.id),
  }));

  return NextResponse.json(result);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const result = db
      .insert(menuItems)
      .values({
        categoryId: body.categoryId,
        name: body.name,
        description: body.description || null,
        price: body.price,
        imageUrl: body.imageUrl || null,
        isAvailable: body.isAvailable ?? true,
        displayOrder: body.displayOrder || 0,
      })
      .returning()
      .get();

    return NextResponse.json(result, { status: 201 });
  } catch {
    return NextResponse.json({ error: "메뉴 생성 실패" }, { status: 500 });
  }
}
