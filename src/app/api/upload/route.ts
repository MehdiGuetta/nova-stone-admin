import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const MAX_BYTES = 5 * 1024 * 1024;

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

    const arrayBuffer = await file.arrayBuffer();
    const asset = await prisma.asset.create({
      data: {
        data: Buffer.from(arrayBuffer),
        mimeType: file.type || "application/octet-stream",
      },
    });

    return NextResponse.json({ url: `/api/assets/${asset.id}` });
  } catch (error: any) {
    console.error("Upload error:", error);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
