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
    orderBy: [{ isCurrent: "desc" }, { lastName: "asc" }],
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

    const isCurrentTenant = body.isCurrent !== undefined ? Boolean(body.isCurrent) : true;

    // Check if property exists
    const property = await prisma.property.findUnique({
      where: { id: body.propertyId },
      include: { tenants: true },
    });

    if (!property) {
      return NextResponse.json(
        { error: "Wohnung nicht gefunden." },
        { status: 404 }
      );
    }

    const activeTenant = property.tenants?.find((t) => t.isCurrent);
    if (isCurrentTenant && activeTenant) {
      return NextResponse.json(
        { error: `Diese Wohnung hat bereits einen aktiven Mieter (${activeTenant.firstName} ${activeTenant.lastName}). Bitte beenden Sie zuerst das bestehende Mietverhältnis oder legen Sie den Mieter als Vormieter an.` },
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
        isCurrent: isCurrentTenant,
        coldRent: parseFloat(body.coldRent || 0),
        utilities: parseFloat(body.utilities || 0),
        deposit: parseFloat(body.deposit || 0),
        depositPaid: Boolean(body.depositPaid),
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
