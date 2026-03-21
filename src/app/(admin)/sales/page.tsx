"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
} from "recharts";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  TrendingUp,
  TrendingDown,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Printer,
  ShoppingCart,
  DollarSign,
  BarChart3,
  Clock,
  Settings,
  Percent,
  Wallet,
  Award,
} from "lucide-react";
import { format } from "date-fns";
import { ko } from "date-fns/locale";

type Mode = "daily" | "monthly";

interface HourlyData {
  hour: number;
  label: string;
  revenue: number;
  orders: number;
}

interface TopItem {
  name: string;
  quantity: number;
  revenue: number;
  totalCost: number;
  profit: number;
  profitRate: number;
}

interface RoomStat {
  roomNumber: string;
  orderCount: number;
  totalAmount: number;
}

interface PaymentBreakdown {
  deferred: { count: number; amount: number };
}

interface Comparison {
  prevRevenue: number;
  revenueDiff: number;
  revenueChangePercent: number;
  prevOrderCount: number;
  orderCountDiff: number;
}

interface DailyData {
  day: number;
  label: string;
  date: string;
  revenue: number;
  orders: number;
}

interface AnalyticsData {
  totalRevenue: number;
  orderCount: number;
  avgOrderValue: number;
  completedOrders: number;
  rejectedOrders: number;
  cancelledOrders: number;
  completionRate: number;
  comparison: Comparison;
  hourlyRevenue: HourlyData[];
  paymentBreakdown: PaymentBreakdown;
  topItems: TopItem[];
  roomStats: RoomStat[];
  // Profit analysis
  totalCost: number;
  totalProfit: number;
  profitRate: number;
  incentiveRate: number;
  incentiveAmount: number;
  // Monthly-specific
  dailyRevenue?: DailyData[];
  bestDay?: DailyData;
  worstDay?: DailyData;
}

const PIE_COLORS = ["#3b82f6"];

function formatPrice(price: number) {
  return price.toLocaleString("ko-KR") + "원";
}

function formatCompact(value: number) {
  if (value >= 10000) {
    return (value / 10000).toFixed(1) + "만";
  }
  return value.toLocaleString("ko-KR");
}

export default function SalesPage() {
  const [mode, setMode] = useState<Mode>("daily");
  const [selectedDate, setSelectedDate] = useState(
    format(new Date(), "yyyy-MM-dd")
  );
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(
    new Date().getMonth() + 1
  );
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [incentiveDialogOpen, setIncentiveDialogOpen] = useState(false);
  const [incentiveRateInput, setIncentiveRateInput] = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      let url = "/api/analytics?mode=" + mode;
      if (mode === "daily") {
        url += `&date=${selectedDate}`;
      } else {
        url += `&year=${selectedYear}&month=${selectedMonth}`;
      }

      const res = await fetch(url);
      if (res.ok) {
        setData(await res.json());
      }
    } finally {
      setLoading(false);
    }
  }, [mode, selectedDate, selectedYear, selectedMonth]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Date navigation
  const navigateDate = (dir: number) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + dir);
    setSelectedDate(format(d, "yyyy-MM-dd"));
  };

  const navigateMonth = (dir: number) => {
    let m = selectedMonth + dir;
    let y = selectedYear;
    if (m > 12) {
      m = 1;
      y++;
    }
    if (m < 1) {
      m = 12;
      y--;
    }
    setSelectedMonth(m);
    setSelectedYear(y);
  };

  const goToToday = () => {
    const now = new Date();
    setSelectedDate(format(now, "yyyy-MM-dd"));
    setSelectedYear(now.getFullYear());
    setSelectedMonth(now.getMonth() + 1);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleSaveIncentiveRate = async () => {
    const rate = parseFloat(incentiveRateInput);
    if (isNaN(rate) || rate < 0 || rate > 100) return;
    const res = await fetch("/api/settings/incentive", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ incentiveRate: rate }),
    });
    if (res.ok) {
      setIncentiveDialogOpen(false);
      fetchData();
    }
  };

  if (loading || !data) {
    return (
      <div className="p-3 md:p-6">
        <h1 className="text-xl md:text-2xl font-bold mb-4 md:mb-6">매출 분석</h1>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      </div>
    );
  }

  const comparisonLabel = mode === "daily" ? "전일 대비" : "전월 대비";
  const peakHour = data.hourlyRevenue.reduce(
    (max, h) => (h.revenue > max.revenue ? h : max),
    data.hourlyRevenue[0]
  );

  return (
    <div className="p-3 md:p-6 print:p-2 h-full flex flex-col overflow-hidden print:overflow-visible print:h-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 md:mb-6 print:mb-3 shrink-0">
        <h1 className="text-xl md:text-2xl font-bold">매출 분석</h1>
        <Button
          variant="outline"
          size="sm"
          onClick={handlePrint}
          className="print:hidden"
        >
          <Printer className="w-4 h-4 mr-2" />
          인쇄
        </Button>
      </div>

      {/* Mode Toggle + Date Navigation */}
      <div className="flex flex-wrap items-center gap-2 md:gap-3 mb-4 md:mb-6 print:mb-3 shrink-0">
        <div className="flex bg-gray-100 rounded-lg p-1 print:hidden">
          <button
            onClick={() => setMode("daily")}
            className={`px-4 py-2 rounded-md text-sm font-medium transition ${
              mode === "daily"
                ? "bg-white shadow text-blue-600"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            일별 정산
          </button>
          <button
            onClick={() => setMode("monthly")}
            className={`px-4 py-2 rounded-md text-sm font-medium transition ${
              mode === "monthly"
                ? "bg-white shadow text-blue-600"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            월별 정산
          </button>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() =>
              mode === "daily" ? navigateDate(-1) : navigateMonth(-1)
            }
            className="print:hidden"
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>

          <div className="flex items-center gap-2 px-3 py-2 bg-white border rounded-lg">
            <Calendar className="w-4 h-4 text-gray-400" />
            {mode === "daily" ? (
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="text-sm font-medium border-0 focus:outline-none print:hidden"
              />
            ) : (
              <span className="text-sm font-medium">
                {selectedYear}년 {selectedMonth}월
              </span>
            )}
            <span className="hidden print:inline text-sm font-medium">
              {mode === "daily"
                ? format(new Date(selectedDate), "yyyy년 M월 d일 (EEEE)", {
                    locale: ko,
                  })
                : `${selectedYear}년 ${selectedMonth}월`}
            </span>
          </div>

          <Button
            variant="ghost"
            size="icon"
            onClick={() =>
              mode === "daily" ? navigateDate(1) : navigateMonth(1)
            }
            className="print:hidden"
          >
            <ChevronRight className="w-4 h-4" />
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={goToToday}
            className="print:hidden"
          >
            오늘
          </Button>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto print:overflow-visible">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-4 md:mb-6 print:gap-2 print:mb-3">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
              <DollarSign className="w-4 h-4" />
              총 매출
            </div>
            <p className="text-2xl font-bold text-blue-600">
              {formatPrice(data.totalRevenue)}
            </p>
            <ComparisonBadge
              diff={data.comparison.revenueDiff}
              percent={data.comparison.revenueChangePercent}
              label={comparisonLabel}
              isCurrency
            />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
              <ShoppingCart className="w-4 h-4" />
              주문 건수
            </div>
            <p className="text-2xl font-bold">{data.orderCount}건</p>
            <ComparisonBadge
              diff={data.comparison.orderCountDiff}
              label={comparisonLabel}
              suffix="건"
            />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
              <BarChart3 className="w-4 h-4" />
              평균 주문 금액
            </div>
            <p className="text-2xl font-bold">
              {formatPrice(data.avgOrderValue)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
              <Clock className="w-4 h-4" />
              피크 시간대
            </div>
            <p className="text-2xl font-bold">{peakHour.label}</p>
            <p className="text-xs text-gray-400">
              {peakHour.orders}건 · {formatPrice(peakHour.revenue)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Order Status Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4 md:mb-6 print:mb-3">
        <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-center">
          <p className="text-2xl font-bold text-green-600">
            {data.completedOrders}
          </p>
          <p className="text-xs text-green-600">완료</p>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-center">
          <p className="text-2xl font-bold text-blue-600">
            {data.completionRate}%
          </p>
          <p className="text-xs text-blue-600">완료율</p>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-center">
          <p className="text-2xl font-bold text-red-600">
            {data.rejectedOrders}
          </p>
          <p className="text-xs text-red-600">거절</p>
        </div>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-center">
          <p className="text-2xl font-bold text-gray-600">
            {data.cancelledOrders}
          </p>
          <p className="text-xs text-gray-600">취소</p>
        </div>
      </div>

      {/* Profit Analysis Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-4 md:mb-6 print:gap-2 print:mb-3">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
              <Wallet className="w-4 h-4" />
              총 원가
            </div>
            <p className="text-2xl font-bold text-gray-600">
              {formatPrice(data.totalCost)}
            </p>
          </CardContent>
        </Card>

        <Card className="border-green-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
              <TrendingUp className="w-4 h-4" />
              순이익
            </div>
            <p className={`text-2xl font-bold ${data.totalProfit >= 0 ? "text-green-600" : "text-red-600"}`}>
              {formatPrice(data.totalProfit)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
              <Percent className="w-4 h-4" />
              이익률
            </div>
            <p className="text-2xl font-bold text-blue-600">
              {data.profitRate}%
            </p>
          </CardContent>
        </Card>

        <Card className="border-purple-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between text-sm text-gray-500 mb-1">
              <div className="flex items-center gap-2">
                <Award className="w-4 h-4" />
                인센티브
              </div>
              <button
                onClick={() => {
                  setIncentiveRateInput(String(data.incentiveRate));
                  setIncentiveDialogOpen(true);
                }}
                className="print:hidden"
              >
                <Settings className="w-3.5 h-3.5 text-gray-400 hover:text-gray-600" />
              </button>
            </div>
            <p className="text-2xl font-bold text-purple-600">
              {formatPrice(data.incentiveAmount)}
            </p>
            <p className="text-xs text-gray-400 mt-1">
              순이익의 {data.incentiveRate}%
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6 print:gap-2 print:mb-3">
        {/* Revenue Chart */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">
              {mode === "daily" ? "시간대별 매출" : "일별 매출 추이"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64 print:h-48">
              <ResponsiveContainer width="100%" height="100%">
                {mode === "daily" ? (
                  <BarChart data={data.hourlyRevenue}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 11 }}
                      interval={2}
                    />
                    <YAxis
                      tick={{ fontSize: 11 }}
                      tickFormatter={formatCompact}
                    />
                    <Tooltip
                      formatter={(value) => [formatPrice(Number(value)), "매출"]}
                      labelFormatter={(label) => `${label}`}
                    />
                    <Bar dataKey="revenue" fill="#3b82f6" radius={[2, 2, 0, 0]} />
                  </BarChart>
                ) : (
                  <LineChart data={data.dailyRevenue}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 11 }}
                      interval={4}
                    />
                    <YAxis
                      tick={{ fontSize: 11 }}
                      tickFormatter={formatCompact}
                    />
                    <Tooltip
                      formatter={(value) => [formatPrice(Number(value)), "매출"]}
                    />
                    <Line
                      type="monotone"
                      dataKey="revenue"
                      stroke="#3b82f6"
                      strokeWidth={2}
                      dot={{ r: 2 }}
                    />
                  </LineChart>
                )}
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Payment Breakdown Pie */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">결제 수단별</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-44 print:h-36">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={[
                      {
                        name: "후불결제",
                        value: data.paymentBreakdown.deferred.amount,
                      },
                    ]}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={65}
                    dataKey="value"
                    label={({ name, percent }) =>
                      `${name} ${((percent ?? 0) * 100).toFixed(0)}%`
                    }
                    labelLine={false}
                  >
                    <Cell fill={PIE_COLORS[0]} />
                  </Pie>
                  <Tooltip formatter={(v) => formatPrice(Number(v))} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-2 mt-2">
              <div className="flex justify-between text-sm">
                <span className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-blue-500" />
                  후불결제
                </span>
                <span className="font-medium">
                  {data.paymentBreakdown.deferred.count}건 ·{" "}
                  {formatPrice(data.paymentBreakdown.deferred.amount)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Monthly-specific: Best/Worst Day */}
      {mode === "monthly" && data.bestDay && data.worstDay && (
        <div className="grid grid-cols-2 gap-4 mb-6 print:mb-3">
          <Card className="border-green-200 bg-green-50/50">
            <CardContent className="p-4">
              <p className="text-sm text-green-600 font-medium mb-1">
                최고 매출일
              </p>
              <p className="text-lg font-bold">{data.bestDay.label}</p>
              <p className="text-sm text-gray-600">
                {formatPrice(data.bestDay.revenue)} · {data.bestDay.orders}건
              </p>
            </CardContent>
          </Card>
          <Card className="border-orange-200 bg-orange-50/50">
            <CardContent className="p-4">
              <p className="text-sm text-orange-600 font-medium mb-1">
                최저 매출일
              </p>
              <p className="text-lg font-bold">{data.worstDay.label}</p>
              <p className="text-sm text-gray-600">
                {formatPrice(data.worstDay.revenue)} · {data.worstDay.orders}건
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Bottom Section: Top Items + Room Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 print:gap-2">
        {/* Top Menu Items */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">인기 메뉴 TOP 10</CardTitle>
          </CardHeader>
          <CardContent>
            {data.topItems.length === 0 ? (
              <p className="text-sm text-gray-400 py-4 text-center">
                데이터가 없습니다
              </p>
            ) : (
              <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8">#</TableHead>
                    <TableHead>메뉴명</TableHead>
                    <TableHead className="text-right">판매량</TableHead>
                    <TableHead className="text-right">매출</TableHead>
                    <TableHead className="text-right">원가</TableHead>
                    <TableHead className="text-right">순이익</TableHead>
                    <TableHead className="text-right">이익률</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.topItems.map((item, idx) => (
                    <TableRow key={item.name}>
                      <TableCell className="font-bold text-gray-400">
                        {idx + 1}
                      </TableCell>
                      <TableCell className="font-medium">{item.name}</TableCell>
                      <TableCell className="text-right">
                        {item.quantity}개
                      </TableCell>
                      <TableCell className="text-right text-sm">
                        {formatPrice(item.revenue)}
                      </TableCell>
                      <TableCell className="text-right text-sm text-gray-500">
                        {formatPrice(item.totalCost)}
                      </TableCell>
                      <TableCell className={`text-right text-sm font-medium ${item.profit >= 0 ? "text-green-600" : "text-red-600"}`}>
                        {formatPrice(item.profit)}
                      </TableCell>
                      <TableCell className="text-right text-sm">
                        {item.profitRate}%
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Room Stats */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">객실별 주문 현황</CardTitle>
          </CardHeader>
          <CardContent>
            {data.roomStats.length === 0 ? (
              <p className="text-sm text-gray-400 py-4 text-center">
                데이터가 없습니다
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>객실</TableHead>
                    <TableHead className="text-right">주문 건수</TableHead>
                    <TableHead className="text-right">총 매출</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.roomStats.map((room) => (
                    <TableRow key={room.roomNumber}>
                      <TableCell className="font-medium">
                        {room.roomNumber}호
                      </TableCell>
                      <TableCell className="text-right">
                        {room.orderCount}건
                      </TableCell>
                      <TableCell className="text-right text-sm">
                        {formatPrice(room.totalAmount)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Monthly: Daily Breakdown Table */}
      {mode === "monthly" && data.dailyRevenue && (
        <Card className="mt-4 print:mt-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">일별 상세 내역</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>날짜</TableHead>
                  <TableHead className="text-right">주문 건수</TableHead>
                  <TableHead className="text-right">매출</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.dailyRevenue
                  .filter((d) => d.orders > 0)
                  .map((d) => (
                    <TableRow key={d.date}>
                      <TableCell>{d.label}</TableCell>
                      <TableCell className="text-right">{d.orders}건</TableCell>
                      <TableCell className="text-right font-medium">
                        {formatPrice(d.revenue)}
                      </TableCell>
                    </TableRow>
                  ))}
                {data.dailyRevenue.filter((d) => d.orders > 0).length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={3}
                      className="text-center text-gray-400 py-6"
                    >
                      해당 월에 주문 데이터가 없습니다
                    </TableCell>
                  </TableRow>
                )}
                {data.dailyRevenue.filter((d) => d.orders > 0).length > 0 && (
                  <TableRow className="bg-gray-50 font-bold">
                    <TableCell>합계</TableCell>
                    <TableCell className="text-right">
                      {data.orderCount}건
                    </TableCell>
                    <TableCell className="text-right">
                      {formatPrice(data.totalRevenue)}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Monthly: Hourly Heatmap */}
      {mode === "monthly" && (
        <Card className="mt-4 print:mt-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">시간대별 주문 분포</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-48 print:h-36">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.hourlyRevenue}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 11 }}
                    interval={2}
                  />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip
                    formatter={(value, name) => [
                      name === "orders"
                        ? `${value}건`
                        : formatPrice(Number(value)),
                      name === "orders" ? "주문수" : "매출",
                    ]}
                  />
                  <Bar
                    dataKey="orders"
                    fill="#8b5cf6"
                    radius={[2, 2, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Print Footer */}
      <div className="hidden print:block mt-4 text-center text-xs text-gray-400 border-t pt-2">
        {mode === "daily"
          ? `일별 정산서 · ${format(new Date(selectedDate), "yyyy년 M월 d일", { locale: ko })}`
          : `월별 정산서 · ${selectedYear}년 ${selectedMonth}월`}
        {" · "}
        출력일시: {format(new Date(), "yyyy-MM-dd HH:mm")}
      </div>
      </div>

      {/* Incentive Rate Dialog */}
      <Dialog open={incentiveDialogOpen} onOpenChange={setIncentiveDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>인센티브 비율 설정</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">비율 (%)</label>
              <Input
                type="number"
                value={incentiveRateInput}
                onChange={(e) => setIncentiveRateInput(e.target.value)}
                min="0"
                max="100"
                step="0.1"
              />
              <p className="text-xs text-gray-400 mt-1">
                순이익의 몇 %를 인센티브로 지급할지 설정합니다.
              </p>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIncentiveDialogOpen(false)}>
                취소
              </Button>
              <Button onClick={handleSaveIncentiveRate}>
                저장
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ComparisonBadge({
  diff,
  percent,
  label,
  isCurrency,
  suffix,
}: {
  diff: number;
  percent?: number;
  label: string;
  isCurrency?: boolean;
  suffix?: string;
}) {
  if (diff === 0 && !percent) {
    return (
      <p className="text-xs text-gray-400 mt-1">{label}: 변동 없음</p>
    );
  }

  const isPositive = diff > 0;
  const Icon = isPositive ? TrendingUp : TrendingDown;
  const color = isPositive ? "text-green-600" : "text-red-600";

  const displayDiff = isCurrency
    ? formatPrice(Math.abs(diff))
    : `${Math.abs(diff)}${suffix || ""}`;

  return (
    <p className={`text-xs mt-1 flex items-center gap-1 ${color}`}>
      <Icon className="w-3 h-3" />
      {isPositive ? "+" : "-"}
      {displayDiff}
      {percent !== undefined && ` (${isPositive ? "+" : ""}${percent}%)`}
      <span className="text-gray-400 ml-1">{label}</span>
    </p>
  );
}
