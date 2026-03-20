import { NextRequest, NextResponse } from "next/server";
import { firestore } from "@/lib/firebase";
import {
  collection,
  getDocs,
  query,
  where,
} from "firebase/firestore";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const { roomId } = await params;

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
  const roomData = roomDoc.data() as { roomNumber: string; roomId: string };

  // Get all deferred orders for this room (unified collection)
  const deferredSnap = await getDocs(
    query(
      collection(firestore, "orders"),
      where("roomId", "==", roomDoc.id),
      where("paymentMethod", "==", "deferred"),
      where("paymentStatus", "==", "deferred")
    )
  );

  let totalAmount = 0;

  const orders = await Promise.all(
    deferredSnap.docs
      .filter((d) => {
        const data = d.data() as { type?: string };
        return !data.type || data.type === "product";
      })
      .map(async (orderDoc) => {
        const orderData = orderDoc.data() as {
          orderId: string;
          totalAmount: number;
          createdAt: string;
          note: string | null;
        };
        totalAmount += orderData.totalAmount;

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

  // Get deferred service-type orders (checkout extensions etc.)
  const extensions = deferredSnap.docs
    .filter((d) => {
      const data = d.data() as { type?: string };
      return data.type && data.type !== "product";
    })
    .map((extDoc) => {
      const extData = extDoc.data() as {
        orderId: string;
        categoryName: string;
        extensionHours: number;
        extensionAmount: number;
        createdAt: string;
      };
      totalAmount += extData.extensionAmount || 0;

      return {
        requestId: extData.orderId,
        categoryName: extData.categoryName,
        extensionHours: extData.extensionHours,
        extensionAmount: extData.extensionAmount,
        createdAt: extData.createdAt,
      };
    });

  return NextResponse.json({
    totalAmount,
    roomNumber: roomData.roomNumber,
    roomId,
    orderCount: deferredSnap.size,
    orders,
    extensions,
  });
}
