export const HOTEL_NAME = process.env.NEXT_PUBLIC_HOTEL_NAME || "Easy Tap";

/** 영업 마감 시간 (KST) */
export const CLOSING_HOUR = 23;
export const CLOSING_MINUTE = 50;
export const CLOSING_TIME_LABEL = "23:50";

function getBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_BASE_URL) return process.env.NEXT_PUBLIC_BASE_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

export const BASE_URL = getBaseUrl();
