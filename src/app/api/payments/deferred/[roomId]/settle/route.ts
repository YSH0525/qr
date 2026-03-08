import { NextRequest, NextResponse } from "next/server";
import { firestore } from "@/lib/firebase";
import {
  collection,
  getDocs,
  query,
  where,
  updateDoc,
  addDoc,
} from "firebase/firestore";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const { roomId } = await params;

  // Find room by UUID
  const roomSnap = await getDocs(
    query(
      collection(firestore, "rooms"),
      where("roomId", "==", roomId)
    )
  );

  if (roomSnap.empty) {
    return NextResponse.json(
      { error: "객실을 찾을 수 없습니다" },
      { status: 404 }
    );
  }

  const roomDoc = roomSnap.docs[0];
  const roomData = roomDoc.data() as { roomNumber: string };

  // Get all deferred orders for this room
  const deferredSnap = await getDocs(
    query(
      collection(firestore, "orders"),
      where("roomId", "==", roomDoc.id),
      where("paymentMethod", "==", "deferred"),
      where("paymentStatus", "==", "deferred")
    )
  );

  const settledAt = new Date().toISOString();
  let totalAmount = 0;

  // Settle each order and collect full details with items
  const settledOrders = await Promise.all(
    deferredSnap.docs.map(async (orderDoc) => {
      await updateDoc(orderDoc.ref, {
        paymentStatus: "paid",
        updatedAt: settledAt,
      });

      const orderData = orderDoc.data() as {
        orderId: string;
        totalAmount: number;
        createdAt: string;
        note: string | null;
      };
      totalAmount += orderData.totalAmount;

      // Get order items from subcollection
      const itemsSnap = await getDocs(
        collection(firestore, "orders", orderDoc.id, "items")
      );
      const items = itemsSnap.docs.map((d) => d.data() as {
        menuItemName: string;
        menuItemPrice: number;
        quantity: number;
        subtotal: number;
      });

      return {
        orderId: orderData.orderId,
        totalAmount: orderData.totalAmount,
        createdAt: orderData.createdAt,
        note: orderData.note,
        items,
      };
    })
  );

  // Settle checkout extension fees from service requests
  const roomUuid = (roomDoc.data() as { roomId: string }).roomId;
  const extensionSnap = await getDocs(
    query(
      collection(firestore, "serviceRequests"),
      where("roomUuid", "==", roomUuid),
      where("paymentStatus", "==", "deferred")
    )
  );

  const settledExtensions = await Promise.all(
    extensionSnap.docs.map(async (extDoc) => {
      await updateDoc(extDoc.ref, {
        paymentStatus: "paid",
        updatedAt: settledAt,
      });

      const extData = extDoc.data() as {
        requestId: string;
        categoryName: string;
        extensionHours: number;
        extensionAmount: number;
        createdAt: string;
      };
      totalAmount += extData.extensionAmount || 0;

      return {
        requestId: extData.requestId,
        categoryName: extData.categoryName,
        extensionHours: extData.extensionHours,
        extensionAmount: extData.extensionAmount,
        createdAt: extData.createdAt,
      };
    })
  );

  // 정산 내역을 settlements 컬렉션에 저장
  await addDoc(collection(firestore, "settlements"), {
    roomNumber: roomData.roomNumber,
    roomId: roomUuid,
    totalAmount,
    orderCount: deferredSnap.size + extensionSnap.size,
    settledAt,
  });

  return NextResponse.json({
    settled: deferredSnap.size + extensionSnap.size,
    totalAmount,
    roomNumber: roomData.roomNumber,
    settledAt,
    orders: settledOrders,
    extensions: settledExtensions,
  });
}
