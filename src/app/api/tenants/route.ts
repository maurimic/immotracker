import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const tenants = await prisma.tenant.findMany({
    include: {
      property: {
        select: {
          id: true,
          name: true,
          address: true,
          possessionAt: true,
          purchasedAt: true,
          rentAdjustments: {
            orderBy: { effectiveDate: "asc" },
          },
        },
      },
    },
    orderBy: { lastName: "asc" },
  });
  return NextResponse.json(tenants);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    if (!body.propertyId) {
      return NextResponse.json(
        { error: "Bitte eine Wohnung auswählen." },
        { status: 400 }
      );
    }

    // Check if property exists
    const property = await prisma.property.findUnique({
      where: { id: body.propertyId },
      include: { tenant: true },
    });

    if (!property) {
      return NextResponse.json(
        { error: "Wohnung nicht gefunden." },
        { status: 404 }
      );
    }

    if (property.tenant) {
      return NextResponse.json(
        { error: `Diese Wohnung hat bereits einen aktiven Mieter (${property.tenant.firstName} ${property.tenant.lastName}). Bitte beenden Sie zuerst das bestehende Mietverhältnis.` },
        { status: 400 }
      );
    }

    const tenant = await prisma.tenant.create({
      data: {
        propertyId: body.propertyId,
        firstName: body.firstName || "Unbekannt",
        lastName: body.lastName || "Mieter",
        email: body.email || null,
        phone: body.phone || null,
        iban: body.iban || null,
        coldRent: parseFloat(body.coldRent || 0),
        utilities: parseFloat(body.utilities || 0),
        deposit: parseFloat(body.deposit || 0),
        moveInDate: body.moveInDate ? new Date(body.moveInDate) : null,
        contractStart: body.contractStart ? new Date(body.contractStart) : null,
        moveOutDate: body.moveOutDate ? new Date(body.moveOutDate) : null,
      },
      include: { property: { select: { name: true } } },
    });

    return NextResponse.json(tenant, { status: 201 });
  } catch (error: any) {
    console.error("Fehler beim Erstellen des Mieters:", error);
    return NextResponse.json(
      { error: error?.message || "Fehler beim Erstellen des Mieters" },
      { status: 500 }
    );
  }
}
