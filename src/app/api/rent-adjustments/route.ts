import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const propertyId = searchParams.get("propertyId");

    const adjustments = await prisma.rentAdjustment.findMany({
      where: propertyId ? { propertyId } : undefined,
      include: {
        property: {
          select: {
            id: true,
            name: true,
            address: true,
            tenants: {
              where: { isCurrent: true },
              take: 1,
              select: {
                id: true,
                firstName: true,
                lastName: true,
                coldRent: true,
                utilities: true,
              },
            },
          },
        },
      },
      orderBy: { effectiveDate: "desc" },
    });

    const mapped = adjustments.map((adj) => ({
      ...adj,
      property: {
        ...adj.property,
        tenant: adj.property.tenants?.[0] || null,
      },
    }));

    return NextResponse.json(mapped);
  } catch (error: any) {
    console.error("Fehler beim Abrufen der Mietanpassungen:", error);
    return NextResponse.json(
      { error: error?.message || "Fehler beim Abrufen" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    if (!body.propertyId) {
      return NextResponse.json(
        { error: "propertyId ist erforderlich" },
        { status: 400 }
      );
    }

    if (!body.effectiveDate) {
      return NextResponse.json(
        { error: "effectiveDate (Wirksamkeitsdatum) ist erforderlich" },
        { status: 400 }
      );
    }

    const effectiveDate = new Date(body.effectiveDate);
    const newColdRent = body.newColdRent !== undefined && body.newColdRent !== "" && body.newColdRent !== null
      ? parseFloat(body.newColdRent)
      : null;
    const newUtilities = body.newUtilities !== undefined && body.newUtilities !== "" && body.newUtilities !== null
      ? parseFloat(body.newUtilities)
      : null;
    const previousColdRent = body.previousColdRent !== undefined && body.previousColdRent !== "" && body.previousColdRent !== null
      ? parseFloat(body.previousColdRent)
      : null;
    const previousUtilities = body.previousUtilities !== undefined && body.previousUtilities !== "" && body.previousUtilities !== null
      ? parseFloat(body.previousUtilities)
      : null;

    const adjustment = await prisma.rentAdjustment.create({
      data: {
        propertyId: body.propertyId,
        effectiveDate,
        newColdRent,
        newUtilities,
        previousColdRent,
        previousUtilities,
        type: body.type || "NEBENKOSTEN",
        notes: body.notes || null,
        reminderDate: body.reminderDate ? new Date(body.reminderDate) : null,
      },
      include: {
        property: {
          select: {
            id: true,
            name: true,
            tenants: {
              where: { isCurrent: true },
              take: 1,
            },
          },
        },
      },
    });

    // Falls die Anpassung bereits wirksam ist (effectiveDate <= heute) und neue Werte angegeben wurden,
    // aktualisieren wir auch direkt die Stammdaten des aktuellen Mieters:
    const now = new Date();
    if (effectiveDate <= now && (newColdRent !== null || newUtilities !== null)) {
      const tenant = await prisma.tenant.findFirst({
        where: { propertyId: body.propertyId, isCurrent: true },
      });
      if (tenant) {
        await prisma.tenant.update({
          where: { id: tenant.id },
          data: {
            coldRent: newColdRent !== null ? newColdRent : tenant.coldRent,
            utilities: newUtilities !== null ? newUtilities : tenant.utilities,
          },
        });
      }
    }

    const resAdjustment = {
      ...adjustment,
      property: {
        ...adjustment.property,
        tenant: adjustment.property.tenants?.[0] || null,
      },
    };

    return NextResponse.json(resAdjustment, { status: 201 });
  } catch (error: any) {
    console.error("Fehler beim Erstellen der Mietanpassung:", error);
    return NextResponse.json(
      { error: error?.message || "Fehler beim Erstellen" },
      { status: 500 }
    );
  }
}
