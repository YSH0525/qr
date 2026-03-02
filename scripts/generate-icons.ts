/**
 * PWA 아이콘 생성 스크립트
 * "ET" (Easy Tap) 로고를 프로그래밍적으로 생성
 *
 * Usage: npx tsx scripts/generate-icons.ts
 */

import { createCanvas } from "canvas";
import { writeFileSync } from "fs";
import { join } from "path";

const OUTPUT_DIR = join(__dirname, "..", "public", "icons");

interface IconConfig {
  size: number;
  filename: string;
  maskable: boolean;
}

const icons: IconConfig[] = [
  { size: 192, filename: "icon-192x192.png", maskable: false },
  { size: 512, filename: "icon-512x512.png", maskable: false },
  { size: 192, filename: "icon-maskable-192x192.png", maskable: true },
  { size: 512, filename: "icon-maskable-512x512.png", maskable: true },
  { size: 180, filename: "apple-touch-icon.png", maskable: false },
];

function generateIcon({ size, filename, maskable }: IconConfig) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext("2d");

  // Background
  const bgColor = "#111827"; // gray-900 (matches sidebar)

  if (maskable) {
    // Maskable icons: fill entire canvas, safe zone is inner 80%
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, size, size);
  } else {
    // Regular icons: rounded rectangle
    const radius = size * 0.18;
    ctx.fillStyle = bgColor;
    ctx.beginPath();
    ctx.moveTo(radius, 0);
    ctx.lineTo(size - radius, 0);
    ctx.quadraticCurveTo(size, 0, size, radius);
    ctx.lineTo(size, size - radius);
    ctx.quadraticCurveTo(size, size, size - radius, size);
    ctx.lineTo(radius, size);
    ctx.quadraticCurveTo(0, size, 0, size - radius);
    ctx.lineTo(0, radius);
    ctx.quadraticCurveTo(0, 0, radius, 0);
    ctx.closePath();
    ctx.fill();
  }

  // Text "ET"
  const fontSize = maskable ? size * 0.32 : size * 0.38;
  ctx.fillStyle = "#FFFFFF";
  ctx.font = `bold ${fontSize}px sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("ET", size / 2, size / 2);

  // Accent line (teal/emerald accent)
  const lineY = size / 2 + fontSize * 0.42;
  const lineWidth = size * 0.35;
  ctx.strokeStyle = "#10B981"; // emerald-500
  ctx.lineWidth = size * 0.025;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(size / 2 - lineWidth / 2, lineY);
  ctx.lineTo(size / 2 + lineWidth / 2, lineY);
  ctx.stroke();

  const buffer = canvas.toBuffer("image/png");
  const outputPath = join(OUTPUT_DIR, filename);
  writeFileSync(outputPath, buffer);
  console.log(`Generated: ${outputPath} (${size}x${size})`);
}

for (const icon of icons) {
  generateIcon(icon);
}

console.log("\nAll icons generated successfully!");
