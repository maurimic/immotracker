import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const property = await prisma.property.findUnique({
    where: { id: params.id },
    include: {
      tenant: true,
      loans: { include: { amortizations: { orderBy: { period: "desc" }, take: 12 } } },
      tickets: { orderBy: { reportedAt: "desc" } },
      meterReadings: { orderBy: { readingDate: "desc" }, take: 10 },
      rentAdjustments: { orderBy: { effectiveDate: "asc" } },
      documents: { orderBy: { uploadedAt: "desc" } },
    },
  });

  if (!property) {
    return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
  }

  return NextResponse.json(property);
}

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const property = await prisma.property.update({
      where: { id: params.id },
      data: {
        name: body.name,
        address: body.address,
        sqm: body.sqm ? parseFloat(body.sqm) : undefined,
        floor: body.floor !== undefined ? body.floor : undefined,
        rooms: body.rooms !== undefined ? (body.rooms ? parseFloat(body.rooms) : null) : undefined,
        purchasePrice: body.purchasePrice !== undefined ? (body.purchasePrice ? parseFloat(body.purchasePrice) : null) : undefined,
        purchasedAt: body.purchasedAt !== undefined ? (body.purchasedAt ? new Date(body.purchasedAt) : null) : undefined,
        possessionAt: body.possessionAt !== undefined ? (body.possessionAt ? new Date(body.possessionAt) : null) : undefined,
        ancillaryCosts: body.ancillaryCosts !== undefined ? (body.ancillaryCosts ? parseFloat(body.ancillaryCosts) : null) : undefined,
        nonRecoverableCosts: body.nonRecoverableCosts !== undefined ? (body.nonRecoverableCosts !== "" && !isNaN(parseFloat(body.nonRecoverableCosts)) ? parseFloat(body.nonRecoverableCosts) : null) : undefined,
        maintenanceReserve: body.maintenanceReserve !== undefined ? (body.maintenanceReserve !== "" && !isNaN(parseFloat(body.maintenanceReserve)) ? parseFloat(body.maintenanceReserve) : null) : undefined,
      },
      include: {
        tenant: true,
        loans: true,
        tickets: true,
        rentAdjustments: true,
        documents: true,
      },
    });
    return NextResponse.json(property);
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
      // 1. Find tenant if any
      const tenant = await tx.tenant.findUnique({
        where: { propertyId },
        select: { id: true },
      });

      if (tenant) {
        // Delete payments linked to this tenant
        await tx.payment.deleteMany({
          where: { tenantId: tenant.id },
        });
        // Delete tenant
        await tx.tenant.delete({
          where: { id: tenant.id },
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

      // 9. Delete property itself
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
