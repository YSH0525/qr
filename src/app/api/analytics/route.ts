import { NextRequest, NextResponse } from "next/server";
import { firestore } from "@/lib/firebase";
import {
  collection,
  getDocs,
  query,
  where,
  orderBy,
} from "firebase/firestore";

interface OrderDoc {
  id: string;
  orderId: string;
  roomNumber: string;
  status: string;
  paymentMethod: string;
  paymentStatus: string;
  totalAmount: number;
  createdAt: string;
  updatedAt: string;
}

interface OrderItemDoc {
  menuItemName: string;
  menuItemPrice: number;
  quantity: number;
  subtotal: number;
}

// GET /api/analytics?mode=daily&date=2026-03-01
// GET /api/analytics?mode=monthly&year=2026&month=3
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get("mode") || "daily";

  try {
    if (mode === "daily") {
      return await getDailyAnalytics(searchParams);
    } else if (mode === "monthly") {
      return await getMonthlyAnalytics(searchParams);
    }

    return NextResponse.json({ error: "Invalid mode" }, { status: 400 });
  } catch (e) {
    console.error("Analytics error:", e);
    return NextResponse.json(
      { error: "분석 데이터를 불러올 수 없습니다" },
      { status: 500 }
    );
  }
}

async function getDailyAnalytics(params: URLSearchParams) {
  const dateStr = params.get("date") || new Date().toISOString().split("T")[0];

  // Date range for the day
  const startOfDay = new Date(dateStr + "T00:00:00.000Z");
  const endOfDay = new Date(dateStr + "T23:59:59.999Z");

  // Also get previous day for comparison
  const prevDate = new Date(startOfDay);
  prevDate.setDate(prevDate.getDate() - 1);
  const prevStart = new Date(prevDate);
  prevStart.setHours(0, 0, 0, 0);
  const prevEnd = new Date(prevDate);
  prevEnd.setHours(23, 59, 59, 999);

  // Fetch orders for current and previous day
  const ordersSnap = await getDocs(
    query(
      collection(firestore, "orders"),
      where("createdAt", ">=", startOfDay.toISOString()),
      where("createdAt", "<=", endOfDay.toISOString()),
      orderBy("createdAt", "desc")
    )
  );

  const prevOrdersSnap = await getDocs(
    query(
      collection(firestore, "orders"),
      where("createdAt", ">=", prevStart.toISOString()),
      where("createdAt", "<=", prevEnd.toISOString())
    )
  );

  const orders: OrderDoc[] = ordersSnap.docs.map((d) => ({
    id: d.id,
    ...(d.data() as Omit<OrderDoc, "id">),
  }));

  const prevOrders: OrderDoc[] = prevOrdersSnap.docs.map((d) => ({
    id: d.id,
    ...(d.data() as Omit<OrderDoc, "id">),
  }));

  // Fetch items for current day orders
  const orderItems: Record<string, OrderItemDoc[]> = {};
  for (const order of orders) {
    const itemsSnap = await getDocs(
      collection(firestore, "orders", order.id, "items")
    );
    orderItems[order.id] = itemsSnap.docs.map(
      (d) => d.data() as OrderItemDoc
    );
  }

  // Calculate stats (exclude rejected/cancelled)
  const validOrders = orders.filter(
    (o) => o.status !== "rejected" && o.status !== "cancelled"
  );
  const totalRevenue = validOrders.reduce((sum, o) => sum + o.totalAmount, 0);
  const orderCount = orders.length;
  const completedCount = orders.filter((o) => o.status === "completed").length;
  const rejectedCount = orders.filter((o) => o.status === "rejected").length;
  const cancelledCount = orders.filter((o) => o.status === "cancelled").length;
  const acceptedCount = orders.filter(
    (o) =>
      o.status === "accepted" ||
      o.status === "preparing" ||
      o.status === "completed"
  ).length;

  // Previous day stats for comparison
  const prevValidOrders = prevOrders.filter(
    (o) => o.status !== "rejected" && o.status !== "cancelled"
  );
  const prevRevenue = prevValidOrders.reduce(
    (sum, o) => sum + o.totalAmount,
    0
  );
  const prevOrderCount = prevOrders.length;

  // Hourly breakdown
  const hourlyRevenue = Array.from({ length: 24 }, (_, h) => ({
    hour: h,
    label: `${h}시`,
    revenue: 0,
    orders: 0,
  }));

  for (const order of validOrders) {
    const hour = new Date(order.createdAt).getHours();
    hourlyRevenue[hour].revenue += order.totalAmount;
    hourlyRevenue[hour].orders += 1;
  }

  // Payment method breakdown
  const paymentBreakdown = {
    kakaopay: { count: 0, amount: 0 },
    deferred: { count: 0, amount: 0 },
  };

  for (const order of validOrders) {
    const method = order.paymentMethod as "kakaopay" | "deferred";
    if (paymentBreakdown[method]) {
      paymentBreakdown[method].count += 1;
      paymentBreakdown[method].amount += order.totalAmount;
    }
  }

  // Top menu items
  const itemMap = new Map<
    string,
    { name: string; quantity: number; revenue: number }
  >();
  for (const order of validOrders) {
    const items = orderItems[order.id] || [];
    for (const item of items) {
      const existing = itemMap.get(item.menuItemName) || {
        name: item.menuItemName,
        quantity: 0,
        revenue: 0,
      };
      existing.quantity += item.quantity;
      existing.revenue += item.subtotal;
      itemMap.set(item.menuItemName, existing);
    }
  }

  const topItems = [...itemMap.values()]
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 10);

  // Room stats
  const roomMap = new Map<
    string,
    { roomNumber: string; orderCount: number; totalAmount: number }
  >();
  for (const order of validOrders) {
    const existing = roomMap.get(order.roomNumber) || {
      roomNumber: order.roomNumber,
      orderCount: 0,
      totalAmount: 0,
    };
    existing.orderCount += 1;
    existing.totalAmount += order.totalAmount;
    roomMap.set(order.roomNumber, existing);
  }

  const roomStats = [...roomMap.values()].sort(
    (a, b) => b.totalAmount - a.totalAmount
  );

  return NextResponse.json({
    date: dateStr,
    totalRevenue,
    orderCount,
    avgOrderValue: validOrders.length
      ? Math.round(totalRevenue / validOrders.length)
      : 0,
    completedOrders: completedCount,
    acceptedOrders: acceptedCount,
    rejectedOrders: rejectedCount,
    cancelledOrders: cancelledCount,
    completionRate: orderCount
      ? Math.round((completedCount / orderCount) * 100)
      : 0,
    comparison: {
      prevRevenue,
      revenueDiff: totalRevenue - prevRevenue,
      revenueChangePercent: prevRevenue
        ? Math.round(((totalRevenue - prevRevenue) / prevRevenue) * 100)
        : 0,
      prevOrderCount,
      orderCountDiff: orderCount - prevOrderCount,
    },
    hourlyRevenue,
    paymentBreakdown,
    topItems,
    roomStats,
  });
}

async function getMonthlyAnalytics(params: URLSearchParams) {
  const now = new Date();
  const year = parseInt(params.get("year") || String(now.getFullYear()));
  const month = parseInt(params.get("month") || String(now.getMonth() + 1));

  // Date range for the month
  const startOfMonth = new Date(year, month - 1, 1);
  const endOfMonth = new Date(year, month, 0, 23, 59, 59, 999);

  // Previous month for comparison
  const prevStart = new Date(year, month - 2, 1);
  const prevEnd = new Date(year, month - 1, 0, 23, 59, 59, 999);

  // Fetch orders
  const ordersSnap = await getDocs(
    query(
      collection(firestore, "orders"),
      where("createdAt", ">=", startOfMonth.toISOString()),
      where("createdAt", "<=", endOfMonth.toISOString()),
      orderBy("createdAt", "asc")
    )
  );

  const prevOrdersSnap = await getDocs(
    query(
      collection(firestore, "orders"),
      where("createdAt", ">=", prevStart.toISOString()),
      where("createdAt", "<=", prevEnd.toISOString())
    )
  );

  const orders: OrderDoc[] = ordersSnap.docs.map((d) => ({
    id: d.id,
    ...(d.data() as Omit<OrderDoc, "id">),
  }));

  const prevOrders: OrderDoc[] = prevOrdersSnap.docs.map((d) => ({
    id: d.id,
    ...(d.data() as Omit<OrderDoc, "id">),
  }));

  // Fetch items for all orders
  const orderItems: Record<string, OrderItemDoc[]> = {};
  for (const order of orders) {
    const itemsSnap = await getDocs(
      collection(firestore, "orders", order.id, "items")
    );
    orderItems[order.id] = itemsSnap.docs.map(
      (d) => d.data() as OrderItemDoc
    );
  }

  const validOrders = orders.filter(
    (o) => o.status !== "rejected" && o.status !== "cancelled"
  );
  const totalRevenue = validOrders.reduce((sum, o) => sum + o.totalAmount, 0);
  const orderCount = orders.length;
  const completedCount = orders.filter((o) => o.status === "completed").length;
  const rejectedCount = orders.filter((o) => o.status === "rejected").length;
  const cancelledCount = orders.filter((o) => o.status === "cancelled").length;

  // Previous month comparison
  const prevValidOrders = prevOrders.filter(
    (o) => o.status !== "rejected" && o.status !== "cancelled"
  );
  const prevRevenue = prevValidOrders.reduce(
    (sum, o) => sum + o.totalAmount,
    0
  );
  const prevOrderCount = prevOrders.length;

  // Daily breakdown
  const daysInMonth = endOfMonth.getDate();
  const dailyRevenue = Array.from({ length: daysInMonth }, (_, i) => ({
    day: i + 1,
    label: `${i + 1}일`,
    date: `${year}-${String(month).padStart(2, "0")}-${String(i + 1).padStart(2, "0")}`,
    revenue: 0,
    orders: 0,
  }));

  for (const order of validOrders) {
    const day = new Date(order.createdAt).getDate();
    if (day >= 1 && day <= daysInMonth) {
      dailyRevenue[day - 1].revenue += order.totalAmount;
      dailyRevenue[day - 1].orders += 1;
    }
  }

  // Payment breakdown
  const paymentBreakdown = {
    kakaopay: { count: 0, amount: 0 },
    deferred: { count: 0, amount: 0 },
  };

  for (const order of validOrders) {
    const method = order.paymentMethod as "kakaopay" | "deferred";
    if (paymentBreakdown[method]) {
      paymentBreakdown[method].count += 1;
      paymentBreakdown[method].amount += order.totalAmount;
    }
  }

  // Top items for the month
  const itemMap = new Map<
    string,
    { name: string; quantity: number; revenue: number }
  >();
  for (const order of validOrders) {
    const items = orderItems[order.id] || [];
    for (const item of items) {
      const existing = itemMap.get(item.menuItemName) || {
        name: item.menuItemName,
        quantity: 0,
        revenue: 0,
      };
      existing.quantity += item.quantity;
      existing.revenue += item.subtotal;
      itemMap.set(item.menuItemName, existing);
    }
  }

  const topItems = [...itemMap.values()]
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 10);

  // Hourly heatmap (aggregated across the month)
  const hourlyRevenue = Array.from({ length: 24 }, (_, h) => ({
    hour: h,
    label: `${h}시`,
    revenue: 0,
    orders: 0,
  }));

  for (const order of validOrders) {
    const hour = new Date(order.createdAt).getHours();
    hourlyRevenue[hour].revenue += order.totalAmount;
    hourlyRevenue[hour].orders += 1;
  }

  // Room stats for the month
  const roomMap = new Map<
    string,
    { roomNumber: string; orderCount: number; totalAmount: number }
  >();
  for (const order of validOrders) {
    const existing = roomMap.get(order.roomNumber) || {
      roomNumber: order.roomNumber,
      orderCount: 0,
      totalAmount: 0,
    };
    existing.orderCount += 1;
    existing.totalAmount += order.totalAmount;
    roomMap.set(order.roomNumber, existing);
  }

  const roomStats = [...roomMap.values()].sort(
    (a, b) => b.totalAmount - a.totalAmount
  );

  // Best/worst day
  const bestDay = dailyRevenue.reduce(
    (best, d) => (d.revenue > best.revenue ? d : best),
    dailyRevenue[0]
  );
  const worstActiveDay = dailyRevenue
    .filter((d) => d.orders > 0)
    .reduce(
      (worst, d) => (d.revenue < worst.revenue ? d : worst),
      dailyRevenue.find((d) => d.orders > 0) || dailyRevenue[0]
    );

  return NextResponse.json({
    year,
    month,
    totalRevenue,
    orderCount,
    avgOrderValue: validOrders.length
      ? Math.round(totalRevenue / validOrders.length)
      : 0,
    completedOrders: completedCount,
    rejectedOrders: rejectedCount,
    cancelledOrders: cancelledCount,
    completionRate: orderCount
      ? Math.round((completedCount / orderCount) * 100)
      : 0,
    comparison: {
      prevRevenue,
      revenueDiff: totalRevenue - prevRevenue,
      revenueChangePercent: prevRevenue
        ? Math.round(((totalRevenue - prevRevenue) / prevRevenue) * 100)
        : 0,
      prevOrderCount,
      orderCountDiff: orderCount - prevOrderCount,
    },
    dailyRevenue,
    hourlyRevenue,
    paymentBreakdown,
    topItems,
    roomStats,
    bestDay,
    worstDay: worstActiveDay,
  });
}
