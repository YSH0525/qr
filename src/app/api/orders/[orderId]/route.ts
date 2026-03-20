import { NextRequest, NextResponse } from "next/server";
import { firestore } from "@/lib/firebase";
import {
  collection,
  getDocs,
  query,
  where,
  deleteDoc,
  doc,
  getDoc,
  updateDoc,
  increment,
} from "firebase/firestore";
import { emitToAdmin } from "@/lib/socket-server";

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
  const orderData = orderDoc.data() as { type?: string };

  // Product orders have items in subcollection
  if (!orderData.type || orderData.type === "product") {
    const itemsSnap = await getDocs(
      collection(firestore, "orders", orderDoc.id, "items")
    );
    const items = itemsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
    return NextResponse.json({ ...order, items });
  }

  return NextResponse.json(order);
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
  const orderData = orderDoc.data() as { status: string; type?: string };
  const isProduct = !orderData.type || orderData.type === "product";

  if (isProduct) {
    // Product order: handle items subcollection and stock restoration
    const itemsSnap = await getDocs(
      collection(firestore, "orders", orderDoc.id, "items")
    );

    // Restore stock if not already rejected/cancelled
    if (orderData.status !== "rejected" && orderData.status !== "cancelled") {
      for (const itemDoc of itemsSnap.docs) {
        const itemData = itemDoc.data() as { menuItemId: string; quantity: number };
        const menuRef = doc(firestore, "menuItems", itemData.menuItemId);
        const menuSnap = await getDoc(menuRef);
        if (menuSnap.exists()) {
          const menuData = menuSnap.data() as { stock?: number | null };
          if (menuData.stock !== null && menuData.stock !== undefined) {
            await updateDoc(menuRef, { stockUsed: increment(-itemData.quantity) });
          }
        }
      }
    }

    // Delete items subcollection
    for (const itemDoc of itemsSnap.docs) {
      await deleteDoc(itemDoc.ref);
    }
  }

  // Delete order document
  await deleteDoc(orderDoc.ref);

  emitToAdmin("order:deleted", { orderId });

  return NextResponse.json({ success: true });
}
