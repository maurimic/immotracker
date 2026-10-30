import { NextResponse } from "next/server";
import path from "path";
import fs from "fs";

function getBackupDir(): string {
  if (process.env.BACKUP_DIR) return process.env.BACKUP_DIR;
  if (fs.existsSync("/backups")) return "/backups";
  return path.join(process.cwd(), "backups");
}

export async function GET(
  request: Request,
  { params }: { params: { filename: string } }
) {
  const backupDir = getBackupDir();
  const safeFilename = path.basename(params.filename);
  const filePath = path.join(backupDir, safeFilename);

  if (!fs.existsSync(filePath)) {
    return NextResponse.json({ error: "Backup-Datei nicht gefunden" }, { status: 404 });
  }

  const fileBuffer = fs.readFileSync(filePath);

  return new NextResponse(fileBuffer, {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${safeFilename}"`,
    },
  });
}
