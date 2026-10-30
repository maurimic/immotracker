import { NextResponse } from "next/server";
import { execSync } from "child_process";
import path from "path";
import fs from "fs";

function getBackupDir(): string {
  if (process.env.BACKUP_DIR) return process.env.BACKUP_DIR;
  if (fs.existsSync("/backups")) return "/backups";
  const localDir = path.join(process.cwd(), "backups");
  if (!fs.existsSync(localDir)) {
    fs.mkdirSync(localDir, { recursive: true });
  }
  return localDir;
}

function getDataPaths(): string[] {
  const paths: string[] = [];
  
  // Docker path
  if (fs.existsSync("/data/immotracker.db")) {
    paths.push("/data");
  } else if (fs.existsSync(path.join(process.cwd(), "prisma", "dev.db"))) {
    paths.push(path.join(process.cwd(), "prisma", "dev.db"));
  }

  // Uploads
  if (fs.existsSync("/app/public/uploads")) {
    paths.push("/app/public/uploads");
  } else if (fs.existsSync(path.join(process.cwd(), "public", "uploads"))) {
    paths.push(path.join(process.cwd(), "public", "uploads"));
  }

  return paths;
}

export async function POST() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupDir = getBackupDir();
  const backupFile = path.join(backupDir, `immotracker-backup-${timestamp}.zip`);

  try {
    const parts = getDataPaths();

    if (parts.length === 0) {
      return NextResponse.json({ error: "Keine Daten zum Sichern gefunden" }, { status: 500 });
    }

    if (process.platform === "win32") {
      const pathsArg = parts.map((p) => `'${p}'`).join(", ");
      execSync(`powershell -NoProfile -Command "Compress-Archive -Path ${pathsArg} -DestinationPath '${backupFile}' -Force"`);
    } else {
      execSync(`zip -r "${backupFile}" ${parts.map((p) => `"${p}"`).join(" ")} 2>&1`);
    }

    const stats = fs.statSync(backupFile);

    return NextResponse.json({
      success: true,
      file: path.basename(backupFile),
      size: stats.size,
      timestamp: new Date().toISOString(),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET() {
  const backupDir = getBackupDir();

  try {
    if (!fs.existsSync(backupDir)) {
      return NextResponse.json({ backups: [] });
    }

    const files = fs.readdirSync(backupDir)
      .filter((f) => f.endsWith(".zip"))
      .map((f) => {
        const stat = fs.statSync(path.join(backupDir, f));
        return {
          name: f,
          size: stat.size,
          created: stat.mtime.toISOString(),
        };
      })
      .sort((a, b) => new Date(b.created).getTime() - new Date(a.created).getTime());

    return NextResponse.json({ backups: files });
  } catch {
    return NextResponse.json({ backups: [] });
  }
}
