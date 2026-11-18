import { Hash, User, Bot, Split, AlertCircle } from "lucide-react";

export interface SplitItemState {
  id: string;
  amount: string;
  category: string;
  tenantId: string;
  propertyId: string;
  period: string;
  reference: string;
}

export interface Tenant {
  id: string;
  firstName: string;
  lastName: string;
  coldRent: number;
  utilities: number;
  iban?: string | null;
  isCurrent?: boolean;
  moveInDate?: string | null;
  moveOutDate?: string | null;
  property: {
    id: string;
    name: string;
    address: string;
    possessionAt?: string | null;
    purchasedAt?: string | null;
    rentAdjustments?: any[];
  };
}

export interface Payment {
  id: string;
  bookingDate: string;
  amount: number;
  payerName: string;
  payerIban?: string | null;
  reference?: string | null;
  matchMethod?: string | null;
  matchConfidence?: number | null;
  category: string;
  status: string;
  period?: string | null;
  sheetsRowId?: string | null;
  propertyId?: string | null;
  tenantId?: string | null;
  isSplit?: boolean;
  parentPaymentId?: string | null;
  property?: {
    id: string;
    name: string;
    address: string;
    unitNumber?: string | null;
    hausgeld?: number | null;
    maintenanceReserve?: number | null;
    hausgeldDetails?: string | null;
    unitDetails?: string | null;
  } | null;
  loanId?: string | null;
  loan?: {
    id: string;
    label: string;
    bank?: string | null;
    monthlyPayment: number;
    property?: {
      id: string;
      name: string;
      address: string;
    } | null;
  } | null;
  tenant?: {
    id: string;
    firstName: string;
    lastName: string;
    isCurrent?: boolean;
    coldRent?: number;
    utilities?: number;
    property?: {
      id: string;
      name: string;
      address: string;
      rentAdjustments?: any[];
    } | null;
  } | null;
  splitPayments?: Payment[];
  parentPayment?: Payment | null;
}

export interface MonthStatus {
  tenantId: string;
  tenantName: string;
  propertyName: string;
  propertyAddress: string;
  periodMonth?: string;
  soll: number;
  ist: number;
  utilityPaid: number;
  otherPaid: number;
  totalPaid: number;
  paymentDate?: string | null;
  reference?: string | null;
  utilityReference?: string | null;
  status: "PAID" | "OVERPAID" | "PARTIAL" | "OVERDUE" | "PENDING";
  daysOverdue: number;
  tenant: Tenant;
  isAdjusted?: boolean;
  adjustmentNote?: string | null;
}

export const METHOD_CONFIG = {
  IBAN: { label: "IBAN", icon: Hash, color: "success" },
  NAME: { label: "Name", icon: User, color: "secondary" },
  AI: { label: "KI", icon: Bot, color: "warning" },
  MANUAL: { label: "Manuell", icon: User, color: "secondary" },
  SPLIT: { label: "Split", icon: Split, color: "secondary" },
  UNMATCHED: { label: "Unbekannt", icon: AlertCircle, color: "destructive" },
};

export const CATEGORY_LABELS: Record<string, { label: string; color: string }> = {
  RENT: { label: "Miete", color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300" },
  DEPOSIT: { label: "Kaution", color: "bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300" },
  UTILITY_IN: { label: "Nebenkosten-Abrechnung", color: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300" },
  LOAN: { label: "Darlehen / Annuität", color: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300" },
  HAUSGELD: { label: "Hausgeld", color: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300" },
  REPAIR: { label: "Baumaterial & Reparatur", color: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300" },
  MAINTENANCE: { label: "Baumaterial & Reparatur", color: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300" },
  OTHER: { label: "Sonstiges/Transfer", color: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300" },
};

export const STATUS_COLORS: Record<string, string> = {
  PAID: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 border border-green-200 dark:border-green-800",
  OVERPAID: "bg-amber-100 text-amber-900 dark:bg-amber-900/30 dark:text-amber-300 border border-amber-300 dark:border-amber-700",
  PARTIAL: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400 border border-yellow-200 dark:border-yellow-800",
  OVERDUE: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 border border-red-200 dark:border-red-800",
  PENDING: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400 border border-gray-200 dark:border-gray-700",
  MATCHED: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  SPLIT: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300 border border-purple-200 dark:border-purple-800",
  MANUAL_REVIEW: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
};
