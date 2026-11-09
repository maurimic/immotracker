import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Formatiert eine Zahl als Euro-Betrag
 */
export function formatCurrency(amount: number, decimals = 2): string {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(amount);
}

/**
 * Formatiert Beträge kompakt (z.B. für Diagrammachsen):
 * - von 0 bis 999 €: genauer Betrag (z.B. "0 €", "100 €", "200 €", "850 €")
 * - ab 1.000 €: kompakte Darstellung in k€ (z.B. "1k €", "1,1k €", "15k €")
 */
export function formatCompactCurrency(amount: number): string {
  if (Math.abs(amount) < 1000) {
    return `${Math.round(amount)} €`;
  }
  const kVal = amount / 1000;
  const formatted = kVal.toLocaleString("de-DE", {
    minimumFractionDigits: kVal % 1 === 0 ? 0 : 1,
    maximumFractionDigits: 1,
  });
  return `${formatted}k €`;
}

/**
 * Validiert und parst einen Datumsstring (deutsch oder ISO) in ein ISO YYYY-MM-DD.
 * Gibt null zurück, wenn das Datum ungültig ist.
 */
export function parseDateToISO(input?: unknown): string | null {
  if (!input) return null;
  if (input instanceof Date) {
    if (isNaN(input.getTime())) return null;
    const y = input.getFullYear();
    const m = String(input.getMonth() + 1).padStart(2, "0");
    const d = String(input.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  const trimmed = String(input).trim();
  if (!trimmed) return null;

  // 1. Bereits ISO YYYY-MM-DD (ggf. mit Zeitanteil)
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
    const parts = trimmed.split("T")[0].split("-");
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    const d = parseInt(parts[2], 10);
    const testDate = new Date(y, m - 1, d);
    if (
      !isNaN(testDate.getTime()) &&
      testDate.getFullYear() === y &&
      testDate.getMonth() === m - 1 &&
      testDate.getDate() === d
    ) {
      return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    }
  }

  // 2. Deutsches Format DD.MM.YYYY oder DD/MM/YYYY oder DD-MM-YYYY
  const match = trimmed.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})$/);
  if (match) {
    const day = parseInt(match[1], 10);
    const month = parseInt(match[2], 10);
    let year = parseInt(match[3], 10);
    if (year < 100) {
      year += year < 50 ? 2000 : 1900;
    }
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31 && year >= 1900 && year <= 2100) {
      const testDate = new Date(year, month - 1, day);
      if (
        testDate.getFullYear() === year &&
        testDate.getMonth() === month - 1 &&
        testDate.getDate() === day
      ) {
        return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      }
    }
  }

  // 3. Reines 8-stelliges Zahlenformat DDMMYYYY
  const digitsMatch = trimmed.match(/^(\d{2})(\d{2})(\d{4})$/);
  if (digitsMatch) {
    const day = parseInt(digitsMatch[1], 10);
    const month = parseInt(digitsMatch[2], 10);
    const year = parseInt(digitsMatch[3], 10);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31 && year >= 1900 && year <= 2100) {
      const testDate = new Date(year, month - 1, day);
      if (
        testDate.getFullYear() === year &&
        testDate.getMonth() === month - 1 &&
        testDate.getDate() === day
      ) {
        return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      }
    }
  }

  return null;
}

/**
 * Sichere Konvertierung beliebiger Datumseingaben in ein valides Date-Objekt.
 */
export function safeDate(val: unknown): Date | null {
  if (!val) return null;
  if (val instanceof Date) {
    return isNaN(val.getTime()) ? null : val;
  }
  const iso = parseDateToISO(val);
  if (iso) return new Date(iso);
  const d = new Date(String(val));
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Formatiert ein Datum auf Deutsch
 */
export function formatDate(date: Date | string, options?: Intl.DateTimeFormatOptions): string {
  const d = safeDate(date);
  if (!d) return typeof date === "string" ? date : "–";
  return d.toLocaleDateString("de-DE", options ?? {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

/**
 * Berechnet eine relative deutsche Zeitangabe für ein Datum (z.B. "heute", "gestern", "vor 3 Tagen", "vor einer Woche")
 */
export function formatRelativeDate(inputDate?: string | Date | null, baseDate = new Date()): string | null {
  if (!inputDate) return null;

  let d: Date | null = null;
  if (inputDate instanceof Date) {
    d = isNaN(inputDate.getTime()) ? null : inputDate;
  } else if (typeof inputDate === "string") {
    const iso = parseDateToISO(inputDate);
    if (iso) {
      const [y, m, day] = iso.split("-").map(Number);
      d = new Date(y, m - 1, day);
    } else {
      const parsed = new Date(inputDate);
      d = isNaN(parsed.getTime()) ? null : parsed;
    }
  }

  if (!d) return null;

  const target = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const today = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate());

  const diffMs = today.getTime() - target.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    if (diffDays === -1) return "morgen";
    return `in ${Math.abs(diffDays)} Tagen`;
  }
  if (diffDays === 0) return "heute";
  if (diffDays === 1) return "gestern";
  if (diffDays === 2) return "vor 2 Tagen";
  if (diffDays >= 3 && diffDays <= 6) return `vor ${diffDays} Tagen`;
  if (diffDays >= 7 && diffDays <= 13) return "vor einer Woche";
  if (diffDays >= 14 && diffDays <= 20) return "vor 2 Wochen";
  if (diffDays >= 21 && diffDays <= 27) return "vor 3 Wochen";
  if (diffDays >= 28 && diffDays <= 34) return "vor 4 Wochen";
  if (diffDays >= 35 && diffDays <= 59) return "vor einem Monat";
  if (diffDays >= 60 && diffDays <= 365) {
    const months = Math.floor(diffDays / 30);
    return `vor ${months} Monaten`;
  }
  return "vor über einem Jahr";
}

/**
 * Formatiert ein Datum als Monats-String z.B. "Oktober 2026"
 */
export function formatMonth(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("de-DE", { month: "long", year: "numeric" });
}

/**
 * Gibt den aktuellen Monat als String zurück z.B. "2026-10"
 */
export function currentPeriod(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * Berechnet die Differenz in Monaten zwischen zwei Daten
 */
export function monthsDiff(from: Date, to: Date): number {
  return (
    (to.getFullYear() - from.getFullYear()) * 12 +
    (to.getMonth() - from.getMonth())
  );
}

export function formatYearsAndMonthsShort(months: number): string {
  if (months <= 0) return "Abgelaufen";
  const years = Math.floor(months / 12);
  const rem = months % 12;
  if (years === 0) return `${rem}M`;
  if (rem === 0) return `${years}J`;
  return `${years}J ${rem}M`;
}

export function formatYearsAndMonthsLong(months: number): string {
  if (months <= 0) return "abgelaufen";
  const years = Math.floor(months / 12);
  const rem = months % 12;

  const yStr = years === 1 ? "1 Jahr" : `${years} Jahre`;
  const mStr = rem === 1 ? "1 Monat" : `${rem} Monate`;

  if (years === 0) return mStr;
  if (rem === 0) return yStr;
  return `${yStr}, ${mStr}`;
}

/**
 * Bestimmt die Zinsbindungs-Ampelfarbe
 */
export function getFixedRateStatus(fixedRateEnd: Date): {
  color: "green" | "yellow" | "red";
  label: string;
  months: number;
} {
  const now = new Date();
  const months = monthsDiff(now, fixedRateEnd);

  if (months < 0) {
    return { color: "red", label: "Abgelaufen", months };
  } else if (months < 12) {
    return { color: "red", label: `${months} Monate`, months };
  } else if (months < 36) {
    const label = formatYearsAndMonthsShort(months);
    return { color: "yellow", label, months };
  } else {
    const label = formatYearsAndMonthsShort(months);
    return {
      color: "green",
      label,
      months,
    };
  }
}

/**
 * Berechnet den Zahlungsstatus für einen Monat
 */
export function getPaymentStatus(
  paidAmount: number,
  shouldAmount: number
): "PAID" | "PARTIAL" | "OVERDUE" | "PENDING" {
  if (paidAmount >= shouldAmount) return "PAID";
  if (paidAmount > 0) return "PARTIAL";

  // Überfällig ab 5. Werktag
  const now = new Date();
  const workingDays = countWorkingDays(
    new Date(now.getFullYear(), now.getMonth(), 1),
    now
  );
  if (workingDays >= 5) return "OVERDUE";
  return "PENDING";
}

/**
 * Zählt Werktage (Mo-Fr) zwischen zwei Daten
 */
export function countWorkingDays(from: Date, to: Date): number {
  let count = 0;
  const current = new Date(from);
  while (current <= to) {
    const dayOfWeek = current.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) count++;
    current.setDate(current.getDate() + 1);
  }
  return count;
}

/**
 * Annuitäten-Berechnung: Zins- und Tilgungsanteil für eine Periode
 */
export function calculateAmortization(
  balance: number,
  annualInterestRate: number,
  monthlyPayment: number
): { interestPart: number; principalPart: number; newBalance: number } {
  const monthlyRate = annualInterestRate / 100 / 12;
  const interestPart = balance * monthlyRate;
  const principalPart = Math.min(monthlyPayment - interestPart, balance);
  const newBalance = Math.max(0, balance - principalPart);
  return { interestPart, principalPart, newBalance };
}

/**
 * Erstellt einen kompletten Tilgungsplan bis zur vollständigen Tilgung
 */
export function buildAmortizationSchedule(
  initialBalance: number,
  annualInterestRate: number,
  monthlyPayment: number,
  startDate: Date
): Array<{
  period: string;
  balanceBefore: number;
  interestPart: number;
  principalPart: number;
  balanceAfter: number;
}> {
  const schedule = [];
  let balance = initialBalance;
  const current = new Date(startDate);

  while (balance > 0.01) {
    const period = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, "0")}`;
    const { interestPart, principalPart, newBalance } = calculateAmortization(
      balance,
      annualInterestRate,
      monthlyPayment
    );
    schedule.push({
      period,
      balanceBefore: balance,
      interestPart,
      principalPart,
      balanceAfter: newBalance,
    });
    balance = newBalance;
    current.setMonth(current.getMonth() + 1);
    if (schedule.length > 600) break; // Max 50 Jahre
  }
  return schedule;
}

/**
 * Berechnet die aktuelle Restschuld zum heutigen Tag basierend auf:
 * Ursprüngliche Kreditsumme, Sollzins (% p.a.), monatliche Annuität und Darlehensstart
 */
export function calculateCurrentBalanceFromTerms(
  originalAmount: number,
  annualInterestRate: number,
  monthlyPayment: number,
  startDate: Date | string,
  targetDate: Date | string = new Date()
): { balance: number; monthsElapsed: number } {
  if (!originalAmount || originalAmount <= 0) return { balance: 0, monthsElapsed: 0 };
  if (!monthlyPayment || monthlyPayment <= 0) return { balance: originalAmount, monthsElapsed: 0 };

  const start = typeof startDate === "string" ? new Date(startDate) : startDate;
  const target = typeof targetDate === "string" ? new Date(targetDate) : targetDate;
  if (isNaN(start.getTime()) || isNaN(target.getTime()) || start > target) {
    return { balance: originalAmount, monthsElapsed: 0 };
  }

  const months = monthsDiff(start, target);
  if (months <= 0) return { balance: originalAmount, monthsElapsed: 0 };

  let balance = originalAmount;
  for (let i = 0; i < months; i++) {
    const { newBalance } = calculateAmortization(balance, annualInterestRate, monthlyPayment);
    balance = newBalance;
    if (balance <= 0) {
      balance = 0;
      break;
    }
  }

  return {
    balance: Math.round(balance * 100) / 100,
    monthsElapsed: months,
  };
}

/**
 * Statustext und Farbe für Zahlungsstatus
 */
export function paymentStatusInfo(status: string): {
  label: string;
  className: string;
} {
  switch (status) {
    case "PAID":
      return { label: "Bezahlt", className: "badge-paid" };
    case "PARTIAL":
      return { label: "Teilzahlung", className: "badge-partial" };
    case "OVERDUE":
      return { label: "Überfällig", className: "badge-overdue" };
    case "PENDING":
    default:
      return { label: "Ausstehend", className: "badge-pending" };
  }
}
