import { NextRequest, NextResponse } from "next/server";
import { firestore } from "@/lib/firebase";
import {
  doc,
  updateDoc,
  deleteDoc,
  getDoc,
  collection,
  getDocs,
  query,
  where,
} from "firebase/firestore";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ categoryId: string }> }
) {
  const { categoryId } = await params;
  const body = await req.json();

  try {
    const ref = doc(firestore, "menuCategories", categoryId);
    const snap = await getDoc(ref);

    if (!snap.exists()) {
      return NextResponse.json(
        { error: "카테고리를 찾을 수 없습니다" },
        { status: 404 }
      );
    }

    const updates: Record<string, unknown> = {};
    if (body.name !== undefined) updates.name = body.name;
    if (body.displayOrder !== undefined) updates.displayOrder = body.displayOrder;
    if (body.isActive !== undefined) updates.isActive = body.isActive;

    await updateDoc(ref, updates);

    const updated = await getDoc(ref);
    return NextResponse.json({ id: updated.id, ...updated.data() });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "카테고리 수정 실패";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ categoryId: string }> }
) {
  const { categoryId } = await params;

  try {
    const ref = doc(firestore, "menuCategories", categoryId);
    const snap = await getDoc(ref);

    if (!snap.exists()) {
      return NextResponse.json(
        { error: "카테고리를 찾을 수 없습니다" },
        { status: 404 }
      );
    }

    // Check if category has menu items
    const itemSnap = await getDocs(
      query(
        collection(firestore, "menuItems"),
        where("categoryId", "==", categoryId)
      )
    );

    if (!itemSnap.empty) {
      return NextResponse.json(
        { error: "메뉴가 포함된 카테고리는 삭제할 수 없습니다. 메뉴를 먼저 삭제해주세요." },
        { status: 409 }
      );
    }

    await deleteDoc(ref);
    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "카테고리 삭제 실패";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
