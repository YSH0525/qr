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
      const totalDeferred = deferredOrders.reduce(
        (sum, o) => sum + (o.totalAmount || 0),
        0
      );

      return {
        room,
        deferredOrders,
        totalDeferred,
        orderCount: deferredOrders.length,
      };
    })
  );

  // Only return rooms with outstanding deferred payments
  return NextResponse.json(result.filter((r) => r.orderCount > 0));
}
