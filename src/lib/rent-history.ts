export interface RentAdjustmentItem {
  id?: string;
  propertyId: string;
  effectiveDate: Date | string;
  newColdRent?: number | null;
  newUtilities?: number | null;
  previousColdRent?: number | null;
  previousUtilities?: number | null;
  type?: string;
  notes?: string | null;
}

export interface ResolvedRent {
  coldRent: number;
  utilities: number;
  warmRent: number;
  isAdjusted: boolean;
  adjustmentNote?: string | null;
}

/**
 * Ermittelt die historisch gültige Soll-Miete (Kaltmiete, Nebenkostenvorauszahlung, Warmmiete)
 * für eine Einheit in einem bestimmten Monat (Format "YYYY-MM").
 *
 * Berücksichtigt alle eingetragenen Mietanpassungen und deren Wirksamkeitsdatum:
 * - Liegt der Monat VOR einer Mieterhöhung, gilt die vorherige Miete (previousColdRent / previousUtilities)
 * - Liegt der Monat NACH dem Wirksamkeitsdatum, gilt die neue Miete (newColdRent / newUtilities)
 */
export function getRentForPeriod(
  tenant: { coldRent: number; utilities: number; propertyId?: string },
  periodStr: string, // "YYYY-MM"
  adjustments: RentAdjustmentItem[] = []
): ResolvedRent {
  const currentCold = tenant.coldRent || 0;
  const currentUtil = tenant.utilities || 0;

  if (!periodStr || !adjustments || adjustments.length === 0) {
    return {
      coldRent: currentCold,
      utilities: currentUtil,
      warmRent: currentCold + currentUtil,
      isAdjusted: false,
    };
  }

  // Zielmonat (Ende des Monats für Vergleich, z.B. 2025-06-30)
  const [yStr, mStr] = periodStr.split("-");
  const year = parseInt(yStr, 10);
  const month = parseInt(mStr, 10);
  if (isNaN(year) || isNaN(month)) {
    return {
      coldRent: currentCold,
      utilities: currentUtil,
      warmRent: currentCold + currentUtil,
      isAdjusted: false,
    };
  }

  const periodDate = new Date(year, month - 1, 1);
  const periodEnd = new Date(year, month, 0, 23, 59, 59);

  // Chronologisch nach Wirksamkeitsdatum sortieren
  const sorted = [...adjustments].sort(
    (a, b) => new Date(a.effectiveDate).getTime() - new Date(b.effectiveDate).getTime()
  );

  // 1. Suche die letzte Anpassung, die VOR oder IM Zielmonat wirksam wurde
  const pastAdjustments = sorted.filter(
    (adj) => new Date(adj.effectiveDate).getTime() <= periodEnd.getTime()
  );

  if (pastAdjustments.length > 0) {
    const latestAdj = pastAdjustments[pastAdjustments.length - 1];
    const cold = latestAdj.newColdRent !== null && latestAdj.newColdRent !== undefined
      ? latestAdj.newColdRent
      : currentCold;
    const util = latestAdj.newUtilities !== null && latestAdj.newUtilities !== undefined
      ? latestAdj.newUtilities
      : currentUtil;
    const warm = cold + util;
    const isDifferent = Math.abs(warm - (currentCold + currentUtil)) > 0.009;

    return {
      coldRent: cold,
      utilities: util,
      warmRent: warm,
      isAdjusted: isDifferent,
      adjustmentNote: isDifferent
        ? latestAdj.notes || `Mietanpassung ab ${new Date(latestAdj.effectiveDate).toLocaleDateString("de-DE")}`
        : null,
    };
  }

  // 2. Zielmonat liegt VOR der allerersten dokumentierten Anpassung
  const earliestAdj = sorted[0];
  if (earliestAdj && new Date(earliestAdj.effectiveDate).getTime() > periodEnd.getTime()) {
    // Wenn Vorher-Werte hinterlegt sind, greifen diese!
    const prevCold = earliestAdj.previousColdRent !== null && earliestAdj.previousColdRent !== undefined
      ? earliestAdj.previousColdRent
      : currentCold;
    const prevUtil = earliestAdj.previousUtilities !== null && earliestAdj.previousUtilities !== undefined
      ? earliestAdj.previousUtilities
      : currentUtil;
    const prevWarm = prevCold + prevUtil;
    const isDifferent = Math.abs(prevWarm - (currentCold + currentUtil)) > 0.009;

    return {
      coldRent: prevCold,
      utilities: prevUtil,
      warmRent: prevWarm,
      isAdjusted: isDifferent,
      adjustmentNote: isDifferent
        ? (earliestAdj.notes || `Historischer Soll vor Anpassung zum ${new Date(earliestAdj.effectiveDate).toLocaleDateString("de-DE")}`)
        : null,
    };
  }

  return {
    coldRent: currentCold,
    utilities: currentUtil,
    warmRent: currentCold + currentUtil,
    isAdjusted: false,
  };
}
