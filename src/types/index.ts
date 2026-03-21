export * from "./service";
import type { CleaningOptions, ServiceRequestItem } from "./service";

export type OrderType = "product" | "cleaning" | "checkout_extension" | "amenity";

export type OrderStatus =
  | "pending"
  | "accepted"
  | "rejected"
  | "preparing"
  | "completed"
  | "cancelled";

export type PaymentMethod = "deferred";

export type PaymentStatus = "deferred";

export const ORDER_TYPE_LABELS: Record<OrderType, string> = {
  product: "주문",
  cleaning: "연박 청소",
  checkout_extension: "체크아웃 연장",
  amenity: "비품 요청",
};

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  pending: "대기중",
  accepted: "접수됨",
  rejected: "거절됨",
  preparing: "준비중",
  completed: "완료",
  cancelled: "취소됨",
};

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  deferred: "후불결제",
};

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  deferred: "후불",
};

export interface CartItem {
  menuItemId: string;
  name: string;
  price: number;
  quantity: number;
  imageUrl?: string | null;
}

export const REJECTION_REASONS = [
  { value: "sold_out", label: "재고소진" },
  { value: "closing_soon", label: "영업마감(23시50분 마감)" },
] as const;

export type RejectionReasonValue = typeof REJECTION_REASONS[number]["value"];

export const REJECTION_REASON_LABELS: Record<RejectionReasonValue, string> = Object.fromEntries(
  REJECTION_REASONS.map((r) => [r.value, r.label])
) as Record<RejectionReasonValue, string>;

/**
 * Unified order type — covers both product orders and service orders.
 * Discriminated by the `type` field.
 */
export interface OrderWithItems {
  id: string;
  orderId: string;
  type: OrderType;
  roomId: string;
  roomUuid: string;
  roomNumber: string;
  status: OrderStatus;
  paymentMethod: PaymentMethod | null;
  paymentStatus: PaymentStatus | null;
  totalAmount: number;
  note: string | null;
  rejectionReason?: string;
  dailySeq?: number;
  createdAt: string;
  updatedAt: string;

  // Product order items
  items: OrderItem[];

  // Service-specific fields (null/undefined for product orders)
  categoryId?: string;
  categoryName?: string;
  categoryIcon?: string;
  serviceItems?: ServiceRequestItem[];
  cleaningOptions?: CleaningOptions | null;
  extensionHours?: number | null;
  extensionAmount?: number | null;
  freeExtension?: boolean;
}

export interface OrderItem {
  menuItemId?: string;
  menuItemName: string;
  menuItemPrice: number;
  costPrice?: number | null;
  quantity: number;
  subtotal: number;
}
