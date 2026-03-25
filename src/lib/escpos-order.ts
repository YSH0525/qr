/**
 * 주문 접수 영수증 ESC/POS 래스터 생성기
 * 새 주문이 들어올 때 자동으로 프린터에 출력하기 위한 모듈
 * 80mm 열감지 프린터용 (384 dots, 203 DPI)
 */

import {
  concatBytes,
  cmdInit,
  cmdCut,
  cmdLF,
} from "./escpos";

import type { OrderWithItems } from "@/types";

// 80mm 프린터: 384 dots wide @ 203 DPI
const PRINTER_WIDTH = 384;
const BYTES_PER_ROW = PRINTER_WIDTH / 8; // 48
const BAND_HEIGHT = 200;

// 폰트 설정
const FONT_FAMILY =
  '"Malgun Gothic", "Apple SD Gothic Neo", "Noto Sans KR", sans-serif';
const FONT_SIZE_NORMAL = 24;
const FONT_SIZE_LARGE = 48;
const FONT_SIZE_SMALL = 20;
const LINE_HEIGHT = 1.4;
const MARGIN_X = 4;

// GS v 0 래스터 명령
const GS = 0x1d;

interface DrawContext {
  ctx: CanvasRenderingContext2D;
  y: number;
  width: number;
}

function setFont(
  ctx: CanvasRenderingContext2D,
  size: number,
  bold: boolean
): void {
  ctx.font = `${bold ? "bold " : ""}${size}px ${FONT_FAMILY}`;
}

function drawTextCentered(dc: DrawContext, text: string, size: number, bold: boolean): void {
  setFont(dc.ctx, size, bold);
  const metrics = dc.ctx.measureText(text);
  const x = (dc.width - metrics.width) / 2;
  dc.ctx.fillText(text, x, dc.y);
  dc.y += size * LINE_HEIGHT;
}

function drawTextLeft(dc: DrawContext, text: string, size: number, bold: boolean): void {
  setFont(dc.ctx, size, bold);
  dc.ctx.fillText(text, MARGIN_X, dc.y);
  dc.y += size * LINE_HEIGHT;
}

function drawKeyValue(
  dc: DrawContext,
  key: string,
  value: string,
  size: number,
  bold: boolean
): void {
  setFont(dc.ctx, size, bold);
  dc.ctx.fillText(key, MARGIN_X, dc.y);
  const valWidth = dc.ctx.measureText(value).width;
  dc.ctx.fillText(value, dc.width - MARGIN_X - valWidth, dc.y);
  dc.y += size * LINE_HEIGHT;
}

function drawDashLine(dc: DrawContext, char: string): void {
  setFont(dc.ctx, FONT_SIZE_NORMAL, false);
  const charWidth = dc.ctx.measureText(char).width;
  const count = Math.floor((dc.width - MARGIN_X * 2) / charWidth);
  const line = char.repeat(count);
  dc.ctx.fillText(line, MARGIN_X, dc.y);
  dc.y += FONT_SIZE_NORMAL * LINE_HEIGHT;
}

function addSpacing(dc: DrawContext, px: number): void {
  dc.y += px;
}

function formatPrice(n: number): string {
  return n.toLocaleString("ko-KR") + "\uC6D0";
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  const date = `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
  const time = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  return `${date} ${time}`;
}

const ORDER_TYPE_LABELS: Record<string, string> = {
  product: "\uC8FC\uBB38",
  cleaning: "\uC5F0\uBC15 \uCCAD\uC18C",
  checkout_extension: "\uCCB4\uD06C\uC544\uC6C3 \uC5F0\uC7A5",
  amenity: "\uBE44\uD488 \uC694\uCCAD",
};

/** 주문 영수증을 Canvas에 렌더링 */
function renderOrderReceiptToCanvas(
  order: OrderWithItems,
  hotelName: string
): { canvas: HTMLCanvasElement; usedHeight: number } {
  const canvas = document.createElement("canvas");
  canvas.width = PRINTER_WIDTH;
  canvas.height = 3000;
  const ctx = canvas.getContext("2d")!;

  // 배경 흰색
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // 텍스트 검정
  ctx.fillStyle = "#000000";
  ctx.textBaseline = "top";

  const dc: DrawContext = { ctx, y: 8, width: PRINTER_WIDTH };

  // 헤더
  drawTextCentered(dc, "\uC8FC\uBB38\uC811\uC218\uC11C", FONT_SIZE_LARGE, true);
  drawTextCentered(dc, "ORDER RECEIPT", FONT_SIZE_NORMAL, false);
  addSpacing(dc, 8);
  drawDashLine(dc, "=");

  // 호텔명
  if (hotelName) {
    drawTextCentered(dc, hotelName, FONT_SIZE_NORMAL, false);
    addSpacing(dc, 4);
  }

  // 기본 정보
  drawKeyValue(dc, "\uC8FC\uBB38\uBC88\uD638", order.orderId, FONT_SIZE_NORMAL, true);
  drawKeyValue(dc, "\uAC1D\uC2E4", `${order.roomNumber}\uD638`, FONT_SIZE_NORMAL, false);
  drawKeyValue(dc, "\uC8FC\uBB38\uC720\uD615", ORDER_TYPE_LABELS[order.type] || order.type, FONT_SIZE_NORMAL, false);
  drawKeyValue(dc, "\uC8FC\uBB38\uC77C\uC2DC", formatDateTime(order.createdAt), FONT_SIZE_NORMAL, false);

  if (order.dailySeq) {
    drawKeyValue(dc, "\uC21C\uBC88", `#${order.dailySeq}`, FONT_SIZE_NORMAL, false);
  }

  drawDashLine(dc, "-");

  // 주문 항목
  if (order.type === "product" && order.items.length > 0) {
    for (const item of order.items) {
      const name = `${item.menuItemName} x${item.quantity}`;
      drawKeyValue(dc, name, formatPrice(item.subtotal), FONT_SIZE_NORMAL, false);
    }
  }

  // 서비스 항목
  if (order.serviceItems && order.serviceItems.length > 0) {
    for (const item of order.serviceItems) {
      drawTextLeft(dc, `${item.name} x${item.quantity}`, FONT_SIZE_NORMAL, false);
    }
  }

  // 청소 옵션
  if (order.type === "cleaning" && order.cleaningOptions) {
    const co = order.cleaningOptions;
    drawTextLeft(dc, `\uCCAD\uC18C \uC218\uC900: ${co.serviceLevel}`, FONT_SIZE_NORMAL, false);
    if (co.preferredTime) {
      drawTextLeft(dc, `\uD76C\uB9DD \uC2DC\uAC04: ${co.preferredTime}`, FONT_SIZE_NORMAL, false);
    }
    if (!co.linenChange) {
      drawTextLeft(dc, "\uC2DC\uD2B8\uAD50\uCCB4: \uC5C6\uC74C", FONT_SIZE_NORMAL, false);
    }
  }

  // 체크아웃 연장
  if (order.type === "checkout_extension" && order.extensionHours) {
    drawTextLeft(dc, `\uC5F0\uC7A5: +${order.extensionHours}\uC2DC\uAC04`, FONT_SIZE_NORMAL, false);
    if (order.extensionAmount) {
      drawKeyValue(dc, "\uC5F0\uC7A5 \uC694\uAE08", formatPrice(order.extensionAmount), FONT_SIZE_NORMAL, false);
    }
    if (order.freeExtension) {
      drawTextLeft(dc, "(\uBB34\uB8CC \uC5F0\uC7A5)", FONT_SIZE_NORMAL, false);
    }
  }

  // 요청사항
  if (order.note) {
    drawDashLine(dc, ".");
    drawTextLeft(dc, `\uC694\uCCAD\uC0AC\uD56D: ${order.note}`, FONT_SIZE_NORMAL, false);
  }

  // 합계
  if (order.totalAmount > 0) {
    drawDashLine(dc, "=");
    drawKeyValue(dc, "\uD569\uACC4", formatPrice(order.totalAmount), FONT_SIZE_NORMAL + 4, true);
    addSpacing(dc, 4);
    if (order.paymentMethod === "deferred") {
      drawKeyValue(dc, "\uACB0\uC81C\uBC29\uBC95", "\uD6C4\uBD88\uACB0\uC81C", FONT_SIZE_NORMAL, false);
    }
  }

  drawDashLine(dc, "-");

  // 푸터
  addSpacing(dc, 8);
  drawTextCentered(dc, "\uC2E0\uC18D\uD558\uAC8C \uC900\uBE44\uD574 \uC8FC\uC138\uC694!", FONT_SIZE_SMALL, false);
  addSpacing(dc, FONT_SIZE_NORMAL * 2);

  return { canvas, usedHeight: Math.ceil(dc.y) };
}

/** Canvas 비트맵을 ESC/POS GS v 0 래스터 바이트로 변환 */
function canvasToEscPosRaster(
  canvas: HTMLCanvasElement,
  usedHeight: number
): Uint8Array {
  const ctx = canvas.getContext("2d")!;
  const imageData = ctx.getImageData(0, 0, PRINTER_WIDTH, usedHeight);
  const pixels = imageData.data;

  const bands: Uint8Array[] = [];

  for (let bandStart = 0; bandStart < usedHeight; bandStart += BAND_HEIGHT) {
    const bandEnd = Math.min(bandStart + BAND_HEIGHT, usedHeight);
    const bandH = bandEnd - bandStart;

    const header = new Uint8Array([
      GS,
      0x76,
      0x30,
      0x00,
      BYTES_PER_ROW & 0xff,
      (BYTES_PER_ROW >> 8) & 0xff,
      bandH & 0xff,
      (bandH >> 8) & 0xff,
    ]);

    const bitmapData = new Uint8Array(BYTES_PER_ROW * bandH);

    for (let row = 0; row < bandH; row++) {
      const absRow = bandStart + row;
      for (let col = 0; col < PRINTER_WIDTH; col++) {
        const pixIdx = (absRow * PRINTER_WIDTH + col) * 4;
        const r = pixels[pixIdx];
        const g = pixels[pixIdx + 1];
        const b = pixels[pixIdx + 2];
        const brightness = r * 0.299 + g * 0.587 + b * 0.114;
        if (brightness < 128) {
          const byteIdx = row * BYTES_PER_ROW + Math.floor(col / 8);
          const bitIdx = 7 - (col % 8);
          bitmapData[byteIdx] |= 1 << bitIdx;
        }
      }
    }

    bands.push(concatBytes(header, bitmapData));
  }

  return concatBytes(...bands);
}

/** OrderWithItems를 래스터 이미지 기반 ESC/POS 바이트로 변환 */
export function buildOrderReceiptRaster(
  order: OrderWithItems,
  hotelName = ""
): Uint8Array {
  const { canvas, usedHeight } = renderOrderReceiptToCanvas(order, hotelName);
  const rasterData = canvasToEscPosRaster(canvas, usedHeight);

  return concatBytes(cmdInit(), rasterData, cmdLF(4), cmdCut());
}
