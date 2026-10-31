import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { currentPeriod } from "@/lib/utils";
import { getRentForPeriod } from "@/lib/rent-history";
import { fetchLatestAccountBalance } from "@/lib/google-sheets";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Dashboard-Aggregation-API
 * Liefert alle KPIs für das Haupt-Dashboard
 */
export async function GET() {
  const [properties, payments, loans, tickets, rentAdjustments, accountBalanceSetting] =
    await Promise.all([
      prisma.property.findMany({
        include: {
          tenant: true,
          loans: true,
          rentAdjustments: {
            orderBy: { effectiveDate: "asc" },
          },
        },
      }),
      prisma.payment.findMany({
        where: { period: currentPeriod() },
        include: { tenant: true },
      }),
      prisma.loan.findMany({
        include: { property: true },
      }),
      prisma.maintenanceTicket.findMany({
        where: { status: { not: "DONE" } },
        include: { property: true },
        orderBy: { priority: "desc" },
        take: 10,
      }),
      prisma.rentAdjustment.findMany({
        where: {
          OR: [
            { effectiveDate: { gte: new Date() } },
            { reminderDate: { gte: new Date() } },
          ],
        },
        include: { property: true },
        orderBy: { effectiveDate: "asc" },
        take: 5,
      }),
      prisma.appSetting.findUnique({
        where: { key: "latest_account_balance" },
      }),
    ]);

  // ─── Kredit-KPIs ──────────────────────────────────────────────────────────

  const totalOriginal = loans.reduce((sum, l) => sum + l.originalAmount, 0);
  const totalBalance = loans.reduce((sum, l) => sum + l.currentBalance, 0);
  const totalRepaid = totalOriginal - totalBalance;

  const monthlyRate = (rate: number) => rate / 100 / 12;

  const totalMonthlyInterest = loans.reduce((sum, l) => {
    return sum + l.currentBalance * monthlyRate(l.interestRate);
  }, 0);

  const totalMonthlyPrincipal = loans.reduce((sum, l) => {
    const interest = l.currentBalance * monthlyRate(l.interestRate);
    return sum + Math.min(l.monthlyPayment - interest, l.currentBalance);
  }, 0);

  const totalMonthlyLoanPayment = loans.reduce(
    (sum, l) => sum + l.monthlyPayment,
    0
  );

  // ─── Miet-KPIs ────────────────────────────────────────────────────────────

  const totalSollRent = properties.reduce((sum, p) => {
    if (!p.tenant) return sum;
    return sum + p.tenant.coldRent + p.tenant.utilities;
  }, 0);

  const totalColdRent = properties.reduce((sum, p) => {
    if (!p.tenant) return sum;
    return sum + p.tenant.coldRent;
  }, 0);

  const totalIstRent = payments
    .filter((p) => p.category === "RENT")
    .reduce((sum, p) => sum + p.amount, 0);

  // ─── Cashflow ─────────────────────────────────────────────────────────────

  // Operativer Cashflow basiert betriebswirtschaftlich auf Kaltmiete abzüglich Kredit-Annuitäten (deckungsgleich mit Detail-Cashflow-Rechner)
  const netCashflow = totalColdRent - totalMonthlyLoanPayment;

  // ─── Kaufpreis & Rendite KPIs ─────────────────────────────────────────────

  const totalPurchasePrice = properties.reduce(
    (sum, p) => sum + (p.purchasePrice || 0),
    0
  );
  const totalAncillaryCosts = properties.reduce(
    (sum, p) => sum + (p.ancillaryCosts || 0),
    0
  );
  const totalInvestment = totalPurchasePrice + totalAncillaryCosts;
  const propertiesWithPrice = properties.filter(
    (p) => (p.purchasePrice || 0) > 0
  );

  const annualColdRent = totalColdRent * 12;
  const portfolioYield =
    totalPurchasePrice > 0 ? (annualColdRent / totalPurchasePrice) * 100 : 0;
  const portfolioMultiplier =
    annualColdRent > 0 && totalPurchasePrice > 0
      ? totalPurchasePrice / annualColdRent
      : 0;

  // ─── Echter Netto-Cashflow (nach Rücklagen & nicht-umlagefähigen Kosten) ───

  const totalReserves = properties.reduce((sum, p) => {
    return sum + (p.maintenanceReserve != null && p.maintenanceReserve > 0 ? p.maintenanceReserve : p.sqm * 1.20);
  }, 0);

  const totalNonRecoverable = properties.reduce((sum, p) => {
    return sum + (p.nonRecoverableCosts != null && p.nonRecoverableCosts > 0 ? p.nonRecoverableCosts : p.sqm * 0.35 + 25);
  }, 0);

  const realNetCashflow = totalColdRent - totalMonthlyLoanPayment - totalReserves - totalNonRecoverable;

  // ─── Zahlungsstatus je Wohnung ────────────────────────────────────────────

  const paymentStatus = properties.map((property) => {
    if (!property.tenant) {
      return {
        propertyId: property.id,
        propertyName: property.name,
        tenant: null,
        soll: 0,
        ist: 0,
        status: "NO_TENANT" as const,
      };
    }

    const now = new Date();
    const currentYm = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const propPoss = property.possessionAt || property.purchasedAt;
    const possYm = propPoss ? propPoss.toISOString().slice(0, 7) : null;
    const moveInYm = property.tenant.moveInDate ? property.tenant.moveInDate.toISOString().slice(0, 7) : null;
    const tStartYm = (moveInYm && possYm)
      ? (moveInYm > possYm ? moveInYm : possYm)
      : (moveInYm || possYm);

    if (tStartYm && tStartYm > currentYm) {
      return {
        propertyId: property.id,
        propertyName: property.name,
        tenant: {
          name: `${property.tenant.firstName} ${property.tenant.lastName}`,
        },
        soll: 0,
        ist: 0,
        status: "PENDING" as const,
      };
    }

    const resolvedRent = getRentForPeriod(
      property.tenant,
      currentYm,
      (property as any).rentAdjustments || []
    );
    const soll = resolvedRent.warmRent;

    // In der Mieteingangskontrolle darf NUR echte Miete (category === "RENT" und Betrag > 0) gezählt werden!
    // Reparaturkosten (REPAIR), Hausgeld, Kredite etc. dürfen keinesfalls von der Miete abgezogen werden.
    const ist = payments
      .filter(
        (p) =>
          p.category === "RENT" &&
          p.amount > 0 &&
          (p.tenantId === property.tenant!.id || p.propertyId === property.id)
      )
      .reduce((sum, p) => sum + p.amount, 0);

    let status: "PAID" | "PARTIAL" | "OVERDUE" | "PENDING";
    if (ist >= soll) status = "PAID";
    else if (ist > 0) status = "PARTIAL";
    else {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      let workingDays = 0;
      const cur = new Date(startOfMonth);
      while (cur <= now) {
        const d = cur.getDay();
        if (d !== 0 && d !== 6) workingDays++;
        cur.setDate(cur.getDate() + 1);
      }
      status = workingDays >= 5 ? "OVERDUE" : "PENDING";
    }

    return {
      propertyId: property.id,
      propertyName: property.name,
      tenant: {
        name: `${property.tenant.firstName} ${property.tenant.lastName}`,
      },
      soll,
      ist,
      status,
    };
  });

  // ─── Zinsbindungs-Ampel ───────────────────────────────────────────────────

  const now = new Date();
  const fixedRateStatus = loans.map((l) => {
    const months = Math.round(
      (l.fixedRateEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24 * 30)
    );
    return {
      loanId: l.id,
      propertyId: l.propertyId,
      propertyName: l.property?.name || "Wohnung",
      label: l.label,
      bank: l.bank,
      originalAmount: l.originalAmount,
      currentBalance: l.currentBalance,
      fixedRateEnd: l.fixedRateEnd,
      months,
      trafficLight:
        months < 0
          ? "RED"
          : months < 12
          ? "RED"
          : months < 36
          ? "YELLOW"
          : "GREEN",
    };
  });

  // ─── Kontostand aus Tabellenblatt "Kontostand" (Live oder aus Cache) ─────

  let accountBalance: { amount: number; date: string; formattedDate: string } | null = null;
  if (accountBalanceSetting) {
    try {
      accountBalance = JSON.parse(accountBalanceSetting.value);
    } catch {}
  }

  try {
    const livePromise = fetchLatestAccountBalance();
    const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 2500));
    const live = await Promise.race([livePromise, timeoutPromise]);
    if (live) {
      accountBalance = {
        amount: live.amount,
        date: live.date.toISOString(),
        formattedDate: live.formattedDate,
      };
      await prisma.appSetting.upsert({
        where: { key: "latest_account_balance" },
        create: {
          key: "latest_account_balance",
          value: JSON.stringify(accountBalance),
        },
        update: {
          value: JSON.stringify(accountBalance),
        },
      });
    }
  } catch (err) {
    // Bei Timeout oder Offline-Betrieb bleibt der gecachte Kontostand aktiv
  }

  // ─── Historische Cashflow-Daten (letzte 6 Monate) ────────────────────────

  const historicPayments = await prisma.payment.groupBy({
    by: ["period"],
    where: {
      category: "RENT",
      period: { not: null },
    },
    _sum: { amount: true },
    orderBy: { period: "desc" },
    take: 6,
  });

  return NextResponse.json({
    // Kredit-KPIs
    totalOriginal,
    totalBalance,
    totalRepaid,
    repaidPercent: totalOriginal > 0 ? (totalRepaid / totalOriginal) * 100 : 0,
    totalMonthlyInterest,
    totalMonthlyPrincipal,
    totalMonthlyLoanPayment,

    // Miet-KPIs
    totalSollRent,
    totalColdRent,
    totalIstRent,
    rentCollection: totalSollRent > 0 ? (totalIstRent / totalSollRent) * 100 : 0,

    // Cashflow
    netCashflow,
    realNetCashflow,
    totalReserves,
    totalNonRecoverable,

    // Per-Property
    paymentStatus,
    fixedRateStatus,

    // Warnungen
    openTickets: tickets,
    upcomingRentAdjustments: rentAdjustments,
    redFixedRates: fixedRateStatus.filter((f) => f.trafficLight === "RED"),
    overduePayments: paymentStatus.filter((p) => p.status === "OVERDUE"),

    // Kaufpreis- & Investitions-KPIs
    totalPurchasePrice,
    totalAncillaryCosts,
    totalInvestment,
    propertiesWithPriceCount: propertiesWithPrice.length,
    portfolioYield,
    portfolioMultiplier,

    // Google Sheets Kontostand
    accountBalance,

    // Historisch
    historicCashflow: historicPayments
      .reverse()
      .map((p) => ({ period: p.period, amount: p._sum.amount || 0 })),
  });
}
