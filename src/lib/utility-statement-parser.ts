import { PDFParse } from "pdf-parse";
import Anthropic from "@anthropic-ai/sdk";

export interface ExtractedCostItem {
  id: string;
  category: string;
  name: string;
  totalCost: number;
  distributionKey: string;
  amount: number;
}

export interface ParsedUtilityStatement {
  detectedAddress?: string;
  detectedUnit?: string;
  matchedPropertyId?: string;
  matchedSubUnitKey?: string;
  period: string;
  sqm?: number;
  items: ExtractedCostItem[];
  totalCosts: number;
  hasPropertyTax: boolean;
  rawTextPreview: string;
}

export interface PropertyMatchTarget {
  id: string;
  name: string;
  address: string;
  unitNumber?: string | null;
  sqm: number;
  unitDetails?: any;
}

const CATEGORY_MAP: Array<{
  category: string;
  defaultName: string;
  keywords: string[];
}> = [
  {
    category: "HEATING",
    defaultName: "Heizung & Warmwasser (gem. HeizkostenV)",
    keywords: ["heiz", "warmwasser", "fernwärme", "brennstoff", "techem", "ista", "brunata", "kalorimeta", "kalo", "gaszentral", "ölzentral"],
  },
  {
    category: "WATER",
    defaultName: "Wasserversorgung & Abwasser",
    keywords: ["kaltwasser", "abwasser", "wasserversorg", "frischwasser", "schmutzwasser", "niederschlag", "oberflächenwasser", "entwässer", "zählergebühr"],
  },
  {
    category: "TRASH",
    defaultName: "Müllbeseitigung & Straßenreinigung",
    keywords: ["müll", "abfall", "straßenreinigung", "müllabfuhr", "müllbeseitigung", "sperrmüll", "biotonne", "restmüll", "papier"],
  },
  {
    category: "INSURANCE",
    defaultName: "Gebäude- & Haftpflichtversicherung",
    keywords: ["versicherung", "wohngebäude", "gebäudever", "sachver", "haftpflicht", "feuerver", "leitungswasser", "sturm", "elementar"],
  },
  {
    category: "ELECTRICITY",
    defaultName: "Allgemeinstrom & Beleuchtung",
    keywords: ["allgemeinstrom", "treppenhauslicht", "hausstrom", "flurbeleucht", "außenbeleucht", "gemeinschaftsstrom"],
  },
  {
    category: "CHIMNEY",
    defaultName: "Schornsteinfeger & Immissionsmessung",
    keywords: ["schornsteinfeger", "kamin", "kehrgebühr", "immissions"],
  },
  {
    category: "CLEANING",
    defaultName: "Gebäudereinigung & Ungezieferbekämpfung",
    keywords: ["hausreinigung", "treppenhausreinigung", "gebäudereinigung", "flurreinigung", "ungeziefer", "schädlingsbekämpfung"],
  },
  {
    category: "GARDENING",
    defaultName: "Gartenpflege & Außenanlagen",
    keywords: ["gartenpflege", "grünanlage", "rasenschnitt", "außenanlage", "baumpflege"],
  },
  {
    category: "CARETAKER",
    defaultName: "Hauswart & Hausmeisterdienst",
    keywords: ["hauswart", "hausmeister", "hausmeisterdienst", "hausbetreuung"],
  },
  {
    category: "ELEVATOR",
    defaultName: "Aufzugsanlage (Betrieb & Wartung)",
    keywords: ["aufzug", "fahrstuhl", "personenaufzug", "aufzugswartung", "notruf"],
  },
  {
    category: "CABLE",
    defaultName: "Kabelanschluss & Antenne",
    keywords: ["kabel", "antenne", "breitband", "gemeinschaftsantenne"],
  },
  {
    category: "PROPERTY_TAX",
    defaultName: "Grundsteuer B",
    keywords: ["grundsteuer", "grst", "grundabgaben"],
  },
  {
    category: "OTHER",
    defaultName: "Sonstige Betriebskosten",
    keywords: ["sonstige", "rauchwarnmelder", "rauchmelder", "wartung", "dachrinne", "trinkwasser", "legionell"],
  },
];

const NON_ALLOCATABLE_KEYWORDS = [
  "verwaltungskosten",
  "verwalterhonorar",
  "verwaltergebühr",
  "verwaltervergütung",
  "instandhaltungsrücklage",
  "erhaltungsrücklage",
  "rücklagenzuführung",
  "zuführung zur rücklage",
  "zuführung zur erhaltungsrücklage",
  "zuführung rücklage",
  "zuführung erhaltungsrücklage",
  "kontoführung",
  "bankspesen",
  "kontogebühr",
  "nicht umlagefähig",
  "nicht-umlagefähig",
  "nicht umlegbar",
];

/**
 * Wandelt deutsche Beträge (z.B. "1.234,56 €" oder "450,00") in Zahlen um
 */
export function parseGermanNumber(val: string): number {
  if (!val) return 0;
  const clean = val
    .replace(/[€\s]/g, "")
    .replace(/\./g, "")
    .replace(",", ".");
  const num = parseFloat(clean);
  return isNaN(num) ? 0 : num;
}

/**
 * Erkennt aus dem PDF-Text die passende Liegenschaft und Untereinheit
 */
export function matchPropertyFromText(
  text: string,
  properties: PropertyMatchTarget[]
): { propertyId?: string; subUnitKey?: string; detectedAddress?: string; detectedUnit?: string } {
  const lower = text.toLowerCase();

  for (const prop of properties) {
    const addressKeywords = prop.address.toLowerCase().split(/[\s,]+/);
    const streetMatch = addressKeywords.some((w) => w.length >= 5 && lower.includes(w));

    if (streetMatch) {
      // Prüfe auf Untereinheiten (z.B. Siemensstraße 2.OG WE5 vs WE6)
      if (prop.unitDetails) {
        const details = typeof prop.unitDetails === "string" ? JSON.parse(prop.unitDetails) : prop.unitDetails;
        for (const [key, sub] of Object.entries<any>(details)) {
          const subUnitNum = (sub.unitNumber || key).toLowerCase().replace(/[^a-z0-9]/g, "");
          const subKey = key.toLowerCase();
          const subFloor = (sub.floor || "").toLowerCase();

          // WE05 / WE5 / links
          const unitMatched =
            lower.includes(subUnitNum) ||
            lower.includes(`we ${sub.unitNumber?.replace(/[^0-9]/g, "")}`) ||
            lower.includes(`we${sub.unitNumber?.replace(/[^0-9]/g, "")}`) ||
            (subFloor.includes("links") && (lower.includes("links") || lower.includes("li."))) ||
            (subFloor.includes("rechts") && (lower.includes("rechts") || lower.includes("re.")));

          if (unitMatched) {
            return {
              propertyId: prop.id,
              subUnitKey: key,
              detectedAddress: prop.address,
              detectedUnit: sub.unitNumber || key,
            };
          }
        }
      }

      // Prüfe auf Hauptwohnung (z.B. WE1 oder EG)
      const propUnit = (prop.unitNumber || "").toLowerCase().replace(/[^a-z0-9]/g, "");
      const unitMatched = propUnit && (lower.includes(propUnit) || lower.includes(`we ${propUnit.replace(/[^0-9]/g, "")}`));
      const floorMatched = lower.includes("eg") || lower.includes("erdgeschoss");

      if (unitMatched || floorMatched || !prop.unitDetails) {
        return {
          propertyId: prop.id,
          detectedAddress: prop.address,
          detectedUnit: prop.unitNumber || undefined,
        };
      }
    }
  }

  return {};
}

/**
 * Regelbasierte Extraktion der umlagefähigen Betriebskosten aus dem Fließtext
 */
export function extractBetrKVFromText(text: string): {
  period: string;
  sqm?: number;
  items: ExtractedCostItem[];
  totalCosts: number;
  hasPropertyTax: boolean;
} {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);

  // 1. Abrechnungsperiode finden
  let period = String(new Date().getFullYear() - 1);
  const periodMatch = text.match(/(?:abrechnungszeitraum|abrechnungsjahr|zeitraum|jahr)[:\s]+(?:01\.01\.)?(\d{4})/i) ||
    text.match(/\b(202[0-9])\b/);
  if (periodMatch && periodMatch[1]) {
    period = periodMatch[1];
  }

  // 2. Wohnfläche / qm finden
  let sqm: number | undefined = undefined;
  const sqmMatch = text.match(/(\d{1,3}(?:[.,]\d{1,2})?)\s*(?:m²|qm|quadratmeter)/i);
  if (sqmMatch && sqmMatch[1]) {
    const val = parseGermanNumber(sqmMatch[1]);
    if (val > 10 && val < 500) sqm = val;
  }

  // 3. Einzelpositionen erkennen
  const extractedItems: ExtractedCostItem[] = [];
  let inNonAllocatableSection = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lowerLine = line.toLowerCase();

    // Sektionswechsel: Nicht-umlagefähige Kosten überspringen
    if (
      lowerLine.includes("nicht umlagefähig") ||
      lowerLine.includes("nicht-umlagefähig") ||
      lowerLine.includes("instandhaltungsrücklage") ||
      lowerLine.includes("erhaltungsrücklage") ||
      lowerLine.includes("verwaltungskosten")
    ) {
      // Wenn Zeile explizit eine Zwischenüberschrift ist
      if (lowerLine.includes("übersicht") || lowerLine.includes("kosten:") || lowerLine.length < 50) {
        inNonAllocatableSection = true;
      }
    }
    if (lowerLine.includes("umlagefähige kosten") || lowerLine.includes("umlagefähig nach betrkv")) {
      inNonAllocatableSection = false;
    }

    if (inNonAllocatableSection) {
      // Prüfe ob die Zeile nicht doch wieder umlagefähig ist
      const isAllocatableKeyword = CATEGORY_MAP.some((cat) =>
        cat.keywords.some((kw) => lowerLine.includes(kw))
      );
      if (!isAllocatableKeyword) continue;
    }

    // Wenn die Zeile selbst ein Ausschlusskriterium hat:
    if (NON_ALLOCATABLE_KEYWORDS.some((kw) => lowerLine.includes(kw))) {
      continue;
    }

    // Prüfe Kategorie
    let matchedCategory: (typeof CATEGORY_MAP)[0] | null = null;
    for (const cat of CATEGORY_MAP) {
      if (cat.keywords.some((kw) => lowerLine.includes(kw))) {
        matchedCategory = cat;
        break;
      }
    }

    if (!matchedCategory) continue;

    // Suche nach Geldbeträgen in der Zeile (z.B. "1.234,56" oder "450,00 €")
    // Häufige Muster: "450,00 €" oder " 450,00 "
    const amountMatches = Array.from(line.matchAll(/(\d{1,3}(?:\.\d{3})*,\d{2})\s*(?:€|eur)?/gi));
    if (amountMatches.length === 0) continue;

    // Beträge auswerten:
    // Wenn mehrere Beträge in der Zeile stehen (z.B. Gesamtkosten Liegenschaft ... Ihr Anteil):
    // In der Regel ist der letzte Betrag der Anteil der Wohnung!
    const amounts = amountMatches.map((m) => parseGermanNumber(m[1]));
    let tenantAmount = amounts[amounts.length - 1];
    let buildingTotal = amounts.length > 1 ? amounts[0] : tenantAmount;

    // Wenn der "letzte Betrag" unplausibel riesig ist (z.B. Gesamtkosten ganz hinten):
    if (amounts.length >= 2 && tenantAmount > 10000 && amounts[0] < 5000) {
      // Tausche, falls Gesamtkosten hinten standen
      buildingTotal = tenantAmount;
      tenantAmount = amounts[0];
    }

    // Verteilerschlüssel suchen (z.B. "41,00 / 340,00 m²" oder "125/1000 MEA" oder "Personen")
    let distKey = "Wohnfläche (m²)";
    const keyMatch = line.match(/(\d+(?:,\d+)?\s*\/\s*\d+(?:,\d+)?\s*(?:m²|qm|mea)?)/i) ||
      line.match(/(verbrauch|personen|einheiten|direkt|pauschal)/i);
    if (keyMatch && keyMatch[0]) {
      distKey = keyMatch[0].trim();
    } else if (matchedCategory.category === "HEATING") {
      distKey = "Verbrauch (70/30 HeizkostenV)";
    }

    // Zeilenbezeichnung sauber extrahieren
    let cleanName = line
      .replace(/(\d{1,3}(?:\.\d{3})*,\d{2})\s*(?:€|eur)?/gi, "")
      .replace(/(\d+(?:,\d+)?\s*\/\s*\d+(?:,\d+)?\s*(?:m²|qm|mea)?)/gi, "")
      .replace(/[:|;\t]/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    if (cleanName.length < 3 || cleanName.length > 80) {
      cleanName = matchedCategory.defaultName;
    }

    // Dopplungen vermeiden (falls selbe Kategorie bereits mit identischem Betrag erfasst)
    const exists = extractedItems.some(
      (it) => it.category === matchedCategory!.category && Math.abs(it.amount - tenantAmount) < 0.05
    );
    if (exists) continue;

    extractedItems.push({
      id: `item-${extractedItems.length + 1}`,
      category: matchedCategory.category,
      name: cleanName,
      totalCost: buildingTotal,
      distributionKey: distKey,
      amount: tenantAmount,
    });
  }

  const hasPropertyTax = extractedItems.some((it) => it.category === "PROPERTY_TAX");
  const totalCosts = extractedItems.reduce((s, it) => s + it.amount, 0);

  return {
    period,
    sqm,
    items: extractedItems,
    totalCosts,
    hasPropertyTax,
  };
}

/**
 * Tiefe KI-Extraktion via Anthropic Claude (sofern ANTHROPIC_API_KEY vorhanden)
 */
async function extractWithClaude(
  text: string,
  properties: PropertyMatchTarget[]
): Promise<ParsedUtilityStatement | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || apiKey.trim().length === 0) return null;

  try {
    const client = new Anthropic({ apiKey });
    const prompt = `
Du bist ein Experte für deutsches Mietrecht und Betriebskostenabrechnungen (§ 2 BetrKV / HeizkostenV).
Hier ist der ausgelesene Text einer WEG-Hausgeldabrechnung / Betriebskostenabrechnung einer Hausverwaltung:

"""
${text.slice(0, 15000)}
"""

Extrahiere die umlagefähigen Betriebskosten für die Wohnung als valides JSON nach folgendem Schema:
{
  "detectedAddress": "Adresse falls vorhanden",
  "detectedUnit": "WE-Nummer oder Etage z.B. WE 05 oder 2.OG links",
  "period": "Abrechnungsjahr z.B. 2024",
  "sqm": 41.0,
  "items": [
    {
      "category": "HEATING | WATER | TRASH | INSURANCE | ELECTRICITY | CHIMNEY | CLEANING | GARDENING | CARETAKER | ELEVATOR | CABLE | PROPERTY_TAX | OTHER",
      "name": "Genaue deutsche Bezeichnung der Position",
      "totalCost": 1200.00,
      "distributionKey": "z.B. Wohnfläche (41 m² / 340 m²) oder Verbrauch 70/30 oder MEA",
      "amount": 145.20
    }
  ],
  "hasPropertyTax": false
}

WICHTIG:
- Ignoriere nicht-umlagefähige Positionen wie Erhaltungsrücklage/Instandhaltungsrücklage, Verwaltungskosten/Verwalterhonorar, Bankgebühren.
- 'amount' ist immer der Kostenanteil, der auf diese konkrete Wohnung entfällt.
- Antworte NUR mit dem JSON-Objekt.
`;

    const response = await client.messages.create({
      model: "claude-3-5-haiku-20241022",
      max_tokens: 3000,
      messages: [{ role: "user", content: prompt }],
    });

    const reply = response.content[0].type === "text" ? response.content[0].text : "";
    const jsonMatch = reply.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    const data = JSON.parse(jsonMatch[0]);
    const items: ExtractedCostItem[] = (data.items || []).map((it: any, idx: number) => ({
      id: `ai-item-${idx + 1}`,
      category: it.category || "OTHER",
      name: it.name || "Betriebskosten",
      totalCost: Number(it.totalCost) || Number(it.amount) || 0,
      distributionKey: it.distributionKey || "Wohnfläche (m²)",
      amount: Number(it.amount) || 0,
    }));

    const totalCosts = items.reduce((s, it) => s + it.amount, 0);

    // Property-Match
    const matched = matchPropertyFromText(`${data.detectedAddress || ""} ${data.detectedUnit || ""} ${text}`, properties);

    return {
      detectedAddress: data.detectedAddress,
      detectedUnit: data.detectedUnit,
      matchedPropertyId: matched.propertyId,
      matchedSubUnitKey: matched.subUnitKey,
      period: data.period || String(new Date().getFullYear() - 1),
      sqm: data.sqm,
      items,
      totalCosts,
      hasPropertyTax: items.some((it) => it.category === "PROPERTY_TAX"),
      rawTextPreview: text.slice(0, 500),
    };
  } catch (err) {
    console.warn("Claude AI extraction error (falling back to rule-based parser):", err);
    return null;
  }
}

/**
 * Hauptfunktion: Liest PDF-Buffer oder Text aus und liefert die strukturierte Abrechnung
 */
export async function parseUtilityStatementPdf(
  fileBuffer: Buffer,
  properties: PropertyMatchTarget[] = []
): Promise<ParsedUtilityStatement> {
  let fullText = "";

  try {
    const parser = new PDFParse({ data: fileBuffer });
    const result = await parser.getText();
    fullText = result.text || "";
  } catch (err: any) {
    console.error("PDFParse error:", err);
    throw new Error(`PDF konnte nicht gelesen werden: ${err.message || String(err)}`);
  }

  if (!fullText.trim()) {
    throw new Error("Das PDF enthält keinen lesbaren Text (möglicherweise ein reiner Bild-Scan).");
  }

  // 1. Versuche KI-Extraktion falls Key vorhanden
  const aiResult = await extractWithClaude(fullText, properties);
  if (aiResult && aiResult.items.length > 0) {
    return aiResult;
  }

  // 2. Schnelle & präzise regelbasierte Extraktion
  const ruleResult = extractBetrKVFromText(fullText);
  const matched = matchPropertyFromText(fullText, properties);

  return {
    detectedAddress: matched.detectedAddress,
    detectedUnit: matched.detectedUnit,
    matchedPropertyId: matched.propertyId,
    matchedSubUnitKey: matched.subUnitKey,
    period: ruleResult.period,
    sqm: ruleResult.sqm,
    items: ruleResult.items,
    totalCosts: ruleResult.totalCosts,
    hasPropertyTax: ruleResult.hasPropertyTax,
    rawTextPreview: fullText.slice(0, 600),
  };
}
