import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { matchTransaction } from "@/lib/matching";
import { SheetRow } from "@/lib/google-sheets";

/**
 * POST /api/payments/rematch
 * Führt einen vollständigen Re-Match aller Bankbuchungen gegen die aktuellen Mieter & Wohnungen durch.
 * Korrigiert fehlerhafte Zuordnungen (z.B. nach Neuanlage von Mietern im selben Haus).
 */
export async function POST() {
  try {
    const [tenants, loans] = await Promise.all([
      prisma.tenant.findMany({
        include: { property: true },
      }),
      prisma.loan.findMany(),
    ]);

    const payments = await prisma.payment.findMany({
      where: {
        matchMethod: { not: "MANUAL" }, // Manuelle Zuweisungen durch den Nutzer bleiben geschützt
      },
      include: { tenant: true },
    });

    let updated = 0;
    let reassigned = 0;

    for (const p of payments) {
      const row: SheetRow = {
        rowIndex: 0,
        date: p.bookingDate,
        amount: p.amount,
        name: p.payerName,
        iban: p.payerIban || undefined,
        reference: p.reference || undefined,
      };

      const result = await matchTransaction(row, tenants, loans);
      const newTenantId = result.tenantId || null;
      const newPropertyId = result.propertyId || null;
      const newLoanId = result.loanId || null;
      const newCategory = result.category || p.category;
      const newStatus = (newTenantId || newLoanId || newPropertyId)
        ? "MATCHED"
        : newCategory === "OTHER"
        ? "MATCHED"
        : "MANUAL_REVIEW";

      // Prüfe ob sich die Zuordnung oder der Status geändert hat
      if (
        p.tenantId !== newTenantId ||
        p.propertyId !== newPropertyId ||
        p.loanId !== newLoanId ||
        p.status !== newStatus ||
        p.category !== newCategory
      ) {
        await prisma.payment.update({
          where: { id: p.id },
          data: {
            tenantId: newTenantId,
            propertyId: newPropertyId,
            loanId: newLoanId,
            category: newCategory,
            status: newStatus,
            matchMethod: result.method,
            matchConfidence: result.confidence,
          },
        });
        updated++;
        if (p.tenantId !== newTenantId || p.loanId !== newLoanId) {
          reassigned++;
        }
      }
    }

    return NextResponse.json({
      success: true,
      updated,
      reassigned,
      totalChecked: payments.length,
      tenantsCount: tenants.length,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
