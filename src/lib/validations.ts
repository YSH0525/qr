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
  costPrice: z.number().int().min(0, "원가는 0 이상이어야 합니다").nullable().optional(),
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
        quantity: z.number().int().min(1).max(99),
      })
    )
    .min(1, "최소 1개 이상의 상품을 주문해야 합니다"),
  paymentMethod: z.enum(["deferred"]),
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

export const serviceCategorySchema = z.object({
  name: z.string().min(1, "서비스명을 입력하세요"),
  type: z.enum(["cleaning", "checkout_extension", "amenity"]),
  icon: z.string().min(1),
  description: z.string().optional(),
  isActive: z.boolean().optional(),
  displayOrder: z.number().int().optional(),
  hourlyRate: z.number().int().min(0).optional(),
});

export const serviceItemSchema = z.object({
  name: z.string().min(1, "아이템명을 입력하세요"),
  icon: z.string().min(1),
  categoryId: z.string().min(1),
  isAvailable: z.boolean().optional(),
  displayOrder: z.number().int().optional(),
});

export const cleaningOptionsSchema = z.object({
  serviceLevel: z.enum(["full", "light", "dnd"]),
  preferredTime: z.enum(["morning", "afternoon", "anytime"]),
  linenChange: z.boolean(),
  contactlessSupplies: z.array(z.enum(["towel", "water", "amenity"])),
  leaveAtDoor: z.boolean(),
  trashRemovalOnly: z.boolean(),
});

export const serviceRequestSchema = z.object({
  roomId: z.string().min(1),
  categoryId: z.string().min(1),
  note: z.string().optional(),
  items: z
    .array(
      z.object({
        itemId: z.string().min(1),
        name: z.string().min(1),
        quantity: z.number().int().min(1),
      })
    )
    .optional(),
  extensionHours: z.number().int().min(1).max(6).optional(),
  cleaningOptions: cleaningOptionsSchema.optional(),
});

export const serviceRequestStatusSchema = z.object({
  status: z.enum(["requested", "accepted", "completed"]),
});
