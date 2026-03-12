import { NextRequest, NextResponse } from "next/server";
import { firestore } from "@/lib/firebase";
import {
  collection,
  getDocs,
  query,
  where,
  deleteDoc,
} from "firebase/firestore";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  const { orderId } = await params;

  const orderSnap = await getDocs(
    query(
      collection(firestore, "orders"),
      where("orderId", "==", orderId)
    )
  );

  if (orderSnap.empty) {
    return NextResponse.json(
      { error: "주문을 찾을 수 없습니다" },
      { status: 404 }
    );
  }

  const orderDoc = orderSnap.docs[0];
  const order = { id: orderDoc.id, ...orderDoc.data() };

  // Get order items subcollection
  const itemsSnap = await getDocs(
    collection(firestore, "orders", orderDoc.id, "items")
  );
  const items = itemsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

  return NextResponse.json({ ...order, items });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  const { orderId } = await params;

  const orderSnap = await getDocs(
    query(
      collection(firestore, "orders"),
      where("orderId", "==", orderId)
    )
  );

  if (orderSnap.empty) {
    return NextResponse.json({ error: "주문을 찾을 수 없습니다" }, { status: 404 });
  }

  const orderDoc = orderSnap.docs[0];

  // 서브컬렉션(items) 삭제
  const itemsSnap = await getDocs(
    collection(firestore, "orders", orderDoc.id, "items")
  );
  for (const itemDoc of itemsSnap.docs) {
    await deleteDoc(itemDoc.ref);
  }

  // 주문 문서 삭제
  await deleteDoc(orderDoc.ref);

  return NextResponse.json({ success: true });
}
