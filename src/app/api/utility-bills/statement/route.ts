import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * Generiert Nebenkostenabrechnungen für alle Wohnungen in einem Jahr
 * Umlage nach Flächenanteil (qm)
 */
export async function POST(request: Request) {
  const { searchParams } = new URL(request.url);
  const period = searchParams.get("period") || String(new Date().getFullYear() - 1);

  const [properties, bills] = await Promise.all([
    prisma.property.findMany({
      include: { tenants: true },
    }),
    prisma.utilityBill.findMany({
      where: { period, isAllocatable: true },
    }),
  ]);

  if (bills.length === 0) {
    return NextResponse.json({ error: "Keine umlegbaren Kosten für diesen Zeitraum gefunden" }, { status: 404 });
  }

  const totalSqm = properties.reduce((s, p) => s + p.sqm, 0);
  const totalAllocatableCosts = bills.reduce((s, b) => s + b.amount, 0);

  // Kategorien aufsummieren
  const costsByCategory: Record<string, number> = {};
  for (const bill of bills) {
    costsByCategory[bill.category] = (costsByCategory[bill.category] || 0) + bill.amount;
  }

  const statements = [];

  for (const property of properties) {
    const activeTenant = property.tenants?.find((t) => t.isCurrent);
    if (!activeTenant) continue;

    const share = property.sqm / totalSqm;
    const propertyShare = totalAllocatableCosts * share;

    // Vorauszahlungen berechnen
    const prepayments = await prisma.payment.aggregate({
      where: {
        tenantId: activeTenant.id,
        period: { startsWith: period },
        category: "RENT",
      },
      _sum: { amount: true },
    });

    // Nur NK-VZ (Vorauszahlung), nicht Kaltmiete
    const monthlyNKVZ = activeTenant.utilities;
    const annualPrepayments = monthlyNKVZ * 12;
    const balance = annualPrepayments - propertyShare;

    // Statement in DB speichern
    const statement = await prisma.utilityStatement.upsert({
      where: { id: `${property.id}-${period}` },
      create: {
        id: `${property.id}-${period}`,
        propertyId: property.id,
        period,
        totalCosts: propertyShare,
        prepayments: annualPrepayments,
        balance,
        lineItems: {
          create: Object.entries(costsByCategory).map(([category, total]) => ({
            category,
            totalCost: total,
            share: share * 100,
            amount: total * share,
          })),
        },
      },
      update: {
        totalCosts: propertyShare,
        prepayments: annualPrepayments,
        balance,
        generatedAt: new Date(),
      },
    });

    statements.push({
      property: property.name,
      tenant: `${activeTenant.firstName} ${activeTenant.lastName}`,
      sqm: property.sqm,
      share: (share * 100).toFixed(2),
      totalCosts: propertyShare,
      prepayments: annualPrepayments,
      balance,
    });
  }

  return NextResponse.json({ period, statements });
}
