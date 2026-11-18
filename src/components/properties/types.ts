import { PropertyInvestment } from "@/components/PropertyInvestmentsDialog";

export interface SubUnitDetail {
  key: string;
  unitNumber?: string;
  name?: string;
  label?: string;
  floor?: string;
  sqm?: number;
  rentSqm?: number;
  purchasePrice?: number;
  purchasedAt?: string;
  possessionAt?: string;
  // Kaufnebenkosten je Einheit
  ancillaryCosts?: number;
  propertyTransferTax?: number;
  notaryCosts?: number;
  landRegisterCosts?: number;
  brokerCosts?: number;
  otherAncillaryCosts?: number;
  // Miete
  coldRent?: number;
  heating?: number;
  operatingCosts?: number;
  utilities?: number;
  warmRent?: number;
  // WEG
  hausgeld?: number;
  maintenanceReserve?: number;
  totalWeg?: number;
}

export interface Tenant {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  iban?: string;
  isCurrent?: boolean;
  coldRent: number;
  utilities: number;
  deposit: number;
  depositPaid: boolean;
  moveInDate: string;
  contractStart: string;
  moveOutDate?: string;
}

export interface RentAdjustment {
  id: string;
  propertyId: string;
  type: string;
  effectiveDate: string;
  newColdRent?: number | null;
  newUtilities?: number | null;
  previousColdRent?: number | null;
  previousUtilities?: number | null;
  notes?: string | null;
  reminderDate?: string | null;
  reminded?: boolean;
}

export interface Property {
  id: string;
  name: string;
  address: string;
  sqm: number;
  floor?: string;
  unitNumber?: string | null;
  rooms?: number;
  purchasePrice?: number | null;
  purchasedAt?: string | null;
  possessionAt?: string | null;
  ancillaryCosts?: number | null;
  propertyTransferTax?: number | null;
  notaryCosts?: number | null;
  landRegisterCosts?: number | null;
  brokerCosts?: number | null;
  otherAncillaryCosts?: number | null;
  buildingSharePercent?: number | null;
  hausgeld?: number | null;
  hausgeldDetails?: string | null;
  unitDetails?: string | null;
  nonRecoverableCosts?: number | null;
  maintenanceReserve?: number | null;
  tenant: Tenant | null;
  formerTenants?: Tenant[];
  tenants?: Tenant[];
  loans: Array<{ id: string; originalAmount: number; currentBalance: number }>;
  tickets: Array<{ id: string; status: string; priority: string }>;
  rentAdjustments: RentAdjustment[];
  investments?: PropertyInvestment[];
  documents: Array<{
    id: string;
    name: string;
    type: string;
    filePath?: string;
    fileUrl?: string;
    fileSize?: number;
    uploadedAt?: string;
  }>;
}

/**
 * Sicherer JSON-Parser, der niemals eine Exception wirft
 */
export function parseJsonSafe<T = any>(val: any): T | null {
  if (!val || val === "null" || val === "undefined") return null;
  if (typeof val === "object") return val as T;
  try {
    const parsed = typeof val === "string" ? JSON.parse(val) : val;
    if (!parsed || parsed === "null" || parsed === "undefined") return null;
    return typeof parsed === "object" ? (parsed as T) : null;
  } catch {
    return null;
  }
}
