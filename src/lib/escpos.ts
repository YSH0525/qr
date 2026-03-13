/**
 * 경량 ESC/POS 명령 생성기
 * 80mm 열감지 프린터용 (BLE 블루투스 프린터 대응)
 * EUC-KR 인코딩 지원 (한글 출력용)
 */

// ESC/POS 명령 상수
const ESC = 0x1b;
const GS = 0x1d;
const LF = 0x0a;

// --- EUC-KR 인코딩 테이블 ---
import { EUCKR_TABLE_B64 } from "./euckr-table";

let eucKrMap: Map<number, number> | null = null;

function getEucKrMap(): Map<number, number> {
  if (eucKrMap) return eucKrMap;
  eucKrMap = new Map();
  const bin = Uint8Array.from(atob(EUCKR_TABLE_B64), (c) => c.charCodeAt(0));
  for (let i = 0; i < bin.length; i += 4) {
    const unicode = (bin[i] << 8) | bin[i + 1];
    const euckr = (bin[i + 2] << 8) | bin[i + 3];
    eucKrMap.set(unicode, euckr);
  }
  return eucKrMap;
}

/** 문자열을 EUC-KR 바이트 배열로 인코딩 */
function encodeEucKr(text: string): Uint8Array {
  const map = getEucKrMap();
  const bytes: number[] = [];
  for (const ch of text) {
    const cp = ch.codePointAt(0)!;
    if (cp <= 0x7f) {
      bytes.push(cp);
    } else {
      const euckr = map.get(cp);
      if (euckr) {
        bytes.push((euckr >> 8) & 0xff, euckr & 0xff);
      } else {
        bytes.push(0x3f);
      }
    }
  }
  return new Uint8Array(bytes);
}

// --- 기본 명령 ---

/** 프린터 초기화 */
export function cmdInit(): Uint8Array {
  return new Uint8Array([ESC, 0x40]);
}

/** 한국어 코드페이지 설정 (FS & + FS C 3) */
export function cmdSetKorean(): Uint8Array {
  const FS = 0x1c;
  return new Uint8Array([
    FS, 0x26,       // FS & : 멀티바이트(CJK) 문자 모드 활성화
    FS, 0x43, 0x03, // FS C 3 : 한국어(KS C 5601) 코드페이지 선택
  ]);
}

/** 줄바꿈 */
export function cmdLF(lines = 1): Uint8Array {
  const arr = new Uint8Array(lines);
  arr.fill(LF);
  return arr;
}

/** 텍스트 정렬: 0=좌, 1=중앙, 2=우 */
export function cmdAlign(align: 0 | 1 | 2): Uint8Array {
  return new Uint8Array([ESC, 0x61, align]);
}

/** 강조 (볼드) on/off */
export function cmdBold(on: boolean): Uint8Array {
  return new Uint8Array([ESC, 0x45, on ? 1 : 0]);
}

/** 텍스트 크기: 0=일반, 1=2배폭, 16=2배높이, 17=2배폭+높이 */
export function cmdTextSize(size: 0 | 1 | 16 | 17): Uint8Array {
  return new Uint8Array([GS, 0x21, size]);
}

/** 용지 절단 (부분 절단) */
export function cmdCut(): Uint8Array {
  return new Uint8Array([GS, 0x56, 0x01]);
}

/** EUC-KR 인코딩된 텍스트를 바이트 배열로 변환 */
export function cmdText(text: string): Uint8Array {
  return encodeEucKr(text);
}

/** 구분선 (80mm 프린터 기준 32자 폭) */
export function cmdDashLine(char = "-", width = 32): Uint8Array {
  return encodeEucKr(char.repeat(width) + "\n");
}

/** 좌우 분할 텍스트 (key를 왼쪽, value를 오른쪽에 배치) */
export function cmdKeyValue(
  key: string,
  value: string,
  width = 32
): Uint8Array {
  const keyLen = getStringWidth(key);
  const valLen = getStringWidth(value);
  const spaceCount = Math.max(1, width - keyLen - valLen);
  return encodeEucKr(key + " ".repeat(spaceCount) + value + "\n");
}

// --- 헬퍼 ---

/** 한국어/영어 혼합 문자열의 출력 폭 계산 (한글=2칸, 영숫자=1칸) */
function getStringWidth(str: string): number {
  let width = 0;
  for (const ch of str) {
    const code = ch.charCodeAt(0);
    if (
      (code >= 0x1100 && code <= 0x11ff) ||
      (code >= 0x3000 && code <= 0x9fff) ||
      (code >= 0xac00 && code <= 0xd7af) ||
      (code >= 0xf900 && code <= 0xfaff) ||
      (code >= 0xff00 && code <= 0xff60)
    ) {
      width += 2;
    } else {
      width += 1;
    }
  }
  return width;
}

/** 여러 Uint8Array를 하나로 합치기 */
export function concatBytes(...arrays: Uint8Array[]): Uint8Array {
  const totalLength = arrays.reduce((sum, a) => sum + a.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const arr of arrays) {
    result.set(arr, offset);
    offset += arr.length;
  }
  return result;
}

// --- 영수증 변환 ---

interface SettlementItem {
  menuItemName: string;
  menuItemPrice: number;
  quantity: number;
  subtotal: number;
}

interface SettledOrder {
  orderId: string;
  totalAmount: number;
  createdAt: string;
  note: string | null;
  items: SettlementItem[];
}

interface SettledExtension {
  requestId: string;
  categoryName: string;
  extensionHours: number;
  extensionAmount: number;
  createdAt: string;
}

export interface SettlementData {
  settled: number;
  totalAmount: number;
  roomNumber: string;
  settledAt: string;
  orders: SettledOrder[];
  extensions?: SettledExtension[];
}

function formatPrice(n: number): string {
  return n.toLocaleString("ko-KR") + "원";
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  const date = `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
  const time = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  return `${date} ${time}`;
}

/** SettlementData를 ESC/POS 바이트 배열로 변환 */
export function buildSettlementReceipt(data: SettlementData): Uint8Array {
  const W = 32; // 80mm 프린터 기준 한 줄 글자 수

  const parts: Uint8Array[] = [];

  // 초기화 + 한국어 문자셋 설정
  parts.push(cmdInit());
  parts.push(cmdSetKorean());

  // 헤더
  parts.push(cmdAlign(1));
  parts.push(cmdBold(true));
  parts.push(cmdTextSize(17)); // 2배 크기
  parts.push(cmdText("정산내역서\n"));
  parts.push(cmdTextSize(0));
  parts.push(cmdBold(false));
  parts.push(cmdText("SETTLEMENT RECEIPT\n"));
  parts.push(cmdAlign(0));
  parts.push(cmdLF());
  parts.push(cmdDashLine("=", W));

  // 기본 정보
  parts.push(cmdKeyValue("객실", `${data.roomNumber}호`, W));
  parts.push(cmdKeyValue("정산일시", formatDateTime(data.settledAt), W));
  parts.push(cmdKeyValue("주문건수", `${data.settled}건`, W));
  parts.push(cmdDashLine("-", W));

  // 주문별 상세 내역
  for (let i = 0; i < data.orders.length; i++) {
    const order = data.orders[i];
    parts.push(cmdText(`#${order.orderId}\n`));
    parts.push(cmdText(`${formatDateTime(order.createdAt)}\n`));

    for (const item of order.items) {
      const name = `${item.menuItemName} x${item.quantity}`;
      parts.push(cmdKeyValue(name, formatPrice(item.subtotal), W));
    }

    if (order.note) {
      parts.push(cmdText(`* ${order.note}\n`));
    }

    parts.push(cmdDashLine(".", W));
    parts.push(cmdBold(true));
    parts.push(cmdKeyValue("소계", formatPrice(order.totalAmount), W));
    parts.push(cmdBold(false));

    if (i < data.orders.length - 1) {
      parts.push(cmdLF());
    }
  }

  // 체크아웃 연장
  if (data.extensions && data.extensions.length > 0) {
    parts.push(cmdDashLine("-", W));
    parts.push(cmdBold(true));
    parts.push(cmdText("체크아웃 연장\n"));
    parts.push(cmdBold(false));

    for (const ext of data.extensions) {
      parts.push(cmdText(`#${ext.requestId}\n`));
      parts.push(cmdText(`${formatDateTime(ext.createdAt)}\n`));
      const desc = `${ext.categoryName} +${ext.extensionHours}시간`;
      parts.push(cmdKeyValue(desc, formatPrice(ext.extensionAmount), W));
    }
  }

  // 합계
  parts.push(cmdDashLine("=", W));
  parts.push(cmdBold(true));
  parts.push(cmdTextSize(1)); // 2배폭
  parts.push(cmdKeyValue("합계", formatPrice(data.totalAmount), W));
  parts.push(cmdTextSize(0));
  parts.push(cmdBold(false));
  parts.push(cmdLF());
  parts.push(cmdKeyValue("결제방법", "후불결제", W));
  parts.push(cmdDashLine("-", W));

  // 푸터
  parts.push(cmdAlign(1));
  parts.push(cmdText("이용해 주셔서 감사합니다\n"));
  parts.push(cmdText("Thank you for your stay\n"));
  parts.push(cmdAlign(0));
  parts.push(cmdLF(4));

  // 용지 절단
  parts.push(cmdCut());

  return concatBytes(...parts);
}
