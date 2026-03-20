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

        // Get all deferred orders for this room (unified collection)
        const orderSnap = await getDocs(
          query(
            collection(firestore, "orders"),
            where("roomId", "==", roomDoc.id)
          )
        );

        const deferredOrders = orderSnap.docs
          .map((d) => ({
            id: d.id,
            ...(d.data() as { totalAmount: number; paymentMethod: string; paymentStatus: string; extensionAmount?: number; type?: string; [key: string]: unknown }),
          }))
          .filter((o) => o.paymentMethod === "deferred" && o.paymentStatus === "deferred");

        const totalDeferred = deferredOrders.reduce((sum, o) => {
          // For product orders, use totalAmount; for checkout_extension, use extensionAmount
          const amount = o.type === "checkout_extension"
            ? (o.extensionAmount || 0)
            : (o.totalAmount || 0);
          return sum + amount;
        }, 0);

        return {
          room,
          deferredOrders,
          totalDeferred,
          orderCount: deferredOrders.length,
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
