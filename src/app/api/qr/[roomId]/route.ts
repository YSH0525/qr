import { NextRequest, NextResponse } from "next/server";
import { generateQRCodeBuffer } from "@/lib/qr";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const { roomId } = await params;

  try {
    const buffer = await generateQRCodeBuffer(roomId);
    const uint8 = new Uint8Array(buffer);
    return new NextResponse(uint8, {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch {
    return NextResponse.json({ error: "QR 코드 생성 실패" }, { status: 500 });
  }
}
