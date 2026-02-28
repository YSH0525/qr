import QRCode from "qrcode";

export async function generateQRCodeDataURL(roomId: string): Promise<string> {
  const url = `${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"}/room/${roomId}`;
  return QRCode.toDataURL(url, {
    width: 400,
    margin: 2,
    errorCorrectionLevel: "H",
    color: { dark: "#000000", light: "#FFFFFF" },
  });
}

export async function generateQRCodeBuffer(roomId: string): Promise<Buffer> {
  const url = `${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"}/room/${roomId}`;
  return QRCode.toBuffer(url, {
    width: 400,
    margin: 2,
    errorCorrectionLevel: "H",
    color: { dark: "#000000", light: "#FFFFFF" },
  });
}
