import { NextResponse } from "next/server";
import sharp from "sharp";
import { prisma } from "@/lib/prisma";

const MAX_BYTES = 5 * 1024 * 1024;
const WEBP_QUALITY = 82;

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: "File too large (max 5MB)" }, { status: 400 });
    }

    const inputBuffer = Buffer.from(await file.arrayBuffer());

    let data = inputBuffer;
    let mimeType = file.type || "application/octet-stream";

    if (mimeType.startsWith("image/") && mimeType !== "image/webp") {
      try {
        data = await sharp(inputBuffer).webp({ quality: WEBP_QUALITY }).toBuffer();
        mimeType = "image/webp";
      } catch (error) {
        console.error("WebP conversion failed, storing original:", error);
      }
    }

    const asset = await prisma.asset.create({ data: { data, mimeType } });

    return NextResponse.json({ url: `/api/assets/${asset.id}` });
  } catch (error: any) {
    console.error("Upload error:", error);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
