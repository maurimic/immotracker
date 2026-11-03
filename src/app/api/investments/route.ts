import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const propertyId = searchParams.get("propertyId");

    const where: any = {};
    if (propertyId) {
      where.propertyId = propertyId;
    }

    const investments = await prisma.propertyInvestment.findMany({
      where,
      include: {
        property: {
          select: {
            id: true,
            name: true,
            address: true,
            purchasePrice: true,
            purchasedAt: true,
            possessionAt: true,
            buildingSharePercent: true,
          },
        },
      },
      orderBy: {
        date: "desc",
      },
    });

    return NextResponse.json(investments);
  } catch (error: any) {
    console.error("Fehler beim Abrufen der Investitionen:", error);
    return NextResponse.json(
      { error: error?.message || "Fehler beim Abrufen der Investitionen" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    if (!body.propertyId || !body.title || body.amount === undefined || body.amount === "") {
      return NextResponse.json(
        { error: "Wohnung, Bezeichnung und Betrag sind erforderlich." },
        { status: 400 }
      );
    }

    const gross = parseFloat(body.amount);
    if (isNaN(gross) || gross <= 0) {
      return NextResponse.json(
        { error: "Ungültiger Betrag angegeben." },
        { status: 400 }
      );
    }

    // Falls kein Nettobetrag angegeben wurde: Vorbelegung mit 19% USt-Abzug (Standard)
    const net = body.amountNet !== undefined && body.amountNet !== "" && !isNaN(parseFloat(body.amountNet))
      ? parseFloat(body.amountNet)
      : Math.round((gross / 1.19) * 100) / 100;

    const investment = await prisma.propertyInvestment.create({
      data: {
        propertyId: body.propertyId,
        title: body.title.trim(),
        description: body.description?.trim() || null,
        amount: gross,
        amountNet: net,
        date: body.date ? new Date(body.date) : new Date(),
        craftsman: body.craftsman?.trim() || null,
        category: body.category || "SANIERUNG",
        isCapitalized: body.isCapitalized !== undefined ? Boolean(body.isCapitalized) : true,
        relevantFor15Percent: body.relevantFor15Percent !== undefined ? Boolean(body.relevantFor15Percent) : true,
      },
      include: {
        property: {
          select: {
            id: true,
            name: true,
            address: true,
            purchasePrice: true,
            purchasedAt: true,
            possessionAt: true,
            buildingSharePercent: true,
          },
        },
      },
    });

    return NextResponse.json(investment, { status: 201 });
  } catch (error: any) {
    console.error("Fehler beim Erstellen der Investition:", error);
    return NextResponse.json(
      { error: error?.message || "Fehler beim Erstellen der Investition" },
      { status: 500 }
    );
  }
}
