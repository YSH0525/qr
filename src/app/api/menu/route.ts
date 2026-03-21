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

export async function GET() {
  const catSnap = await getDocs(
    query(collection(firestore, "menuCategories"), orderBy("displayOrder"))
  );

  const itemSnap = await getDocs(
    query(collection(firestore, "menuItems"), orderBy("displayOrder"))
  );

  interface MenuItemData {
    categoryId: string;
    [key: string]: unknown;
  }

  const items = itemSnap.docs.map((d) => ({
    ...(d.data() as MenuItemData),
    id: d.id,
  }));

  const result = catSnap.docs
    .filter((d) => d.data().isActive !== false)
    .map((d) => ({
      ...d.data(),
      id: d.id,
      items: items.filter((item) => item.categoryId === d.id),
    }));

  return NextResponse.json(result);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    if (!body.name || body.price == null || !body.categoryId) {
      return NextResponse.json(
        { error: "메뉴명, 가격, 카테고리는 필수입니다" },
        { status: 400 }
      );
    }

    // Verify category exists
    const catDoc = await getDocs(
      query(
        collection(firestore, "menuCategories"),
        where("__name__", "==", body.categoryId)
      )
    );
    if (catDoc.empty) {
      return NextResponse.json(
        { error: "존재하지 않는 카테고리입니다" },
        { status: 400 }
      );
    }

    const data = {
      categoryId: body.categoryId,
      name: body.name,
      description: body.description || null,
      price: Number(body.price),
      costPrice: body.costPrice !== undefined ? (body.costPrice === null ? null : Number(body.costPrice)) : null,
      imageUrl: body.imageUrl || null,
      isAvailable: body.isAvailable ?? true,
      isBest: body.isBest ?? false,
      stock: body.stock !== undefined ? (body.stock === null ? null : Number(body.stock)) : null,
      stockUsed: 0,
      displayOrder: body.displayOrder || 0,
      createdAt: new Date().toISOString(),
    };
    const docRef = await addDoc(collection(firestore, "menuItems"), data);

    return NextResponse.json({ id: docRef.id, ...data }, { status: 201 });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "메뉴 생성 실패";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
