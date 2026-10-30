import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    await prisma.rentAdjustment.delete({
      where: { id },
    });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Fehler beim Löschen der Mietanpassung:", error);
    return NextResponse.json(
      { error: error?.message || "Fehler beim Löschen" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const body = await req.json();

    const updateData: any = {};
    if (body.effectiveDate) updateData.effectiveDate = new Date(body.effectiveDate);
    if (body.newColdRent !== undefined) updateData.newColdRent = body.newColdRent ? parseFloat(body.newColdRent) : null;
    if (body.newUtilities !== undefined) updateData.newUtilities = body.newUtilities ? parseFloat(body.newUtilities) : null;
    if (body.previousColdRent !== undefined) updateData.previousColdRent = body.previousColdRent ? parseFloat(body.previousColdRent) : null;
    if (body.previousUtilities !== undefined) updateData.previousUtilities = body.previousUtilities ? parseFloat(body.previousUtilities) : null;
    if (body.type !== undefined) updateData.type = body.type;
    if (body.notes !== undefined) updateData.notes = body.notes;

    const updated = await prisma.rentAdjustment.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json(updated);
  } catch (error: any) {
    console.error("Fehler beim Aktualisieren der Mietanpassung:", error);
    return NextResponse.json(
      { error: error?.message || "Fehler beim Aktualisieren" },
      { status: 500 }
    );
  }
}
