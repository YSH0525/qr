export type ServiceType = "cleaning" | "checkout_extension" | "amenity";

export type ServiceRequestStatus = "requested" | "accepted" | "completed";

export const SERVICE_TYPE_LABELS: Record<ServiceType, string> = {
  cleaning: "연박 청소",
  checkout_extension: "체크아웃 연장",
  amenity: "비품 요청",
};

export const SERVICE_STATUS_LABELS: Record<ServiceRequestStatus, string> = {
  requested: "요청됨",
  accepted: "접수됨",
  completed: "완료",
};

export interface ServiceCategory {
  id: string;
  name: string;
  type: ServiceType;
  icon: string;
  description: string;
  isActive: boolean;
  displayOrder: number;
  hourlyRate?: number; // checkout_extension 전용
}

export interface ServiceItem {
  id: string;
  name: string;
  icon: string;
  categoryId: string;
  isAvailable: boolean;
  displayOrder: number;
}

export interface ServiceRequestItem {
  itemId: string;
  name: string;
  quantity: number;
}

export interface ServiceRequest {
  id: string;
  requestId: string;
  categoryId: string;
  categoryName: string;
  categoryIcon: string;
  type: ServiceType;
  roomId: string;
  roomUuid: string;
  roomNumber: string;
  status: ServiceRequestStatus;
  note: string | null;
  items: ServiceRequestItem[];
  extensionHours: number | null;
  extensionAmount: number | null;
  freeExtension: boolean;
  createdAt: string;
  updatedAt: string;
}
