import { prisma } from "@/lib/prisma";
import {
  fetchSheetTransactions,
  fetchLatestAccountBalance,
  type AccountBalance,
} from "@/lib/google-sheets";
import { matchTransaction, detectPaymentPeriod } from "@/lib/matching";

export interface CachedBalance {
  amount: number;
  date: string;
  formattedDate: string;
}

export interface PaymentsSyncResult {
  imported: number;
  skipped: number;
  matched: number;
  aiUsed: number;
  total: number;
}

export interface FullSyncResult extends PaymentsSyncResult {
  accountBalance: CachedBalance | null;
  balanceUpdated: boolean;
  amountChanged: boolean;
  dateChanged: boolean;
  previousBalance: CachedBalance | null;
}

// Modul-weiter Mutex verhindert parallele Doppel-Syncs (z.B. Dashboard + Zahlungen gleichzeitig)
let activePaymentsSyncPromise: Promise<PaymentsSyncResult> | null = null;
let activeBalanceAndSyncPromise: Promise<{
  accountBalance: CachedBalance | null;
  cached: boolean;
  balanceUpdated: boolean;
  autoSyncedPayments: { triggered: boolean; imported: number; matched: number } | null;
}> | null = null;

function toCachedBalance(bal: AccountBalance): CachedBalance {
  return {
    amount: bal.amount,
    date: bal.date.toISOString(),
    formattedDate: bal.formattedDate,
  };
}

async function readSettingBalance(key: string): Promise<CachedBalance | null> {
  try {
    const setting = await prisma.appSetting.findUnique({ where: { key } });
    if (setting?.value) {
      return JSON.parse(setting.value) as CachedBalance;
    }
  } catch {
    // ignore invalid JSON
  }
  return null;
}

async function writeSettingBalance(key: string, data: CachedBalance): Promise<void> {
  try {
    await prisma.appSetting.upsert({
      where: { key },
      create: { key, value: JSON.stringify(data) },
      update: { value: JSON.stringify(data) },
    });
  } catch (err) {
    console.warn(`Warnung: Konnte ${key} nicht in appSetting schreiben:`, err);
  }
}

export function hasBalanceChanged(
  prev: CachedBalance | null,
  next: CachedBalance
): { changed: boolean; amountChanged: boolean; dateChanged: boolean } {
  const amountChanged = !prev || prev.amount !== next.amount;
  const dateChanged = !prev || prev.formattedDate !== next.formattedDate;
  return {
    changed: amountChanged || dateChanged,
    amountChanged,
    dateChanged,
  };
}

/**
 * Importiert alle neuen Zeilen aus dem Tabellenblatt "Kontobewegung" in die Datenbank.
 * Verwendet einen In-Flight-Mutex, sodass parallele Aufrufe denselben Sync teilen.
 */
export async function syncGoogleSheetsPayments(): Promise<PaymentsSyncResult> {
  if (activePaymentsSyncPromise) {
    return activePaymentsSyncPromise;
  }

  activePaymentsSyncPromise = (async () => {
    const [tenants, loans, properties, rows] = await Promise.all([
      prisma.tenant.findMany({ include: { property: true } }),
      prisma.loan.findMany(),
      prisma.property.findMany({
        select: { id: true, name: true, address: true, floor: true, unitNumber: true },
      }),
      fetchSheetTransactions(),
    ]);

    let imported = 0;
    let skipped = 0;
    let matched = 0;
    let aiUsed = 0;

    for (const row of rows) {
      const primaryId = row.externalId ? `ref-${row.externalId}` : `sheets-${row.rowIndex}`;
      const legacyId = `sheets-${row.rowIndex}`;

      const existing = await prisma.payment.findFirst({
        where: {
          OR: [{ sheetsRowId: primaryId }, { sheetsRowId: legacyId }],
        },
      });
      if (existing) {
        skipped++;
        continue;
      }

      const result = await matchTransaction(row, tenants, loans, properties);
      if (result.method === "AI") aiUsed++;
      if (result.tenantId || result.loanId) matched++;

      const matchedTenant = result.tenantId
        ? tenants.find((t) => t.id === result.tenantId)
        : null;
      let period = `${row.date.getFullYear()}-${String(row.date.getMonth() + 1).padStart(2, "0")}`;

      if (result.category === "RENT" && result.tenantId) {
        const existingInMonth = await prisma.payment.count({
          where: {
            tenantId: result.tenantId,
            category: "RENT",
            period,
          },
        });
        period = detectPaymentPeriod(
          row.date,
          row.reference,
          existingInMonth,
          matchedTenant?.moveInDate
        );
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
          status:
            result.tenantId || result.loanId || result.propertyId
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

    return { imported, skipped, matched, aiUsed, total: rows.length };
  })().finally(() => {
    activePaymentsSyncPromise = null;
  });

  return activePaymentsSyncPromise;
}

/**
 * Vollständiger manueller Sync (POST /api/payments/sync):
 * Synchronisiert immer alle Transaktionen und aktualisiert beide Balance-Marker.
 */
export async function runManualGoogleSheetsSync(): Promise<FullSyncResult> {
  const previousBalance = await readSettingBalance("latest_account_balance");
  const syncResult = await syncGoogleSheetsPayments();

  let latestBalance: CachedBalance | null = null;
  let balanceUpdated = false;
  let amountChanged = false;
  let dateChanged = false;

  try {
    const bal = await fetchLatestAccountBalance();
    if (bal) {
      latestBalance = toCachedBalance(bal);
      const diff = hasBalanceChanged(previousBalance, latestBalance);
      balanceUpdated = diff.changed;
      amountChanged = diff.amountChanged;
      dateChanged = diff.dateChanged;

      await writeSettingBalance("latest_account_balance", latestBalance);
      await writeSettingBalance("last_synced_payments_balance", latestBalance);
    }
  } catch (err) {
    console.warn("Fehler beim Abruf des Kontostands aus Google Sheets:", err);
  }

  return {
    ...syncResult,
    accountBalance: latestBalance,
    balanceUpdated,
    amountChanged,
    dateChanged,
    previousBalance,
  };
}

/**
 * Ruft den aktuellen Kontostand live ab.
 * Stellt er fest, dass sich der Kontostand (Betrag oder Datum) gegenüber dem letzten
 * Bankumsatz-Sync geändert hat, werden automatisch auch die neuen Bankumsätze synchronisiert.
 */
export async function fetchBalanceAndAutoSyncPayments(options?: {
  balanceTimeoutMs?: number;
}): Promise<{
  accountBalance: CachedBalance | null;
  cached: boolean;
  balanceUpdated: boolean;
  autoSyncedPayments: { triggered: boolean; imported: number; matched: number } | null;
}> {
  if (activeBalanceAndSyncPromise) {
    return activeBalanceAndSyncPromise;
  }

  activeBalanceAndSyncPromise = (async () => {
    const [cachedDisplay, lastSyncedBalance] = await Promise.all([
      readSettingBalance("latest_account_balance"),
      readSettingBalance("last_synced_payments_balance"),
    ]);

    let liveRaw: AccountBalance | null = null;
    try {
      if (options?.balanceTimeoutMs && options.balanceTimeoutMs > 0) {
        const timeoutPromise = new Promise<null>((resolve) =>
          setTimeout(() => resolve(null), options.balanceTimeoutMs)
        );
        liveRaw = await Promise.race([fetchLatestAccountBalance(), timeoutPromise]);
      } else {
        liveRaw = await fetchLatestAccountBalance();
      }
    } catch (err) {
      console.warn("Fehler beim Live-Abruf des Kontostands aus Google Sheets:", err);
      return {
        accountBalance: cachedDisplay,
        cached: true,
        balanceUpdated: false,
        autoSyncedPayments: null,
      };
    }

    if (!liveRaw) {
      return {
        accountBalance: cachedDisplay,
        cached: true,
        balanceUpdated: false,
        autoSyncedPayments: null,
      };
    }

    const live = toCachedBalance(liveRaw);
    const displayDiff = hasBalanceChanged(cachedDisplay, live);
    const syncDiff = hasBalanceChanged(lastSyncedBalance, live);

    // Immer wenn der Kontostand gegenüber dem letzten Bankumsatz-Sync neu ist -> Bankumsätze mitsynchronisieren
    let autoSyncedPayments: { triggered: boolean; imported: number; matched: number } | null = null;
    if (syncDiff.changed) {
      try {
        const syncResult = await syncGoogleSheetsPayments();
        autoSyncedPayments = {
          triggered: true,
          imported: syncResult.imported,
          matched: syncResult.matched,
        };
        await writeSettingBalance("last_synced_payments_balance", live);
      } catch (syncErr) {
        console.warn("Fehler beim automatischen Nachziehen der Bankumsätze:", syncErr);
      }
    }

    await writeSettingBalance("latest_account_balance", live);

    return {
      accountBalance: live,
      cached: false,
      balanceUpdated: displayDiff.changed || syncDiff.changed,
      autoSyncedPayments,
    };
  })().finally(() => {
    activeBalanceAndSyncPromise = null;
  });

  return activeBalanceAndSyncPromise;
}
