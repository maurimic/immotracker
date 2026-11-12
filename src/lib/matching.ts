/**
 * Zweistufige Matching-Pipeline:
 * 1. Regelbasiertes Matching (IBAN / Darlehen / Hausgeld / Name / Adresse + Wohneinheit) – kostenfrei
 * 2. KI-Fallback via Claude Haiku – bei unklaren Buchungen
 */

import Anthropic from "@anthropic-ai/sdk";
import { SheetRow } from "./google-sheets";
import {
  type PropertyMatchInfo,
  findBestMatchingProperty,
  extractAddressKeywords,
} from "./property-matching";

export type PropertyInfo = PropertyMatchInfo;

export interface Tenant {
  id: string;
  firstName: string;
  lastName: string;
  iban?: string | null;
  propertyId: string;
  coldRent?: number;
  utilities?: number;
  isCurrent?: boolean;
  moveInDate?: Date | string | null;
  moveOutDate?: Date | string | null;
  property?: PropertyInfo | null;
}

export interface LoanInfo {
  id: string;
  propertyId: string;
  label: string;
  bank?: string | null;
  monthlyPayment: number;
}

export interface MatchResult {
  tenantId: string | null;
  propertyId: string | null;
  loanId?: string | null;
  method: "IBAN" | "NAME" | "AI" | "MANUAL" | "UNMATCHED";
  confidence: number;
  category: "RENT" | "UTILITY_IN" | "LOAN" | "HAUSGELD" | "REPAIR" | "OTHER";
  aiRawResponse?: string;
}

/**
 * Erkennt anhand des Verwendungszwecks die Kategorie der Mieterzahlung
 */
export function detectPaymentCategory(
  rowRef: string,
  rowName: string,
  amount?: number
): "RENT" | "UTILITY_IN" | "LOAN" | "HAUSGELD" | "REPAIR" | "OTHER" {
  const combined = `${rowRef} ${rowName}`.toLowerCase();
  const hasRent = combined.includes("miet") || combined.includes("mitt");

  // 1. Darlehen / Annuität / Tilgung
  if (
    combined.includes("darlehen") ||
    combined.includes("annuität") ||
    combined.includes("annuitaet") ||
    combined.includes("rechn.zins") ||
    combined.includes("tilg")
  ) {
    return "LOAN";
  }

  // 2. Hausgeld & WEG-Sonderumlagen
  if (
    combined.includes("hausgeld") ||
    combined.includes("sonderumlage") ||
    combined.includes("weg alter dortmunder") ||
    combined.includes("weg siemens")
  ) {
    return "HAUSGELD";
  }

  // 3. Baumaterial / Baumärkte / Handwerker / Reparaturen
  if (
    combined.includes("bauhaus") ||
    combined.includes("obi") ||
    combined.includes("hornbach") ||
    combined.includes("toom") ||
    combined.includes("hellweg") ||
    combined.includes("hagebau") ||
    combined.includes("baumarkt") ||
    combined.includes("baumaterial") ||
    combined.includes("handwerker") ||
    combined.includes("reparatur") ||
    combined.includes("instandhalt") ||
    combined.includes("sanitär") ||
    combined.includes("sanitaer") ||
    combined.includes("elektro") ||
    combined.includes("maler") ||
    combined.includes("lackier") ||
    combined.includes("schreiner") ||
    combined.includes("tischler") ||
    combined.includes("dachdecker") ||
    combined.includes("renovier") ||
    combined.includes("fliesen") ||
    combined.includes("werkzeug") ||
    combined.includes("baustoff")
  ) {
    return "REPAIR";
  }

  // 4. Nebenkostenabrechnung / Nachzahlung / Betriebskosten
  if (
    combined.includes("nebenkost") ||
    combined.includes("betriebskost") ||
    combined.includes("abrech") ||
    combined.includes("bk-abr") ||
    combined.includes("nk-abr") ||
    (combined.includes("nachzahl") && !combined.includes("mietnachzahl"))
  ) {
    return "UTILITY_IN";
  }

  // 5. Reine Kaution (nur wenn KEINE Miete im Text erwähnt wird)
  if (
    (combined.includes("kaution") ||
      combined.includes("kautions") ||
      combined.includes("kauaz") ||
      combined.includes("kaut.")) &&
    !hasRent
  ) {
    return "OTHER";
  }

  return "RENT";
}

/**
 * Erkennt den abrechnungsrelevanten Monat (Abrechnungsperiode)
 */
export function detectPaymentPeriod(
  date: Date,
  reference?: string | null,
  tenantPaymentsInMonth: number = 0,
  moveInDate?: string | Date | null
): string {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();

  const ref = (reference || "").toLowerCase();

  const monthsMap: Record<string, number> = {
    januar: 1, jan: 1,
    februar: 2, feb: 2,
    märz: 3, maerz: 3, mrz: 3,
    april: 4, apr: 4,
    mai: 5,
    juni: 6, jun: 6,
    juli: 7, jul: 7,
    august: 8, aug: 8,
    september: 9, sep: 9, sept: 9,
    oktober: 10, okt: 10,
    november: 11, nov: 11,
    dezember: 12, dez: 12,
  };

  for (const [name, m] of Object.entries(monthsMap)) {
    const regex = new RegExp(`\\b${name}\\b`, "i");
    if (regex.test(ref)) {
      let targetYear = year;
      if (month === 12 && m === 1) targetYear = year + 1;
      else if (month === 1 && m === 12) targetYear = year - 1;
      return `${targetYear}-${String(m).padStart(2, "0")}`;
    }
  }

  if (moveInDate) {
    const mDate = typeof moveInDate === "string" ? new Date(moveInDate) : moveInDate;
    if (!isNaN(mDate.getTime())) {
      const moveInYm = `${mDate.getFullYear()}-${String(mDate.getMonth() + 1).padStart(2, "0")}`;
      const bookingYm = `${year}-${String(month).padStart(2, "0")}`;
      if (bookingYm < moveInYm) {
        return moveInYm;
      }
    }
  }

  if (day >= 20 && tenantPaymentsInMonth > 0) {
    const nextDate = new Date(year, month, 1);
    const nextYear = nextDate.getFullYear();
    const nextMonth = nextDate.getMonth() + 1;
    return `${nextYear}-${String(nextMonth).padStart(2, "0")}`;
  }

  return `${year}-${String(month).padStart(2, "0")}`;
}

/**
 * Stufe 1: Regelbasiertes Matching
 */
export function ruleBasedMatch(
  row: SheetRow,
  tenants: Tenant[],
  loans: LoanInfo[] = [],
  properties: PropertyInfo[] = []
): MatchResult | null {
  const rowIban = row.iban?.replace(/\s/g, "").toUpperCase();
  const rowName = (row.name || "").toLowerCase().trim();
  const rowRef = (row.reference || "").toLowerCase().trim();
  const combinedFullText = `${rowName} ${rowRef}`;

  // Alle bekannten Wohnungen aus Parameter + Mieter-Verknüpfungen sammeln
  const propMap = new Map<string, PropertyInfo>();
  for (const p of properties) {
    propMap.set(p.id, p);
  }
  for (const t of tenants) {
    if (t.property && !propMap.has(t.property.id)) {
      propMap.set(t.property.id, t.property);
    }
  }
  const allProperties = Array.from(propMap.values());

  // 1. IBAN-Matching (exakt)
  if (rowIban) {
    const matches = tenants.filter(
      (t) => t.iban?.replace(/\s/g, "").toUpperCase() === rowIban
    );
    if (matches.length > 0) {
      let best = matches[0];
      if (matches.length > 1) {
        const rowTime = new Date(row.date).getTime();
        const bestPropMatch = findBestMatchingProperty(combinedFullText, allProperties);
        const unitMatch = bestPropMatch?.property
          ? matches.find((t) => t.propertyId === bestPropMatch.property!.id)
          : undefined;
        const dateMatch = matches.find((t) => {
          const inTime = t.moveInDate ? new Date(t.moveInDate).getTime() : -Infinity;
          const outTime = t.moveOutDate ? new Date(t.moveOutDate).getTime() : Infinity;
          return rowTime >= inTime && rowTime <= outTime;
        });
        best = unitMatch || dateMatch || matches.find((t) => t.isCurrent) || matches[0];
      }
      const category = detectPaymentCategory(rowRef, rowName, row.amount);
      return {
        tenantId: best.id,
        propertyId: best.propertyId,
        loanId: null,
        method: "IBAN",
        confidence: 1.0,
        category,
      };
    }
  }

  // 2. Darlehens-Annuitäten & Kredite
  const isLoanRef =
    rowRef.includes("darlehen") ||
    rowRef.includes("rechn.zins") ||
    rowRef.includes("tilg") ||
    rowRef.includes("annuität") ||
    rowRef.includes("annuitaet");

  const absAmount = Math.abs(row.amount);
  const matchedLoan = loans.find(
    (l) => Math.abs(l.monthlyPayment - absAmount) < 0.05
  );

  if (isLoanRef || (row.amount < 0 && matchedLoan)) {
    return {
      tenantId: null,
      propertyId: matchedLoan?.propertyId || null,
      loanId: matchedLoan?.id || null,
      method: "NAME",
      confidence: matchedLoan ? 1.0 : 0.95,
      category: "LOAN",
    };
  }

  // 3. Hausgeld & WEG-Sonderumlagen
  const isHausgeld =
    rowRef.includes("hausgeld") ||
    rowName.includes("hausgeld") ||
    rowRef.includes("sonderumlage") ||
    rowName.includes("sonderumlage") ||
    rowName.startsWith("weg ") ||
    rowName.includes(" weg ");

  if (isHausgeld) {
    const propCandidate = findBestMatchingProperty(combinedFullText, allProperties);
    // Wenn das Gebäude mehrere Einheiten hat (z.B. Siemensstraße 28) und KEINE WE/Etage genannt ist:
    // NICHT blind einer einzigen Wohnung zuordnen, sondern für Aufteilung / Prüfung offenlassen!
    if (propCandidate?.ambiguousBuildingProperties && propCandidate.ambiguousBuildingProperties.length > 1) {
      return {
        tenantId: null,
        propertyId: null,
        loanId: null,
        method: "UNMATCHED",
        confidence: 0.85,
        category: "HAUSGELD",
      };
    }

    return {
      tenantId: null,
      propertyId: propCandidate?.property?.id || null,
      loanId: null,
      method: propCandidate?.property ? "NAME" : "UNMATCHED",
      confidence: propCandidate?.property ? 0.95 : 0.85,
      category: "HAUSGELD",
    };
  }

  // 4. Eigentümer-Kautionsanzahlungen für Mieter (nur reine Kaution ohne Miete!)
  for (const tenant of tenants) {
    const lastName = tenant.lastName.toLowerCase().trim();
    if (lastName.length >= 3 && (rowRef.includes(lastName) || rowName.includes(lastName))) {
      const hasKaution = rowRef.includes("kaution") || rowRef.includes("anzahlung");
      const hasRent = rowRef.includes("miet") || rowRef.includes("mitt");
      if (hasKaution && !hasRent) {
        return {
          tenantId: tenant.id,
          propertyId: tenant.propertyId,
          loanId: null,
          method: "NAME",
          confidence: 0.98,
          category: "OTHER",
        };
      }
    }
  }

  // 5. Name-Matching: Mietername im Zahlungspartner oder Verwendungszweck
  let bestTenantMatch: { tenant: Tenant; score: number } | null = null;
  const textPropMatch = findBestMatchingProperty(combinedFullText, allProperties);

  for (const tenant of tenants) {
    const lastName = tenant.lastName.toLowerCase().trim();
    const firstName = tenant.firstName.toLowerCase().trim();

    const inNameFirst = firstName.length >= 3 && rowName.includes(firstName);
    const inNameLast = lastName.length >= 3 && rowName.includes(lastName);
    const inRefFirst = firstName.length >= 3 && rowRef.includes(firstName);
    const inRefLast = lastName.length >= 3 && rowRef.includes(lastName);

    let score = 0;
    if (inNameFirst && inNameLast) {
      score = 1.0;
    } else if (inNameLast) {
      score = 0.88;
    } else if (inRefFirst && inRefLast) {
      score = 0.95;
    } else if (inRefLast) {
      score = 0.80;
    }

    if (score >= 0.80) {
      const rowTime = new Date(row.date).getTime();
      const inTime = tenant.moveInDate ? new Date(tenant.moveInDate).getTime() : -Infinity;
      const outTime = tenant.moveOutDate ? new Date(tenant.moveOutDate).getTime() : Infinity;
      if (rowTime >= inTime && rowTime <= outTime) {
        score += 0.05;
      } else if (tenant.isCurrent) {
        score += 0.02;
      }
      if (textPropMatch?.property && tenant.propertyId === textPropMatch.property.id) {
        score += 0.1;
      }
    }

    if (score > (bestTenantMatch?.score || 0)) {
      bestTenantMatch = { tenant, score };
    }
  }

  if (bestTenantMatch && bestTenantMatch.score >= 0.80) {
    const category = detectPaymentCategory(rowRef, rowName, row.amount);
    return {
      tenantId: bestTenantMatch.tenant.id,
      propertyId: bestTenantMatch.tenant.propertyId,
      loanId: null,
      method: "NAME",
      confidence: Math.min(1.0, bestTenantMatch.score),
      category,
    };
  }

  // 6. Eigentümer-Einlagen & Privat-Transfers
  const ownerKeywords = [
    "einlage",
    "steven buraje poggel",
    "steven poggel",
    "maurizio micciche",
    "gesellschafter",
  ];
  if (ownerKeywords.some((kw) => rowName.includes(kw) || rowRef.includes(kw))) {
    const propCandidate = findBestMatchingProperty(rowRef, allProperties);
    const matchedPropId =
      propCandidate?.property && (propCandidate.addressMatched || propCandidate.unitMatched)
        ? propCandidate.property.id
        : null;
    return {
      tenantId: null,
      propertyId: matchedPropId,
      loanId: null,
      method: matchedPropId ? "NAME" : propCandidate?.ambiguousBuildingProperties ? "UNMATCHED" : "NAME",
      confidence: 0.95,
      category: "OTHER",
    };
  }

  // 7. Grundsteuer / Grundbesitzabgaben
  if (rowRef.includes("grundsteuer") || rowRef.includes("grundbesitzabgab")) {
    const propCandidate = findBestMatchingProperty(combinedFullText, allProperties);
    const matchedId =
      propCandidate?.property && (propCandidate.addressMatched || propCandidate.unitMatched)
        ? propCandidate.property.id
        : null;
    return {
      tenantId: null,
      propertyId: matchedId,
      loanId: null,
      method: matchedId ? "NAME" : "UNMATCHED",
      confidence: 0.95,
      category: "OTHER",
    };
  }

  // 8. Nebenkosten/Versorger
  const utilityKeywords = [
    "stadtwerk", "versorger", "stromanbieter", "wasserwerk", "gaswerk",
    "heizkost", "hausverwaltung", "versicherung", "allianz", "signal",
    "engie", "eon", "vattenfall", "stadtgas", "fernwärme", "schwerte",
  ];
  if (utilityKeywords.some((kw) => rowName.includes(kw) || rowRef.includes(kw))) {
    const propCandidate = findBestMatchingProperty(combinedFullText, allProperties);
    const matchedId =
      propCandidate?.property && (propCandidate.addressMatched || propCandidate.unitMatched)
        ? propCandidate.property.id
        : null;
    return {
      tenantId: null,
      propertyId: matchedId,
      loanId: null,
      method: matchedId ? "NAME" : "UNMATCHED",
      confidence: matchedId ? 0.85 : 0.75,
      category: "UTILITY_IN",
    };
  }

  // 9. Wohnungs-, Wohneinheits- & Adress-Matching
  const directPropMatch = findBestMatchingProperty(combinedFullText, allProperties);
  if (directPropMatch?.property && (directPropMatch.addressMatched || directPropMatch.unitMatched)) {
    const matchedProp = directPropMatch.property;
    const sameBuildingCount = allProperties.filter((p) => {
      if (p.id === matchedProp.id) return false;
      const k1 = extractAddressKeywords(matchedProp);
      const k2 = extractAddressKeywords(p);
      return k1.some((w) => k2.includes(w));
    }).length;

    if (sameBuildingCount === 0 || directPropMatch.unitMatched || directPropMatch.floorMatched) {
      const category = detectPaymentCategory(rowRef, rowName, row.amount);
      const activeTenant = tenants.find((t) => t.propertyId === matchedProp.id && t.isCurrent)
        || tenants.find((t) => t.propertyId === matchedProp.id);

      return {
        tenantId: row.amount > 0 && activeTenant ? activeTenant.id : null,
        propertyId: matchedProp.id,
        loanId: null,
        method: "NAME",
        confidence: directPropMatch.unitMatched ? 0.92 : 0.85,
        category,
      };
    }
  } else if (directPropMatch?.ambiguousBuildingProperties && directPropMatch.ambiguousBuildingProperties.length > 1) {
    const category = detectPaymentCategory(rowRef, rowName, row.amount);
    return {
      tenantId: null,
      propertyId: null,
      loanId: null,
      method: "UNMATCHED",
      confidence: 0.80,
      category,
    };
  }

  return null;
}

/**
 * Stufe 2: KI-Fallback via Claude Haiku
 */
export async function aiMatch(
  row: SheetRow,
  tenants: Tenant[]
): Promise<MatchResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return { tenantId: null, propertyId: null, method: "UNMATCHED", confidence: 0, category: "OTHER" };
  }

  const client = new Anthropic({ apiKey });

  const tenantList = tenants.map((t) => ({
    id: t.id,
    name: `${t.firstName} ${t.lastName}`,
    iban: t.iban,
    propertyId: t.propertyId,
    propertyName: t.property?.name,
    unitNumber: t.property?.unitNumber,
  }));

  const prompt = `Du bist ein Buchhalter für Mietwohnungen. Ordne die folgende Bankbuchung einem Mieter zu.

Bankbuchung:
- Datum: ${row.date.toISOString().split("T")[0]}
- Betrag: ${row.amount} EUR
- Name/Auftraggeber: ${row.name}
- IBAN: ${row.iban || "nicht angegeben"}
- Verwendungszweck: ${row.reference || "nicht angegeben"}

Mieter:
${JSON.stringify(tenantList, null, 2)}

Antworte NUR mit einem JSON-Objekt ohne zusätzlichen Text:
{
  "tenantId": "<tenant-id oder null>",
  "propertyId": "<property-id oder null>",
  "confidence": <0.0-1.0>,
  "category": "<RENT|UTILITY_IN|LOAN|HAUSGELD|REPAIR|OTHER>",
  "reasoning": "<kurze Begründung auf Deutsch>"
}`;

  try {
    const message = await client.messages.create({
      model: "claude-3-5-haiku-latest",
      max_tokens: 512,
      messages: [{ role: "user", content: prompt }],
    });

    const text = message.content[0].type === "text" ? message.content[0].text : "";

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("Kein JSON in Antwort");

    const result = JSON.parse(jsonMatch[0]);
    const tenant = result.tenantId ? tenants.find((t) => t.id === result.tenantId) : null;

    return {
      tenantId: result.tenantId || null,
      propertyId: tenant?.propertyId || result.propertyId || null,
      method: "AI",
      confidence: result.confidence || 0.5,
      category: result.category || "OTHER",
      aiRawResponse: text,
    };
  } catch (err) {
    console.error("AI-Matching Fehler:", err);
    return {
      tenantId: null,
      propertyId: null,
      method: "UNMATCHED",
      confidence: 0,
      category: "OTHER",
    };
  }
}

/**
 * Hauptfunktion: Wendet Matching-Pipeline auf eine Buchung an
 */
export async function matchTransaction(
  row: SheetRow,
  tenants: Tenant[],
  loans: LoanInfo[] = [],
  properties: PropertyInfo[] = []
): Promise<MatchResult> {
  const ruleResult = ruleBasedMatch(row, tenants, loans, properties);
  if (ruleResult && ruleResult.confidence >= 0.75) {
    return ruleResult;
  }

  return aiMatch(row, tenants);
}
