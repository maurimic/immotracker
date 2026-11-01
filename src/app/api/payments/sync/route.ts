import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  fetchSheetTransactions,
  fetchLatestAccountBalance,
  testGoogleSheetsConnection,
} from "@/lib/google-sheets";
import { matchTransaction, detectPaymentPeriod } from "@/lib/matching";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * GET /api/payments/sync
 * Prüft den Google Sheets Verbindungsstatus
 */
export async function GET() {
  try {
    const status = await testGoogleSheetsConnection();
    return NextResponse.json(status);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      {
        success: false,
        error: message,
        spreadsheetId:
          process.env.GOOGLE_SHEETS_ID ||
          process.env.GOOGLE_SPREADSHEET_ID ||
          "1GslK8LFx_Day6hjEcQnEY_nmX06KuJwRRdqVr1ph8HU",
        sheetName: process.env.GOOGLE_SHEET_NAME || "Kontobewegung",
        serviceAccountEmail:
          process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL ||
          "immobiliendashboard@n8n-self-host-458810.iam.gserviceaccount.com",
      },
      { status: 200 }
    );
  }
}

/**
 * POST /api/payments/sync
 * Synchronisiert Buchungen aus Google Sheets und matched sie automatisch
 */
export async function POST() {
  const [tenants, loans] = await Promise.all([
    prisma.tenant.findMany({ include: { property: true } }),
    prisma.loan.findMany(),
  ]);

  let rows;
  try {
    rows = await fetchSheetTransactions();
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }

  let imported = 0;
  let skipped = 0;
  let matched = 0;
  let aiUsed = 0;

  for (const row of rows) {
    // Stabile ID über Referenz (externalId) oder Fallback auf Zeilennummer
    const primaryId = row.externalId ? `ref-${row.externalId}` : `sheets-${row.rowIndex}`;
    const legacyId = `sheets-${row.rowIndex}`;

    // Prüfe ob bereits importiert (entweder per Referenz oder alter Zeilen-ID)
    const existing = await prisma.payment.findFirst({
      where: {
        OR: [
          { sheetsRowId: primaryId },
          { sheetsRowId: legacyId },
        ],
      },
    });
    if (existing) {
      skipped++;
      continue;
    }

    const result = await matchTransaction(row, tenants, loans);
    if (result.method === "AI") aiUsed++;
    if (result.tenantId || result.loanId) matched++;

    const matchedTenant = result.tenantId ? tenants.find((t) => t.id === result.tenantId) : null;
    let period = `${row.date.getFullYear()}-${String(row.date.getMonth() + 1).padStart(2, "0")}`;
    if (result.category === "RENT" && result.tenantId) {
      const existingInMonth = await prisma.payment.count({
        where: {
          tenantId: result.tenantId,
          category: "RENT",
          period,
        },
      });
      period = detectPaymentPeriod(row.date, row.reference, existingInMonth, matchedTenant?.moveInDate);
    } else {
      period = detectPaymentPeriod(row.date, row.reference, 0, matchedTenant?.moveInDate);
    }

    await prisma.payment.create({
      data: {
        tenantId: result.tenantId || null,
        propertyId: result.propertyId || null,
        loanId: result.loanId || null,
        bookingDate: row.date,
        amount: row.amount,
        payerName: row.name,
        payerIban: row.iban || null,
        reference: row.reference || null,
        matchMethod: result.method,
        matchConfidence: result.confidence,
        aiRawResponse: result.aiRawResponse || null,
        category: result.category,
        status: (result.tenantId || result.loanId || result.propertyId)
          ? "MATCHED"
          : result.category === "OTHER"
          ? "MATCHED"
          : "MANUAL_REVIEW",
        period,
        sheetsRowId: primaryId,
      },
    });

    imported++;
  }

  // Kontostand aus Tabellenblatt "Kontostand" aktualisieren & cachen
  let latestBalance = null;
  try {
    const bal = await fetchLatestAccountBalance();
    if (bal) {
      latestBalance = {
        amount: bal.amount,
        date: bal.date.toISOString(),
        formattedDate: bal.formattedDate,
      };
      await prisma.appSetting.upsert({
        where: { key: "latest_account_balance" },
        create: {
          key: "latest_account_balance",
          value: JSON.stringify(latestBalance),
        },
        update: {
          value: JSON.stringify(latestBalance),
        },
      });
    }
  } catch (err) {
    console.warn("Fehler beim Abruf des Kontostands aus Google Sheets:", err);
  }

  return NextResponse.json({
    success: true,
    imported,
    skipped,
    matched,
    aiUsed,
    total: rows.length,
    accountBalance: latestBalance,
  });
}

