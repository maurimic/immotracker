import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { safeDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function GET() {
  const rawProperties = await prisma.property.findMany({
    include: {
      tenants: {
        orderBy: [{ isCurrent: "desc" }, { moveOutDate: "desc" }, { createdAt: "desc" }],
      },
      loans: true,
      tickets: {
        where: { status: { not: "DONE" } },
        orderBy: { reportedAt: "desc" },
      },
      rentAdjustments: {
        orderBy: { effectiveDate: "asc" },
      },
      documents: true,
      investments: {
        orderBy: { date: "desc" },
      },
    },
    orderBy: { name: "asc" },
  });

  const properties = rawProperties.map((p) => {
    const activeTenant = p.tenants?.find((t) => t.isCurrent) || null;
    const formerTenants = p.tenants?.filter((t) => !t.isCurrent) || [];
    return {
      ...p,
      tenant: activeTenant,
      formerTenants,
    };
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

    const parseOptFloat = (val: any) =>
      val !== undefined && val !== "" && val !== null && !isNaN(parseFloat(val))
        ? parseFloat(val)
        : null;

    const pTax = parseOptFloat(body.propertyTransferTax);
    const notary = parseOptFloat(body.notaryCosts);
    const landReg = parseOptFloat(body.landRegisterCosts);
    const broker = parseOptFloat(body.brokerCosts);
    const otherAnc = parseOptFloat(body.otherAncillaryCosts);
    const sumDetailed = (pTax || 0) + (notary || 0) + (landReg || 0) + (broker || 0) + (otherAnc || 0);
    const explicitAnc = parseOptFloat(body.ancillaryCosts);
    const totalAncillary = explicitAnc !== null ? explicitAnc : sumDetailed > 0 ? sumDetailed : null;

    const property = await prisma.property.create({
      data: {
        name: body.name,
        address: body.address,
        sqm: parseFloat(body.sqm),
        floor: body.floor || null,
        unitNumber: typeof body.unitNumber === "string" && body.unitNumber.trim() ? body.unitNumber.trim() : null,
        rooms: body.rooms ? parseFloat(body.rooms) : null,
        purchasePrice: parseOptFloat(body.purchasePrice),
        purchasedAt: body.purchasedAt ? safeDate(body.purchasedAt) : null,
        possessionAt: body.possessionAt ? safeDate(body.possessionAt) : null,
        ancillaryCosts: totalAncillary,
        propertyTransferTax: pTax,
        notaryCosts: notary,
        landRegisterCosts: landReg,
        brokerCosts: broker,
        otherAncillaryCosts: otherAnc,
        buildingSharePercent: body.buildingSharePercent !== undefined && body.buildingSharePercent !== "" && !isNaN(parseFloat(body.buildingSharePercent)) ? parseFloat(body.buildingSharePercent) : 80,
        nonRecoverableCosts: parseOptFloat(body.nonRecoverableCosts),
        maintenanceReserve: parseOptFloat(body.maintenanceReserve),
        ...(tenantInput ? { tenants: { create: [tenantInput] } } : {}),
      },
      include: {
        tenants: true,
        loans: true,
        tickets: true,
        rentAdjustments: true,
        documents: true,
        investments: true,
      },
    });

    const activeTenant = property.tenants?.find((t) => t.isCurrent) || null;
    const formerTenants = property.tenants?.filter((t) => !t.isCurrent) || [];

    return NextResponse.json({ ...property, tenant: activeTenant, formerTenants }, { status: 201 });
  } catch (error: any) {
    console.error("Fehler beim Erstellen der Wohnung:", error);
    return NextResponse.json(
      { error: error?.message || "Fehler beim Erstellen der Wohnung" },
      { status: 500 }
    );
  }
}
