import { NextResponse } from "next/server";
import path from "path";
import fs from "fs";

export async function GET() {
  let dbPath = "/data/immotracker.db";
  if (!fs.existsSync(dbPath)) {
    dbPath = path.join(process.cwd(), "prisma", "dev.db");
  }

  if (!fs.existsSync(dbPath)) {
    return NextResponse.json({ error: "SQLite-Datenbankdatei nicht gefunden" }, { status: 404 });
  }

  const fileBuffer = fs.readFileSync(dbPath);
  const timestamp = new Date().toISOString().slice(0, 10);

  return new NextResponse(fileBuffer, {
    status: 200,
    headers: {
      "Content-Type": "application/x-sqlite3",
      "Content-Disposition": `attachment; filename="immotracker-${timestamp}.db"`,
    },
  });
}
