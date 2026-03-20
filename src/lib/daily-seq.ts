import { firestore } from "@/lib/firebase";
import { collection, getDocs, query, where } from "firebase/firestore";
import { format } from "date-fns";

/**
 * 당일 순번(dailySeq)을 계산합니다.
 * 오늘 생성된 모든 주문 중 최대 dailySeq + 1을 반환합니다.
 */
export async function getNextDailySeq(): Promise<number> {
  const todayPrefix = format(new Date(), "yyyy-MM-dd");

  const ordersSnap = await getDocs(
    query(
      collection(firestore, "orders"),
      where("createdAt", ">=", `${todayPrefix}T00:00:00`),
      where("createdAt", "<=", `${todayPrefix}T23:59:59`)
    )
  );

  let maxSeq = 0;

  for (const doc of ordersSnap.docs) {
    const seq = (doc.data() as { dailySeq?: number }).dailySeq;
    if (seq && seq > maxSeq) maxSeq = seq;
  }

  return maxSeq + 1;
}
