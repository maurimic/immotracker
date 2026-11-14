import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/utility-bills/statement
 * Ruft alle gespeicherten Mieter-Nebenkostenabrechnungen ab
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const period = searchParams.get("period");

    const where: any = {};
    if (period && period !== "ALL") {
      where.period = period;
    }

    const statements = await prisma.utilityStatement.findMany({
      where,
      include: {
        property: {
          select: {
            id: true,
            name: true,
            address: true,
            unitNumber: true,
            sqm: true,
            unitDetails: true,
          },
        },
        lineItems: true,
      },
      orderBy: { generatedAt: "desc" },
    });

    return NextResponse.json({ statements });
  } catch (err: any) {
    console.error("Error fetching utility statements:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/**
 * POST /api/utility-bills/statement
 * Speichert eine Mieter-Nebenkostenabrechnung mit allen BetrKV-Einzelpositionen
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      id,
      propertyId,
      subUnitKey,
      period,
      sqm,
      tenantName,
      tenantAddress,
      totalCosts,
      prepayments,
      balance,
      notes,
      detailsJson,
      items,
    } = body;

    if (!propertyId || !period) {
      return NextResponse.json(
        { error: "Wohnung und Abrechnungszeitraum sind erforderlich" },
        { status: 400 }
      );
    }

    const targetId = id || `${propertyId}-${subUnitKey || "MAIN"}-${period}`;

    // Transaktion: Vorherige Items löschen und Statement mit neuen Items anlegen/aktualisieren
    const statement = await prisma.$transaction(async (tx) => {
      // Existiert bereits?
      const existing = await tx.utilityStatement.findUnique({
        where: { id: targetId },
      });

      if (existing) {
        // Alte Line-Items löschen
        await tx.utilityStatementItem.deleteMany({
          where: { statementId: targetId },
        });

        // Statement aktualisieren
        return tx.utilityStatement.update({
          where: { id: targetId },
          data: {
            subUnitKey: subUnitKey || null,
            tenantName: tenantName || null,
            tenantAddress: tenantAddress || null,
            sqm: sqm ? Number(sqm) : null,
            period: String(period),
            totalCosts: Number(totalCosts) || 0,
            prepayments: Number(prepayments) || 0,
            balance: Number(balance) || 0,
            notes: notes || null,
            detailsJson: typeof detailsJson === "string" ? detailsJson : JSON.stringify(detailsJson || {}),
            generatedAt: new Date(),
            lineItems: {
              create: (items || []).map((it: any) => ({
                category: it.category || "OTHER",
                name: it.name || null,
                totalCost: Number(it.totalCost) || Number(it.amount) || 0,
                share: Number(it.share) || 100,
                distributionKey: it.distributionKey || null,
                amount: Number(it.amount) || 0,
              })),
            },
          },
          include: {
            property: true,
            lineItems: true,
          },
        });
      } else {
        // Neu anlegen
        return tx.utilityStatement.create({
          data: {
            id: targetId,
            propertyId,
            subUnitKey: subUnitKey || null,
            tenantName: tenantName || null,
            tenantAddress: tenantAddress || null,
            sqm: sqm ? Number(sqm) : null,
            period: String(period),
            totalCosts: Number(totalCosts) || 0,
            prepayments: Number(prepayments) || 0,
            balance: Number(balance) || 0,
            notes: notes || null,
            detailsJson: typeof detailsJson === "string" ? detailsJson : JSON.stringify(detailsJson || {}),
            lineItems: {
              create: (items || []).map((it: any) => ({
                category: it.category || "OTHER",
                name: it.name || null,
                totalCost: Number(it.totalCost) || Number(it.amount) || 0,
                share: Number(it.share) || 100,
                distributionKey: it.distributionKey || null,
                amount: Number(it.amount) || 0,
              })),
            },
          },
          include: {
            property: true,
            lineItems: true,
          },
        });
      }
    });

    return NextResponse.json({ success: true, statement });
  } catch (err: any) {
    console.error("Error saving utility statement:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/**
 * DELETE /api/utility-bills/statement?id=...
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Statement-ID erforderlich" }, { status: 400 });
    }

    await prisma.utilityStatement.delete({
      where: { id },
    });

    return NextResponse.json({ success: true, deletedId: id });
  } catch (err: any) {
    console.error("Error deleting utility statement:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
