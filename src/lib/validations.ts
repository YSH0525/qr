import { z } from "zod/v4";

export const loginSchema = z.object({
  password: z.string().min(1, "비밀번호를 입력하세요"),
});

export const roomSchema = z.object({
  roomNumber: z.string().min(1, "객실 번호를 입력하세요"),
  floor: z.string().optional(),
});

export const menuItemSchema = z.object({
  categoryId: z.string().min(1),
  name: z.string().min(1, "메뉴명을 입력하세요"),
  description: z.string().optional(),
  price: z.number().int().min(0, "가격은 0 이상이어야 합니다"),
  imageUrl: z.string().optional(),
  isAvailable: z.boolean().optional(),
});

export const categorySchema = z.object({
  name: z.string().min(1, "카테고리명을 입력하세요"),
  displayOrder: z.number().int().optional(),
});

export const orderSchema = z.object({
  roomId: z.string().min(1),
  items: z
    .array(
      z.object({
        menuItemId: z.string().min(1),
        quantity: z.number().int().min(1),
      })
    )
    .min(1, "최소 1개 이상의 상품을 주문해야 합니다"),
  paymentMethod: z.enum(["kakaopay", "deferred"]),
  note: z.string().optional(),
});

export const orderStatusSchema = z.object({
  status: z.enum([
    "pending",
    "accepted",
    "rejected",
    "preparing",
    "completed",
    "cancelled",
  ]),
});
