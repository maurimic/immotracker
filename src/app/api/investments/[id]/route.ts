import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { safeDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const investment = await prisma.propertyInvestment.findUnique({
      where: { id: params.id },
      include: {
        property: true,
      },
    });

    if (!investment) {
      return NextResponse.json({ error: "Investition nicht gefunden" }, { status: 404 });
    }

    return NextResponse.json(investment);
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Fehler beim Abrufen der Investition" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();

    const gross = body.amount !== undefined ? parseFloat(body.amount) : undefined;
    const net = body.amountNet !== undefined && body.amountNet !== ""
      ? parseFloat(body.amountNet)
      : gross !== undefined
      ? Math.round((gross / 1.19) * 100) / 100
      : undefined;

    const updated = await prisma.propertyInvestment.update({
      where: { id: params.id },
      data: {
        title: body.title !== undefined ? body.title.trim() : undefined,
        description: body.description !== undefined ? (body.description ? body.description.trim() : null) : undefined,
        amount: gross !== undefined && !isNaN(gross) ? gross : undefined,
        amountNet: net !== undefined && !isNaN(net) ? net : undefined,
        date: body.date ? (safeDate(body.date) || undefined) : undefined,
        craftsman: body.craftsman !== undefined ? (body.craftsman ? body.craftsman.trim() : null) : undefined,
        category: body.category !== undefined ? body.category : undefined,
        isCapitalized: body.isCapitalized !== undefined ? Boolean(body.isCapitalized) : undefined,
        relevantFor15Percent: body.relevantFor15Percent !== undefined ? Boolean(body.relevantFor15Percent) : undefined,
        propertyId: body.propertyId || undefined,
      },
      include: {
        property: true,
      },
    });

    return NextResponse.json(updated);
  } catch (error: any) {
    console.error("Fehler beim Aktualisieren der Investition:", error);
    return NextResponse.json(
      { error: error?.message || "Fehler beim Aktualisieren der Investition" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    await prisma.propertyInvestment.delete({
      where: { id: params.id },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Fehler beim Löschen der Investition:", error);
    return NextResponse.json(
      { error: error?.message || "Fehler beim Löschen der Investition" },
      { status: 500 }
    );
  }
}
