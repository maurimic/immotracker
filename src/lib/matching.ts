/**
 * Zweistufige Matching-Pipeline:
 * 1. Regelbasiertes Matching (IBAN / Darlehen / Hausgeld / Name / Adresse + Wohneinheit) – kostenfrei
 * 2. KI-Fallback via Claude Haiku – bei unklaren Buchungen
 */

import Anthropic from "@anthropic-ai/sdk";
import { SheetRow } from "./google-sheets";

export interface PropertyInfo {
  id: string;
  name: string;
  address: string;
  floor?: string | null;
  unitNumber?: string | null;
}

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
 * Normalisiert deutschen Text für fehlertoleranten Abgleich (Umlaute, ß, Abkürzungen wie Str./Straße)
 */
function normalizeText(input: string): string {
  return input
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/stra(?:ss|ß)e/g, "str")
    .replace(/str\./g, "str");
}

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Zerlegt das Feld Wohneinheit (z.B. "WE1", "WE5, WE6", "WE 5 / WE 6", "Whg. 1") in einzelne Token
 */
export function parseUnitTokens(rawUnit?: string | null): Array<{ raw: string; prefix?: "WE" | "WHG"; digits?: string }> {
  if (!rawUnit || !rawUnit.trim()) return [];
  const parts = rawUnit
    .split(/[,;/&+|]+|\bund\b/i)
    .map((p) => p.trim())
    .filter(Boolean);

  return parts.map((raw) => {
    const normalized = normalizeText(raw).replace(/\s+/g, "");
    const match = normalized.match(/^(we|whg\.?(?:nr\.?)?|wohnung(?:nr\.?)?|w)?0*(\d+)$/i);
    let prefix: "WE" | "WHG" | undefined;
    if (match?.[1]) {
      const p = match[1].toLowerCase();
      if (p.startsWith("we") || p === "w") prefix = "WE";
      else if (p.startsWith("whg") || p.startsWith("wohnung")) prefix = "WHG";
    }
    return {
      raw: normalizeText(raw),
      prefix,
      digits: match ? match[2] : undefined,
    };
  });
}

/**
 * Prüft, ob eine Wohneinheit im Banktext vorkommt und gibt die Passgenauigkeit zurück:
 * - "EXACT": z.B. "WE1" findet "WE 1" / "91H1W1", oder "Whg. 1" findet "Whg. 1" / "Wohnung Nr. 1"
 * - "NUMBER": gleiche Ziffer mit anderem Präfix (z.B. "WE 1" vs "Whg 1")
 */
function matchesUnitToken(
  normalizedText: string,
  token: { raw: string; prefix?: "WE" | "WHG"; digits?: string }
): "EXACT" | "NUMBER" | null {
  if (token.digits) {
    const d = token.digits;
    const wePatterns = [
      new RegExp(`\\bwe\\s*0*${d}\\b`, "i"),
      new RegExp(`\\bwe\\s*0*\\d+\\s*[/&-]+\\s*0*${d}\\b`, "i"),
      new RegExp(`\\bwe\\s*0*${d}\\s*[/&-]+\\s*0*\\d+\\b`, "i"),
      new RegExp(`\\b\\d+[a-z]+\\d*w0*${d}\\b`, "i"), // z.B. 91H1W5, 91H1W6, 91H1W1
    ];
    const whgPatterns = [
      new RegExp(`\\bwhg\\.?\\s*(?:nr\\.?\\s*)?0*${d}\\b`, "i"),
      new RegExp(`\\bwohnung\\s*(?:nr\\.?\\s*)?0*${d}\\b`, "i"),
    ];

    const weHit = wePatterns.some((rx) => rx.test(normalizedText));
    const whgHit = whgPatterns.some((rx) => rx.test(normalizedText));

    if (!weHit && !whgHit) return null;
    if (token.prefix === "WE" && weHit) return "EXACT";
    if (token.prefix === "WHG" && whgHit) return "EXACT";
    if (!token.prefix) return "EXACT";
    return "NUMBER";
  }

  const compact = token.raw.replace(/\s+/g, "");
  if (compact.length < 2) return null;
  return new RegExp(`\\b${escapeRegExp(token.raw)}\\b`, "i").test(normalizedText) ? "EXACT" : null;
}

/**
 * Prüft, ob die Etage (z.B. "EG", "2.OG") im Banktext vorkommt
 */
function matchesFloorToken(normalizedText: string, floor?: string | null): boolean {
  if (!floor || !floor.trim()) return false;
  const f = normalizeText(floor).replace(/\s+/g, "");
  if (f === "eg" || f === "erdgeschoss") {
    return /\b(eg|erdgeschoss)\b/i.test(normalizedText);
  }
  if (f === "dg" || f === "dachgeschoss") {
    return /\b(dg|dachgeschoss)\b/i.test(normalizedText);
  }
  if (f === "ug" || f === "untergeschoss" || f === "kg") {
    return /\b(ug|untergeschoss|kg|kellergeschoss)\b/i.test(normalizedText);
  }
  const ogMatch = f.match(/^(\d+)\.?og$/);
  if (ogMatch) {
    const lvl = ogMatch[1];
    return new RegExp(`\\b${lvl}\\.?\\s*(?:og|obergeschoss)\\b`, "i").test(normalizedText);
  }
  return new RegExp(`\\b${escapeRegExp(normalizeText(floor.trim()))}\\b`, "i").test(normalizedText);
}

/**
 * Ermittelt aussagekräftige Straßen-/Ortswörter einer Immobilie
 */
function extractAddressKeywords(prop: PropertyInfo): string[] {
  const genericWords = new Set([
    "wohnung", "haus", "apartment", "eg", "og", "dg", "ug", "links", "rechts", "mitte",
    "str", "weg", "platz", "allee", "ring", "gasse", "damm",
  ]);
  const combined = `${normalizeText(prop.address)} ${normalizeText(prop.name)}`;
  const words = combined
    .replace(/[,.;:/()]/g, " ")
    .split(/\s+/)
    .map((w) => w.trim())
    .filter((w) => w.length >= 4 && !genericWords.has(w) && !/^\d+[a-z]?$/.test(w));

  // Straßen-Stamm ohne "str" ergänzen (z.B. "siemensstr" -> "siemens", "siemenstr" -> "siemen", "bockumweg" -> "bockum")
  const expanded = new Set<string>(words);
  for (const w of words) {
    const stem = w.replace(/(?:str|weg|allee|platz)$/i, "");
    if (stem.length >= 4) {
      expanded.add(stem);
    }
    // Toleranz für "siemen" vs "siemens"
    if (stem.startsWith("siemen")) {
      expanded.add("siemen");
    }
  }
  return Array.from(expanded);
}

interface PropertyMatchCandidate {
  property: PropertyInfo;
  score: number;
  addressMatched: boolean;
  unitMatched: boolean;
  floorMatched: boolean;
}

/**
 * Gewichteter Objekt- & Wohneinheits-Abgleich.
 * Löst Konflikte bei gleichen Wohneinheitsnummern in verschiedenen Häusern (z.B. WE6 in Siemensstraße vs. WE6 in Schwerte)
 * und unterscheidet mehrere Einheiten im selben Haus (z.B. WE1 vs. WE5/WE6 in Siemensstraße 28).
 */
export function findBestMatchingProperty(
  rawText: string,
  properties: PropertyInfo[]
): PropertyMatchCandidate | null {
  if (properties.length === 0) return null;
  const text = normalizeText(rawText);

  const candidates: PropertyMatchCandidate[] = properties.map((prop) => {
    let score = 0;
    let addressMatched = false;
    let unitMatched = false;
    let floorMatched = false;

    const addrNorm = normalizeText(prop.address);
    const nameNorm = normalizeText(prop.name);

    // 1. Straßen-/Objekt-/Verwaltungs-Abgleich (+100)
    const keywords = extractAddressKeywords(prop);
    if (keywords.some((kw) => text.includes(kw))) {
      score += 100;
      addressMatched = true;
    }

    // Bekannte Hausverwaltungen direkt dem jeweiligen Objekt zuordnen
    if (!addressMatched) {
      if ((addrNorm.includes("dortmunder") || nameNorm.includes("schwerte")) && text.includes("buechel")) {
        score += 100;
        addressMatched = true;
      } else if ((addrNorm.includes("bockum") || nameNorm.includes("bockum")) && text.includes("schubert")) {
        score += 100;
        addressMatched = true;
      } else if ((addrNorm.includes("siemen") || nameNorm.includes("siemen")) && text.includes("langer")) {
        score += 100;
        addressMatched = true;
      }
    }

    // 2. Wohneinheit-Abgleich (+65 exakt / +55 Ziffer, +40 pro weiterer passender Einheit wie "WE5/WE6")
    const unitTokens = parseUnitTokens(prop.unitNumber);
    let exactMatches = 0;
    let numberMatches = 0;
    for (const token of unitTokens) {
      const m = matchesUnitToken(text, token);
      if (m === "EXACT") exactMatches++;
      else if (m === "NUMBER") numberMatches++;
    }
    const totalUnitHits = exactMatches + numberMatches;
    if (totalUnitHits > 0) {
      const baseUnitScore = exactMatches > 0 ? 65 : 55;
      score += baseUnitScore + (totalUnitHits - 1) * 40;
      unitMatched = true;
      // Tie-Breaker: wenn nur genau eine Wohneinheit im Text steht und keine Straße genannt ist,
      // bevorzugt ein 1:1 zugeordnetes Einzel-WE-Objekt (z.B. "WE 6" allein -> Schwerte statt "WE5, WE6")
      if (!addressMatched && unitTokens.length === 1 && totalUnitHits === 1) {
        score += 10;
      }
    } else if (unitTokens.length === 0) {
      // Abwärtskompatibilität falls unitNumber noch nicht ausgefüllt wurde
      if (addrNorm.includes("siemen") || nameNorm.includes("siemen")) {
        if ((prop.floor?.toLowerCase().includes("2") || nameNorm.includes("2.og")) &&
            (/91h1w[56]/i.test(text) || /\bwe\s*[56]\b/i.test(text))) {
          score += 50;
          unitMatched = true;
        } else if ((prop.floor?.toLowerCase().includes("eg") || nameNorm.includes("eg")) &&
                   (/91h1w1/i.test(text) || /\bwe\s*1\b/i.test(text))) {
          score += 50;
          unitMatched = true;
        }
      } else if ((addrNorm.includes("bockum") || nameNorm.includes("bockum")) &&
                 (/\bwhg\.?\s*1\b/i.test(text) || /\bwohnung\s*(?:nr\.?\s*)?1\b/i.test(text))) {
        score += 50;
        unitMatched = true;
      } else if ((addrNorm.includes("dortmunder") || nameNorm.includes("schwerte")) &&
                 /\bwe\s*6\b/i.test(text)) {
        score += 50;
        unitMatched = true;
      }
    }

    // 3. Etage-Abgleich (+30) anhand des Feldes floor oder Namens-Stockwerk
    if (matchesFloorToken(text, prop.floor)) {
      score += 30;
      floorMatched = true;
    } else if (!prop.floor) {
      if (nameNorm.includes("2.og") && /\b2\.?\s*(og|obergeschoss)\b/i.test(text)) {
        score += 30;
        floorMatched = true;
      } else if (nameNorm.includes("1.og") && /\b1\.?\s*(og|obergeschoss)\b/i.test(text)) {
        score += 30;
        floorMatched = true;
      } else if (/\beg\b/.test(nameNorm) && /\b(eg|erdgeschoss)\b/i.test(text)) {
        score += 30;
        floorMatched = true;
      }
    }

    return {
      property: prop,
      score,
      addressMatched,
      unitMatched,
      floorMatched,
    };
  });

  // Nach höchstem Score sortieren
  candidates.sort((a, b) => b.score - a.score);
  const top = candidates[0];
  if (!top || top.score === 0) return null;

  // Sonderfall: Mehrere Einheiten am selben Haus, Straße getroffen, aber weder WE noch Etage angegeben (z.B. Sammel-Sonderumlage)
  if (top.addressMatched && !top.unitMatched && !top.floorMatched) {
    const sameStreetProps = candidates.filter((c) => c.addressMatched && c.score === top.score);
    if (sameStreetProps.length > 1) {
      const preferred =
        sameStreetProps.find((c) => normalizeText(c.property.name).includes("2.og")) ||
        sameStreetProps[0];
      return preferred;
    }
  }

  return top;
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
        const unitMatch = bestPropMatch
          ? matches.find((t) => t.propertyId === bestPropMatch.property.id)
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

  // 3. Hausgeld & WEG-Sonderumlagen (mit Wohneinheit-, Etage- und Straßen-Gewichtung)
  const isHausgeld =
    rowRef.includes("hausgeld") ||
    rowName.includes("hausgeld") ||
    rowRef.includes("sonderumlage") ||
    rowName.includes("sonderumlage") ||
    rowName.startsWith("weg ") ||
    rowName.includes(" weg ");

  if (isHausgeld) {
    const propCandidate = findBestMatchingProperty(combinedFullText, allProperties);
    return {
      tenantId: null,
      propertyId: propCandidate?.property.id || null,
      loanId: null,
      method: "NAME",
      confidence: propCandidate ? 0.95 : 0.85,
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
      if (textPropMatch && tenant.propertyId === textPropMatch.property.id) {
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
    return {
      tenantId: null,
      propertyId: null,
      loanId: null,
      method: "NAME",
      confidence: 0.95,
      category: "OTHER",
    };
  }

  // 7. Grundsteuer / Grundbesitzabgaben
  if (rowRef.includes("grundsteuer") || rowRef.includes("grundbesitzabgab")) {
    const propCandidate = findBestMatchingProperty(combinedFullText, allProperties);
    return {
      tenantId: null,
      propertyId: propCandidate?.addressMatched || propCandidate?.unitMatched ? propCandidate.property.id : null,
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
    const propCandidate = findBestMatchingProperty(combinedFullText, allProperties);
    return {
      tenantId: null,
      propertyId: propCandidate?.addressMatched || propCandidate?.unitMatched ? propCandidate.property.id : null,
      loanId: null,
      method: propCandidate ? "NAME" : "UNMATCHED",
      confidence: propCandidate ? 0.85 : 0.75,
      category: "UTILITY_IN",
    };
  }

  // 9. Wohnungs-, Wohneinheits- & Adress-Matching im Verwendungszweck & Zahlungspartner
  const directPropMatch = findBestMatchingProperty(combinedFullText, allProperties);
  if (directPropMatch && (directPropMatch.addressMatched || directPropMatch.unitMatched)) {
    const matchedProp = directPropMatch.property;
    // Prüfe ob im selben Haus mehrere Wohnungen existieren -> fordere WE/Etage wenn eindeutig nötig
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
