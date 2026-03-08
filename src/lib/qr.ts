import QRCode from "qrcode";
import { BASE_URL } from "@/lib/constants";

export async function generateQRCodeDataURL(roomId: string): Promise<string> {
  const url = `${BASE_URL}/room/${roomId}`;
  return QRCode.toDataURL(url, {
    width: 400,
    margin: 2,
    errorCorrectionLevel: "H",
    color: { dark: "#000000", light: "#FFFFFF" },
  });
}

export async function generateQRCodeBuffer(roomId: string): Promise<Buffer> {
  const url = `${BASE_URL}/room/${roomId}`;
  return QRCode.toBuffer(url, {
    width: 400,
    margin: 2,
    errorCorrectionLevel: "H",
    color: { dark: "#000000", light: "#FFFFFF" },
  });
}
