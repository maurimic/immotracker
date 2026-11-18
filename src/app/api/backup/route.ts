import { NextResponse } from "next/server";
import { execSync } from "child_process";
import path from "path";
import fs from "fs";
import os from "os";

function getBackupDir(): string {
  if (process.env.BACKUP_DIR) return process.env.BACKUP_DIR;
  if (fs.existsSync("/backups")) return "/backups";
  const localDir = path.join(process.cwd(), "backups");
  if (!fs.existsSync(localDir)) {
    fs.mkdirSync(localDir, { recursive: true });
  }
  return localDir;
}

function getDatabasePath(): string | null {
  // Docker Pfad
  if (fs.existsSync("/data/immotracker.db")) {
    return "/data/immotracker.db";
  }

  // Lokaler Pfad (prisma/dev.db)
  const localPrismaDb = path.join(process.cwd(), "prisma", "dev.db");
  if (fs.existsSync(localPrismaDb)) {
    return localPrismaDb;
  }

  // Fallback über DATABASE_URL
  if (process.env.DATABASE_URL) {
    const raw = process.env.DATABASE_URL.replace(/^file:/, "");
    if (path.isAbsolute(raw) && fs.existsSync(raw)) return raw;
    const resolvedPrisma = path.resolve(process.cwd(), "prisma", raw);
    if (fs.existsSync(resolvedPrisma)) return resolvedPrisma;
    const resolvedCwd = path.resolve(process.cwd(), raw);
    if (fs.existsSync(resolvedCwd)) return resolvedCwd;
  }

  return null;
}

function getUploadsPath(): string | null {
  if (fs.existsSync("/app/public/uploads")) {
    return "/app/public/uploads";
  }
  const localUploads = path.join(process.cwd(), "public", "uploads");
  if (fs.existsSync(localUploads)) {
    return localUploads;
  }
  return null;
}

export async function POST() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupDir = getBackupDir();
  const backupFile = path.join(backupDir, `immotracker-backup-${timestamp}.zip`);

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "immotracker-backup-"));

  try {
    const dbPath = getDatabasePath();
    const uploadsPath = getUploadsPath();
    const partsToZip: string[] = [];

    if (dbPath && fs.existsSync(dbPath)) {
      const dbFilename = path.basename(dbPath);
      const tempDbPath = path.join(tempDir, dbFilename);

      // Konsistente temporäre Kopie via sqlite3 .backup erstellen
      let consistentSuccess = false;
      try {
        const normalizedSrc = dbPath.replace(/\\/g, "/");
        const normalizedDst = tempDbPath.replace(/\\/g, "/");
        execSync(`sqlite3 "${normalizedSrc}" ".backup '${normalizedDst}'"`, {
          stdio: "pipe",
          timeout: 10000,
        });
        if (fs.existsSync(tempDbPath) && fs.statSync(tempDbPath).size > 0) {
          consistentSuccess = true;
        }
      } catch (sqliteErr) {
        console.warn(
          "sqlite3 CLI .backup fehlgeschlagen oder nicht verfügbar. Verwende Fallback-Kopie:",
          sqliteErr
        );
      }

      // Fallback falls sqlite3 CLI lokal nicht installiert ist (z. B. Windows-Entwicklung ohne sqlite3.exe)
      if (!consistentSuccess) {
        fs.copyFileSync(dbPath, tempDbPath);
      }

      partsToZip.push(tempDbPath);
    }

    if (uploadsPath && fs.existsSync(uploadsPath)) {
      partsToZip.push(uploadsPath);
    }

    if (partsToZip.length === 0) {
      return NextResponse.json({ error: "Keine Daten zum Sichern gefunden" }, { status: 500 });
    }

    if (process.platform === "win32") {
      const pathsArg = partsToZip.map((p) => `'${p}'`).join(", ");
      execSync(
        `powershell -NoProfile -Command "Compress-Archive -Path ${pathsArg} -DestinationPath '${backupFile}' -Force"`
      );
    } else {
      execSync(`zip -r "${backupFile}" ${partsToZip.map((p) => `"${p}"`).join(" ")} 2>&1`);
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
  } finally {
    try {
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    } catch {
      // ignore cleanup errors
    }
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
