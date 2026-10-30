import { NextResponse } from "next/server";
import path from "path";
import fs from "fs";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "Keine Datei hochgeladen" }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Verify SQLite header: first 16 bytes must start with "SQLite format 3"
    const header = buffer.subarray(0, 16).toString("utf-8");
    if (!header.startsWith("SQLite format 3")) {
      return NextResponse.json(
        { error: "Ungültige Datei: Es handelt sich nicht um eine gültige SQLite-3-Datenbank (Header-Signatur fehlt)" },
        { status: 400 }
      );
    }

    let targetDbPath = "/data/immotracker.db";
    if (!fs.existsSync("/data") && !fs.existsSync(targetDbPath)) {
      targetDbPath = path.join(process.cwd(), "prisma", "dev.db");
    }

    // Create automatic safety backup of current db before overwriting
    if (fs.existsSync(targetDbPath)) {
      const backupPath = `${targetDbPath}.safety_${Date.now()}.bak`;
      fs.copyFileSync(targetDbPath, backupPath);
    }

    // Write new DB
    fs.writeFileSync(targetDbPath, buffer);

    return NextResponse.json({
      success: true,
      message: "Datenbank erfolgreich wiederhergestellt. Daten sind sofort aktiv.",
    });
  } catch (error) {
    console.error("Restore failed:", error);
    return NextResponse.json({ error: "Wiederherstellung fehlgeschlagen" }, { status: 500 });
  }
}
