/**
 * Reine, umgebungsunabhängige Wohnungs- & Wohneinheits-Erkennung (Server & Client).
 */

export interface PropertyMatchInfo {
  id: string;
  name: string;
  address: string;
  floor?: string | null;
  unitNumber?: string | null;
  sqm?: number | null;
  hausgeld?: number | null;
  maintenanceReserve?: number | null;
  hausgeldDetails?: string | null;
}

export interface PropertyMatchCandidate {
  property: PropertyMatchInfo | null;
  score: number;
  addressMatched: boolean;
  unitMatched: boolean;
  floorMatched: boolean;
  /** Wenn ein Text nur das Haus (z.B. "Siemensstraße 28") nennt und dort mehrere Wohnungen liegen */
  ambiguousBuildingProperties?: PropertyMatchInfo[];
}

export function normalizeMatchText(input: string): string {
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
export function parseUnitTokens(
  rawUnit?: string | null
): Array<{ raw: string; prefix?: "WE" | "WHG"; digits?: string }> {
  if (!rawUnit || !rawUnit.trim()) return [];
  const parts = rawUnit
    .split(/[,;/&+|]+|\bund\b/i)
    .map((p) => p.trim())
    .filter(Boolean);

  return parts.map((raw) => {
    const normalized = normalizeMatchText(raw).replace(/\s+/g, "");
    const match = normalized.match(/^(we|whg\.?(?:nr\.?)?|wohnung(?:nr\.?)?|w)?0*(\d+)$/i);
    let prefix: "WE" | "WHG" | undefined;
    if (match?.[1]) {
      const p = match[1].toLowerCase();
      if (p.startsWith("we") || p === "w") prefix = "WE";
      else if (p.startsWith("whg") || p.startsWith("wohnung")) prefix = "WHG";
    }
    return {
      raw: normalizeMatchText(raw),
      prefix,
      digits: match ? match[2] : undefined,
    };
  });
}

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
      new RegExp(`\\b\\d+[a-z]+\\d*w0*${d}\\b`, "i"),
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
  return new RegExp(`\\b${escapeRegExp(token.raw)}\\b`, "i").test(normalizedText)
    ? "EXACT"
    : null;
}

function matchesFloorToken(normalizedText: string, floor?: string | null): boolean {
  if (!floor || !floor.trim()) return false;
  const f = normalizeMatchText(floor).replace(/\s+/g, "");
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
  return new RegExp(`\\b${escapeRegExp(normalizeMatchText(floor.trim()))}\\b`, "i").test(
    normalizedText
  );
}

export function extractAddressKeywords(prop: PropertyMatchInfo): string[] {
  const genericWords = new Set([
    "wohnung", "haus", "apartment", "eg", "og", "dg", "ug", "links", "rechts", "mitte",
    "str", "weg", "platz", "allee", "ring", "gasse", "damm",
  ]);
  const combined = `${normalizeMatchText(prop.address)} ${normalizeMatchText(prop.name)}`;
  const words = combined
    .replace(/[,.;:/()]/g, " ")
    .split(/\s+/)
    .map((w) => w.trim())
    .filter((w) => w.length >= 4 && !genericWords.has(w) && !/^\d+[a-z]?$/.test(w));

  const expanded = new Set<string>(words);
  for (const w of words) {
    const stem = w.replace(/(?:str|weg|allee|platz)$/i, "");
    if (stem.length >= 4) {
      expanded.add(stem);
    }
    if (stem.startsWith("siemen")) {
      expanded.add("siemen");
    }
  }
  return Array.from(expanded);
}

/**
 * Gewichteter Objekt- & Wohneinheits-Abgleich.
 * Bei mehrteiligen Objekten (z. B. mehrere Wohnungen in der Siemensstraße 28) ohne Angabe von
 * Wohneinheit oder Etage wird bewusst KEINE einzelne Wohnung geraten, sondern `ambiguousBuildingProperties`
 * zurückgegeben, sodass die Buchung zur Prüfung / Aufteilung markiert wird.
 */
export function findBestMatchingProperty(
  rawText: string,
  properties: PropertyMatchInfo[]
): PropertyMatchCandidate | null {
  if (properties.length === 0) return null;
  const text = normalizeMatchText(rawText);

  const scored = properties.map((prop) => {
    let score = 0;
    let addressMatched = false;
    let unitMatched = false;
    let floorMatched = false;

    const addrNorm = normalizeMatchText(prop.address);
    const nameNorm = normalizeMatchText(prop.name);

    // 1. Straßen-/Objekt-/Verwaltungs-Abgleich (+100)
    const keywords = extractAddressKeywords(prop);
    if (keywords.some((kw) => text.includes(kw))) {
      score += 100;
      addressMatched = true;
    }

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

    // 2. Wohneinheit-Abgleich (+65 exakt / +55 Ziffer, +40 pro weiterer passender Einheit)
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
      if (!addressMatched && unitTokens.length === 1 && totalUnitHits === 1) {
        score += 10;
      }
    } else if (unitTokens.length === 0) {
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

    // 3. Etage-Abgleich (+30)
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

  scored.sort((a, b) => b.score - a.score);
  const top = scored[0];
  if (!top || top.score === 0) return null;

  // Wenn die Straße mehrere Wohnungen enthält und im Text KEINE Wohneinheit und KEINE Etage steht:
  // NICHT pauschal auf eine einzelne Wohnung (z.B. 2.OG) zuordnen!
  if (top.addressMatched && !top.unitMatched && !top.floorMatched) {
    const sameBuildingCandidates = scored.filter(
      (c) => c.addressMatched && c.score === top.score
    );
    if (sameBuildingCandidates.length > 1) {
      return {
        property: null,
        score: top.score,
        addressMatched: true,
        unitMatched: false,
        floorMatched: false,
        ambiguousBuildingProperties: sameBuildingCandidates.map((c) => c.property),
      };
    }
  }

  return top;
}
