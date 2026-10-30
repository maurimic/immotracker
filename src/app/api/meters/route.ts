import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const propertyId = searchParams.get("propertyId");

  const readings = await prisma.meterReading.findMany({
    where: propertyId ? { propertyId } : {},
    include: { property: { select: { name: true } } },
    orderBy: { readingDate: "desc" },
    take: 50,
  });
  return NextResponse.json(readings);
}

export async function POST(request: Request) {
  const body = await request.json();
  const reading = await prisma.meterReading.create({
    data: {
      propertyId: body.propertyId,
      type: body.type,
      value: parseFloat(body.value),
      unit: body.unit || "kWh",
      readingDate: new Date(body.readingDate),
      photoPath: body.photoPath,
      notes: body.notes,
    },
    include: { property: { select: { name: true } } },
  });
  return NextResponse.json(reading, { status: 201 });
}
