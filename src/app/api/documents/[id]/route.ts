import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { unlink } from "fs/promises";
import path from "path";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  const { id } = await Promise.resolve(params);

  const doc = await prisma.document.findUnique({
    where: { id },
  });

  if (!doc) {
    return NextResponse.json({ error: "Dokument nicht gefunden" }, { status: 404 });
  }

  // Delete physical file if inside public/
  try {
    const fullPath = path.join(process.cwd(), "public", doc.filePath.replace(/^\//, ""));
    await unlink(fullPath);
  } catch {
    // Ignore error if physical file doesn't exist on disk
  }

  await prisma.document.delete({
    where: { id },
  });

  return NextResponse.json({ success: true });
}
