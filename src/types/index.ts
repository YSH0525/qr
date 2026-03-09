export * from "./service";

export type OrderStatus =
  | "pending"
  | "accepted"
  | "rejected"
  | "preparing"
  | "completed"
  | "cancelled";

export type PaymentMethod = "kakaopay" | "deferred";

export type PaymentStatus =
  | "pending"
  | "paid"
  | "failed"
  | "cancelled"
  | "deferred";

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  pending: "대기중",
  accepted: "접수됨",
  rejected: "거절됨",
  preparing: "준비중",
  completed: "완료",
  cancelled: "취소됨",
};

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  kakaopay: "카카오페이",
  deferred: "후불결제",
};

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  pending: "결제대기",
  paid: "결제완료",
  failed: "결제실패",
  cancelled: "결제취소",
  deferred: "후불",
};

export interface CartItem {
  menuItemId: string;
  name: string;
  price: number;
  quantity: number;
  imageUrl?: string | null;
}

export interface OrderWithItems {
  id: string;
  orderId: string;
  roomId: string;
  roomNumber: string;
  status: OrderStatus;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  totalAmount: number;
  note: string | null;
  createdAt: string;
  updatedAt: string;
  items: {
    menuItemName: string;
    menuItemPrice: number;
    quantity: number;
    subtotal: number;
  }[];
}
