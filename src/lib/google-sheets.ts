/**
 * Google Sheets Synchronisation-Service
 * Liest Kontoumsätze („Kontobewegung“) schreibgeschützt über Service Account
 */

import { google } from "googleapis";
import fs from "fs";
import path from "path";

export interface SheetRow {
  rowIndex: number;
  externalId?: string; // z.B. "3H2C21GT2MED9500/57285" (Referenz)
  date: Date;
  amount: number;
  currency?: string; // z.B. "EUR"
  name: string; // Zahlungspartner (z.B. "Shyar Daoud")
  iban?: string;
  reference?: string; // Verwendungszweck (z.B. "Shyar Daoud ,Siemenstr .28 ,45143 Essen")
  transactionType?: string; // Umsatzart (z.B. "Transfer", "Direct Debit")
}

/**
 * Holt die Service Account Credentials aus der Umgebung oder Datei
 */
export function getGoogleCredentials(): { credentials: any; email?: string } {
  // 1. Direkt aus JSON-String in Umgebung
  if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
    try {
      const parsed = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
      return { credentials: parsed, email: parsed.client_email };
    } catch {
      // ignore and try file
    }
  }

  // 2. Aus Pfad in Umgebung oder Standard-Pfaden
  const candidatePaths = [
    process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH,
    path.join(process.cwd(), "secrets", "google-service-account.json"),
    "C:\\Users\\User\\Documents\\Codex\\2026-10-22\\goal-baue-ein-komplettes-selbst-gehostetes\\outputs\\hauskonto\\secrets\\google-service-account.json",
  ].filter(Boolean) as string[];

  for (const p of candidatePaths) {
    try {
      if (fs.existsSync(p)) {
        const content = fs.readFileSync(p, "utf8");
        const parsed = JSON.parse(content);
        if (parsed.type === "service_account" && parsed.private_key) {
          return { credentials: parsed, email: parsed.client_email };
        }
      }
    } catch {
      // continue searching
    }
  }

  throw new Error(
    "Google Sheets Konfiguration fehlt: Es wurde kein gültiges Service-Account-JSON gefunden. Bitte hinterlegen Sie die Dienstkonto-Schlüsseldatei oder GOOGLE_SERVICE_ACCOUNT_JSON."
  );
}

/**
 * Parst einen deutschen oder internationalen Betragsstring (z.B. "-205.57", "1131", "1.131,00")
 */
function parseAmount(val: unknown): number {
  if (typeof val === "number") return val;
  if (!val) return 0;
  let str = String(val).trim();
  // Wenn Tausendertrennzeichen Punkt und Dezimal Komma (z.B. 1.234,56)
  if (str.includes(",") && str.includes(".")) {
    if (str.indexOf(".") < str.indexOf(",")) {
      str = str.replace(/\./g, "").replace(",", ".");
    } else {
      str = str.replace(/,/g, "");
    }
  } else if (str.includes(",")) {
    str = str.replace(",", ".");
  }
  const cleaned = str.replace(/[^\d.-]/g, "");
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : parsed;
}

/**
 * Parst Datumsangaben (YYYY-MM-DD, DD.MM.YYYY, ISO oder Sheets Serial)
 */
function parseDate(val: unknown): Date | null {
  if (!val) return null;
  if (val instanceof Date) return val;
  const str = String(val).trim();

  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
    const d = new Date(str);
    if (!isNaN(d.getTime())) return d;
  }

  // DD.MM.YYYY
  if (/^\d{1,2}\.\d{1,2}\.\d{4}/.test(str)) {
    const parts = str.split(".");
    const day = parts[0].padStart(2, "0");
    const month = parts[1].padStart(2, "0");
    const year = parts[2].slice(0, 4);
    const d = new Date(`${year}-${month}-${day}`);
    if (!isNaN(d.getTime())) return d;
  }

  // Fallback
  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Liest Kontobewegungen aus dem angegebenen Google Sheet
 */
export async function fetchSheetTransactions(): Promise<SheetRow[]> {
  const spreadsheetId =
    process.env.GOOGLE_SHEETS_ID ||
    process.env.GOOGLE_SPREADSHEET_ID ||
    "1GslK8LFx_Day6hjEcQnEY_nmX06KuJwRRdqVr1ph8HU";
  const sheetName = process.env.GOOGLE_SHEET_NAME || "Kontobewegung";

  const { credentials } = getGoogleCredentials();

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });

  const sheets = google.sheets({ version: "v4", auth });
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${sheetName}!A1:Z`,
  });

  const rows = response.data.values || [];
  if (rows.length === 0) return [];

  // Spaltenkopf-Erkennung in Zeile 1
  const headerRow = rows[0].map((h) => String(h || "").trim().toLowerCase());
  let refCol = headerRow.findIndex((h) => h.includes("referenz") || h === "id" || h.includes("tx"));
  let dateCol = headerRow.findIndex((h) => h.includes("datum") || h.includes("date") || h.includes("buchung"));
  let amountCol = headerRow.findIndex((h) => h.includes("betrag") || h.includes("amount") || h.includes("umsatz"));
  let currCol = headerRow.findIndex((h) => h.includes("währung") || h.includes("currency"));
  let purposeCol = headerRow.findIndex(
    (h) =>
      h.includes("verwendungszweck") ||
      h.includes("zweck") ||
      h.includes("reference") ||
      h.includes("text")
  );
  let partnerCol = headerRow.findIndex(
    (h) =>
      h.includes("zahlungspartner") ||
      h.includes("auftraggeber") ||
      h.includes("partner") ||
      h.includes("name") ||
      h.includes("empfänger")
  );
  let typeCol = headerRow.findIndex((h) => h.includes("umsatzart") || h.includes("kategorie") || h.includes("typ"));
  let ibanCol = headerRow.findIndex((h) => h.includes("iban"));

  // Fallback, falls keine Header erkannt wurden (exaktes Schema des Benutzers)
  if (dateCol === -1 || amountCol === -1) {
    refCol = 0;
    dateCol = 1;
    amountCol = 2;
    currCol = 3;
    purposeCol = 4;
    partnerCol = 5;
    typeCol = 6;
  }

  const result: SheetRow[] = [];

  // Ab Zeile 2 (Index 1) Daten parsen
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r || r.length === 0) continue;

    const rawDate = dateCol !== -1 ? r[dateCol] : undefined;
    const rawAmount = amountCol !== -1 ? r[amountCol] : undefined;
    if (!rawDate || rawAmount === undefined || rawAmount === null || rawAmount === "") continue;

    const date = parseDate(rawDate);
    if (!date) continue;

    const amount = parseAmount(rawAmount);

    const externalId = refCol !== -1 && r[refCol] ? String(r[refCol]).trim() : undefined;
    const currency = currCol !== -1 && r[currCol] ? String(r[currCol]).trim() : "EUR";
    const reference = purposeCol !== -1 && r[purposeCol] ? String(r[purposeCol]).trim() : undefined;
    const name = partnerCol !== -1 && r[partnerCol] ? String(r[partnerCol]).trim() : "";
    const transactionType = typeCol !== -1 && r[typeCol] ? String(r[typeCol]).trim() : undefined;
    const iban = ibanCol !== -1 && r[ibanCol] ? String(r[ibanCol]).replace(/\s/g, "").toUpperCase() : undefined;

    result.push({
      rowIndex: i + 1, // 1-indexiert
      externalId,
      date,
      amount,
      currency,
      name,
      iban,
      reference,
      transactionType,
    });
  }

  return result;
}

export interface AccountBalance {
  amount: number;
  date: Date;
  formattedDate: string;
}

/**
 * Liest den aktuellsten Kontostand aus dem Tabellenblatt "Kontostand"
 */
export async function fetchLatestAccountBalance(): Promise<AccountBalance | null> {
  const spreadsheetId =
    process.env.GOOGLE_SHEETS_ID ||
    process.env.GOOGLE_SPREADSHEET_ID ||
    "1GslK8LFx_Day6hjEcQnEY_nmX06KuJwRRdqVr1ph8HU";
  const sheetName = process.env.GOOGLE_BALANCE_SHEET_NAME || "Kontostand";

  const { credentials } = getGoogleCredentials();

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });

  const sheets = google.sheets({ version: "v4", auth });
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${sheetName}!A1:Z1000`,
  });

  const rows = response.data.values || [];
  if (rows.length === 0) return null;

  // Header analysieren
  const headerRow = rows[0].map((h) => String(h || "").trim().toLowerCase());
  let dateCol = headerRow.findIndex(
    (h) => h.includes("datum") || h.includes("date") || h.includes("tag") || h.includes("zeit")
  );
  let amountCol = headerRow.findIndex(
    (h) =>
      h.includes("kontostand") ||
      h.includes("saldo") ||
      h.includes("stand") ||
      h.includes("betrag") ||
      h.includes("amount") ||
      h.includes("balance")
  );

  let startIdx = 1;
  // Falls keine Headerzeile gefunden wurde (z.B. erste Zeile enthält direkt Werte)
  if (dateCol === -1 || amountCol === -1) {
    const d0 = parseDate(rows[0][0]);
    if (d0) {
      dateCol = 0;
      amountCol = 1;
      startIdx = 0;
    } else {
      dateCol = 0;
      amountCol = 1;
      startIdx = 1;
    }
  }

  const entries: Array<{ date: Date; amount: number; rawDate: string; rowIndex: number }> = [];

  for (let i = startIdx; i < rows.length; i++) {
    const r = rows[i];
    if (!r || r.length === 0) continue;
    const rawDate = r[dateCol];
    const rawAmount = r[amountCol];
    if (!rawDate || rawAmount === undefined || rawAmount === null || String(rawAmount).trim() === "") continue;

    const date = parseDate(rawDate);
    if (!date) continue;
    const amount = parseAmount(rawAmount);

    entries.push({
      date,
      amount,
      rawDate: String(rawDate).trim(),
      rowIndex: i,
    });
  }

  if (entries.length === 0) return null;

  // Nach Datum sortieren (neuestes zuerst). Bei gleichem Datum gewinnt die spätere Zeile im Sheet
  entries.sort((a, b) => {
    const timeDiff = b.date.getTime() - a.date.getTime();
    if (timeDiff !== 0) return timeDiff;
    return b.rowIndex - a.rowIndex;
  });

  const latest = entries[0];
  const formattedDate = latest.date.toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  return {
    amount: latest.amount,
    date: latest.date,
    formattedDate,
  };
}

/**
 * Verbindungstest-Helfer
 */
export async function testGoogleSheetsConnection() {
  const spreadsheetId =
    process.env.GOOGLE_SHEETS_ID ||
    process.env.GOOGLE_SPREADSHEET_ID ||
    "1GslK8LFx_Day6hjEcQnEY_nmX06KuJwRRdqVr1ph8HU";
  const sheetName = process.env.GOOGLE_SHEET_NAME || "Kontobewegung";
  const { email } = getGoogleCredentials();

  const transactions = await fetchSheetTransactions();

  return {
    success: true,
    spreadsheetId,
    sheetName,
    serviceAccountEmail: email,
    rowCount: transactions.length,
    sampleRows: transactions.slice(0, 5),
  };
}
