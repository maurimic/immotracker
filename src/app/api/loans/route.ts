import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { calculateCurrentBalanceFromTerms, calculateAmortization } from "@/lib/utils";

export async function GET() {
  const loans = await prisma.loan.findMany({
    include: {
      property: { select: { name: true, sqm: true } },
      amortizations: {
        orderBy: { period: "desc" },
        take: 24,
      },
    },
    orderBy: { propertyId: "asc" },
  });
  return NextResponse.json(loans);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const originalAmount = parseFloat(body.originalAmount);
    const interestRate = parseFloat(body.interestRate);
    const monthlyPayment = parseFloat(body.monthlyPayment);
    const startDate = new Date(body.startDate);
    const fixedRateEnd = new Date(body.fixedRateEnd);

    // Auto-calculate current balance if not specified
    let currentBalance: number;
    if (body.currentBalance !== undefined && body.currentBalance !== "" && !isNaN(parseFloat(body.currentBalance))) {
      currentBalance = parseFloat(body.currentBalance);
    } else {
      const calc = calculateCurrentBalanceFromTerms(originalAmount, interestRate, monthlyPayment, startDate);
      currentBalance = calc.balance;
    }

    const loan = await prisma.loan.create({
      data: {
        propertyId: body.propertyId,
        label: body.label || "Darlehen",
        bank: body.bank || null,
        originalAmount,
        currentBalance,
        interestRate,
        monthlyPayment,
        startDate,
        fixedRateEnd,
      },
      include: { property: { select: { name: true } } },
    });

    // Erzeuge vergangene Amortisationen für Verlauf (bis zu 24 Monate)
    const now = new Date();
    let curDate = new Date(startDate);
    let runBalance = originalAmount;
    const amortRecords = [];

    while (curDate <= now && runBalance > 0.01) {
      const period = `${curDate.getFullYear()}-${String(curDate.getMonth() + 1).padStart(2, "0")}`;
      const { interestPart, principalPart, newBalance } = calculateAmortization(
        runBalance,
        interestRate,
        monthlyPayment
      );
      amortRecords.push({
        loanId: loan.id,
        period,
        balanceBefore: runBalance,
        interestPart,
        principalPart,
        balanceAfter: newBalance,
      });
      runBalance = newBalance;
      curDate.setMonth(curDate.getMonth() + 1);
    }

    // Speichere die letzten 24 Perioden
    const recentAmorts = amortRecords.slice(-24);
    for (const record of recentAmorts) {
      await prisma.amortization.upsert({
        where: { loanId_period: { loanId: loan.id, period: record.period } },
        create: record,
        update: record,
      });
    }

    return NextResponse.json(loan, { status: 201 });
  } catch (error: any) {
    console.error("Fehler beim Erstellen des Darlehens:", error);
    return NextResponse.json(
      { error: error?.message || "Fehler beim Erstellen des Darlehens" },
      { status: 500 }
    );
  }
}
