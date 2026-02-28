import { NextRequest, NextResponse } from "next/server";
import { storage } from "@/lib/firebase";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { v4 as uuidv4 } from "uuid";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "파일이 없습니다" }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = new Uint8Array(bytes);

    const ext = file.name.split(".").pop() || "jpg";
    const fileName = `menu-images/${uuidv4()}.${ext}`;
    const storageRef = ref(storage, fileName);

    await uploadBytes(storageRef, buffer, {
      contentType: file.type,
    });

    const url = await getDownloadURL(storageRef);

    return NextResponse.json({ url });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "파일 업로드 실패";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
