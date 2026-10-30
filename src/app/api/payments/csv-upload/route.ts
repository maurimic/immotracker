import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ruleBasedMatch, aiMatch, Tenant as MatchingTenant } from "@/lib/matching";

interface ParsedRow {
  date: string;
  name: string;
  iban?: string;
  reference?: string;
  amount: number;
}

function parseGermanAmount(str: string): number {
  if (!str) return 0;
  // Handle formats like "1.234,56" or "1234,56" or "1234.56"
  const cleaned = str.trim().replace(/\s/g, "").replace(/\./g, "").replace(",", ".");
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

function parseBankCSV(csvText: string): ParsedRow[] {
  const lines = csvText.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return [];

  // Detect separator (semicolon or comma)
  const firstLine = lines[0];
  const sep = firstLine.includes(";") ? ";" : ",";

  const headers = lines[0]
    .split(sep)
    .map((h) => h.replace(/^["']|["']$/g, "").trim().toLowerCase());

  // Find column indices
  let dateIdx = headers.findIndex((h) => h.includes("datum") || h.includes("buchungstag") || h.includes("valuta"));
  let nameIdx = headers.findIndex((h) => h.includes("begünstigter") || h.includes("zahlungspflichtiger") || h.includes("name") || h.includes("auftraggeber"));
  let ibanIdx = headers.findIndex((h) => h.includes("iban") || h.includes("kontonummer"));
  let refIdx = headers.findIndex((h) => h.includes("verwendungszweck") || h.includes("text") || h.includes("notiz"));
  let amountIdx = headers.findIndex((h) => h.includes("betrag") || h.includes("umsatz"));

  // Fallbacks if header names are standard position
  if (dateIdx === -1) dateIdx = 0;
  if (nameIdx === -1) nameIdx = 1;
  if (refIdx === -1) refIdx = 2;
  if (amountIdx === -1) amountIdx = headers.length - 1;

  const rows: ParsedRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const rawLine = lines[i].trim();
    if (!rawLine) continue;

    // Split considering quotes
    const regex = new RegExp(`(?:^|${sep})(\"(?:[^\"]+|\"\")*\"|[^${sep}]*)`, "g");
    const matches: string[] = [];
    let match;
    while ((match = regex.exec(rawLine)) !== null) {
      let val = match[1] || "";
      if (val.startsWith(sep)) val = val.substring(1);
      val = val.replace(/^["']|["']$/g, "").trim();
      matches.push(val);
    }

    if (matches.length < 3) continue;

    const rawDate = matches[dateIdx] || "";
    const rawName = matches[nameIdx] || "";
    const rawIban = ibanIdx !== -1 ? matches[ibanIdx] : "";
    const rawRef = refIdx !== -1 ? matches[refIdx] : "";
    const rawAmount = matches[amountIdx] || "";

    // Parse date (DD.MM.YYYY or YYYY-MM-DD)
    let parsedDate: Date;
    if (rawDate.includes(".")) {
      const parts = rawDate.split(".");
      if (parts.length === 3) {
        parsedDate = new Date(`${parts[2]}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`);
      } else {
        parsedDate = new Date();
      }
    } else {
      parsedDate = new Date(rawDate);
    }

    if (isNaN(parsedDate.getTime())) {
      parsedDate = new Date();
    }

    const amount = parseGermanAmount(rawAmount);

    if (rawName || rawRef) {
      rows.push({
        date: parsedDate.toISOString().slice(0, 10),
        name: rawName,
        iban: rawIban,
        reference: rawRef,
        amount,
      });
    }
  }

  return rows;
}

export async function POST(request: Request) {
  try {
    const contentType = request.headers.get("content-type") || "";
    let csvContent = "";

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const file = formData.get("file") as File;
      if (!file) {
        return NextResponse.json({ error: "Keine Datei hochgeladen" }, { status: 400 });
      }
      csvContent = await file.text();
    } else {
      const body = await request.json();
      csvContent = body.csvText || "";
    }

    if (!csvContent) {
      return NextResponse.json({ error: "CSV-Inhalt ist leer" }, { status: 400 });
    }

    const parsedRows = parseBankCSV(csvContent);
    if (parsedRows.length === 0) {
      return NextResponse.json({ error: "Keine gültigen Zeilen in der CSV gefunden" }, { status: 400 });
    }

    // Fetch active tenants and loans for matching
    const [dbTenants, loans] = await Promise.all([
      prisma.tenant.findMany({
        select: {
          id: true,
          firstName: true,
          lastName: true,
          iban: true,
          propertyId: true,
        },
      }),
      prisma.loan.findMany(),
    ]);

    const matchingTenants: MatchingTenant[] = dbTenants.map((t) => ({
      id: t.id,
      firstName: t.firstName,
      lastName: t.lastName,
      iban: t.iban,
      propertyId: t.propertyId,
    }));

    let importedCount = 0;
    let matchedCount = 0;

    for (const row of parsedRows) {
      const period = row.date.slice(0, 7); // "YYYY-MM"
      const bookingDate = new Date(row.date);

      // Check duplicate
      const existing = await prisma.payment.findFirst({
        where: {
          bookingDate,
          amount: row.amount,
          payerName: row.name,
        },
      });

      if (existing) continue;

      // Match
      const sheetRow = {
        rowIndex: 0,
        date: bookingDate,
        name: row.name,
        iban: row.iban,
        amount: row.amount,
        reference: row.reference,
      };

      let match = ruleBasedMatch(sheetRow, matchingTenants, loans);
      if (!match && process.env.ANTHROPIC_API_KEY) {
        match = await aiMatch(sheetRow, matchingTenants);
      }

      await prisma.payment.create({
        data: {
          tenantId: match?.tenantId || null,
          propertyId: match?.propertyId || null,
          loanId: match?.loanId || null,
          bookingDate,
          amount: row.amount,
          payerName: row.name,
          payerIban: row.iban,
          reference: row.reference,
          matchMethod: match?.method || "UNMATCHED",
          matchConfidence: match?.confidence || null,
          aiRawResponse: match?.aiRawResponse || null,
          category: match?.category || (row.amount > 0 ? "RENT" : "OTHER"),
          status: (match?.tenantId || match?.loanId) ? "MATCHED" : "MANUAL_REVIEW",
          period,
        },
      });

      importedCount++;
      if (match?.tenantId || match?.loanId) matchedCount++;
    }

    return NextResponse.json({
      success: true,
      totalRows: parsedRows.length,
      importedCount,
      matchedCount,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
