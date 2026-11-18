import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const key = searchParams.get("key");

    if (key) {
      const setting = await prisma.appSetting.findUnique({
        where: { key },
      });
      return NextResponse.json({
        key,
        value: setting ? setting.value : null,
      });
    }

    const settings = await prisma.appSetting.findMany({
      orderBy: { key: "asc" },
    });
    return NextResponse.json({ settings });
  } catch (error: any) {
    console.error("GET /api/settings error:", error);
    return NextResponse.json(
      { error: error?.message || "Fehler beim Laden der Einstellungen" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { key, value } = body;

    if (!key || typeof key !== "string") {
      return NextResponse.json(
        { error: "Parameter 'key' ist erforderlich." },
        { status: 400 }
      );
    }

    const stringValue = typeof value === "string" ? value : JSON.stringify(value);

    const setting = await prisma.appSetting.upsert({
      where: { key },
      create: { key, value: stringValue },
      update: { value: stringValue },
    });

    return NextResponse.json({
      success: true,
      key: setting.key,
      value: setting.value,
      updatedAt: setting.updatedAt,
    });
  } catch (error: any) {
    console.error("POST /api/settings error:", error);
    return NextResponse.json(
      { error: error?.message || "Fehler beim Speichern der Einstellungen" },
      { status: 500 }
    );
  }
}
