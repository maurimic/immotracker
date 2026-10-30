import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await prisma.meterReading.delete({
      where: { id },
    });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const reading = await prisma.meterReading.update({
      where: { id },
      data: {
        value: body.value !== undefined ? parseFloat(body.value) : undefined,
        unit: body.unit !== undefined ? body.unit : undefined,
        type: body.type !== undefined ? body.type : undefined,
        readingDate: body.readingDate ? new Date(body.readingDate) : undefined,
        notes: body.notes !== undefined ? body.notes : undefined,
        propertyId: body.propertyId !== undefined ? body.propertyId : undefined,
      },
      include: { property: { select: { name: true } } },
    });
    return NextResponse.json(reading);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
