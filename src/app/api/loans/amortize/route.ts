import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { calculateAmortization } from "@/lib/utils";

/**
 * Monatliche Restschuld-Fortschreibung für alle Darlehen
 * Wird per Cron oder manuell aufgerufen
 */
export async function POST() {
  const loans = await prisma.loan.findMany();
  const now = new Date();
  const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  let updated = 0;

  for (const loan of loans) {
    // Prüfe ob bereits berechnet
    const existing = await prisma.amortization.findUnique({
      where: { loanId_period: { loanId: loan.id, period } },
    });
    if (existing) continue;

    const { interestPart, principalPart, newBalance } = calculateAmortization(
      loan.currentBalance,
      loan.interestRate,
      loan.monthlyPayment
    );

    await prisma.$transaction([
      prisma.amortization.create({
        data: {
          loanId: loan.id,
          period,
          balanceBefore: loan.currentBalance,
          interestPart,
          principalPart,
          balanceAfter: newBalance,
        },
      }),
      prisma.loan.update({
        where: { id: loan.id },
        data: {
          currentBalance: newBalance,
          lastCalculatedAt: now,
        },
      }),
    ]);
    updated++;
  }

  return NextResponse.json({ updated, period });
}
