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
    query(
      collection(firestore, "menuCategories"),
      where("isActive", "==", true),
      orderBy("displayOrder")
    )
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

  const result = catSnap.docs.map((d) => ({
    ...d.data(),
    id: d.id,
    items: items.filter((item) => item.categoryId === d.id),
  }));

  return NextResponse.json(result);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const data = {
      categoryId: body.categoryId,
      name: body.name,
      description: body.description || null,
      price: body.price,
      imageUrl: body.imageUrl || null,
      isAvailable: body.isAvailable ?? true,
      displayOrder: body.displayOrder || 0,
      createdAt: new Date().toISOString(),
    };
    const docRef = await addDoc(collection(firestore, "menuItems"), data);

    return NextResponse.json({ id: docRef.id, ...data }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "메뉴 생성 실패" }, { status: 500 });
  }
}
