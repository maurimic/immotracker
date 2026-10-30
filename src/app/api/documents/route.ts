import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const propertyId = searchParams.get("propertyId");

  const where: Record<string, unknown> = {};
  if (propertyId) where.propertyId = propertyId;

  const docs = await prisma.document.findMany({
    where,
    orderBy: { uploadedAt: "desc" },
    include: { property: { select: { name: true } } },
  });

  return NextResponse.json(docs);
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const propertyId = formData.get("propertyId") as string;
    const name = formData.get("name") as string;
    const type = (formData.get("type") as string) || "OTHER";

    if (!file || !propertyId) {
      return NextResponse.json(
        { error: "Datei und Wohnung (propertyId) sind erforderlich" },
        { status: 400 }
      );
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Sanitize and create unique filename
    const safeBaseName = (name || file.name).replace(/[^a-zA-Z0-9._-]/g, "_");
    const uniqueSuffix = `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const ext = path.extname(file.name) || ".pdf";
    const storedFileName = `${uniqueSuffix}_${safeBaseName.replace(/\.[^/.]+$/, "")}${ext}`;

    const uploadDir = path.join(process.cwd(), "public", "uploads", "documents");
    await mkdir(uploadDir, { recursive: true });

    const filePath = path.join(uploadDir, storedFileName);
    await writeFile(filePath, buffer);

    const relativeWebPath = `/uploads/documents/${storedFileName}`;

    const doc = await prisma.document.create({
      data: {
        propertyId,
        name: name || file.name,
        type,
        filePath: relativeWebPath,
        fileSize: buffer.length,
        mimeType: file.type || "application/pdf",
      },
      include: { property: { select: { name: true } } },
    });

    return NextResponse.json(doc, { status: 201 });
  } catch (error) {
    console.error("Document upload failed:", error);
    return NextResponse.json({ error: "Fehler beim Datei-Upload" }, { status: 500 });
  }
}
