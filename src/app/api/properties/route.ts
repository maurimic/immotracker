import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const properties = await prisma.property.findMany({
    include: {
      tenant: true,
      loans: true,
      tickets: {
        where: { status: { not: "DONE" } },
        orderBy: { reportedAt: "desc" },
      },
      rentAdjustments: {
        orderBy: { effectiveDate: "asc" },
      },
      documents: true,
    },
    orderBy: { name: "asc" },
  });
  return NextResponse.json(properties);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const hasTenant = Boolean(
      (body.tenant && (body.tenant.firstName || body.tenant.lastName)) ||
      (body.tenantFirstName || body.tenantLastName)
    );

    const tenantInput = hasTenant
      ? {
          firstName: body.tenant?.firstName || body.tenantFirstName || "Unbekannt",
          lastName: body.tenant?.lastName || body.tenantLastName || "Mieter",
          email: body.tenant?.email || body.tenantEmail || null,
          phone: body.tenant?.phone || body.tenantPhone || null,
          iban: body.tenant?.iban || body.tenantIban || null,
          coldRent: parseFloat(body.tenant?.coldRent ?? body.tenantColdRent ?? 0),
          utilities: parseFloat(body.tenant?.utilities ?? body.tenantUtilities ?? 0),
          deposit: parseFloat(body.tenant?.deposit ?? body.tenantDeposit ?? 0),
          depositPaid: Boolean(body.tenant?.depositPaid ?? body.tenantDepositPaid ?? false),
          moveInDate: body.tenant?.moveInDate
            ? new Date(body.tenant.moveInDate)
            : body.tenantMoveInDate
            ? new Date(body.tenantMoveInDate)
            : null,
          contractStart: body.tenant?.contractStart
            ? new Date(body.tenant.contractStart)
            : body.tenantContractStart
            ? new Date(body.tenantContractStart)
            : null,
        }
      : null;

    const property = await prisma.property.create({
      data: {
        name: body.name,
        address: body.address,
        sqm: parseFloat(body.sqm),
        floor: body.floor || null,
        rooms: body.rooms ? parseFloat(body.rooms) : null,
        purchasePrice: body.purchasePrice !== undefined && body.purchasePrice !== "" && !isNaN(parseFloat(body.purchasePrice)) ? parseFloat(body.purchasePrice) : null,
        purchasedAt: body.purchasedAt ? new Date(body.purchasedAt) : null,
        possessionAt: body.possessionAt ? new Date(body.possessionAt) : null,
        ancillaryCosts: body.ancillaryCosts !== undefined && body.ancillaryCosts !== "" && !isNaN(parseFloat(body.ancillaryCosts)) ? parseFloat(body.ancillaryCosts) : null,
        nonRecoverableCosts: body.nonRecoverableCosts !== undefined && body.nonRecoverableCosts !== "" && !isNaN(parseFloat(body.nonRecoverableCosts)) ? parseFloat(body.nonRecoverableCosts) : null,
        maintenanceReserve: body.maintenanceReserve !== undefined && body.maintenanceReserve !== "" && !isNaN(parseFloat(body.maintenanceReserve)) ? parseFloat(body.maintenanceReserve) : null,
        ...(tenantInput ? { tenant: { create: tenantInput } } : {}),
      },
      include: {
        tenant: true,
        loans: true,
        tickets: true,
        rentAdjustments: true,
        documents: true,
      },
    });

    return NextResponse.json(property, { status: 201 });
  } catch (error: any) {
    console.error("Fehler beim Erstellen der Wohnung:", error);
    return NextResponse.json(
      { error: error?.message || "Fehler beim Erstellen der Wohnung" },
      { status: 500 }
    );
  }
}
