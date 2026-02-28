import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { menuCategories } from "@/db/schema";
import { asc } from "drizzle-orm";

export async function GET() {
  const categories = await db
    .select()
    .from(menuCategories)
    .orderBy(asc(menuCategories.displayOrder));
  return NextResponse.json(categories);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const result = db
    .insert(menuCategories)
    .values({
      name: body.name,
      displayOrder: body.displayOrder || 0,
    })
    .returning()
    .get();

  return NextResponse.json(result, { status: 201 });
}
