/**
 * 래스터 이미지 기반 ESC/POS 영수증 생성기
 * Canvas API로 텍스트를 비트맵으로 렌더링하여 프린터 문자 ROM 우회
 * 80mm 열감지 프린터용 (384 dots, 203 DPI)
 */

import {
  type SettlementData,
  concatBytes,
  cmdInit,
  cmdCut,
  cmdLF,
} from "./escpos";

// 80mm 프린터: 384 dots wide @ 203 DPI
const PRINTER_WIDTH = 384;
const BYTES_PER_ROW = PRINTER_WIDTH / 8; // 48
const BAND_HEIGHT = 200; // 밴드당 줄 수 (프린터 메모리 제한 대응)

// 폰트 설정
const FONT_FAMILY =
  '"Malgun Gothic", "Apple SD Gothic Neo", "Noto Sans KR", sans-serif';
const FONT_SIZE_NORMAL = 24;
const FONT_SIZE_LARGE = 48;
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

/** 영수증 데이터를 Canvas에 렌더링 */
function renderReceiptToCanvas(
  data: SettlementData
): { canvas: HTMLCanvasElement; usedHeight: number } {
  const canvas = document.createElement("canvas");
  canvas.width = PRINTER_WIDTH;
  canvas.height = 4000; // 충분히 크게 생성
  const ctx = canvas.getContext("2d")!;

  // 배경 흰색
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // 텍스트 검정
  ctx.fillStyle = "#000000";
  ctx.textBaseline = "top";

  const dc: DrawContext = { ctx, y: 8, width: PRINTER_WIDTH };

  // 헤더
  drawTextCentered(dc, "\uC815\uC0B0\uB0B4\uC5ED\uC11C", FONT_SIZE_LARGE, true);
  drawTextCentered(dc, "SETTLEMENT RECEIPT", FONT_SIZE_NORMAL, false);
  addSpacing(dc, 8);
  drawDashLine(dc, "=");

  // 기본 정보
  drawKeyValue(dc, "\uAC1D\uC2E4", `${data.roomNumber}\uD638`, FONT_SIZE_NORMAL, false);
  drawKeyValue(dc, "\uC815\uC0B0\uC77C\uC2DC", formatDateTime(data.settledAt), FONT_SIZE_NORMAL, false);
  drawKeyValue(dc, "\uC8FC\uBB38\uAC74\uC218", `${data.settled}\uAC74`, FONT_SIZE_NORMAL, false);
  drawDashLine(dc, "-");

  // 주문별 상세 내역
  for (let i = 0; i < data.orders.length; i++) {
    const order = data.orders[i];
    drawTextLeft(dc, `#${order.orderId}`, FONT_SIZE_NORMAL, false);
    drawTextLeft(dc, formatDateTime(order.createdAt), FONT_SIZE_NORMAL, false);

    for (const item of order.items) {
      const name = `${item.menuItemName} x${item.quantity}`;
      drawKeyValue(dc, name, formatPrice(item.subtotal), FONT_SIZE_NORMAL, false);
    }

    if (order.note) {
      drawTextLeft(dc, `* ${order.note}`, FONT_SIZE_NORMAL, false);
    }

    drawDashLine(dc, ".");
    drawKeyValue(dc, "\uC18C\uACC4", formatPrice(order.totalAmount), FONT_SIZE_NORMAL, true);

    if (i < data.orders.length - 1) {
      addSpacing(dc, FONT_SIZE_NORMAL * 0.5);
    }
  }

  // 체크아웃 연장
  if (data.extensions && data.extensions.length > 0) {
    drawDashLine(dc, "-");
    drawTextLeft(dc, "\uCCB4\uD06C\uC544\uC6C3 \uC5F0\uC7A5", FONT_SIZE_NORMAL, true);

    for (const ext of data.extensions) {
      drawTextLeft(dc, `#${ext.requestId}`, FONT_SIZE_NORMAL, false);
      drawTextLeft(dc, formatDateTime(ext.createdAt), FONT_SIZE_NORMAL, false);
      const desc = `${ext.categoryName} +${ext.extensionHours}\uC2DC\uAC04`;
      drawKeyValue(dc, desc, formatPrice(ext.extensionAmount), FONT_SIZE_NORMAL, false);
    }
  }

  // 합계
  drawDashLine(dc, "=");
  drawKeyValue(dc, "\uD569\uACC4", formatPrice(data.totalAmount), FONT_SIZE_NORMAL + 4, true);
  addSpacing(dc, 4);
  drawKeyValue(dc, "\uACB0\uC81C\uBC29\uBC95", "\uD6C4\uBD88\uACB0\uC81C", FONT_SIZE_NORMAL, false);
  drawDashLine(dc, "-");

  // 푸터
  drawTextCentered(dc, "\uC774\uC6A9\uD574 \uC8FC\uC154\uC11C \uAC10\uC0AC\uD569\uB2C8\uB2E4", FONT_SIZE_NORMAL, false);
  drawTextCentered(dc, "Thank you for your stay", FONT_SIZE_NORMAL, false);
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
  const pixels = imageData.data; // RGBA

  const bands: Uint8Array[] = [];

  for (let bandStart = 0; bandStart < usedHeight; bandStart += BAND_HEIGHT) {
    const bandEnd = Math.min(bandStart + BAND_HEIGHT, usedHeight);
    const bandH = bandEnd - bandStart;

    // GS v 0 헤더 (8 bytes)
    const header = new Uint8Array([
      GS,
      0x76,
      0x30,
      0x00, // m = 0 (normal)
      BYTES_PER_ROW & 0xff, // xL
      (BYTES_PER_ROW >> 8) & 0xff, // xH
      bandH & 0xff, // yL
      (bandH >> 8) & 0xff, // yH
    ]);

    // 비트맵 데이터: 1 bit per pixel, MSB first, 1=black
    const bitmapData = new Uint8Array(BYTES_PER_ROW * bandH);

    for (let row = 0; row < bandH; row++) {
      const absRow = bandStart + row;
      for (let col = 0; col < PRINTER_WIDTH; col++) {
        const pixIdx = (absRow * PRINTER_WIDTH + col) * 4;
        const r = pixels[pixIdx];
        const g = pixels[pixIdx + 1];
        const b = pixels[pixIdx + 2];
        // 밝기 계산 (가중 평균)
        const brightness = r * 0.299 + g * 0.587 + b * 0.114;
        if (brightness < 128) {
          // 검정 = bit 1
          const byteIdx = row * BYTES_PER_ROW + Math.floor(col / 8);
          const bitIdx = 7 - (col % 8); // MSB first
          bitmapData[byteIdx] |= 1 << bitIdx;
        }
      }
    }

    bands.push(concatBytes(header, bitmapData));
  }

  return concatBytes(...bands);
}

/** SettlementData를 래스터 이미지 기반 ESC/POS 바이트로 변환 */
export function buildSettlementReceiptRaster(
  data: SettlementData
): Uint8Array {
  const { canvas, usedHeight } = renderReceiptToCanvas(data);
  const rasterData = canvasToEscPosRaster(canvas, usedHeight);

  return concatBytes(cmdInit(), rasterData, cmdLF(4), cmdCut());
}
