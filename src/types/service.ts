export type ServiceType = "cleaning" | "checkout_extension" | "amenity";

export type ServiceRequestStatus = "requested" | "accepted" | "completed";

export type CleaningLevel = "full" | "light" | "dnd";
export type PreferredTime = "morning" | "afternoon" | "anytime";
export type SupplyItem = "towel" | "water" | "amenity";

export interface CleaningOptions {
  serviceLevel: CleaningLevel;
  preferredTime: PreferredTime;
  linenChange: boolean;
  contactlessSupplies: SupplyItem[];
  leaveAtDoor: boolean;
  trashRemovalOnly: boolean;
}

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

export const CLEANING_LEVEL_LABELS: Record<CleaningLevel, string> = {
  full: "전체 정비",
  light: "간편 정비",
  dnd: "정비 안 함 (DND)",
};

export const CLEANING_LEVEL_DESCRIPTIONS: Record<CleaningLevel, string> = {
  full: "침구 교체 포함",
  light: "수건 교체, 쓰레기 수거, 바닥 정리",
  dnd: "방해 금지",
};

export const PREFERRED_TIME_LABELS: Record<PreferredTime, string> = {
  morning: "오전 (10~12시)",
  afternoon: "오후 (12~14시)",
  anytime: "상관없음",
};

export const SUPPLY_ITEM_LABELS: Record<SupplyItem, string> = {
  towel: "수건 추가",
  water: "생수 보충",
  amenity: "어메니티 리필",
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
  cleaningOptions: CleaningOptions | null;
  extensionHours: number | null;
  extensionAmount: number | null;
  freeExtension: boolean;
  paymentStatus?: string | null;
  paymentMethod?: string | null;
  kakaoTid?: string | null;
  createdAt: string;
  updatedAt: string;
}
