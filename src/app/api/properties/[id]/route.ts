import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { safeDate, parseGermanNumber } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const property = await prisma.property.findUnique({
    where: { id: params.id },
    include: {
      tenants: {
        orderBy: [{ isCurrent: "desc" }, { moveOutDate: "desc" }, { createdAt: "desc" }],
      },
      loans: { include: { amortizations: { orderBy: { period: "desc" }, take: 12 } } },
      tickets: { orderBy: { reportedAt: "desc" } },
      meterReadings: { orderBy: { readingDate: "desc" }, take: 10 },
      rentAdjustments: { orderBy: { effectiveDate: "asc" } },
      documents: { orderBy: { uploadedAt: "desc" } },
      investments: { orderBy: { date: "desc" } },
    },
  });

  if (!property) {
    return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
  }

  const activeTenant = property.tenants?.find((t) => t.isCurrent) || null;
  const formerTenants = property.tenants?.filter((t) => !t.isCurrent) || [];

  return NextResponse.json({ ...property, tenant: activeTenant, formerTenants });
}

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();

    const parseOptFloat = (val: any) => {
      if (val === undefined) return undefined;
      if (val === "" || val === null) return null;
      const num = parseGermanNumber(val);
      return isNaN(num) ? null : num;
    };

    const pTax = parseOptFloat(body.propertyTransferTax);
    const notary = parseOptFloat(body.notaryCosts);
    const landReg = parseOptFloat(body.landRegisterCosts);
    const broker = parseOptFloat(body.brokerCosts);
    const otherAnc = parseOptFloat(body.otherAncillaryCosts);

    let explicitAnc = parseOptFloat(body.ancillaryCosts);
    if (
      explicitAnc === undefined &&
      (pTax !== undefined || notary !== undefined || landReg !== undefined || broker !== undefined || otherAnc !== undefined)
    ) {
      const sum = (pTax || 0) + (notary || 0) + (landReg || 0) + (broker || 0) + (otherAnc || 0);
      explicitAnc = sum > 0 ? sum : null;
    }

    const property = await prisma.property.update({
      where: { id: params.id },
      data: {
        name: body.name,
        address: body.address,
        sqm: body.sqm ? parseFloat(body.sqm) : undefined,
        floor: body.floor !== undefined ? body.floor : undefined,
        unitNumber: body.unitNumber !== undefined ? (typeof body.unitNumber === "string" && body.unitNumber.trim() ? body.unitNumber.trim() : null) : undefined,
        rooms: body.rooms !== undefined ? (body.rooms ? parseFloat(body.rooms) : null) : undefined,
        purchasePrice: body.purchasePrice !== undefined ? (body.purchasePrice ? parseFloat(body.purchasePrice) : null) : undefined,
        purchasedAt: body.purchasedAt !== undefined ? safeDate(body.purchasedAt) : undefined,
        possessionAt: body.possessionAt !== undefined ? safeDate(body.possessionAt) : undefined,
        ancillaryCosts: explicitAnc,
        propertyTransferTax: pTax,
        notaryCosts: notary,
        landRegisterCosts: landReg,
        brokerCosts: broker,
        otherAncillaryCosts: otherAnc,
        buildingSharePercent: body.buildingSharePercent !== undefined ? (body.buildingSharePercent !== "" && !isNaN(parseFloat(body.buildingSharePercent)) ? parseFloat(body.buildingSharePercent) : 80) : undefined,
        nonRecoverableCosts: body.nonRecoverableCosts !== undefined ? (body.nonRecoverableCosts !== "" && !isNaN(parseFloat(body.nonRecoverableCosts)) ? parseFloat(body.nonRecoverableCosts) : null) : undefined,
        maintenanceReserve: body.maintenanceReserve !== undefined ? (body.maintenanceReserve !== "" && !isNaN(parseFloat(body.maintenanceReserve)) ? parseFloat(body.maintenanceReserve) : null) : undefined,
      },
      include: {
        tenants: {
          orderBy: [{ isCurrent: "desc" }, { moveOutDate: "desc" }],
        },
        loans: true,
        tickets: true,
        rentAdjustments: true,
        documents: true,
        investments: { orderBy: { date: "desc" } },
      },
    });

    const activeTenant = property.tenants?.find((t) => t.isCurrent) || null;
    const formerTenants = property.tenants?.filter((t) => !t.isCurrent) || [];

    return NextResponse.json({ ...property, tenant: activeTenant, formerTenants });
  } catch (error: any) {
    console.error("Fehler beim Aktualisieren der Wohnung:", error);
    return NextResponse.json(
      { error: error?.message || "Fehler beim Aktualisieren der Wohnung" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: Request,
  ctx: { params: { id: string } }
) {
  return PUT(request, ctx);
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const propertyId = params.id;

    await prisma.$transaction(async (tx) => {
      // 1. Find tenants of this property if any
      const tenants = await tx.tenant.findMany({
        where: { propertyId },
        select: { id: true },
      });

      const tenantIds = tenants.map((t) => t.id);
      if (tenantIds.length > 0) {
        // Delete payments linked to these tenants
        await tx.payment.deleteMany({
          where: { tenantId: { in: tenantIds } },
        });
        // Delete tenants
        await tx.tenant.deleteMany({
          where: { id: { in: tenantIds } },
        });
      }

      // 2. Delete utility allocations for this property
      await tx.utilityAllocation.deleteMany({
        where: { propertyId },
      });

      // 3. Delete utility bills for this property
      await tx.utilityBill.deleteMany({
        where: { propertyId },
      });

      // 4. Delete documents
      await tx.document.deleteMany({
        where: { propertyId },
      });

      // 5. Delete rent adjustments
      await tx.rentAdjustment.deleteMany({
        where: { propertyId },
      });

      // 6. Delete meter readings
      await tx.meterReading.deleteMany({
        where: { propertyId },
      });

      // 7. Delete maintenance tickets
      await tx.maintenanceTicket.deleteMany({
        where: { propertyId },
      });

      // 8. Delete loans and their amortizations
      const loans = await tx.loan.findMany({
        where: { propertyId },
        select: { id: true },
      });
      for (const loan of loans) {
        await tx.amortization.deleteMany({ where: { loanId: loan.id } });
      }
      await tx.loan.deleteMany({
        where: { propertyId },
      });

      // 9. Delete investments
      await tx.propertyInvestment.deleteMany({
        where: { propertyId },
      });

      // 10. Delete property itself
      await tx.property.delete({
        where: { id: propertyId },
      });
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Fehler beim Löschen der Wohnung:", error);
    return NextResponse.json(
      { error: error?.message || "Fehler beim Löschen der Wohnung" },
      { status: 500 }
    );
  }
}
