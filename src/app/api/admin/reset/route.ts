import { NextResponse } from "next/server";
import { firestore } from "@/lib/firebase";
import {
  collection,
  getDocs,
  doc,
  writeBatch,
  updateDoc,
} from "firebase/firestore";

const COLLECTIONS_TO_RESET = [
  "orders",
  "serviceRequests",
  "pendingOrderPayments",
  "pendingServicePayments",
  "settlements",
];

/** 컬렉션의 모든 문서를 삭제 (서브컬렉션 포함) */
async function deleteCollection(collectionName: string): Promise<number> {
  const colRef = collection(firestore, collectionName);
  const snapshot = await getDocs(colRef);

  if (snapshot.empty) return 0;

  // orders 컬렉션은 items 서브컬렉션이 있음
  if (collectionName === "orders") {
    for (const orderDoc of snapshot.docs) {
      const itemsRef = collection(firestore, "orders", orderDoc.id, "items");
      const itemsSnapshot = await getDocs(itemsRef);
      const itemBatch = writeBatch(firestore);
      itemsSnapshot.docs.forEach((itemDoc) => {
        itemBatch.delete(doc(firestore, "orders", orderDoc.id, "items", itemDoc.id));
      });
      if (!itemsSnapshot.empty) await itemBatch.commit();
    }
  }

  // 500개씩 배치 삭제 (Firestore 배치 제한)
  let deleted = 0;
  const docs = snapshot.docs;
  for (let i = 0; i < docs.length; i += 500) {
    const batch = writeBatch(firestore);
    const chunk = docs.slice(i, i + 500);
    chunk.forEach((d) => batch.delete(doc(firestore, collectionName, d.id)));
    await batch.commit();
    deleted += chunk.length;
  }

  return deleted;
}

export async function POST() {
  try {
    const results: Record<string, number> = {};

    for (const col of COLLECTIONS_TO_RESET) {
      results[col] = await deleteCollection(col);
    }

    // 모든 menuItems의 stockUsed를 0으로 리셋
    const menuSnap = await getDocs(collection(firestore, "menuItems"));
    let stockResetCount = 0;
    for (const menuDoc of menuSnap.docs) {
      const data = menuDoc.data() as { stockUsed?: number };
      if ((data.stockUsed || 0) > 0) {
        await updateDoc(menuDoc.ref, { stockUsed: 0 });
        stockResetCount++;
      }
    }
    results["menuItems_stockReset"] = stockResetCount;

    const total = Object.values(results).reduce((a, b) => a + b, 0);

    return NextResponse.json({
      success: true,
      message: `${total}건의 데이터가 삭제되었습니다`,
      details: results,
    });
  } catch (error) {
    console.error("Reset failed:", error);
    return NextResponse.json(
      { error: "데이터 초기화에 실패했습니다" },
      { status: 500 }
    );
  }
}
