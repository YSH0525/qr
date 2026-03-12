import { type NextRequest } from "next/server";

export const HOTEL_NAME = process.env.NEXT_PUBLIC_HOTEL_NAME || "Easy Tap";

/** 카카오페이 활성화 여부 — true로 바꾸면 카카오페이 결제 옵션이 다시 노출됩니다 */
export const KAKAOPAY_ENABLED = false;

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

export function getBaseUrlFromRequest(req: NextRequest): string {
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
  // x-forwarded-proto can contain multiple values like "http,https" from proxies
  const rawProto = req.headers.get("x-forwarded-proto") || "https";
  const proto = rawProto.split(",")[0].trim();
  if (host) return `${proto}://${host}`;
  return BASE_URL;
}

/**
 * Get a reliable base URL for Kakao Pay callback URLs.
 * Prioritizes NEXT_PUBLIC_BASE_URL (explicitly configured public URL) over
 * request headers, since callback URLs must be publicly accessible from
 * the Kakao Pay app redirecting back to the browser.
 */
export function getCallbackBaseUrl(req: NextRequest): string {
  // 1. NEXT_PUBLIC_BASE_URL (explicitly configured public URL)
  const envUrl = process.env.NEXT_PUBLIC_BASE_URL;
  if (envUrl && !envUrl.includes("localhost") && !envUrl.includes("127.0.0.1")) {
    return envUrl.replace(/\/$/, "");
  }
  // 2. VERCEL_URL (auto-set by Vercel, always publicly accessible)
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  // 3. Fallback to request headers
  return getBaseUrlFromRequest(req);
}
