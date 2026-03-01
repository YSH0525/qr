import { NextResponse } from "next/server";
import { firestore } from "@/lib/firebase";
import {
  collection,
  getDocs,
  query,
  where,
} from "firebase/firestore";

export async function GET() {
  try {
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
        // Use single where clause to avoid composite index requirement, filter in memory
        const orderSnap = await getDocs(
          query(
            collection(firestore, "orders"),
            where("roomId", "==", roomDoc.id)
          )
        );

        const deferredOrders = orderSnap.docs
          .map((d) => ({
            id: d.id,
            ...(d.data() as { totalAmount: number; paymentMethod: string; paymentStatus: string; [key: string]: unknown }),
          }))
          .filter((o) => o.paymentMethod === "deferred" && o.paymentStatus === "deferred");

        const orderTotal = deferredOrders.reduce(
          (sum, o) => sum + (o.totalAmount || 0),
          0
        );

        // Get unsettled checkout extension fees from service requests
        const serviceSnap = await getDocs(
          query(
            collection(firestore, "serviceRequests"),
            where("roomUuid", "==", roomData.roomId)
          )
        );

        const deferredExtensions = serviceSnap.docs.filter((d) => {
          const data = d.data() as { paymentStatus?: string };
          return data.paymentStatus === "deferred";
        });

        const extensionTotal = deferredExtensions.reduce((sum, d) => {
          const data = d.data() as { extensionAmount?: number };
          return sum + (data.extensionAmount || 0);
        }, 0);

        const totalDeferred = orderTotal + extensionTotal;

        return {
          room,
          deferredOrders,
          totalDeferred,
          orderCount: deferredOrders.length + deferredExtensions.length,
        };
      })
    );

    // Only return rooms with outstanding deferred payments
    return NextResponse.json(result.filter((r) => r.totalDeferred > 0));
  } catch (e) {
    console.error("Deferred payments GET error:", e);
    return NextResponse.json([], { status: 200 });
  }
}
