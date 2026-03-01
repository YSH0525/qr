import { NextResponse } from "next/server";
import { firestore } from "@/lib/firebase";
import {
  collection,
  getDocs,
  query,
  where,
} from "firebase/firestore";

export async function GET() {
  // Get all active rooms
  const roomsSnap = await getDocs(
    query(
      collection(firestore, "rooms"),
      where("isActive", "==", true)
    )
  );

  const result = await Promise.all(
    roomsSnap.docs.map(async (roomDoc) => {
      const room = { id: roomDoc.id, ...roomDoc.data() };
      const roomData = roomDoc.data() as { roomId: string };

      // Get deferred unpaid orders for this room
      const deferredSnap = await getDocs(
        query(
          collection(firestore, "orders"),
          where("roomId", "==", roomDoc.id),
          where("paymentMethod", "==", "deferred"),
          where("paymentStatus", "==", "deferred")
        )
      );

      const deferredOrders = deferredSnap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as { totalAmount: number; [key: string]: unknown }),
      }));
      const orderTotal = deferredOrders.reduce(
        (sum, o) => sum + (o.totalAmount || 0),
        0
      );

      // Get unsettled checkout extension fees from service requests
      const extensionSnap = await getDocs(
        query(
          collection(firestore, "serviceRequests"),
          where("roomUuid", "==", roomData.roomId),
          where("paymentStatus", "==", "deferred")
        )
      );

      const extensionTotal = extensionSnap.docs.reduce((sum, d) => {
        const data = d.data() as { extensionAmount?: number };
        return sum + (data.extensionAmount || 0);
      }, 0);

      const totalDeferred = orderTotal + extensionTotal;

      return {
        room,
        deferredOrders,
        totalDeferred,
        orderCount: deferredOrders.length + extensionSnap.size,
      };
    })
  );

  // Only return rooms with outstanding deferred payments
  return NextResponse.json(result.filter((r) => r.totalDeferred > 0));
}
