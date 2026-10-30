/**
 * Zweistufige Matching-Pipeline:
 * 1. Regelbasiertes Matching (IBAN / Name) – kostenfrei
 * 2. KI-Fallback via Claude Haiku – bei unklaren Buchungen
 */

import Anthropic from "@anthropic-ai/sdk";
import { SheetRow } from "./google-sheets";

export interface Tenant {
  id: string;
  firstName: string;
  lastName: string;
  iban?: string | null;
  propertyId: string;
  coldRent?: number;
  utilities?: number;
  property?: { id: string; name: string; address: string } | null;
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
 * Erkennt anhand des Verwendungszwecks die Kategorie der Mieterzahlung:
 * - "LOAN": Annuitäten / Darlehenszins / Tilgung
 * - "HAUSGELD": Hausgeldzahlungen
 * - "REPAIR": Baumaterial, Baumarkt, Handwerker, Reparaturen
 * - "UTILITY_IN": Nebenkostenabrechnung, Betriebskostennachzahlung
 * - "OTHER": Kaution, Kautionsanzahlung, Privattransfers
 * - "RENT": Reguläre monatliche Mietzahlung
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
 * Erkennt den abrechnungsrelevanten Monat (Abrechnungsperiode),
 * berücksichtigt Vorauszahlungen am Monatsende für den Folgemonat (§ 556b BGB),
 * Vorab-Mietzahlungen vor dem Einzug sowie Monatsangaben im Verwendungszweck.
 */
export function detectPaymentPeriod(
  date: Date,
  reference?: string | null,
  tenantPaymentsInMonth: number = 0,
  moveInDate?: string | Date | null
): string {
  const year = date.getFullYear();
  const month = date.getMonth() + 1; // 1-12
  const day = date.getDate();

  const ref = (reference || "").toLowerCase();

  // 1. Suche nach Monatsangabe im Verwendungszweck (z.B. "Miete August", "Miete März", "März 2026")
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

  // 2. Zahlung vor dem Einzugsdatum (z.B. Mietvorauszahlung am 22.07 vor Einzug am 01.08):
  // Gehört zum ersten Mietmonat!
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

  // 3. Spät am Monatsende überwiesen (ab dem 20. des Monats):
  // Wenn im Monat bereits eine Mietzahlung vorlag, ist dies die Zahlung für den Folgemonat
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
  loans: LoanInfo[] = []
): MatchResult | null {
  const rowIban = row.iban?.replace(/\s/g, "").toUpperCase();
  const rowName = (row.name || "").toLowerCase().trim();
  const rowRef = (row.reference || "").toLowerCase().trim();

  // 1. IBAN-Matching (exakt)
  if (rowIban) {
    const match = tenants.find(
      (t) => t.iban?.replace(/\s/g, "").toUpperCase() === rowIban
    );
    if (match) {
      const category = detectPaymentCategory(rowRef, rowName, row.amount);
      return {
        tenantId: match.id,
        propertyId: match.propertyId,
        loanId: null,
        method: "IBAN",
        confidence: 1.0,
        category,
      };
    }
  }

  // 2. Darlehens-Annuitäten & Kredite (Verwendungszweck enthält "darlehen" oder Betrag entspricht Darlehensrate)
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
    const fullText = `${rowName} ${rowRef}`.toLowerCase();
    let matchedPropId: string | null = null;

    // Sammle alle bekannten Wohnungen aus den übergebenen Mietern
    const knownProps: Array<{ id: string; name: string; address: string }> = [];
    const seen = new Set<string>();
    for (const t of tenants) {
      if (t.property && !seen.has(t.property.id)) {
        seen.add(t.property.id);
        knownProps.push(t.property);
      }
    }

    // 1. Spezifischer Check: Schwerte / Alter Dortmunder Weg 4 (WE 6)
    if (
      fullText.includes("dortmunder") ||
      fullText.includes("schwerte") ||
      fullText.includes("we 6") ||
      fullText.includes("we6") ||
      fullText.includes("buechel")
    ) {
      const p = knownProps.find(
        (kp) =>
          kp.name.toLowerCase().includes("schwerte") ||
          kp.address.toLowerCase().includes("dortmunder")
      );
      if (p) matchedPropId = p.id;
    }
    // 2. Spezifischer Check: Bockumweg 17a (Whg. 1)
    else if (
      fullText.includes("bockum") ||
      (fullText.includes("schubert") &&
        (fullText.includes("17a") ||
          fullText.includes("whg. 1") ||
          fullText.includes("wohnung nr. 1") ||
          fullText.includes("whg 1")))
    ) {
      const p = knownProps.find(
        (kp) =>
          kp.name.toLowerCase().includes("bockum") ||
          kp.address.toLowerCase().includes("bockum")
      );
      if (p) matchedPropId = p.id;
    }
    // 3. Spezifischer Check: Siemensstraße 28 (EG vs. 2.OG)
    else if (fullText.includes("siemens")) {
      const is2og =
        /\b(2\.?\s*og|2\.?\s*obergeschoss|2og)\b/i.test(fullText) ||
        fullText.includes("91h1w5") ||
        fullText.includes("91h1w6");
      const isEg =
        /\b(eg|erdgeschoss)\b/i.test(fullText) ||
        fullText.includes("91h1w1");

      if (is2og) {
        const p = knownProps.find((kp) => kp.name.toLowerCase().includes("2.og"));
        if (p) matchedPropId = p.id;
      } else if (isEg) {
        const p = knownProps.find((kp) => kp.name.toLowerCase().includes("eg"));
        if (p) matchedPropId = p.id;
      } else {
        // Sammel-Sonderumlage WEG Siemensstr. 28 ohne spezifische Etage -> 2.OG (größere Einheit)
        const p = knownProps.find((kp) => kp.name.toLowerCase().includes("2.og"));
        if (p) matchedPropId = p.id;
      }
    }
    // 4. Generischer Adress-Check für alle sonstigen Immobilien im Portfolio
    else {
      for (const prop of knownProps) {
        const propAddr = prop.address.toLowerCase();
        const streetParts = propAddr
          .replace(/[,.]/g, " ")
          .split(" ")
          .map((s) => s.trim())
          .filter((w) => w.length >= 5);

        if (streetParts.some((part) => fullText.includes(part))) {
          matchedPropId = prop.id;
          break;
        }
      }
    }

    return {
      tenantId: null,
      propertyId: matchedPropId,
      loanId: null,
      method: "NAME",
      confidence: matchedPropId ? 0.95 : 0.85,
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

  // 5. Name-Matching: Höchste Priorität für Mietername im Zahlungspartner oder Verwendungszweck
  let bestTenantMatch: { tenant: Tenant; score: number } | null = null;

  for (const tenant of tenants) {
    const lastName = tenant.lastName.toLowerCase().trim();
    const firstName = tenant.firstName.toLowerCase().trim();

    // Voller Name im Zahlungspartner
    const inNameFirst = firstName.length >= 3 && rowName.includes(firstName);
    const inNameLast = lastName.length >= 3 && rowName.includes(lastName);

    // Voller Name im Verwendungszweck
    const inRefFirst = firstName.length >= 3 && rowRef.includes(firstName);
    const inRefLast = lastName.length >= 3 && rowRef.includes(lastName);

    let score = 0;
    if (inNameFirst && inNameLast) {
      score = 1.0; // Exakter Vor- und Nachname im Zahler
    } else if (inNameLast) {
      score = 0.88; // Nachname im Zahler
    } else if (inRefFirst && inRefLast) {
      score = 0.95; // Exakter Name im Verwendungszweck
    } else if (inRefLast) {
      score = 0.80; // Nachname im Verwendungszweck
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
      confidence: bestTenantMatch.score,
      category,
    };
  }

  // 6. Eigentümer-Einlagen & Privat-Transfers (nur wenn KEIN Mieter im Zweck steht)
  const ownerKeywords = [
    "einlage",
    "steven buraje poggel",
    "steven poggel",
    "maurizio micciche",
    "gesellschafter",
  ];
  if (ownerKeywords.some((kw) => rowName.includes(kw) || rowRef.includes(kw))) {
    return {
      tenantId: null,
      propertyId: null,
      loanId: null,
      method: "NAME",
      confidence: 0.95,
      category: "OTHER",
    };
  }

  // 7. Grundsteuer
  if (rowRef.includes("grundsteuer")) {
    return {
      tenantId: null,
      propertyId: null,
      loanId: null,
      method: "NAME",
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
    return {
      tenantId: null,
      propertyId: null,
      loanId: null,
      method: "UNMATCHED",
      confidence: 0.75,
      category: "UTILITY_IN",
    };
  }

  // 9. Wohnungs- / Adress-Matching im Verwendungszweck & Zahlungspartner
  for (const tenant of tenants) {
    if (tenant.property) {
      const propName = tenant.property.name.toLowerCase().trim();
      const propAddress = tenant.property.address.toLowerCase().trim();
      const combinedText = `${rowRef} ${rowName}`.toLowerCase();

      // Straße und Hausnummer aus Adresse
      const streetWords = propAddress
        .replace(/[,.]/g, " ")
        .split(" ")
        .map((s) => s.trim())
        .filter((w) => w.length >= 5);

      const matchedStreet = streetWords.some((sw) => combinedText.includes(sw));
      const matchedPropName = propName.length >= 4 && combinedText.includes(propName);

      if (matchedStreet || matchedPropName) {
        // Prüfe ob mehrere Mieter an derselben Straße/Hausnummer wohnen
        const otherTenantsSameStreet = tenants.filter(
          (ot) =>
            ot.id !== tenant.id &&
            ot.property &&
            streetWords.some((sw) => ot.property!.address.toLowerCase().includes(sw))
        );

        if (otherTenantsSameStreet.length > 0) {
          // Mehrere Mieter im selben Gebäude!
          const unitWords = propName
            .replace(/[,.]/g, " ")
            .split(" ")
            .map((s) => s.trim().toLowerCase())
            .filter((w) => ["eg", "og", "1.og", "2.og", "3.og", "dg", "whg", "whg1", "whg2"].includes(w));

          const matchedUnit = unitWords.some((uw) => combinedText.includes(uw));
          if (matchedUnit) {
            const category = detectPaymentCategory(rowRef, rowName, row.amount);
            return {
              tenantId: row.amount > 0 ? tenant.id : null,
              propertyId: tenant.propertyId,
              loanId: null,
              method: "NAME",
              confidence: 0.85,
              category,
            };
          }
          continue;
        }

        // Einziger Mieter an dieser Adresse
        const category = detectPaymentCategory(rowRef, rowName, row.amount);
        return {
          tenantId: row.amount > 0 ? tenant.id : null,
          propertyId: tenant.propertyId,
          loanId: null,
          method: "NAME",
          confidence: 0.85,
          category,
        };
      }
    }
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
    
    // JSON aus der Antwort extrahieren
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
  loans: LoanInfo[] = []
): Promise<MatchResult> {
  // Stufe 1: Regelbasiert
  const ruleResult = ruleBasedMatch(row, tenants, loans);
  if (ruleResult && ruleResult.confidence >= 0.75) {
    return ruleResult;
  }

  // Stufe 2: KI-Fallback
  return aiMatch(row, tenants);
}
