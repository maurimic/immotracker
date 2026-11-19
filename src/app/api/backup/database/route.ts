import { NextResponse } from "next/server";
import { execSync } from "child_process";
import path from "path";
import fs from "fs";
import os from "os";
import { prisma } from "@/lib/prisma";

function getDatabasePath(): string | null {
  if (fs.existsSync("/data/immotracker.db")) {
    return "/data/immotracker.db";
  }

  const localPrismaDb = path.join(process.cwd(), "prisma", "dev.db");
  if (fs.existsSync(localPrismaDb)) {
    return localPrismaDb;
  }

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

export async function GET() {
  const dbPath = getDatabasePath();

  if (!dbPath || !fs.existsSync(dbPath)) {
    return NextResponse.json({ error: "SQLite-Datenbankdatei nicht gefunden" }, { status: 404 });
  }

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "immotracker-db-download-"));
  const tempDbPath = path.join(tempDir, "snapshot.db");

  try {
    let snapshotCreated = false;
    const normalizedDst = tempDbPath.replace(/\\/g, "/");

    // 1. Primär: Native SQLite VACUUM INTO über Prisma für konsistenten Live-Snapshot
    try {
      await prisma.$executeRawUnsafe(`VACUUM INTO '${normalizedDst}'`);
      if (fs.existsSync(tempDbPath) && fs.statSync(tempDbPath).size > 0) {
        snapshotCreated = true;
      }
    } catch (vacuumErr) {
      console.warn("VACUUM INTO fehlgeschlagen, versuche sqlite3 CLI:", vacuumErr);
    }

    // 2. Sekundär: sqlite3 CLI mit .backup
    if (!snapshotCreated) {
      try {
        const normalizedSrc = dbPath.replace(/\\/g, "/");
        execSync(`sqlite3 "${normalizedSrc}" ".backup '${normalizedDst}'"`, {
          stdio: "pipe",
          timeout: 10000,
        });
        if (fs.existsSync(tempDbPath) && fs.statSync(tempDbPath).size > 0) {
          snapshotCreated = true;
        }
      } catch (sqliteErr) {
        console.warn("sqlite3 CLI .backup fehlgeschlagen:", sqliteErr);
      }
    }

    // 3. Fallback: Direkte Dateikopie, falls weder VACUUM noch sqlite3 CLI funktioniert
    if (!snapshotCreated) {
      fs.copyFileSync(dbPath, tempDbPath);
    }

    const fileBuffer = fs.readFileSync(tempDbPath);
    const timestamp = new Date().toISOString().slice(0, 10);

    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/x-sqlite3",
        "Content-Disposition": `attachment; filename="immotracker-${timestamp}.db"`,
      },
    });
  } catch (err: any) {
    console.error("Fehler beim Erstellen des Datenbank-Snapshots:", err);
    return NextResponse.json(
      { error: "Fehler beim Erstellen des konsistenten Datenbank-Snapshots" },
      { status: 500 }
    );
  } finally {
    try {
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    } catch {}
  }
}
