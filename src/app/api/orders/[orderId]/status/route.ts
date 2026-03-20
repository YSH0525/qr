import { NextRequest, NextResponse } from "next/server";
import { firestore } from "@/lib/firebase";
import {
  collection,
  getDocs,
  query,
  where,
  updateDoc,
  doc,
  getDoc,
  increment,
} from "firebase/firestore";
import { emitToAdmin, emitToRoom } from "@/lib/socket-server";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  const { orderId } = await params;
  const { status, rejectionReason } = await req.json();

  const validStatuses = [
    "pending",
    "accepted",
    "rejected",
    "preparing",
    "completed",
    "cancelled",
  ];

  if (!validStatuses.includes(status)) {
    return NextResponse.json(
      { error: "잘못된 상태값입니다" },
      { status: 400 }
    );
  }

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
  const orderData = orderDoc.data() as { status: string; type?: string; roomUuid?: string };
  const updatedAt = new Date().toISOString();

  const updateData: Record<string, unknown> = { status, updatedAt };
  if (status === "rejected" && rejectionReason) {
    updateData.rejectionReason = rejectionReason;
  }

  // Restore stock when rejecting/cancelling product orders
  const currentStatus = orderData.status;
  const isProduct = !orderData.type || orderData.type === "product";

  if (
    isProduct &&
    (status === "rejected" || status === "cancelled") &&
    currentStatus !== "rejected" &&
    currentStatus !== "cancelled"
  ) {
    const itemsSnap = await getDocs(
      collection(firestore, "orders", orderDoc.id, "items")
    );
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

  await updateDoc(orderDoc.ref, updateData);

  const updated = { id: orderDoc.id, ...orderDoc.data(), ...updateData };

  const statusPayload = { orderId, status, updatedAt, ...(status === "rejected" && rejectionReason ? { rejectionReason } : {}) };
  emitToAdmin("order:status-changed", statusPayload);
  if (orderData.roomUuid) {
    emitToRoom(orderData.roomUuid, "order:status-changed", statusPayload);
  }

  return NextResponse.json(updated);
}
