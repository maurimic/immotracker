"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Building2, Plus, Users, Euro, FileText, ChevronRight,
  Phone, Mail, Calendar, CreditCard, Edit, Trash2, X, TrendingUp,
  AlertCircle, ShieldCheck, Clock, Calculator, Upload, Check,
  UserPlus, UserMinus, AlertTriangle, Home, Coins, Percent, ArrowUpRight, ArrowRight, Info,
  Hammer, ShieldAlert, ChevronDown, ChevronUp, Receipt, History, Archive, Layers
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { DateInput } from "@/components/ui/date-input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  formatCurrency,
  formatDate,
  parseGermanNumber,
  formatGermanNumber,
  formatGermanPercent,
  formatGermanInput,
} from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { RentAdjustmentDialog } from "@/components/RentAdjustmentDialog";
import { PropertyInvestmentsDialog, PropertyInvestment } from "@/components/PropertyInvestmentsDialog";
import { parseUnitTokens } from "@/lib/property-matching";

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
  coldRent?: number;
  heating?: number;
  operatingCosts?: number;
  utilities?: number;
  warmRent?: number;
  hausgeld?: number;
  maintenanceReserve?: number;
  totalWeg?: number;
}

interface Tenant {
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

interface RentAdjustment {
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

interface Property {
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

// ─── Detaillierte Kaufnebenkosten Eingabe & Aufteilung ───────────────────────
function DetailedAncillaryCostsSection({
  form,
  setForm,
}: {
  form: any;
  setForm: React.Dispatch<React.SetStateAction<any>>;
}) {
  const hasDetailedValues = Boolean(
    form.propertyTransferTax ||
    form.notaryCosts ||
    form.landRegisterCosts ||
    form.brokerCosts ||
    form.otherAncillaryCosts
  );

  const [expanded, setExpanded] = useState<boolean>(hasDetailedValues);

  const price = parseGermanNumber(form.purchasePrice) || 0;

  const pTax = parseGermanNumber(form.propertyTransferTax) || 0;
  const notary = parseGermanNumber(form.notaryCosts) || 0;
  const landReg = parseGermanNumber(form.landRegisterCosts) || 0;
  const broker = parseGermanNumber(form.brokerCosts) || 0;
  const other = parseGermanNumber(form.otherAncillaryCosts) || 0;
  const detailedSum = pTax + notary + landReg + broker + other;

  const currentTotal = parseGermanNumber(form.ancillaryCosts) || 0;

  const updateDetailedField = (field: string, value: string) => {
    setForm((prev: any) => {
      const next = { ...prev, [field]: value };
      const nextPTax = parseGermanNumber(field === "propertyTransferTax" ? value : next.propertyTransferTax);
      const nextNotary = parseGermanNumber(field === "notaryCosts" ? value : next.notaryCosts);
      const nextLandReg = parseGermanNumber(field === "landRegisterCosts" ? value : next.landRegisterCosts);
      const nextBroker = parseGermanNumber(field === "brokerCosts" ? value : next.brokerCosts);
      const nextOther = parseGermanNumber(field === "otherAncillaryCosts" ? value : next.otherAncillaryCosts);

      const newSum = nextPTax + nextNotary + nextLandReg + nextBroker + nextOther;
      if (newSum > 0 || (value === "" && nextPTax === 0 && nextNotary === 0 && nextLandReg === 0 && nextBroker === 0 && nextOther === 0)) {
        next.ancillaryCosts = newSum > 0 ? formatGermanInput(newSum) : "";
      }
      return next;
    });
  };

  const applyPercentToField = (field: string, pct: number) => {
    if (price <= 0) {
      toast({
        title: "Kaufpreis benötigt",
        description: "Bitte zuerst einen Kaufpreis eingeben, um den Prozentwert zu berechnen.",
        variant: "destructive",
      });
      return;
    }
    const val = Math.round(price * (pct / 100) * 100) / 100;
    updateDetailedField(field, formatGermanInput(val));
  };

  return (
    <div className="space-y-2 pt-2 border-t border-border/40">
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <Label className="text-xs font-semibold flex items-center gap-1.5">
            <Receipt className="h-3.5 w-3.5 text-primary" />
            Kaufnebenkosten (€)
          </Label>
          <p className="text-[10px] text-muted-foreground">
            Grunderwerbsteuer, Notar, Grundbuch, Makler
          </p>
        </div>
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="text-[11px] text-primary hover:underline flex items-center gap-1 font-medium bg-primary/10 hover:bg-primary/20 px-2 py-1 rounded transition-colors"
        >
          {expanded ? (
            <>
              <ChevronUp className="h-3 w-3" /> Details verbergen
            </>
          ) : (
            <>
              <ChevronDown className="h-3 w-3" /> Aufschlüsselung {detailedSum > 0 ? `(${formatCurrency(detailedSum)})` : "öffnen"}
            </>
          )}
        </button>
      </div>

      {/* Gesamtsumme Eingabefeld */}
      <div className="grid grid-cols-2 gap-3 items-center">
        <div className="space-y-1">
          <Input
            type="text"
            inputMode="decimal"
            placeholder="z.B. 23.500,00"
            value={form.ancillaryCosts}
            onChange={(e) => setForm((prev: any) => ({ ...prev, ancillaryCosts: e.target.value }))}
          />
        </div>
        <div className="text-[11px] text-muted-foreground leading-tight">
          {price > 0 && currentTotal > 0 ? (
            <span>
              = <strong className="text-foreground">{formatGermanPercent((currentTotal / price) * 100, 1)}</strong> des Kaufpreises
              <span className="block text-[10px] text-muted-foreground/80 mt-0.5">
                Gesamtinvestition: {formatCurrency(price + currentTotal)}
              </span>
            </span>
          ) : (
            <span className="text-muted-foreground/80">Summe aller Erwerbsnebenkosten</span>
          )}
        </div>
      </div>

      {/* Ausklappbare Detailaufteilung */}
      {expanded && (
        <div className="p-3 bg-secondary/30 rounded-xl space-y-3 border border-border/60 text-xs">
          <div className="flex items-center justify-between pb-1 border-b border-border/40">
            <span className="font-semibold text-foreground text-xs flex items-center gap-1.5">
              <Calculator className="h-3.5 w-3.5 text-primary" /> Aufteilung nach Kostenarten
            </span>
            <span className="text-[10px] text-muted-foreground font-mono">
              Summe: <strong className="text-foreground">{formatCurrency(detailedSum)}</strong>
            </span>
          </div>

          {/* 1. Grunderwerbsteuer */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-[11px] font-medium text-foreground">
                1. Grunderwerbsteuer (Finanzamt)
              </Label>
              {price > 0 && pTax > 0 && (
                <span className="text-[10px] text-muted-foreground font-mono">
                  {formatGermanPercent((pTax / price) * 100, 1)}
                </span>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <Input
                type="text"
                inputMode="decimal"
                placeholder="z.B. 13.200,00"
                className="h-8 text-xs font-mono"
                value={form.propertyTransferTax}
                onChange={(e) => updateDetailedField("propertyTransferTax", e.target.value)}
              />
              <div className="flex items-center gap-1 flex-wrap">
                <span className="text-[10px] text-muted-foreground mr-0.5">Presets:</span>
                {[
                  { label: "3,5% (BY)", val: 3.5 },
                  { label: "5,0% (BW)", val: 5.0 },
                  { label: "6,0% (HE/B)", val: 6.0 },
                  { label: "6,5% (NRW)", val: 6.5 },
                ].map((item) => (
                  <Button
                    key={item.label}
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-6 px-1.5 text-[10px] bg-background hover:bg-muted"
                    onClick={() => applyPercentToField("propertyTransferTax", item.val)}
                  >
                    {item.label}
                  </Button>
                ))}
              </div>
            </div>
          </div>

          {/* 2. Notarkosten */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-[11px] font-medium text-foreground">
                2. Notarkosten (Kaufvertragsbeurkundung)
              </Label>
              {price > 0 && notary > 0 && (
                <span className="text-[10px] text-muted-foreground font-mono">
                  {formatGermanPercent((notary / price) * 100, 2)}
                </span>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <Input
                type="text"
                inputMode="decimal"
                placeholder="z.B. 3.300,00"
                className="h-8 text-xs font-mono"
                value={form.notaryCosts}
                onChange={(e) => updateDetailedField("notaryCosts", e.target.value)}
              />
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-6 px-2 text-[10px] bg-background hover:bg-muted"
                  onClick={() => applyPercentToField("notaryCosts", 1.5)}
                >
                  ~1,5% Standard
                </Button>
                <span className="text-[10px] text-muted-foreground">Kaufvertragsbeurkundung</span>
              </div>
            </div>
          </div>

          {/* 3. Grundbuchamt */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-[11px] font-medium text-foreground">
                3. Grundbuchamt (Eigentumsumschreibung)
              </Label>
              {price > 0 && landReg > 0 && (
                <span className="text-[10px] text-muted-foreground font-mono">
                  {formatGermanPercent((landReg / price) * 100, 2)}
                </span>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <Input
                type="text"
                inputMode="decimal"
                placeholder="z.B. 1.100,00"
                className="h-8 text-xs font-mono"
                value={form.landRegisterCosts}
                onChange={(e) => updateDetailedField("landRegisterCosts", e.target.value)}
              />
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-6 px-2 text-[10px] bg-background hover:bg-muted"
                  onClick={() => applyPercentToField("landRegisterCosts", 0.5)}
                >
                  ~0,5% Standard
                </Button>
                <span className="text-[10px] text-muted-foreground">Auflassung & Eigentum</span>
              </div>
            </div>
          </div>

          {/* 4. Maklerprovision */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-[11px] font-medium text-foreground">
                4. Maklerprovision (Courtage)
              </Label>
              {price > 0 && broker > 0 && (
                <span className="text-[10px] text-muted-foreground font-mono">
                  {formatGermanPercent((broker / price) * 100, 2)}
                </span>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <Input
                type="text"
                inputMode="decimal"
                placeholder="z.B. 7.854,00"
                className="h-8 text-xs font-mono"
                value={form.brokerCosts}
                onChange={(e) => updateDetailedField("brokerCosts", e.target.value)}
              />
              <div className="flex items-center gap-1 flex-wrap">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-6 px-1.5 text-[10px] bg-background hover:bg-muted"
                  onClick={() => updateDetailedField("brokerCosts", "0")}
                >
                  0 € (Frei)
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-6 px-1.5 text-[10px] bg-background hover:bg-muted"
                  onClick={() => applyPercentToField("brokerCosts", 3.57)}
                >
                  3,57% (Hälfte)
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-6 px-1.5 text-[10px] bg-background hover:bg-muted"
                  onClick={() => applyPercentToField("brokerCosts", 7.14)}
                >
                  7,14% (Voll)
                </Button>
              </div>
            </div>
          </div>

          {/* 5. Sonstige Nebenkosten */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-[11px] font-medium text-foreground">
                5. Sonstige Nebenkosten
              </Label>
              <span className="text-[10px] text-muted-foreground">Gutachter, Bewertung, etc.</span>
            </div>
            <Input
              type="text"
              inputMode="decimal"
              placeholder="z.B. 500,00"
              className="h-8 text-xs font-mono"
              value={form.otherAncillaryCosts}
              onChange={(e) => updateDetailedField("otherAncillaryCosts", e.target.value)}
            />
          </div>

          {/* Status-Footer der Details */}
          <div className="pt-2 border-t border-border/40 flex items-center justify-between text-[11px]">
            <div className="text-muted-foreground">
              Einzelpositionen addiert: <strong className="text-foreground font-mono">{formatCurrency(detailedSum)}</strong>
            </div>
            {Math.abs(detailedSum - currentTotal) < 0.01 && detailedSum > 0 ? (
              <span className="text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                <Check className="h-3.5 w-3.5" /> Summe synchron
              </span>
            ) : detailedSum > 0 ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-[10px] text-primary"
                onClick={() => setForm((prev: any) => ({ ...prev, ancillaryCosts: formatGermanInput(detailedSum) }))}
              >
                Als Summe übernehmen
              </Button>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Wohnung bearbeiten Dialog ────────────────────────────────────────────────
function EditPropertyDialog({
  property,
  onRefresh,
}: {
  property: Property;
  onRefresh: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const initialUnitDetails: Record<string, string> = {};
  if (property.hausgeldDetails) {
    try {
      const parsed = typeof property.hausgeldDetails === "string" ? JSON.parse(property.hausgeldDetails) : property.hausgeldDetails;
      for (const [k, v] of Object.entries(parsed)) {
        const num = typeof v === "number" ? v : (v as any)?.hausgeld != null ? (v as any).hausgeld : null;
        if (num != null) initialUnitDetails[k] = formatGermanInput(num);
      }
    } catch {}
  }
  const [unitDetails, setUnitDetails] = useState<Record<string, string>>(initialUnitDetails);

  let initialSubUnits: Record<string, SubUnitDetail> = {};
  if (property.unitDetails) {
    try {
      initialSubUnits = typeof property.unitDetails === "string" ? JSON.parse(property.unitDetails) : property.unitDetails;
    } catch {}
  }
  const [subUnits, setSubUnits] = useState<Record<string, SubUnitDetail>>(initialSubUnits);

  const [form, setForm] = useState({
    name: property.name,
    address: property.address,
    sqm: property.sqm.toString(),
    floor: property.floor || "",
    unitNumber: property.unitNumber || "",
    rooms: property.rooms ? property.rooms.toString() : "",
    purchasePrice: property.purchasePrice != null ? formatGermanInput(property.purchasePrice) : "",
    purchasedAt: property.purchasedAt ? property.purchasedAt.split("T")[0] : "",
    possessionAt: property.possessionAt ? property.possessionAt.split("T")[0] : "",
    ancillaryCosts: property.ancillaryCosts != null ? formatGermanInput(property.ancillaryCosts) : "",
    propertyTransferTax: property.propertyTransferTax != null ? formatGermanInput(property.propertyTransferTax) : "",
    notaryCosts: property.notaryCosts != null ? formatGermanInput(property.notaryCosts) : "",
    landRegisterCosts: property.landRegisterCosts != null ? formatGermanInput(property.landRegisterCosts) : "",
    brokerCosts: property.brokerCosts != null ? formatGermanInput(property.brokerCosts) : "",
    otherAncillaryCosts: property.otherAncillaryCosts != null ? formatGermanInput(property.otherAncillaryCosts) : "",
    buildingSharePercent: property.buildingSharePercent != null ? formatGermanInput(property.buildingSharePercent) : "80",
    hausgeld: property.hausgeld != null ? formatGermanInput(property.hausgeld) : "",
    nonRecoverableCosts: property.nonRecoverableCosts != null ? formatGermanInput(property.nonRecoverableCosts) : "",
    maintenanceReserve: property.maintenanceReserve != null ? formatGermanInput(property.maintenanceReserve) : "",
  });

  const handleUnitDetailChange = (unitKey: string, val: string) => {
    const updated = { ...unitDetails, [unitKey]: val };
    setUnitDetails(updated);
    const sum = Object.values(updated).reduce((acc, v) => acc + (parseGermanNumber(v) || 0), 0);
    if (sum > 0) {
      setForm((prev) => ({ ...prev, hausgeld: formatGermanInput(sum) }));
    }
  };

  const handleSubUnitFieldChange = (key: string, field: keyof SubUnitDetail, rawVal: string) => {
    setSubUnits((prev) => {
      const cur = prev[key] || { key };
      let parsedVal: any = rawVal;
      const numFields: (keyof SubUnitDetail)[] = [
        'sqm', 'rentSqm', 'purchasePrice', 'coldRent', 'heating',
        'operatingCosts', 'utilities', 'warmRent', 'hausgeld',
        'maintenanceReserve', 'totalWeg'
      ];
      if (numFields.includes(field)) {
        parsedVal = parseGermanNumber(rawVal);
      }
      const updatedUnit: SubUnitDetail = { ...cur, [field]: parsedVal };

      // Automatische Zwischensummen je Einheit
      if (['coldRent', 'heating', 'operatingCosts', 'utilities'].includes(field as string)) {
        const cold = updatedUnit.coldRent || 0;
        const heat = updatedUnit.heating || 0;
        const bk = updatedUnit.operatingCosts || 0;
        const ut = (heat + bk) > 0 ? (heat + bk) : (updatedUnit.utilities || 0);
        updatedUnit.utilities = ut;
        updatedUnit.warmRent = cold + ut;
      }
      if (field === 'hausgeld' || field === 'maintenanceReserve') {
        const hg = updatedUnit.hausgeld || 0;
        const mr = updatedUnit.maintenanceReserve || 0;
        updatedUnit.totalWeg = Math.round((hg + mr) * 100) / 100;
      }

      const nextSubUnits = { ...prev, [key]: updatedUnit };

      // Gesamtsummen für das Hauptobjekt automatisch synchronisieren
      const allUnits = Object.values(nextSubUnits);
      const sumPurchase = allUnits.reduce((s, u) => s + (u.purchasePrice || 0), 0);
      const sumSqm = allUnits.reduce((s, u) => s + (u.sqm || 0), 0);
      const sumHg = allUnits.reduce((s, u) => s + (u.hausgeld || 0), 0);
      const sumMr = allUnits.reduce((s, u) => s + (u.maintenanceReserve || 0), 0);

      setForm((f) => ({
        ...f,
        ...(sumPurchase > 0 ? { purchasePrice: formatGermanInput(sumPurchase) } : {}),
        ...(sumSqm > 0 ? { sqm: sumSqm.toString() } : {}),
        ...(sumHg > 0 ? { hausgeld: formatGermanInput(sumHg) } : {}),
        ...(sumMr > 0 ? { maintenanceReserve: formatGermanInput(sumMr) } : {}),
      }));

      return nextSubUnits;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    let hausgeldDetailsPayload: string | null = property.hausgeldDetails || null;
    const tokens = parseUnitTokens(form.unitNumber);
    if (tokens.length > 1) {
      const detailsObj: Record<string, { hausgeld?: number; maintenanceReserve?: number; total?: number }> = {};
      if (Object.keys(subUnits).length > 0) {
        for (const [k, u] of Object.entries(subUnits)) {
          detailsObj[k] = {
            hausgeld: u.hausgeld,
            maintenanceReserve: u.maintenanceReserve,
            total: (u.hausgeld || 0) + (u.maintenanceReserve || 0),
          };
        }
      } else {
        for (const token of tokens) {
          const val = parseGermanNumber(unitDetails[token.raw] || "");
          if (val > 0) detailsObj[token.raw] = { hausgeld: val };
        }
      }
      if (Object.keys(detailsObj).length > 0) {
        hausgeldDetailsPayload = JSON.stringify(detailsObj);
      }
    }

    const payload = {
      ...form,
      purchasePrice: form.purchasePrice ? parseGermanNumber(form.purchasePrice) : null,
      ancillaryCosts: form.ancillaryCosts ? parseGermanNumber(form.ancillaryCosts) : null,
      propertyTransferTax: form.propertyTransferTax ? parseGermanNumber(form.propertyTransferTax) : null,
      notaryCosts: form.notaryCosts ? parseGermanNumber(form.notaryCosts) : null,
      landRegisterCosts: form.landRegisterCosts ? parseGermanNumber(form.landRegisterCosts) : null,
      brokerCosts: form.brokerCosts ? parseGermanNumber(form.brokerCosts) : null,
      otherAncillaryCosts: form.otherAncillaryCosts ? parseGermanNumber(form.otherAncillaryCosts) : null,
      buildingSharePercent: form.buildingSharePercent ? parseGermanNumber(form.buildingSharePercent) : 80,
      hausgeld: form.hausgeld ? parseGermanNumber(form.hausgeld) : null,
      hausgeldDetails: hausgeldDetailsPayload,
      unitDetails: Object.keys(subUnits).length > 0 ? JSON.stringify(subUnits) : (property.unitDetails || null),
      nonRecoverableCosts: form.nonRecoverableCosts ? parseGermanNumber(form.nonRecoverableCosts) : null,
      maintenanceReserve: form.maintenanceReserve ? parseGermanNumber(form.maintenanceReserve) : null,
    };
    const res = await fetch(`/api/properties/${property.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setSaving(false);
    if (res.ok) {
      toast({ title: "Wohnung erfolgreich aktualisiert" });
      setOpen(false);
      onRefresh();
    } else {
      toast({ title: "Fehler beim Speichern der Wohnung", variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          size="sm"
          variant="ghost"
          className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
          title="Wohnungsdaten bearbeiten"
        >
          <Edit className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Wohnung bearbeiten: {property.name}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          {/* Stammdaten */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Home className="h-3.5 w-3.5" /> Stammdaten
            </h4>
            <div className="space-y-1">
              <Label className="text-xs">Bezeichnung *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Adresse *</Label>
              <Input
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                required
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Wohnfläche (m²) *</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={form.sqm}
                  onChange={(e) => setForm({ ...form, sqm: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Zimmer</Label>
                <Input
                  type="number"
                  step="0.5"
                  value={form.rooms}
                  onChange={(e) => setForm({ ...form, rooms: e.target.value })}
                  placeholder="z.B. 2.5"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Etage / Stockwerk</Label>
                <Input
                  value={form.floor}
                  onChange={(e) => setForm({ ...form, floor: e.target.value })}
                  placeholder="z.B. EG oder 2.OG"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Wohneinheit (WE)</Label>
                <Input
                  value={form.unitNumber}
                  onChange={(e) => setForm({ ...form, unitNumber: e.target.value })}
                  placeholder="z.B. WE1 oder WE5, WE6"
                />
                <p className="text-[10px] text-muted-foreground">
                  Für eindeutigen Bankabgleich (z. B. bei Hausgeld)
                </p>
              </div>
            </div>
          </div>

          {/* Kaufpreis & Investitionsdaten (optional) */}
          <div className="space-y-3 pt-3 border-t border-border">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-primary flex items-center gap-1.5">
              <Coins className="h-3.5 w-3.5" /> Kaufpreis & Investition (optional)
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Kaufpreis (€)</Label>
                <Input
                  type="text"
                  inputMode="decimal"
                  placeholder="z.B. 220.000,00"
                  value={form.purchasePrice}
                  onChange={(e) => setForm({ ...form, purchasePrice: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs flex items-center gap-1">
                  <Calendar className="h-3 w-3 text-muted-foreground" /> Notarvertrag
                </Label>
                <DateInput
                  value={form.purchasedAt}
                  onChange={(e) => setForm({ ...form, purchasedAt: e.target.value })}
                />
                <p className="text-[10px] text-muted-foreground">Datum Beurkundung</p>
              </div>
              <div className="space-y-1">
                <Label className="text-xs flex items-center gap-1">
                  <Clock className="h-3 w-3 text-primary" /> Nutzen & Lasten
                </Label>
                <DateInput
                  value={form.possessionAt}
                  onChange={(e) => setForm({ ...form, possessionAt: e.target.value })}
                />
                <p className="text-[10px] text-muted-foreground">Wirtschaftl. Übergang</p>
              </div>
            </div>

            {/* Detaillierte Kaufnebenkosten */}
            <DetailedAncillaryCostsSection form={form} setForm={setForm} />

            {/* Gebäudeanteil & 15%-Grenzen Berechnung */}
            <div className="space-y-2 pt-2 border-t border-border/40">
              <div className="grid grid-cols-2 gap-3 items-center">
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs">Gebäudeanteil (%)</Label>
                    <span className="text-[10px] text-muted-foreground">Standard: 80%</span>
                  </div>
                  <Input
                    type="number"
                    min="10"
                    max="100"
                    step="1"
                    placeholder="80"
                    value={form.buildingSharePercent}
                    onChange={(e) => setForm({ ...form, buildingSharePercent: e.target.value })}
                  />
                  <p className="text-[10px] text-muted-foreground">Für AfA & 15%-Grenze (§ 6 EStG)</p>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Bodenanteil (%)</Label>
                  <div className="h-9 px-3 rounded-md border border-input bg-muted/40 flex items-center font-mono text-xs text-muted-foreground">
                    {100 - (parseFloat(form.buildingSharePercent) || 80)}% (nicht abschreibbar)
                  </div>
                  <p className="text-[10px] text-muted-foreground">Grund und Boden Anteil</p>
                </div>
              </div>

              {/* Live Vorschau Gebäudewert & 15%-Budget */}
              {parseFloat(form.purchasePrice) > 0 && (
                <div className="p-2.5 rounded-lg bg-secondary/40 border border-border/60 text-xs space-y-1">
                  <div className="flex justify-between items-center text-muted-foreground">
                    <span>Gebäudewert (AfA- & 15%-Basis):</span>
                    <span className="font-mono font-bold text-foreground">
                      {formatCurrency(parseFloat(form.purchasePrice) * ((parseFloat(form.buildingSharePercent) || 80) / 100))}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-muted-foreground text-[11px]">
                    <span>15%-Grenzen Budget (§ 6 EStG netto):</span>
                    <span className="font-mono font-semibold text-primary">
                      {formatCurrency(parseFloat(form.purchasePrice) * ((parseFloat(form.buildingSharePercent) || 80) / 100) * 0.15)}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Hausgeld & Erhaltungsrücklage (Monatliche Zahlung an WEG / Hausverwaltung) */}
          <div className="space-y-3 pt-3 border-t border-border">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5">
              <Coins className="h-3.5 w-3.5" /> Hausgeld & Erhaltungsrücklage (Zahlung an WEG)
            </h4>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Hausgeld (€/Mo)</Label>
                <Input
                  type="text"
                  inputMode="decimal"
                  placeholder="z. B. 160,00"
                  value={form.hausgeld}
                  onChange={(e) => setForm({ ...form, hausgeld: e.target.value })}
                />
                <p className="text-[10px] text-muted-foreground">
                  Laufende Bewirtschaftung / Wirtschaftsplan (umlagef. & nicht-umlagef.)
                </p>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Erhaltungsrücklage (€/Mo)</Label>
                <Input
                  type="text"
                  inputMode="decimal"
                  placeholder={`Standard: ${formatGermanNumber(parseFloat(form.sqm || "0") * 1.20, 2)} €`}
                  value={form.maintenanceReserve}
                  onChange={(e) => setForm({ ...form, maintenanceReserve: e.target.value })}
                />
                <p className="text-[10px] text-muted-foreground">
                  Monatliche Zuführung zur WEG-Instandhaltungsrücklage
                </p>
              </div>
            </div>

            {/* Live-Berechnung der Gesamt-Soll-Zahlung an WEG */}
            <div className="rounded-lg bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200/60 dark:border-indigo-800/60 p-2.5 text-xs flex items-center justify-between">
              <div className="space-y-0.5">
                <div className="font-semibold text-indigo-950 dark:text-indigo-200 flex items-center gap-1.5">
                  <span>Monatliche Gesamtzahlung an WEG:</span>
                  <span className="font-mono text-sm text-indigo-700 dark:text-indigo-300 font-bold">
                    {formatCurrency(
                      (parseGermanNumber(form.hausgeld) || 0) +
                      (parseGermanNumber(form.maintenanceReserve) || 0)
                    )}
                  </span>
                </div>
                <p className="text-[10px] text-indigo-700/80 dark:text-indigo-300/80">
                  Wird auf der Banküberweisungs-Seite für den automatischen Soll-Ist-Abgleich herangezogen.
                </p>
              </div>
            </div>

            {/* Mehrere Wohneinheiten (z.B. WE 5 und WE 6)? Untergliederung für Verbundwohnung */}
            {Object.keys(subUnits).length > 0 ? (
              <div className="p-3 rounded-xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50/40 dark:bg-indigo-950/20 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-indigo-950 dark:text-indigo-200 flex items-center gap-1.5">
                    <Layers className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                    Vertragliche Untergliederung ({Object.keys(subUnits).length} Einheiten)
                  </span>
                  <Badge variant="outline" className="text-[10px] bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300">
                    Verbund-Objekt
                  </Badge>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Separate Kauf- und Mietverträge je Wohneinheit. Änderungen synchronisieren automatisch Kaufpreis, Fläche und Hausgeld des Gesamtobjekts.
                </p>

                <div className="space-y-3">
                  {Object.entries(subUnits).map(([key, u]) => (
                    <div key={key} className="rounded-lg border border-border/70 bg-background/90 p-3 space-y-2.5">
                      <div className="flex items-center justify-between border-b border-border/40 pb-1.5">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded bg-indigo-100 dark:bg-indigo-900/60 text-indigo-800 dark:text-indigo-300 font-bold text-xs">
                            {u.unitNumber || key}
                          </span>
                          <span className="text-xs font-semibold text-foreground">{u.name || key}</span>
                        </div>
                        <span className="text-xs font-mono text-muted-foreground">{u.sqm || 0} m²</span>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        <div className="space-y-1">
                          <Label className="text-[10px] text-muted-foreground">Wohnfläche (m²)</Label>
                          <Input
                            type="text"
                            inputMode="decimal"
                            value={u.sqm != null ? formatGermanInput(u.sqm) : ""}
                            onChange={(e) => handleSubUnitFieldChange(key, "sqm", e.target.value)}
                            className="h-7 text-xs font-mono"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px] text-muted-foreground">Kaufpreis (€ Notar)</Label>
                          <Input
                            type="text"
                            inputMode="decimal"
                            value={u.purchasePrice != null ? formatGermanInput(u.purchasePrice) : ""}
                            onChange={(e) => handleSubUnitFieldChange(key, "purchasePrice", e.target.value)}
                            className="h-7 text-xs font-mono"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px] text-muted-foreground">Notartermin (Kauf)</Label>
                          <Input
                            type="date"
                            value={u.purchasedAt || ""}
                            onChange={(e) => handleSubUnitFieldChange(key, "purchasedAt", e.target.value)}
                            className="h-7 text-xs"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px] text-muted-foreground">Kaltmiete (€/Mo)</Label>
                          <Input
                            type="text"
                            inputMode="decimal"
                            value={u.coldRent != null ? formatGermanInput(u.coldRent) : ""}
                            onChange={(e) => handleSubUnitFieldChange(key, "coldRent", e.target.value)}
                            className="h-7 text-xs font-mono text-emerald-600 dark:text-emerald-400 font-semibold"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px] text-muted-foreground">Heizung (€/Mo)</Label>
                          <Input
                            type="text"
                            inputMode="decimal"
                            value={u.heating != null ? formatGermanInput(u.heating) : ""}
                            onChange={(e) => handleSubUnitFieldChange(key, "heating", e.target.value)}
                            className="h-7 text-xs font-mono"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px] text-muted-foreground">Betriebskosten (€/Mo)</Label>
                          <Input
                            type="text"
                            inputMode="decimal"
                            value={u.operatingCosts != null ? formatGermanInput(u.operatingCosts) : ""}
                            onChange={(e) => handleSubUnitFieldChange(key, "operatingCosts", e.target.value)}
                            className="h-7 text-xs font-mono"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px] text-muted-foreground">Hausgeld operativ (€/Mo)</Label>
                          <Input
                            type="text"
                            inputMode="decimal"
                            value={u.hausgeld != null ? formatGermanInput(u.hausgeld) : ""}
                            onChange={(e) => handleSubUnitFieldChange(key, "hausgeld", e.target.value)}
                            className="h-7 text-xs font-mono"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px] text-muted-foreground">Erhaltungsrücklage (€/Mo)</Label>
                          <Input
                            type="text"
                            inputMode="decimal"
                            value={u.maintenanceReserve != null ? formatGermanInput(u.maintenanceReserve) : ""}
                            onChange={(e) => handleSubUnitFieldChange(key, "maintenanceReserve", e.target.value)}
                            className="h-7 text-xs font-mono"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px] text-muted-foreground">Warmmiete gesamt (€)</Label>
                          <div className="h-7 px-2 rounded-md bg-muted flex items-center font-mono text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                            {formatCurrency(u.warmRent || ((u.coldRent || 0) + (u.utilities || ((u.heating || 0) + (u.operatingCosts || 0)))))}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : parseUnitTokens(form.unitNumber).length > 1 ? (
              <div className="p-2.5 rounded-lg border border-border/80 bg-muted/40 space-y-2">
                <div className="text-[11px] font-semibold flex items-center justify-between">
                  <span>Aufteilung nach Wohneinheiten ({parseUnitTokens(form.unitNumber).map((u) => u.raw).join(", ")}):</span>
                  <span className="text-[10px] text-muted-foreground">Für getrennte Banküberweisungen je WE</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {parseUnitTokens(form.unitNumber).map((token) => (
                    <div key={token.raw} className="space-y-1">
                      <Label className="text-[11px] font-medium">{token.raw} (€/Mo):</Label>
                      <Input
                        type="text"
                        inputMode="decimal"
                        placeholder="z. B. 250,00"
                        value={unitDetails[token.raw] || ""}
                        onChange={(e) => handleUnitDetailChange(token.raw, e.target.value)}
                        className="h-8 text-xs"
                      />
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {/* Parameter für Netto-Cashflow */}
            <div className="pt-2">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Nicht-umlagef. Kosten (€/Mo) – optional für Cashflow-Formel</Label>
                <Input
                  type="text"
                  inputMode="decimal"
                  placeholder={`Pauschale: ${formatGermanNumber(parseFloat(form.sqm || "0") * 0.35 + 25, 2)} €`}
                  value={form.nonRecoverableCosts}
                  onChange={(e) => setForm({ ...form, nonRecoverableCosts: e.target.value })}
                  className="h-8 text-xs text-muted-foreground"
                />
                <p className="text-[10px] text-muted-foreground">
                  SEV, Verwaltergebühr etc. Wenn leer: Pauschale (0,35 €/m² + 25 €)
                </p>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3">
            <Button variant="outline" type="button" onClick={() => setOpen(false)}>
              Abbrechen
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Speichern..." : "Änderungen speichern"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Wohnung löschen Dialog ──────────────────────────────────────────────────
function DeletePropertyDialog({
  property,
  onRefresh,
}: {
  property: Property;
  onRefresh: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    setDeleting(true);
    const res = await fetch(`/api/properties/${property.id}`, {
      method: "DELETE",
    });
    setDeleting(false);
    if (res.ok) {
      toast({ title: `Wohnung '${property.name}' wurde gelöscht` });
      setOpen(false);
      onRefresh();
    } else {
      toast({ title: "Fehler beim Löschen der Wohnung", variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          size="sm"
          variant="ghost"
          className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
          title="Wohnung löschen"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Wohnung wirklich löschen?
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2 text-sm text-muted-foreground">
          <p>
            Sind Sie sicher, dass Sie die Wohnung <strong className="text-foreground">{property.name}</strong> ({property.address}) unwiderruflich löschen möchten?
          </p>
          {property.tenant && (
            <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-xs text-destructive">
              <strong>Achtung:</strong> Der aktive Mieter{" "}
              <strong>{property.tenant.firstName} {property.tenant.lastName}</strong> und alle zugehörigen Daten (Mietvertrag, Kredite, Instandhaltungstickets, Zählerstände) werden ebenfalls entfernt!
            </div>
          )}
          <p className="text-xs">Diese Aktion kann nicht rückgängig gemacht werden.</p>
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => setOpen(false)} disabled={deleting}>
            Abbrechen
          </Button>
          <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
            {deleting ? "Wird gelöscht..." : "Wohnung unwiderruflich löschen"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Mieter hinzufügen Dialog (für Leerstand) ────────────────────────────────
function AddTenantDialog({
  property,
  onRefresh,
}: {
  property: Property;
  onRefresh: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const today = new Date().toISOString().split("T")[0];

  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    iban: "",
    coldRent: "",
    utilities: "",
    deposit: "",
    depositPaid: false,
    moveInDate: "",
    contractStart: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const res = await fetch("/api/tenants", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        propertyId: property.id,
        ...form,
        coldRent: parseFloat(form.coldRent || "0"),
        utilities: parseFloat(form.utilities || "0"),
        deposit: parseFloat(form.deposit || "0"),
      }),
    });
    setSaving(false);
    if (res.ok) {
      toast({ title: `Mieter für ${property.name} erfolgreich angelegt!` });
      setOpen(false);
      onRefresh();
    } else {
      const err = await res.json();
      toast({
        title: "Fehler beim Anlegen des Mieters",
        description: err.error || "Bitte Eingaben prüfen",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="w-full gap-1.5 shadow-sm">
          <UserPlus className="h-4 w-4" /> Mieter anlegen / einziehen lassen
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Neuer Mieter für {property.name}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Vorname *</Label>
              <Input
                placeholder="Max"
                value={form.firstName}
                onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                required
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Nachname *</Label>
              <Input
                placeholder="Mustermann"
                value={form.lastName}
                onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">E-Mail</Label>
              <Input
                type="email"
                placeholder="max@beispiel.de"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Telefon</Label>
              <Input
                placeholder="+49 170 1234567"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">IBAN (für automatischen Buchungsabgleich)</Label>
            <Input
              className="font-mono text-xs uppercase"
              placeholder="DE89 3704 0044 0532 0130 00"
              value={form.iban}
              onChange={(e) => setForm({ ...form, iban: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Soll-Kaltmiete (€/Monat) *</Label>
              <Input
                type="number"
                step="0.01"
                placeholder="750.00"
                value={form.coldRent}
                onChange={(e) => {
                  const val = e.target.value;
                  const num = parseFloat(val);
                  setForm({
                    ...form,
                    coldRent: val,
                    deposit: !form.deposit && !isNaN(num) ? (num * 3).toFixed(2) : form.deposit,
                  });
                }}
                required
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">NK-Vorauszahlung (€/Monat) *</Label>
              <Input
                type="number"
                step="0.01"
                placeholder="150.00"
                value={form.utilities}
                onChange={(e) => setForm({ ...form, utilities: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 items-center">
            <div className="space-y-1">
              <Label className="text-xs">Mietkaution (€)</Label>
              <Input
                type="number"
                step="0.01"
                placeholder="2250.00"
                value={form.deposit}
                onChange={(e) => setForm({ ...form, deposit: e.target.value })}
              />
            </div>
            <div className="flex items-center gap-2 pt-5">
              <input
                type="checkbox"
                id={`add-dep-paid-${property.id}`}
                checked={form.depositPaid}
                onChange={(e) => setForm({ ...form, depositPaid: e.target.checked })}
                className="rounded border-input text-primary h-4 w-4"
              />
              <label htmlFor={`add-dep-paid-${property.id}`} className="text-xs font-medium cursor-pointer">
                Kaution vollständig bezahlt
              </label>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Mietbeginn / Einzug *</Label>
              <DateInput
                value={form.moveInDate}
                onChange={(e) => setForm({ ...form, moveInDate: e.target.value })}
                required
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Vertragsbeginn *</Label>
              <DateInput
                value={form.contractStart}
                onChange={(e) => setForm({ ...form, contractStart: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3">
            <Button variant="outline" type="button" onClick={() => setOpen(false)}>
              Abbrechen
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Wird gespeichert..." : "Mieter anlegen"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Vormieter hinzufügen Dialog (Historischer Mieter) ────────────────────────
function AddFormerTenantDialog({
  property,
  onRefresh,
  trigger,
}: {
  property: Property;
  onRefresh: () => void;
  trigger?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    iban: "",
    coldRent: "",
    utilities: "",
    deposit: "",
    depositPaid: true,
    moveInDate: "",
    moveOutDate: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const res = await fetch("/api/tenants", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        propertyId: property.id,
        isCurrent: false,
        ...form,
        coldRent: parseFloat(form.coldRent || "0"),
        utilities: parseFloat(form.utilities || "0"),
        deposit: parseFloat(form.deposit || "0"),
        contractStart: form.moveInDate || null,
        moveInDate: form.moveInDate || null,
        moveOutDate: form.moveOutDate || null,
      }),
    });
    setSaving(false);
    if (res.ok) {
      toast({ title: `Vormieter für ${property.name} erfolgreich angelegt!` });
      setOpen(false);
      onRefresh();
    } else {
      const err = await res.json();
      toast({
        title: "Fehler beim Anlegen des Vormieters",
        description: err.error || "Bitte Eingaben prüfen",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button size="sm" variant="outline" className="h-7 text-xs gap-1 border-dashed text-muted-foreground hover:text-foreground">
            <History className="h-3 w-3 text-amber-500" /> + Vormieter erfassen
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-5 w-5 text-amber-500" />
            Vormieter erfassen für {property.name}
          </DialogTitle>
          <DialogDescription className="text-xs">
            Erfassen Sie einen ehemaligen Mieter, um historische Mietzahlungen und Bankbuchungen automatisch zuzuordnen und auszuwerten.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Vorname *</Label>
              <Input
                placeholder="Max"
                value={form.firstName}
                onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                required
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Nachname *</Label>
              <Input
                placeholder="Mustermann"
                value={form.lastName}
                onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex justify-between items-center">
              <Label className="text-xs">IBAN (für automatische Überweisungs-Zuordnung)</Label>
              <span className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold">Sehr empfohlen</span>
            </div>
            <Input
              className="font-mono text-xs uppercase"
              placeholder="DE89 3704 0044 0532 0130 00"
              value={form.iban}
              onChange={(e) => setForm({ ...form, iban: e.target.value })}
            />
            <p className="text-[11px] text-muted-foreground">
              Wird genutzt, um historische Bankbuchungen automatisch mit diesem Vormieter und dieser Wohnung zu verknüpfen.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Damalige Kaltmiete (€/Monat) *</Label>
              <Input
                type="number"
                step="0.01"
                placeholder="650.00"
                value={form.coldRent}
                onChange={(e) => setForm({ ...form, coldRent: e.target.value })}
                required
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">NK-Vorauszahlung (€/Monat) *</Label>
              <Input
                type="number"
                step="0.01"
                placeholder="130.00"
                value={form.utilities}
                onChange={(e) => setForm({ ...form, utilities: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Mietbeginn / Einzug</Label>
              <DateInput
                value={form.moveInDate}
                onChange={(e) => setForm({ ...form, moveInDate: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Mietende / Auszug</Label>
              <DateInput
                value={form.moveOutDate}
                onChange={(e) => setForm({ ...form, moveOutDate: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">E-Mail (optional)</Label>
              <Input
                type="email"
                placeholder="max@beispiel.de"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Telefon (optional)</Label>
              <Input
                placeholder="+49 170 1234567"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3">
            <Button variant="outline" type="button" onClick={() => setOpen(false)}>
              Abbrechen
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Wird gespeichert..." : "Vormieter anlegen"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Mieter bearbeiten Dialog ────────────────────────────────────────────────
function EditTenantDialog({
  tenant,
  onRefresh,
  trigger,
}: {
  tenant: Tenant;
  onRefresh: () => void;
  trigger?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const isFormer = tenant.isCurrent === false;
  const [form, setForm] = useState({
    firstName: tenant.firstName,
    lastName: tenant.lastName,
    email: tenant.email || "",
    phone: tenant.phone || "",
    iban: tenant.iban || "",
    coldRent: tenant.coldRent.toString(),
    utilities: tenant.utilities.toString(),
    deposit: tenant.deposit.toString(),
    depositPaid: tenant.depositPaid,
    moveInDate: tenant.moveInDate ? tenant.moveInDate.split("T")[0] : "",
    contractStart: tenant.contractStart ? tenant.contractStart.split("T")[0] : "",
    moveOutDate: tenant.moveOutDate ? tenant.moveOutDate.split("T")[0] : "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const res = await fetch(`/api/tenants/${tenant.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        coldRent: parseFloat(form.coldRent),
        utilities: parseFloat(form.utilities),
        deposit: parseFloat(form.deposit),
        moveInDate: form.moveInDate || undefined,
        contractStart: form.contractStart || undefined,
        moveOutDate: form.moveOutDate || null,
      }),
    });
    setSaving(false);
    if (res.ok) {
      toast({ title: isFormer ? "Vormieterdaten erfolgreich aktualisiert" : "Mieterdaten erfolgreich aktualisiert" });
      setOpen(false);
      onRefresh();
    } else {
      toast({ title: "Fehler beim Speichern der Mieterdaten", variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button size="sm" variant="outline" className="h-7 text-xs gap-1">
            <Edit className="h-3 w-3" /> {isFormer ? "Vormieter bearbeiten" : "Mieter bearbeiten"}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isFormer ? (
              <>
                <History className="h-4 w-4 text-amber-500" />
                <span>Vormieterakte: {tenant.firstName} {tenant.lastName}</span>
              </>
            ) : (
              <>
                <Users className="h-4 w-4 text-primary" />
                <span>Mieterakte: {tenant.firstName} {tenant.lastName}</span>
              </>
            )}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3 pt-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Vorname</Label>
              <Input value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} required />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Nachname</Label>
              <Input value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} required />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">E-Mail</Label>
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Telefon</Label>
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">IBAN (für automatischen Buchungsabgleich)</Label>
            <Input className="font-mono text-xs uppercase" value={form.iban} onChange={(e) => setForm({ ...form, iban: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Soll-Kaltmiete (€)</Label>
              <Input type="number" step="0.01" value={form.coldRent} onChange={(e) => setForm({ ...form, coldRent: e.target.value })} required />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">NK-Vorauszahlung (€)</Label>
              <Input type="number" step="0.01" value={form.utilities} onChange={(e) => setForm({ ...form, utilities: e.target.value })} required />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 items-center">
            <div className="space-y-1">
              <Label className="text-xs">Kaution (€)</Label>
              <Input type="number" step="0.01" value={form.deposit} onChange={(e) => setForm({ ...form, deposit: e.target.value })} />
            </div>
            <div className="flex items-center gap-2 pt-4">
              <input
                type="checkbox"
                id={`edit-depositPaid-${tenant.id}`}
                checked={form.depositPaid}
                onChange={(e) => setForm({ ...form, depositPaid: e.target.checked })}
                className="rounded border-input text-primary h-4 w-4"
              />
              <label htmlFor={`edit-depositPaid-${tenant.id}`} className="text-xs font-medium cursor-pointer">
                Kaution bezahlt
              </label>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Einzugsdatum</Label>
              <DateInput value={form.moveInDate} onChange={(e) => setForm({ ...form, moveInDate: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Vertragsbeginn</Label>
              <DateInput value={form.contractStart} onChange={(e) => setForm({ ...form, contractStart: e.target.value })} />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Auszugsdatum (optional, bei Beendigung)</Label>
            <DateInput value={form.moveOutDate} onChange={(e) => setForm({ ...form, moveOutDate: e.target.value })} />
          </div>
          <div className="flex justify-end gap-2 pt-3">
            <Button variant="outline" type="button" onClick={() => setOpen(false)}>Abbrechen</Button>
            <Button type="submit" disabled={saving}>{saving ? "Speichern..." : "Speichern"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Mieter entfernen / Auszug Dialog (Kündigung/Auszug) ──────────────────────
function RemoveTenantDialog({
  tenant,
  propertyName,
  onRefresh,
  trigger,
}: {
  tenant: Tenant;
  propertyName: string;
  onRefresh: () => void;
  trigger?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [moveOutDate, setMoveOutDate] = useState(
    tenant.moveOutDate ? tenant.moveOutDate.split("T")[0] : new Date().toISOString().split("T")[0]
  );
  const [confirmHardDelete, setConfirmHardDelete] = useState(false);

  const isFormer = tenant.isCurrent === false;

  const handleArchive = async () => {
    setLoading(true);
    const res = await fetch(
      `/api/tenants/${tenant.id}?action=archive&moveOutDate=${encodeURIComponent(moveOutDate)}`,
      { method: "DELETE" }
    );
    setLoading(false);
    if (res.ok) {
      toast({
        title: `Auszug erfasst: ${tenant.firstName} ${tenant.lastName}`,
        description: `Wohnung '${propertyName}' ist nun als Leerstand markiert. Mieter wurde als Vormieter archiviert.`,
      });
      setOpen(false);
      onRefresh();
    } else {
      toast({ title: "Fehler beim Erfassen des Auszugs", variant: "destructive" });
    }
  };

  const handleHardDelete = async () => {
    setLoading(true);
    const res = await fetch(`/api/tenants/${tenant.id}`, {
      method: "DELETE",
    });
    setLoading(false);
    if (res.ok) {
      toast({
        title: `Mieter ${tenant.firstName} ${tenant.lastName} wurde gelöscht`,
      });
      setOpen(false);
      onRefresh();
    } else {
      toast({ title: "Fehler beim Löschen des Mieters", variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs text-muted-foreground hover:text-destructive hover:border-destructive/40 gap-1"
            title="Mietverhältnis beenden / Mieter entfernen"
          >
            <UserMinus className="h-3 w-3" /> Auszug / Entfernen
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isFormer ? (
              <>
                <Trash2 className="h-5 w-5 text-destructive" />
                <span>Vormieter löschen</span>
              </>
            ) : (
              <>
                <UserMinus className="h-5 w-5 text-amber-500" />
                <span>Mietverhältnis beenden / Auszug</span>
              </>
            )}
          </DialogTitle>
          <DialogDescription className="text-xs">
            {tenant.firstName} {tenant.lastName} – {propertyName}
          </DialogDescription>
        </DialogHeader>

        {isFormer ? (
          <div className="space-y-3 py-2 text-sm text-muted-foreground">
            <p>
              Möchten Sie den Vormieter <strong className="text-foreground">{tenant.firstName} {tenant.lastName}</strong> unwiderruflich aus der Datenbank entfernen?
            </p>
            <p className="text-xs bg-destructive/10 text-destructive p-3 rounded-lg border border-destructive/20">
              ⚠️ Zugeordnete historische Bankzahlungen bleiben erhalten, werden jedoch vom Mieter entkoppelt.
            </p>
            <DialogFooter className="gap-2 sm:gap-0 pt-2">
              <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>
                Abbrechen
              </Button>
              <Button variant="destructive" onClick={handleHardDelete} disabled={loading}>
                {loading ? "Wird gelöscht..." : "Vormieter endgültig löschen"}
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4 py-2">
            {/* Option 1: Archivieren als Vormieter (Empfohlen) */}
            <div className="border border-border/80 bg-secondary/30 rounded-xl p-3.5 space-y-3">
              <div className="flex items-center gap-2">
                <Archive className="h-4 w-4 text-primary shrink-0" />
                <span className="font-semibold text-xs text-foreground">
                  Als Vormieter archivieren (Auszug)
                </span>
                <Badge variant="outline" className="text-[10px] text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/30 px-1 py-0 ml-auto">
                  Empfohlen
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Die Wohnung wird wieder als <strong>Leerstand</strong> geführt. Der Mieter bleibt mit allen Bankbuchungen in der <strong>Mieter-Historie</strong> dieser Wohnung erhalten.
              </p>
              <div className="space-y-1">
                <Label className="text-xs font-medium">Auszugsdatum / Mietvertragsende</Label>
                <DateInput
                  value={moveOutDate}
                  onChange={(e) => setMoveOutDate(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
              <Button
                className="w-full h-8 text-xs gap-1.5 shadow-sm"
                onClick={handleArchive}
                disabled={loading}
              >
                <Archive className="h-3.5 w-3.5" />
                {loading ? "Wird archiviert..." : "Auszug bestätigen & als Vormieter archivieren"}
              </Button>
            </div>

            {/* Option 2: Hard Delete */}
            <div className="pt-1">
              {!confirmHardDelete ? (
                <button
                  type="button"
                  onClick={() => setConfirmHardDelete(true)}
                  className="text-xs text-muted-foreground hover:text-destructive underline flex items-center gap-1 transition-colors"
                >
                  <Trash2 className="h-3 w-3" /> Mieter unwiderruflich löschen (z.B. bei Fehleingabe)...
                </button>
              ) : (
                <div className="border border-destructive/30 bg-destructive/5 rounded-xl p-3 space-y-2 text-xs">
                  <p className="font-semibold text-destructive flex items-center gap-1">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    Mieter komplett aus der Datenbank löschen?
                  </p>
                  <p className="text-muted-foreground">
                    Verwenden Sie dies nur, wenn der Mieter irrtümlich angelegt wurde.
                  </p>
                  <div className="flex gap-2 justify-end pt-1">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => setConfirmHardDelete(false)}
                    >
                      Abbrechen
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={handleHardDelete}
                      disabled={loading}
                    >
                      {loading ? "Wird gelöscht..." : "Endgültig löschen"}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── Dokumente hochladen Dialog ──────────────────────────────────────────────
function PropertyDocumentUploadDialog({
  property,
  onRefresh,
}: {
  property: Property;
  onRefresh: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState("");
  const [type, setType] = useState("LEASE");
  const [uploading, setUploading] = useState(false);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      toast({ title: "Bitte Datei auswählen", variant: "destructive" });
      return;
    }
    setUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("propertyId", property.id);
    fd.append("name", name || file.name);
    fd.append("type", type);

    try {
      const res = await fetch("/api/documents", {
        method: "POST",
        body: fd,
      });
      if (!res.ok) throw new Error("Upload fehlgeschlagen");
      toast({ title: "Dokument hochgeladen", description: `${name || file.name} wurde gespeichert.` });
      setOpen(false);
      setFile(null);
      setName("");
      onRefresh();
    } catch {
      toast({ title: "Fehler beim Upload", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="h-6 px-1.5 text-[11px] gap-1 text-primary hover:text-primary">
          <Upload className="h-3 w-3" /> Hochladen
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Dokument für {property.name} hochladen</DialogTitle>
          <DialogDescription>
            Laden Sie Mietverträge, Übergabeprotokolle, Grundrisse oder Rechnungen hoch (PDF, PNG, JPG).
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleUpload} className="space-y-4 pt-2">
          <div className="space-y-1">
            <Label className="text-xs">Dokumententyp *</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="LEASE">📜 Mietvertrag</SelectItem>
                <SelectItem value="PROTOCOL">📋 Übergabeprotokoll</SelectItem>
                <SelectItem value="FLOORPLAN">📐 Grundriss / Skizze</SelectItem>
                <SelectItem value="INVOICE">🧾 Handwerkerrechnung / Beleg</SelectItem>
                <SelectItem value="OTHER">📄 Sonstiges Dokument</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Bezeichnung (optional)</Label>
            <Input
              placeholder="z.B. Mietvertrag 2026 unterschrieben"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Datei auswählen *</Label>
            <Input
              type="file"
              accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) {
                  setFile(f);
                  if (!name) setName(f.name.replace(/\.[^/.]+$/, ""));
                }
              }}
              required
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" type="button" onClick={() => setOpen(false)}>Abbrechen</Button>
            <Button type="submit" disabled={uploading || !file}>
              {uploading ? "Wird hochgeladen..." : "Hochladen & Speichern"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Wohnungskarte ───────────────────────────────────────────────────────────
function PropertyCard({ property, onRefresh }: { property: Property; onRefresh: () => void }) {
  const openTickets = property.tickets?.filter((t) => t.status !== "DONE").length ?? 0;
  const sqmRent = property.tenant && property.sqm > 0 ? (property.tenant.coldRent / property.sqm).toFixed(2) : "0.00";

  const deleteDocument = async (id: string) => {
    if (!confirm("Dokument wirklich löschen?")) return;
    try {
      const res = await fetch(`/api/documents/${id}`, { method: "DELETE" });
      if (res.ok) {
        toast({ title: "Dokument gelöscht" });
        onRefresh();
      } else {
        toast({ title: "Fehler beim Löschen des Dokuments", variant: "destructive" });
      }
    } catch {
      toast({ title: "Verbindungsfehler", variant: "destructive" });
    }
  };

  // Investitions- & Rendite-Kennzahlen
  const price = property.purchasePrice || 0;
  const ancillary = property.ancillaryCosts || 0;
  const totalInvestment = price + ancillary;
  const sqmPrice = price > 0 && property.sqm > 0 ? formatGermanNumber(price / property.sqm, 0) : null;
  const annualColdRent = property.tenant ? property.tenant.coldRent * 12 : 0;
  const grossYield = price > 0 && annualColdRent > 0 ? formatGermanPercent((annualColdRent / price) * 100, 2) : null;
  const multiplier = price > 0 && annualColdRent > 0 ? formatGermanNumber(price / annualColdRent, 1) : null;

  // Investitionen & Sanierungen Auswertung
  const totalInvestments = (property.investments || []).reduce((s, i) => s + i.amount, 0);
  const totalCapitalized = (property.investments || [])
    .filter((i) => i.isCapitalized)
    .reduce((s, i) => s + i.amount, 0);
  const totalAssetValue = price + totalCapitalized;

  // 15%-Grenzen Berechnung (§ 6 Abs. 1 Nr. 1a EStG)
  const buildingShare = property.buildingSharePercent ?? 80;
  const buildingVal = price * (buildingShare / 100);
  const limit15 = buildingVal * 0.15;
  const acqDate = property.possessionAt || property.purchasedAt;
  let deadlineEnd: Date | null = null;
  let isExpired = false;
  let monthsRemaining = 0;
  if (acqDate) {
    deadlineEnd = new Date(acqDate);
    deadlineEnd.setFullYear(deadlineEnd.getFullYear() + 3);
    const now = new Date();
    isExpired = now > deadlineEnd;
    monthsRemaining = Math.max(0, Math.ceil((deadlineEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24 * 30.4)));
  }

  const relevantInvestments = (property.investments || []).filter((inv) => {
    if (!inv.relevantFor15Percent) return false;
    if (!acqDate || !deadlineEnd) return true;
    const d = new Date(inv.date);
    return d >= new Date(acqDate) && d <= deadlineEnd;
  });

  const spentNet15 = relevantInvestments.reduce((sum, inv) => {
    return sum + (inv.amountNet != null ? inv.amountNet : Math.round((inv.amount / 1.19) * 100) / 100);
  }, 0);
  const buffer15 = limit15 - spentNet15;
  const used15Pct = limit15 > 0 ? (spentNet15 / limit15) * 100 : 0;
  const isExceeded15 = !isExpired && limit15 > 0 && spentNet15 > limit15;
  const isWarning15 = !isExpired && limit15 > 0 && !isExceeded15 && used15Pct >= 80;

  return (
    <Card className="hover:shadow-lg transition-all duration-300 flex flex-col justify-between">
      <CardContent className="pt-5 pb-5 space-y-4">
        {/* Header mit Titel, Adresse, m² & Aktions-Buttons */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white shadow-md flex-shrink-0">
              <Building2 className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h3 className="font-semibold text-sm leading-tight truncate">{property.name}</h3>
              <p className="text-xs text-muted-foreground mt-0.5 truncate">{property.address}</p>
              {(property.floor || property.unitNumber || property.rooms) && (
                <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground/80 mt-0.5">
                  {(property.floor || property.rooms) && (
                    <span className="truncate">
                      {[property.floor, property.rooms ? `${property.rooms} Zimmer` : null]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  )}
                  {property.unitNumber && (
                    <Badge variant="outline" className="text-[10px] h-4 px-1.5 py-0 font-mono text-primary border-primary/30 bg-primary/5">
                      {property.unitNumber}
                    </Badge>
                  )}
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <div className="text-right mr-1">
              <span className="text-xs font-semibold">{property.sqm} m²</span>
              <span className="block text-[11px] text-muted-foreground">{sqmRent} €/m²</span>
            </div>
            <EditPropertyDialog property={property} onRefresh={onRefresh} />
            <DeletePropertyDialog property={property} onRefresh={onRefresh} />
          </div>
        </div>

        {/* Kaufpreis & Investitions-Infoblock (falls hinterlegt) */}
        {price > 0 && (
          <div className="bg-secondary/40 rounded-xl p-2.5 text-xs space-y-1.5 border border-border/40">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground flex items-center gap-1">
                <Coins className="h-3 w-3 text-primary" /> Kaufpreis:
              </span>
              <span className="font-bold font-mono text-foreground">
                {formatCurrency(price)}
                {sqmPrice && <span className="text-[10px] text-muted-foreground font-normal ml-1">({sqmPrice} €/m²)</span>}
              </span>
            </div>
            {ancillary > 0 && (
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                  <span>+ Kaufnebenkosten:</span>
                  <span className="font-mono font-medium text-foreground">
                    {formatCurrency(ancillary)}{" "}
                    <span className="text-muted-foreground font-normal text-[10px]">
                      (Gesamt: {formatCurrency(totalInvestment)})
                    </span>
                  </span>
                </div>
                {(Boolean(property.propertyTransferTax || property.notaryCosts || property.landRegisterCosts || property.brokerCosts || property.otherAncillaryCosts)) && (
                  <div className="pl-2 border-l-2 border-primary/40 text-[10px] text-muted-foreground space-y-0.5 pt-0.5">
                    {property.propertyTransferTax ? (
                      <div className="flex justify-between">
                        <span>• Grunderwerbsteuer:</span>
                        <span className="font-mono text-foreground">{formatCurrency(property.propertyTransferTax)}</span>
                      </div>
                    ) : null}
                    {property.notaryCosts ? (
                      <div className="flex justify-between">
                        <span>• Notarkosten:</span>
                        <span className="font-mono text-foreground">{formatCurrency(property.notaryCosts)}</span>
                      </div>
                    ) : null}
                    {property.landRegisterCosts ? (
                      <div className="flex justify-between">
                        <span>• Grundbuchamt:</span>
                        <span className="font-mono text-foreground">{formatCurrency(property.landRegisterCosts)}</span>
                      </div>
                    ) : null}
                    {property.brokerCosts ? (
                      <div className="flex justify-between">
                        <span>• Maklerprovision:</span>
                        <span className="font-mono text-foreground">{formatCurrency(property.brokerCosts)}</span>
                      </div>
                    ) : null}
                    {property.otherAncillaryCosts ? (
                      <div className="flex justify-between">
                        <span>• Sonstige Nebenkosten:</span>
                        <span className="font-mono text-foreground">{formatCurrency(property.otherAncillaryCosts)}</span>
                      </div>
                    ) : null}
                  </div>
                )}
              </div>
            )}
            {grossYield && (
              <div className="flex items-center justify-between pt-1 border-t border-border/30">
                <span className="text-muted-foreground">Mietrendite (brutto):</span>
                <div className="flex items-center gap-1.5">
                  <Badge variant="success" className="text-[10px] h-4 px-1.5 font-mono">
                    {grossYield} p.a.
                  </Badge>
                  {multiplier && (
                    <Badge variant="secondary" className="text-[10px] h-4 px-1.5 font-mono">
                      {multiplier}x Faktor
                    </Badge>
                  )}
                </div>
              </div>
            )}
            {(property.purchasedAt || property.possessionAt) && (
              <div className="pt-1.5 border-t border-border/30 space-y-1 text-[11px]">
                {property.purchasedAt && (
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" /> Notarvertrag:
                    </span>
                    <span className="font-mono text-foreground">{formatDate(property.purchasedAt)}</span>
                  </div>
                )}
                {property.possessionAt && (
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span className="flex items-center gap-1" title="Nutzen- & Lastenwechsel: Ab diesem Stichtag gehen Mieteinnahmen, Hausgeld und Pflichten auf den Käufer über">
                      <Clock className="h-3 w-3 text-primary" /> Nutzen & Lasten:
                    </span>
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-foreground">{formatDate(property.possessionAt)}</span>
                      {new Date(property.possessionAt) > new Date() && (
                        <Badge variant="outline" className="text-[9px] h-4 px-1 py-0 text-amber-500 border-amber-500/30">
                          in Zukunft
                        </Badge>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Sanierungen & Gesamtwert */}
            {totalCapitalized > 0 && (
              <div className="pt-1.5 border-t border-border/30 space-y-1 text-[11px]">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                    <Hammer className="h-3 w-3" /> + Investitionen & Sanierung:
                  </span>
                  <span className="font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                    +{formatCurrency(totalCapitalized)}
                  </span>
                </div>
                <div className="flex items-center justify-between font-semibold">
                  <span className="text-foreground">Aktueller Sachwert:</span>
                  <span className="font-mono text-primary">{formatCurrency(totalAssetValue)}</span>
                </div>
              </div>
            )}

            {/* 15%-Grenzen Monitor Mini-Card */}
            {price > 0 && (
              <div
                className={`p-2 rounded-lg text-xs space-y-1.5 border mt-1 ${
                  isExceeded15
                    ? "bg-rose-500/10 border-rose-500/30 text-rose-700 dark:text-rose-300"
                    : isWarning15
                    ? "bg-amber-500/10 border-amber-500/30"
                    : isExpired
                    ? "bg-muted/40 border-border/40 text-muted-foreground"
                    : "bg-emerald-500/5 border-emerald-500/20"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold flex items-center gap-1">
                    <ShieldAlert className="h-3.5 w-3.5" />
                    15%-Grenze (§ 6 EStG):
                  </span>
                  {isExpired ? (
                    <Badge variant="outline" className="text-[9px] h-4 px-1 py-0 bg-muted/60 text-muted-foreground">
                      Frist beendet (Sicher)
                    </Badge>
                  ) : isExceeded15 ? (
                    <Badge variant="destructive" className="text-[9px] h-4 px-1 py-0 animate-pulse">
                      Überschritten!
                    </Badge>
                  ) : isWarning15 ? (
                    <Badge variant="outline" className="text-[9px] h-4 px-1 py-0 bg-amber-500/10 text-amber-600 border-amber-500/30">
                      &gt; 80% verbraucht
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-[9px] h-4 px-1 py-0 bg-emerald-500/10 text-emerald-600 border-emerald-500/30">
                      Puffer: {formatCurrency(buffer15)}
                    </Badge>
                  )}
                </div>
                <div className="flex justify-between items-center text-[10px] text-muted-foreground font-mono">
                  <span>Investiert: {formatCurrency(spentNet15)}</span>
                  <span>Budget: {formatCurrency(limit15)}</span>
                </div>
                {!isExpired && limit15 > 0 && (
                  <div className="h-1.5 w-full bg-secondary rounded-full overflow-hidden">
                    <div
                      className={`h-full ${
                        isExceeded15 ? "bg-rose-500" : isWarning15 ? "bg-amber-500" : "bg-emerald-500"
                      }`}
                      style={{ width: `${Math.min(100, used15Pct)}%` }}
                    />
                  </div>
                )}
                {acqDate && !isExpired && (
                  <p className="text-[10px] text-muted-foreground">
                    Fristende: {formatDate(deadlineEnd!)} (noch ca. {monthsRemaining} Mo.)
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Investitionen & Sanierungen Button */}
        <PropertyInvestmentsDialog
          property={property}
          onRefresh={onRefresh}
          trigger={
            <Button
              variant="outline"
              size="sm"
              className="w-full h-8 text-xs gap-1.5 border-primary/30 text-primary hover:bg-primary/10 shadow-sm"
              title="Investitionen & Sanierungen erfassen, 15%-Grenzen Monitor öffnen"
            >
              <Hammer className="h-3.5 w-3.5" />
              <span>Investitionen & Sanierungen</span>
              {property.investments && property.investments.length > 0 && (
                <Badge variant="secondary" className="text-[10px] h-4 px-1.5 py-0 ml-auto font-mono">
                  {property.investments.length}
                </Badge>
              )}
            </Button>
          }
        />

        {/* Laufende Bewirtschaftungskosten (WEG-Hausgeld & Rücklagen) */}
        <div className="bg-secondary/30 rounded-xl p-2.5 text-xs space-y-1.5 border border-border/40">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="flex items-center gap-1">
              <Coins className="h-3 w-3 text-indigo-500" /> Hausgeld (WEG):
            </span>
            <div className="flex items-center gap-1.5 font-mono">
              <span className="font-semibold text-foreground">
                {property.hausgeld != null && property.hausgeld > 0
                  ? `${formatCurrency(property.hausgeld)}/Mo`
                  : "–"}
              </span>
            </div>
          </div>
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="flex items-center gap-1">
              <ShieldCheck className="h-3 w-3 text-amber-500" /> Erhaltungsrücklage:
            </span>
            <div className="flex items-center gap-1.5 font-mono">
              <span className="font-semibold text-foreground">
                {property.maintenanceReserve != null && property.maintenanceReserve > 0
                  ? `${formatCurrency(property.maintenanceReserve)}/Mo`
                  : `${formatCurrency(property.sqm * 1.20)}/Mo`}
              </span>
              <Badge variant={property.maintenanceReserve != null && property.maintenanceReserve > 0 ? "secondary" : "outline"} className="text-[9px] h-4 px-1 py-0 font-sans">
                {property.maintenanceReserve != null && property.maintenanceReserve > 0 ? "Individuell" : "1,20 €/m²"}
              </Badge>
            </div>
          </div>
          {((property.hausgeld != null && property.hausgeld > 0) || (property.maintenanceReserve != null && property.maintenanceReserve > 0)) && (
            <div className="flex items-center justify-between pt-1 border-t border-border/40 text-xs">
              <span className="font-medium text-foreground">Gesamt-Soll an WEG:</span>
              <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">
                {formatCurrency((property.hausgeld || 0) + (property.maintenanceReserve || 0))}/Mo
              </span>
            </div>
          )}
          {property.nonRecoverableCosts != null && property.nonRecoverableCosts > 0 && (
            <div className="flex items-center justify-between text-[11px] text-muted-foreground/80 pt-0.5">
              <span>Nicht-umlagef. Kosten:</span>
              <span className="font-mono">{formatCurrency(property.nonRecoverableCosts)}/Mo</span>
            </div>
          )}
        </div>

        {/* Verbund-Aufteilung nach Wohneinheiten (z.B. WE 5 & WE 6) */}
        {property.unitDetails && (() => {
          try {
            const details: Record<string, SubUnitDetail> = typeof property.unitDetails === "string" ? JSON.parse(property.unitDetails) : property.unitDetails;
            const units = Object.values(details);
            if (units.length > 1) {
              return (
                <div className="rounded-xl border border-indigo-200/70 dark:border-indigo-800/70 bg-indigo-50/40 dark:bg-indigo-950/20 p-2.5 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-indigo-950 dark:text-indigo-200 flex items-center gap-1.5">
                      <Layers className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
                      Verbund-Aufteilung ({units.length} Einheiten)
                    </span>
                    <Badge variant="outline" className="text-[10px] bg-indigo-100/60 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300 border-indigo-300 dark:border-indigo-700">
                      Kombinierte Nutzung
                    </Badge>
                  </div>

                  <div className="grid grid-cols-1 gap-2">
                    {units.map((u) => (
                      <div key={u.key} className="rounded-lg bg-background/80 p-2.5 border border-border/60 space-y-1.5">
                        <div className="flex items-center justify-between font-semibold text-xs text-foreground border-b border-border/40 pb-1">
                          <span className="flex items-center gap-1.5">
                            <span className="px-1.5 py-0.5 rounded bg-indigo-100 dark:bg-indigo-900/40 text-indigo-800 dark:text-indigo-300 text-[10px] font-bold">
                              {u.unitNumber || u.key}
                            </span>
                            <span>{u.name || u.label || u.key}</span>
                          </span>
                          <span className="font-mono text-indigo-600 dark:text-indigo-400 font-semibold">{u.sqm} m²</span>
                        </div>

                        <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] text-muted-foreground pt-0.5">
                          <div className="space-y-0.5">
                            <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Kauf & Notar</div>
                            <div className="font-mono text-foreground font-medium">{formatCurrency(u.purchasePrice || 0)}</div>
                            <div className="text-[10px] text-muted-foreground">Notar: {u.purchasedAt ? formatDate(u.purchasedAt) : "–"}</div>
                          </div>
                          <div className="space-y-0.5">
                            <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Mietvertrag</div>
                            <div className="font-mono text-foreground font-medium">Kalt: {formatCurrency(u.coldRent || 0)}</div>
                            <div className="text-[10px] text-muted-foreground">
                              NK: {formatCurrency(u.utilities || 0)} {u.heating ? `(Hzg ${formatCurrency(u.heating)} + BK ${formatCurrency(u.operatingCosts || 0)})` : ""}
                            </div>
                            <div className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 font-mono">
                              Warm: {formatCurrency(u.warmRent || ((u.coldRent || 0) + (u.utilities || 0)))}
                            </div>
                          </div>
                        </div>

                        <div className="pt-1 border-t border-border/40 flex items-center justify-between text-[11px]">
                          <span className="text-muted-foreground">WEG-Hausgeld & Rücklage:</span>
                          <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">
                            {formatCurrency(u.totalWeg || ((u.hausgeld || 0) + (u.maintenanceReserve || 0)))}/Mo
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            }
          } catch {}
          return null;
        })()}

        {/* Mieterbereich: Entweder Vermietet ODER Leerstand */}
        {property.tenant ? (
          <div className="space-y-3 border-t border-border/50 pt-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-sm font-semibold">
                  {property.tenant.firstName} {property.tenant.lastName}
                </span>
              </div>
              <Badge variant="success" className="text-xs">Vermietet</Badge>
            </div>

            {/* Kontakt & IBAN */}
            <div className="space-y-1 text-xs text-muted-foreground">
              {property.tenant.email && (
                <div className="flex items-center gap-1.5 truncate">
                  <Mail className="h-3 w-3 flex-shrink-0" />
                  <span className="truncate">{property.tenant.email}</span>
                </div>
              )}
              {property.tenant.phone && (
                <div className="flex items-center gap-1.5">
                  <Phone className="h-3 w-3 flex-shrink-0" />
                  <span>{property.tenant.phone}</span>
                </div>
              )}
              {property.tenant.iban && (
                <div className="flex items-center gap-1.5 font-mono text-[11px]">
                  <CreditCard className="h-3 w-3 flex-shrink-0" />
                  <span>{property.tenant.iban}</span>
                </div>
              )}
            </div>

            {/* Mieten-Tabelle */}
            <div className="grid grid-cols-3 gap-2 pt-1">
              <div className="bg-secondary/50 rounded-lg p-2 text-center">
                <p className="text-[11px] text-muted-foreground">Kaltmiete</p>
                <p className="text-sm font-bold mt-0.5">{formatCurrency(property.tenant.coldRent)}</p>
              </div>
              <div className="bg-secondary/50 rounded-lg p-2 text-center">
                <p className="text-[11px] text-muted-foreground">NK-VZ</p>
                <p className="text-sm font-bold mt-0.5">{formatCurrency(property.tenant.utilities)}</p>
              </div>
              <div className="bg-secondary/50 rounded-lg p-2 text-center">
                <p className="text-[11px] text-muted-foreground">Gesamtmiete</p>
                <p className="text-sm font-bold mt-0.5 text-primary">
                  {formatCurrency(property.tenant.coldRent + property.tenant.utilities)}
                </p>
              </div>
            </div>

            {/* Kaution Status */}
            <div className="flex items-center justify-between text-xs bg-muted/40 p-2 rounded-lg">
              <span className="text-muted-foreground">Mietkaution:</span>
              <div className="flex items-center gap-1">
                <span className="font-semibold">{formatCurrency(property.tenant.deposit)}</span>
                {property.tenant.depositPaid ? (
                  <Badge variant="success" className="text-[10px] h-4 px-1.5 gap-0.5">
                    <Check className="h-2.5 w-2.5" /> Bezahlt
                  </Badge>
                ) : (
                  <Badge variant="destructive" className="text-[10px] h-4 px-1.5">
                    Ausstehend
                  </Badge>
                )}
              </div>
            </div>

            {/* Fristen / Einzug */}
            <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
              <div className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                <span>Einzug: {formatDate(property.tenant.moveInDate)}</span>
              </div>
              {openTickets > 0 && (
                <Badge variant="destructive" className="text-[11px]">
                  {openTickets} offene Reparatur{openTickets > 1 ? "en" : ""}
                </Badge>
              )}
            </div>

            {/* Aktionen für Mieter */}
            <div className="flex items-center justify-between pt-2 border-t border-border/50 gap-2 flex-wrap">
              <div className="flex items-center gap-1.5">
                <EditTenantDialog tenant={property.tenant} onRefresh={onRefresh} />
                <RemoveTenantDialog
                  tenant={property.tenant}
                  propertyName={property.name}
                  onRefresh={onRefresh}
                />
              </div>
              <div className="flex items-center gap-1.5">
                <Link
                  href={`/zahlungen?search=${encodeURIComponent(property.tenant.lastName)}&period=ALL`}
                  className="h-7 px-2 text-xs gap-1 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 rounded-md inline-flex items-center transition-colors shadow-sm font-medium"
                  title={`Zahlungsströme & Soll-/Ist-Status für ${property.tenant.firstName} ${property.tenant.lastName} ansehen`}
                >
                  <CreditCard className="h-3 w-3" />
                  <span>Zahlungen</span>
                  <ArrowRight className="h-3 w-3 opacity-60" />
                </Link>
                <RentAdjustmentDialog
                  selectedPropertyId={property.id}
                  onRefresh={onRefresh}
                  trigger={
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs gap-1 border-primary/30 text-primary hover:bg-primary/10"
                      title="Mietanpassung (Kaltmiete / Nebenkosten) für diese Wohnung erfassen oder Historie einsehen"
                    >
                      <TrendingUp className="h-3 w-3" />
                      <span>Mietanpassung</span>
                      {property.rentAdjustments?.length > 0 && (
                        <Badge variant="secondary" className="text-[10px] h-4 px-1 py-0 ml-0.5">
                          {property.rentAdjustments.length}
                        </Badge>
                      )}
                    </Button>
                  }
                />
              </div>
            </div>
          </div>
        ) : (
          <div className="border-t border-border/50 pt-5 pb-2 text-center space-y-3">
            <div className="p-3 bg-secondary/30 rounded-xl border border-dashed border-border flex flex-col items-center">
              <Badge variant="outline" className="text-muted-foreground text-xs mb-1.5">
                Aktuell Leerstand
              </Badge>
              <p className="text-xs text-muted-foreground mb-3">
                Kein aktiver Mieter für diese Wohnung hinterlegt.
              </p>
              <AddTenantDialog property={property} onRefresh={onRefresh} />
            </div>
          </div>
        )}

        {/* Mieter-Historie / Vormieter Sektion */}
        {property.formerTenants && property.formerTenants.length > 0 ? (
          <div className="border-t border-border/50 pt-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold flex items-center gap-1.5 text-muted-foreground">
                <History className="h-3.5 w-3.5 text-amber-500" />
                Vormieter-Historie ({property.formerTenants.length})
              </span>
              <AddFormerTenantDialog property={property} onRefresh={onRefresh} />
            </div>

            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
              {property.formerTenants.map((ft) => (
                <div
                  key={ft.id}
                  className="bg-secondary/40 border border-border/60 rounded-lg p-2.5 text-xs space-y-1.5"
                >
                  <div className="flex items-center justify-between gap-1">
                    <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                      <span className="font-semibold text-foreground truncate">
                        {ft.firstName} {ft.lastName}
                      </span>
                      <Badge
                        variant="outline"
                        className="text-[10px] text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/30 px-1 py-0 h-4"
                      >
                        Vormieter
                      </Badge>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Link
                        href={`/zahlungen?search=${encodeURIComponent(ft.lastName)}&period=ALL`}
                        className="h-6 px-1.5 text-[11px] gap-1 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 rounded inline-flex items-center transition-colors font-medium shadow-xs"
                        title={`Bankbuchungen & Mieten für ${ft.firstName} ${ft.lastName} ansehen`}
                      >
                        <CreditCard className="h-3 w-3" />
                        <span>Zahlungen</span>
                      </Link>
                      <EditTenantDialog
                        tenant={ft}
                        onRefresh={onRefresh}
                        trigger={
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6 text-muted-foreground hover:text-foreground"
                            title="Vormieter bearbeiten"
                          >
                            <Edit className="h-3 w-3" />
                          </Button>
                        }
                      />
                      <RemoveTenantDialog
                        tenant={ft}
                        propertyName={property.name}
                        onRefresh={onRefresh}
                        trigger={
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6 text-muted-foreground hover:text-destructive"
                            title="Vormieter löschen"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        }
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-muted-foreground text-[11px]">
                    <span>
                      {ft.moveInDate ? formatDate(ft.moveInDate) : "–"} bis{" "}
                      {ft.moveOutDate ? formatDate(ft.moveOutDate) : "–"}
                    </span>
                    <span className="font-mono">
                      {formatCurrency(ft.coldRent + ft.utilities)} ({formatCurrency(ft.coldRent)} KM + {formatCurrency(ft.utilities)} NK)
                    </span>
                  </div>

                  {ft.iban && (
                    <div className="flex items-center gap-1 font-mono text-[10px] text-muted-foreground truncate">
                      <CreditCard className="h-2.5 w-2.5 shrink-0 text-muted-foreground" />
                      <span className="truncate" title={ft.iban}>{ft.iban}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="border-t border-border/40 pt-2 flex justify-end">
            <AddFormerTenantDialog property={property} onRefresh={onRefresh} />
          </div>
        )}

        {/* Dokumente (Mietverträge, Übergabeprotokolle, Grundrisse) */}
        <div className="pt-3 border-t border-border/50 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold flex items-center gap-1.5 text-muted-foreground">
              <FileText className="h-3.5 w-3.5 text-primary" />
              Dokumente & Verträge ({property.documents?.length || 0})
            </span>
            <PropertyDocumentUploadDialog property={property} onRefresh={onRefresh} />
          </div>

          {property.documents && property.documents.length > 0 ? (
            <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
              {property.documents.map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-center justify-between text-xs bg-muted/40 hover:bg-muted/70 px-2.5 py-1.5 rounded-lg border border-border/40 transition-colors"
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-sm">
                      {doc.type === "LEASE" ? "📜" : doc.type === "PROTOCOL" ? "📋" : doc.type === "FLOORPLAN" ? "📐" : "📄"}
                    </span>
                    <span className="truncate font-medium text-[11px]" title={doc.name}>
                      {doc.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <a
                      href={doc.filePath || doc.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1 hover:text-primary transition-colors text-muted-foreground"
                      title="Öffnen / Herunterladen"
                    >
                      <ArrowUpRight className="h-3.5 w-3.5" />
                    </a>
                    <button
                      onClick={() => deleteDocument(doc.id)}
                      className="p-1 text-muted-foreground hover:text-destructive transition-colors"
                      title="Dokument löschen"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[11px] text-muted-foreground/70 italic">
              Noch keine Mietverträge oder Dokumente hinterlegt.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Wohnung hinzufügen Dialog (mit optionalem Mieter) ────────────────────────
function AddPropertyDialog({ onRefresh }: { onRefresh: () => void }) {
  const [open, setOpen] = useState(false);
  const [withTenant, setWithTenant] = useState(false);
  const [saving, setSaving] = useState(false);
  const today = new Date().toISOString().split("T")[0];

  const [form, setForm] = useState({
    name: "",
    address: "",
    sqm: "",
    floor: "",
    unitNumber: "",
    rooms: "",
    // Kaufpreis & Nebenkosten (optional)
    purchasePrice: "",
    purchasedAt: "",
    possessionAt: "",
    ancillaryCosts: "",
    propertyTransferTax: "",
    notaryCosts: "",
    landRegisterCosts: "",
    brokerCosts: "",
    otherAncillaryCosts: "",
    buildingSharePercent: "80",
    hausgeld: "",
    nonRecoverableCosts: "",
    maintenanceReserve: "",
    // Mieterdaten (optional)
    tenantFirstName: "",
    tenantLastName: "",
    tenantEmail: "",
    tenantPhone: "",
    tenantIban: "",
    tenantColdRent: "",
    tenantUtilities: "",
    tenantDeposit: "",
    tenantDepositPaid: false,
    tenantMoveInDate: "",
    tenantContractStart: "",
  });

  const [unitDetails, setUnitDetails] = useState<Record<string, string>>({});

  const handleUnitDetailChange = (unitKey: string, val: string) => {
    const updated = { ...unitDetails, [unitKey]: val };
    setUnitDetails(updated);
    const sum = Object.values(updated).reduce((acc, v) => acc + (parseGermanNumber(v) || 0), 0);
    if (sum > 0) {
      setForm((prev) => ({ ...prev, hausgeld: formatGermanInput(sum) }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    let hausgeldDetailsPayload: string | null = null;
    const tokens = parseUnitTokens(form.unitNumber);
    if (tokens.length > 1) {
      const detailsObj: Record<string, { hausgeld: number }> = {};
      for (const token of tokens) {
        const val = parseGermanNumber(unitDetails[token.raw] || "");
        if (val > 0) {
          detailsObj[token.raw] = { hausgeld: val };
        }
      }
      if (Object.keys(detailsObj).length > 0) {
        hausgeldDetailsPayload = JSON.stringify(detailsObj);
      }
    }

    const payload = {
      name: form.name,
      address: form.address,
      sqm: form.sqm,
      floor: form.floor || null,
      unitNumber: form.unitNumber || null,
      rooms: form.rooms || null,
      purchasePrice: form.purchasePrice ? parseGermanNumber(form.purchasePrice) : null,
      purchasedAt: form.purchasedAt || null,
      possessionAt: form.possessionAt || null,
      ancillaryCosts: form.ancillaryCosts ? parseGermanNumber(form.ancillaryCosts) : null,
      propertyTransferTax: form.propertyTransferTax ? parseGermanNumber(form.propertyTransferTax) : null,
      notaryCosts: form.notaryCosts ? parseGermanNumber(form.notaryCosts) : null,
      landRegisterCosts: form.landRegisterCosts ? parseGermanNumber(form.landRegisterCosts) : null,
      brokerCosts: form.brokerCosts ? parseGermanNumber(form.brokerCosts) : null,
      otherAncillaryCosts: form.otherAncillaryCosts ? parseGermanNumber(form.otherAncillaryCosts) : null,
      buildingSharePercent: form.buildingSharePercent ? parseGermanNumber(form.buildingSharePercent) : 80,
      hausgeld: form.hausgeld ? parseGermanNumber(form.hausgeld) : null,
      hausgeldDetails: hausgeldDetailsPayload,
      nonRecoverableCosts: form.nonRecoverableCosts ? parseGermanNumber(form.nonRecoverableCosts) : null,
      maintenanceReserve: form.maintenanceReserve ? parseGermanNumber(form.maintenanceReserve) : null,
      ...(withTenant && form.tenantLastName
        ? {
            tenant: {
              firstName: form.tenantFirstName || "Unbekannt",
              lastName: form.tenantLastName,
              email: form.tenantEmail || null,
              phone: form.tenantPhone || null,
              iban: form.tenantIban || null,
              coldRent: parseGermanNumber(form.tenantColdRent || "0"),
              utilities: parseGermanNumber(form.tenantUtilities || "0"),
              deposit: parseGermanNumber(form.tenantDeposit || "0"),
              depositPaid: form.tenantDepositPaid,
              moveInDate: form.tenantMoveInDate,
              contractStart: form.tenantContractStart,
            },
          }
        : {}),
    };

    const res = await fetch("/api/properties", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setSaving(false);

    if (res.ok) {
      toast({
        title: "Wohnung angelegt",
        description: withTenant ? "Wohnung & Mieter erfolgreich erstellt!" : "Wohnung erfolgreich als Leerstand erstellt.",
      });
      setOpen(false);
      // Reset form
      setForm({
        name: "",
        address: "",
        sqm: "",
        floor: "",
        unitNumber: "",
        rooms: "",
        purchasePrice: "",
        purchasedAt: "",
        possessionAt: "",
        ancillaryCosts: "",
        propertyTransferTax: "",
        notaryCosts: "",
        landRegisterCosts: "",
        brokerCosts: "",
        otherAncillaryCosts: "",
        buildingSharePercent: "80",
        hausgeld: "",
        nonRecoverableCosts: "",
        maintenanceReserve: "",
        tenantFirstName: "",
        tenantLastName: "",
        tenantEmail: "",
        tenantPhone: "",
        tenantIban: "",
        tenantColdRent: "",
        tenantUtilities: "",
        tenantDeposit: "",
        tenantDepositPaid: false,
        tenantMoveInDate: "",
        tenantContractStart: "",
      });
      setWithTenant(false);
      onRefresh();
    } else {
      const err = await res.json();
      toast({
        title: "Fehler beim Anlegen",
        description: err.error || "Bitte Eingaben überprüfen",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="h-4 w-4 mr-1.5" /> Wohnung hinzufügen
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Neue Wohnung anlegen</DialogTitle>
          <DialogDescription>
            Erfassen Sie die Objektdaten, optional Kaufpreis & Nebenkosten und optional direkt den ersten Mieter.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          {/* Objektdaten */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Home className="h-3.5 w-3.5" /> Objektdaten
            </h4>
            <div className="space-y-1">
              <Label className="text-xs">Bezeichnung *</Label>
              <Input
                placeholder="z.B. Wohnung 6 – Seestr. 10"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Adresse *</Label>
              <Input
                placeholder="Musterstraße 1, 10115 Berlin"
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                required
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Wohnfläche (m²) *</Label>
                <Input
                  type="number"
                  step="0.1"
                  placeholder="68.5"
                  value={form.sqm}
                  onChange={(e) => setForm({ ...form, sqm: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Zimmer</Label>
                <Input
                  type="number"
                  step="0.5"
                  placeholder="3.0"
                  value={form.rooms}
                  onChange={(e) => setForm({ ...form, rooms: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Etage / Stockwerk</Label>
                <Input
                  placeholder="z.B. EG oder 2.OG"
                  value={form.floor}
                  onChange={(e) => setForm({ ...form, floor: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Wohneinheit (WE)</Label>
                <Input
                  placeholder="z.B. WE1 oder WE5, WE6"
                  value={form.unitNumber}
                  onChange={(e) => setForm({ ...form, unitNumber: e.target.value })}
                />
                <p className="text-[10px] text-muted-foreground">
                  Für eindeutigen Bankabgleich (z. B. bei Hausgeld)
                </p>
              </div>
            </div>
          </div>

          {/* Kaufpreis & Nebenkosten (optional) */}
          <div className="space-y-3 pt-3 border-t border-border">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-primary flex items-center gap-1.5">
              <Coins className="h-3.5 w-3.5" /> Kaufpreis & Investition (optional)
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Kaufpreis (€)</Label>
                <Input
                  type="text"
                  inputMode="decimal"
                  placeholder="z.B. 240.000,00"
                  value={form.purchasePrice}
                  onChange={(e) => setForm({ ...form, purchasePrice: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs flex items-center gap-1">
                  <Calendar className="h-3 w-3 text-muted-foreground" /> Notarvertrag
                </Label>
                <DateInput
                  value={form.purchasedAt}
                  onChange={(e) => setForm({ ...form, purchasedAt: e.target.value })}
                />
                <p className="text-[10px] text-muted-foreground">Datum Beurkundung</p>
              </div>
              <div className="space-y-1">
                <Label className="text-xs flex items-center gap-1">
                  <Clock className="h-3 w-3 text-primary" /> Nutzen & Lasten
                </Label>
                <DateInput
                  value={form.possessionAt}
                  onChange={(e) => setForm({ ...form, possessionAt: e.target.value })}
                />
                <p className="text-[10px] text-muted-foreground">Wirtschaftl. Übergang</p>
              </div>
            </div>

            {/* Detaillierte Kaufnebenkosten */}
            <DetailedAncillaryCostsSection form={form} setForm={setForm} />

            {/* Gebäudeanteil & 15%-Grenzen Berechnung */}
            <div className="space-y-2 pt-2 border-t border-border/40">
              <div className="grid grid-cols-2 gap-3 items-center">
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs">Gebäudeanteil (%)</Label>
                    <span className="text-[10px] text-muted-foreground">Standard: 80%</span>
                  </div>
                  <Input
                    type="number"
                    min="10"
                    max="100"
                    step="1"
                    placeholder="80"
                    value={form.buildingSharePercent}
                    onChange={(e) => setForm({ ...form, buildingSharePercent: e.target.value })}
                  />
                  <p className="text-[10px] text-muted-foreground">Für AfA & 15%-Grenze (§ 6 EStG)</p>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Bodenanteil (%)</Label>
                  <div className="h-9 px-3 rounded-md border border-input bg-muted/40 flex items-center font-mono text-xs text-muted-foreground">
                    {100 - (parseFloat(form.buildingSharePercent) || 80)}% (nicht abschreibbar)
                  </div>
                  <p className="text-[10px] text-muted-foreground">Grund und Boden Anteil</p>
                </div>
              </div>

              {/* Live Vorschau Gebäudewert & 15%-Budget */}
              {parseFloat(form.purchasePrice) > 0 && (
                <div className="p-2.5 rounded-lg bg-secondary/40 border border-border/60 text-xs space-y-1">
                  <div className="flex justify-between items-center text-muted-foreground">
                    <span>Gebäudewert (AfA- & 15%-Basis):</span>
                    <span className="font-mono font-bold text-foreground">
                      {formatCurrency(parseFloat(form.purchasePrice) * ((parseFloat(form.buildingSharePercent) || 80) / 100))}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-muted-foreground text-[11px]">
                    <span>15%-Grenzen Budget (§ 6 EStG netto):</span>
                    <span className="font-mono font-semibold text-primary">
                      {formatCurrency(parseFloat(form.purchasePrice) * ((parseFloat(form.buildingSharePercent) || 80) / 100) * 0.15)}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Hausgeld & Erhaltungsrücklage (Monatliche Zahlung an WEG / Hausverwaltung) */}
          <div className="space-y-3 pt-3 border-t border-border">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5">
              <Coins className="h-3.5 w-3.5" /> Hausgeld & Erhaltungsrücklage (Zahlung an WEG)
            </h4>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Hausgeld (€/Mo)</Label>
                <Input
                  type="text"
                  inputMode="decimal"
                  placeholder="z. B. 160,00"
                  value={form.hausgeld}
                  onChange={(e) => setForm({ ...form, hausgeld: e.target.value })}
                />
                <p className="text-[10px] text-muted-foreground">
                  Laufende Bewirtschaftung / Wirtschaftsplan (umlagef. & nicht-umlagef.)
                </p>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Erhaltungsrücklage (€/Mo)</Label>
                <Input
                  type="text"
                  inputMode="decimal"
                  placeholder={`Standard: ${formatGermanNumber(parseFloat(form.sqm || "0") * 1.20, 2)} €`}
                  value={form.maintenanceReserve}
                  onChange={(e) => setForm({ ...form, maintenanceReserve: e.target.value })}
                />
                <p className="text-[10px] text-muted-foreground">
                  Monatliche Zuführung zur WEG-Instandhaltungsrücklage
                </p>
              </div>
            </div>

            {/* Live-Berechnung der Gesamt-Soll-Zahlung an WEG */}
            <div className="rounded-lg bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200/60 dark:border-indigo-800/60 p-2.5 text-xs flex items-center justify-between">
              <div className="space-y-0.5">
                <div className="font-semibold text-indigo-950 dark:text-indigo-200 flex items-center gap-1.5">
                  <span>Monatliche Gesamtzahlung an WEG:</span>
                  <span className="font-mono text-sm text-indigo-700 dark:text-indigo-300 font-bold">
                    {formatCurrency(
                      (parseGermanNumber(form.hausgeld) || 0) +
                      (parseGermanNumber(form.maintenanceReserve) || 0)
                    )}
                  </span>
                </div>
                <p className="text-[10px] text-indigo-700/80 dark:text-indigo-300/80">
                  Wird auf der Banküberweisungs-Seite für den automatischen Soll-Ist-Abgleich herangezogen.
                </p>
              </div>
            </div>

            {/* Mehrere Wohneinheiten (z.B. WE 5 und WE 6)? Aufteilung ermöglichen */}
            {parseUnitTokens(form.unitNumber).length > 1 && (
              <div className="p-2.5 rounded-lg border border-border/80 bg-muted/40 space-y-2">
                <div className="text-[11px] font-semibold flex items-center justify-between">
                  <span>Aufteilung nach Wohneinheiten ({parseUnitTokens(form.unitNumber).map((u) => u.raw).join(", ")}):</span>
                  <span className="text-[10px] text-muted-foreground">Für getrennte Banküberweisungen je WE</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {parseUnitTokens(form.unitNumber).map((token) => (
                    <div key={token.raw} className="space-y-1">
                      <Label className="text-[11px] font-medium">{token.raw} (€/Mo):</Label>
                      <Input
                        type="text"
                        inputMode="decimal"
                        placeholder="z. B. 250,00"
                        value={unitDetails[token.raw] || ""}
                        onChange={(e) => handleUnitDetailChange(token.raw, e.target.value)}
                        className="h-8 text-xs"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Parameter für Netto-Cashflow */}
            <div className="pt-2">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Nicht-umlagef. Kosten (€/Mo) – optional für Cashflow-Formel</Label>
                <Input
                  type="text"
                  inputMode="decimal"
                  placeholder={`Pauschale: ${formatGermanNumber(parseFloat(form.sqm || "0") * 0.35 + 25, 2)} €`}
                  value={form.nonRecoverableCosts}
                  onChange={(e) => setForm({ ...form, nonRecoverableCosts: e.target.value })}
                  className="h-8 text-xs text-muted-foreground"
                />
                <p className="text-[10px] text-muted-foreground">
                  SEV, Verwaltergebühr etc. Wenn leer: Pauschale (0,35 €/m² + 25 €)
                </p>
              </div>
            </div>
          </div>

          {/* Toggle Mieter direkt anlegen */}
          <div className="pt-2 border-t border-border">
            <div className="flex items-center justify-between p-3 bg-secondary/40 rounded-xl border border-border/50">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" />
                <div>
                  <p className="text-xs font-semibold">Direkt einen Mieter für diese Wohnung erfassen?</p>
                  <p className="text-[11px] text-muted-foreground">
                    Falls die Wohnung bereits vermietet ist, können Sie den Mieter sofort anlegen.
                  </p>
                </div>
              </div>
              <input
                type="checkbox"
                id="toggle-with-tenant"
                checked={withTenant}
                onChange={(e) => setWithTenant(e.target.checked)}
                className="h-4 w-4 rounded border-input text-primary cursor-pointer"
              />
            </div>
          </div>

          {/* Optionale Mieterdaten */}
          {withTenant && (
            <div className="space-y-3 p-3.5 bg-muted/30 rounded-xl border border-border animate-fade-in">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-primary flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5" /> Mieterdaten & Mietkonditionen
              </h4>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Vorname</Label>
                  <Input
                    placeholder="Max"
                    value={form.tenantFirstName}
                    onChange={(e) => setForm({ ...form, tenantFirstName: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Nachname *</Label>
                  <Input
                    placeholder="Mustermann"
                    value={form.tenantLastName}
                    onChange={(e) => setForm({ ...form, tenantLastName: e.target.value })}
                    required={withTenant}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">E-Mail</Label>
                  <Input
                    type="email"
                    placeholder="max@beispiel.de"
                    value={form.tenantEmail}
                    onChange={(e) => setForm({ ...form, tenantEmail: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Telefon</Label>
                  <Input
                    placeholder="+49 170 1234567"
                    value={form.tenantPhone}
                    onChange={(e) => setForm({ ...form, tenantPhone: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">IBAN (für Buchungsabgleich)</Label>
                <Input
                  className="font-mono text-xs uppercase"
                  placeholder="DE89 3704 0044 0532 0130 00"
                  value={form.tenantIban}
                  onChange={(e) => setForm({ ...form, tenantIban: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Soll-Kaltmiete (€) *</Label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="800.00"
                    value={form.tenantColdRent}
                    onChange={(e) => {
                      const val = e.target.value;
                      const num = parseFloat(val);
                      setForm({
                        ...form,
                        tenantColdRent: val,
                        tenantDeposit: !form.tenantDeposit && !isNaN(num) ? (num * 3).toFixed(2) : form.tenantDeposit,
                      });
                    }}
                    required={withTenant}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">NK-Vorauszahlung (€) *</Label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="180.00"
                    value={form.tenantUtilities}
                    onChange={(e) => setForm({ ...form, tenantUtilities: e.target.value })}
                    required={withTenant}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 items-center">
                <div className="space-y-1">
                  <Label className="text-xs">Kaution (€)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="2400.00"
                    value={form.tenantDeposit}
                    onChange={(e) => setForm({ ...form, tenantDeposit: e.target.value })}
                  />
                </div>
                <div className="flex items-center gap-2 pt-4">
                  <input
                    type="checkbox"
                    id="new-dep-paid"
                    checked={form.tenantDepositPaid}
                    onChange={(e) => setForm({ ...form, tenantDepositPaid: e.target.checked })}
                    className="rounded border-input text-primary h-4 w-4"
                  />
                  <label htmlFor="new-dep-paid" className="text-xs font-medium cursor-pointer">
                    Kaution bezahlt
                  </label>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Mietbeginn / Einzug</Label>
                  <DateInput
                    value={form.tenantMoveInDate}
                    onChange={(e) => setForm({ ...form, tenantMoveInDate: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Vertragsbeginn</Label>
                  <DateInput
                    value={form.tenantContractStart}
                    onChange={(e) => setForm({ ...form, tenantContractStart: e.target.value })}
                  />
                </div>
              </div>
            </div>
          )}

          <Button type="submit" className="w-full" disabled={saving}>
            {saving ? "Wird gespeichert..." : withTenant ? "Wohnung mit Mieter anlegen" : "Wohnung anlegen"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Portfolio-Kaufwert Info Dialog ──────────────────────────────────────────
function PortfolioKaufwertInfoDialog({
  properties,
  totalPurchaseValue,
  totalAncillaryCosts,
  totalColdRent,
  totalSqm,
  portfolioYield,
}: {
  properties: Property[];
  totalPurchaseValue: number;
  totalAncillaryCosts: number;
  totalColdRent: number;
  totalSqm: number;
  portfolioYield: string | null;
}) {
  const [open, setOpen] = useState(false);
  const totalInvestment = totalPurchaseValue + totalAncillaryCosts;
  const annualColdRent = totalColdRent * 12;
  const multiplier = annualColdRent > 0 && totalPurchaseValue > 0
    ? (totalPurchaseValue / annualColdRent).toFixed(1)
    : null;
  const avgSqmPrice = totalSqm > 0 && totalPurchaseValue > 0
    ? Math.round(totalPurchaseValue / totalSqm)
    : null;

  const totalTransferTax = properties.reduce((s, p) => s + (p.propertyTransferTax || 0), 0);
  const totalNotaryCosts = properties.reduce((s, p) => s + (p.notaryCosts || 0), 0);
  const totalLandRegCosts = properties.reduce((s, p) => s + (p.landRegisterCosts || 0), 0);
  const totalBrokerCosts = properties.reduce((s, p) => s + (p.brokerCosts || 0), 0);
  const totalOtherAncillary = properties.reduce((s, p) => s + (p.otherAncillaryCosts || 0), 0);
  const totalDetailedAncillary = totalTransferTax + totalNotaryCosts + totalLandRegCosts + totalBrokerCosts + totalOtherAncillary;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center justify-center h-4 w-4 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors focus:outline-none"
          title="Kaufwert- und Renditeberechnung ansehen"
        >
          <Info className="h-3.5 w-3.5" />
          <span className="sr-only">Berechnung ansehen</span>
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-primary/10 rounded-lg text-primary">
              <Calculator className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-xl">Berechnung Portfolio-Kaufwert & Rendite</DialogTitle>
              <DialogDescription>
                Detaillierte Aufschlüsselung der Anschaffungskosten und Formeln Ihres Bestands
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6 pt-2">
          {/* Kennzahlen-Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="p-3 rounded-lg border bg-card">
              <span className="text-[11px] text-muted-foreground block">Portfolio-Kaufwert</span>
              <span className="text-lg font-bold text-primary block mt-0.5">
                {formatCurrency(totalPurchaseValue)}
              </span>
              <span className="text-[10px] text-muted-foreground">Reine Kaufpreise</span>
            </div>

            <div className="p-3 rounded-lg border bg-card">
              <span className="text-[11px] text-muted-foreground block">Kaufnebenkosten</span>
              <span className="text-lg font-bold block mt-0.5">
                {formatCurrency(totalAncillaryCosts)}
              </span>
              <span className="text-[10px] text-muted-foreground">Notar, Grunderwerb etc.</span>
            </div>

            <div className="p-3 rounded-lg border bg-card">
              <span className="text-[11px] text-muted-foreground block">Gesamtinvestition</span>
              <span className="text-lg font-bold text-amber-600 dark:text-amber-400 block mt-0.5">
                {formatCurrency(totalInvestment)}
              </span>
              <span className="text-[10px] text-muted-foreground">Kaufpreis + Nebenkosten</span>
            </div>

            <div className="p-3 rounded-lg border bg-card">
              <span className="text-[11px] text-muted-foreground block">Ø Brutto-Mietrendite</span>
              <span className="text-lg font-bold text-green-600 dark:text-green-400 block mt-0.5">
                {portfolioYield ? `${portfolioYield}% p.a.` : "–"}
              </span>
              <span className="text-[10px] text-muted-foreground">
                {multiplier ? `Faktor ${multiplier}x` : "–"}
              </span>
            </div>
          </div>

          {/* Aufschlüsselung der Kaufnebenkosten im Portfolio */}
          {totalDetailedAncillary > 0 && (
            <div className="p-4 rounded-lg bg-secondary/30 border space-y-3">
              <div className="font-semibold text-foreground text-sm flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Receipt className="h-4 w-4 text-primary" />
                  Aufschlüsselung der Kaufnebenkosten im Portfolio
                </span>
                <span className="font-mono text-xs text-muted-foreground">
                  Erfasst: <strong className="text-foreground">{formatCurrency(totalDetailedAncillary)}</strong>
                  {totalAncillaryCosts > 0 && ` von ${formatCurrency(totalAncillaryCosts)}`}
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 text-xs">
                <div className="p-2.5 rounded-md bg-card border">
                  <span className="text-[10px] text-muted-foreground block">Grunderwerbsteuer</span>
                  <span className="font-mono font-semibold text-foreground block mt-0.5">
                    {formatCurrency(totalTransferTax)}
                  </span>
                  {totalPurchaseValue > 0 && totalTransferTax > 0 && (
                    <span className="text-[10px] text-muted-foreground font-mono">
                      {formatGermanPercent((totalTransferTax / totalPurchaseValue) * 100, 1)} v. Kaufwert
                    </span>
                  )}
                </div>
                <div className="p-2.5 rounded-md bg-card border">
                  <span className="text-[10px] text-muted-foreground block">Notarkosten</span>
                  <span className="font-mono font-semibold text-foreground block mt-0.5">
                    {formatCurrency(totalNotaryCosts)}
                  </span>
                  {totalPurchaseValue > 0 && totalNotaryCosts > 0 && (
                    <span className="text-[10px] text-muted-foreground font-mono">
                      {formatGermanPercent((totalNotaryCosts / totalPurchaseValue) * 100, 2)} v. Kaufwert
                    </span>
                  )}
                </div>
                <div className="p-2.5 rounded-md bg-card border">
                  <span className="text-[10px] text-muted-foreground block">Grundbuchamt</span>
                  <span className="font-mono font-semibold text-foreground block mt-0.5">
                    {formatCurrency(totalLandRegCosts)}
                  </span>
                  {totalPurchaseValue > 0 && totalLandRegCosts > 0 && (
                    <span className="text-[10px] text-muted-foreground font-mono">
                      {formatGermanPercent((totalLandRegCosts / totalPurchaseValue) * 100, 2)} v. Kaufwert
                    </span>
                  )}
                </div>
                <div className="p-2.5 rounded-md bg-card border">
                  <span className="text-[10px] text-muted-foreground block">Maklerprovision</span>
                  <span className="font-mono font-semibold text-foreground block mt-0.5">
                    {formatCurrency(totalBrokerCosts)}
                  </span>
                  {totalPurchaseValue > 0 && totalBrokerCosts > 0 && (
                    <span className="text-[10px] text-muted-foreground font-mono">
                      {formatGermanPercent((totalBrokerCosts / totalPurchaseValue) * 100, 2)} v. Kaufwert
                    </span>
                  )}
                </div>
                <div className="p-2.5 rounded-md bg-card border col-span-2 sm:col-span-1">
                  <span className="text-[10px] text-muted-foreground block">Sonstige Nebenkosten</span>
                  <span className="font-mono font-semibold text-foreground block mt-0.5">
                    {formatCurrency(totalOtherAncillary)}
                  </span>
                  <span className="text-[10px] text-muted-foreground">Gutachten etc.</span>
                </div>
              </div>
            </div>
          )}

          {/* Formel-Erklärung */}
          <div className="p-4 rounded-lg bg-muted/50 border space-y-2 text-xs">
            <div className="font-semibold text-foreground text-sm flex items-center gap-1.5">
              <Coins className="h-4 w-4 text-primary" />
              So werden die Werte berechnet:
            </div>
            <div className="grid md:grid-cols-2 gap-3 text-muted-foreground">
              <div>
                <strong className="text-foreground">Portfolio-Kaufwert:</strong>
                <p>Summe der in den Objektakten hinterlegten Kaufpreise aller {properties.length} Wohnungen.</p>
              </div>
              <div>
                <strong className="text-foreground">Gesamtinvestition:</strong>
                <p>Portfolio-Kaufwert ({formatCurrency(totalPurchaseValue)}) + Kaufnebenkosten ({formatCurrency(totalAncillaryCosts)}).</p>
              </div>
              <div>
                <strong className="text-foreground">Brutto-Mietrendite p.a.:</strong>
                <p>(Jahreskaltmiete {formatCurrency(annualColdRent)} ÷ Portfolio-Kaufwert) × 100.</p>
              </div>
              <div>
                <strong className="text-foreground">Mietmultiplikator (Faktor):</strong>
                <p>Portfolio-Kaufwert ÷ Jahreskaltmiete {multiplier ? `(= ${multiplier} Jahreskaltmieten)` : ""}.</p>
              </div>
              {avgSqmPrice && (
                <div className="md:col-span-2">
                  <strong className="text-foreground">Durchschnittlicher m²-Kaufpreis:</strong>
                  <p>Portfolio-Kaufwert ÷ {formatGermanNumber(totalSqm, 1)} m² Gesamtwohnfläche = ca. {avgSqmPrice.toLocaleString("de-DE")} €/m².</p>
                </div>
              )}
            </div>
          </div>

          {/* Einzelaufstellung je Einheit */}
          <div>
            <h4 className="text-sm font-semibold mb-2">Aufschlüsselung nach Einheiten</h4>
            <div className="rounded-md border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="text-xs">Wohnung</TableHead>
                    <TableHead className="text-xs text-right">Fläche</TableHead>
                    <TableHead className="text-xs text-right">Kaufpreis</TableHead>
                    <TableHead className="text-xs text-right">Nebenkosten</TableHead>
                    <TableHead className="text-xs text-right">Kaltmiete/Mo</TableHead>
                    <TableHead className="text-xs text-right">Brutto-Rendite</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {properties.map((p) => {
                    const price = p.purchasePrice || 0;
                    const anc = p.ancillaryCosts || 0;
                    const cold = p.tenant?.coldRent || 0;
                    const yld = price > 0 && cold > 0 ? formatGermanPercent((cold * 12 / price) * 100, 2) : null;

                    return (
                      <TableRow key={p.id}>
                        <TableCell className="font-medium text-xs">
                          <div>{p.name}</div>
                          <div className="text-[10px] text-muted-foreground">{p.address}</div>
                        </TableCell>
                        <TableCell className="text-xs text-right">{p.sqm} m²</TableCell>
                        <TableCell className="text-xs text-right font-medium">
                          {price > 0 ? (
                            formatCurrency(price)
                          ) : (
                            <span className="text-muted-foreground italic text-[11px]">Nicht hinterlegt</span>
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-right">
                          {anc > 0 ? (
                            <div>
                              <span className="font-mono font-medium">{formatCurrency(anc)}</span>
                              {(p.propertyTransferTax || p.notaryCosts || p.landRegisterCosts || p.brokerCosts || p.otherAncillaryCosts) ? (
                                <div className="text-[9px] text-muted-foreground space-y-0.5 mt-0.5 font-mono">
                                  {p.propertyTransferTax ? <div>GrESt: {formatCurrency(p.propertyTransferTax)}</div> : null}
                                  {p.notaryCosts ? <div>Notar: {formatCurrency(p.notaryCosts)}</div> : null}
                                  {p.landRegisterCosts ? <div>Grundbuch: {formatCurrency(p.landRegisterCosts)}</div> : null}
                                  {p.brokerCosts ? <div>Makler: {formatCurrency(p.brokerCosts)}</div> : null}
                                  {p.otherAncillaryCosts ? <div>Sonst.: {formatCurrency(p.otherAncillaryCosts)}</div> : null}
                                </div>
                              ) : null}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">–</span>
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-right">
                          {cold > 0 ? formatCurrency(cold) : <span className="text-muted-foreground italic">Leerstand</span>}
                        </TableCell>
                        <TableCell className="text-xs text-right font-semibold">
                          {yld ? (
                            <span className="text-green-600 dark:text-green-400">{yld} p.a.</span>
                          ) : (
                            <span className="text-muted-foreground">–</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </div>

          <div className="text-[11px] text-muted-foreground bg-blue-50/50 dark:bg-blue-950/20 p-2.5 rounded border border-blue-200/50 dark:border-blue-900/40">
            ℹ️ <strong>Tipp:</strong> Kaufpreise, Erwerbsdaten und Nebenkosten können jederzeit in der jeweiligen Wohnungsakte über das Stift-Symbol (<Edit className="h-3 w-3 inline mx-0.5" /> Bearbeiten) eingetragen und angepasst werden.
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Hauptseite Wohnungen ────────────────────────────────────────────────────
export default function WohnungenPage() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      const res = await fetch("/api/properties");
      if (res.ok) {
        setProperties(await res.json());
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const totalRent = properties.reduce(
    (s, p) => s + (p.tenant ? p.tenant.coldRent + p.tenant.utilities : 0),
    0
  );
  const totalColdRent = properties.reduce(
    (s, p) => s + (p.tenant ? p.tenant.coldRent : 0),
    0
  );
  const vacancies = properties.filter((p) => !p.tenant).length;
  const totalSqm = properties.reduce((s, p) => s + p.sqm, 0);

  // Portfolio-Kaufpreis und Gesamtrendite
  const totalPurchaseValue = properties.reduce((s, p) => s + (p.purchasePrice || 0), 0);
  const totalAncillaryCosts = properties.reduce((s, p) => s + (p.ancillaryCosts || 0), 0);
  const propertiesWithPrice = properties.filter((p) => p.purchasePrice && p.purchasePrice > 0);
  const portfolioYield = totalPurchaseValue > 0 && totalColdRent > 0
    ? formatGermanPercent((totalColdRent * 12 / totalPurchaseValue) * 100, 2)
    : null;

  // Alle Mietanpassungen für den Fristenrechner
  const allAdjustments = properties
    .flatMap((p) =>
      (p.rentAdjustments || []).map((ra) => ({
        ...ra,
        propertyName: p.name,
        currentColdRent: p.tenant?.coldRent || 0,
        sqm: p.sqm,
      }))
    )
    .sort(
      (a, b) =>
        new Date(a.effectiveDate).getTime() - new Date(b.effectiveDate).getTime()
    );

  return (
    <div className="p-3.5 sm:p-6 space-y-4 sm:space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">Objekt- & Mieterakten</h1>
          <p className="text-muted-foreground text-xs sm:text-sm">
            {properties.length} {properties.length === 1 ? "Wohnung" : "Wohnungen"} im Portfolio · Kaufpreise, Mietverträge & Renditen
          </p>
        </div>
        <div className="self-start sm:self-auto">
          <AddPropertyDialog onRefresh={fetchData} />
        </div>
      </div>

      {/* Zusammenfassung KPI */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground mb-1">Vermietungsquote</p>
            <p className="text-xl sm:text-2xl font-bold text-green-500">
              {properties.length > 0
                ? (((properties.length - vacancies) / properties.length) * 100).toFixed(0)
                : 0}
              %
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {properties.length - vacancies} von {properties.length} vermietet
              {vacancies > 0 && ` (${vacancies} Leerstand)`}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground mb-1">Kaltmiete gesamt / Monat</p>
            <p className="text-xl sm:text-2xl font-bold">{formatCurrency(totalColdRent)}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Warm: {formatCurrency(totalRent)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs text-muted-foreground">
                {totalPurchaseValue > 0 ? "Portfolio-Kaufwert" : "Gesamt-Wohnfläche"}
              </p>
              {totalPurchaseValue > 0 && (
                <PortfolioKaufwertInfoDialog
                  properties={properties}
                  totalPurchaseValue={totalPurchaseValue}
                  totalAncillaryCosts={totalAncillaryCosts}
                  totalColdRent={totalColdRent}
                  totalSqm={totalSqm}
                  portfolioYield={portfolioYield}
                />
              )}
            </div>
            <p className="text-xl sm:text-2xl font-bold text-primary">
              {totalPurchaseValue > 0 ? formatCurrency(totalPurchaseValue) : `${formatGermanNumber(totalSqm, 1)} m²`}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {portfolioYield
                ? `Ø Brutto-Rendite: ${portfolioYield} p.a.`
                : `Ø ${totalSqm > 0 ? formatGermanNumber(totalColdRent / totalSqm, 2) : "0,00"} €/m² Kalt`}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground mb-1">Geplante Mietanpassungen</p>
            <p className="text-xl sm:text-2xl font-bold text-blue-500">{allAdjustments.length}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Staffel- & Indexmieten</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="akten">
        <TabsList className="w-full sm:w-auto justify-start overflow-x-auto">
          <TabsTrigger value="akten" className="gap-1.5">
            <Building2 className="h-4 w-4" /> Wohnungs- & Mieterakten ({properties.length})
          </TabsTrigger>
          <TabsTrigger value="anpassungen" className="gap-1.5">
            <TrendingUp className="h-4 w-4" /> Mietanpassungen & Fristenrechner ({allAdjustments.length})
          </TabsTrigger>
        </TabsList>

        {/* Wohnungen Übersicht */}
        <TabsContent value="akten" className="mt-4">
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-64 skeleton rounded-xl" />
              ))}
            </div>
          ) : properties.length === 0 ? (
            <Card className="text-center py-12">
              <CardContent className="space-y-4">
                <Building2 className="h-12 w-12 text-muted-foreground mx-auto" />
                <div>
                  <h3 className="font-semibold text-lg">Noch keine Wohnungen vorhanden</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Legen Sie Ihre erste Mietwohnung an, um die Verwaltung zu starten.
                  </p>
                </div>
                <AddPropertyDialog onRefresh={fetchData} />
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {properties.map((property) => (
                <PropertyCard
                  key={property.id}
                  property={property}
                  onRefresh={fetchData}
                />
              ))}
            </div>
          )}
        </TabsContent>

        {/* Mietanpassungen & Fristenrechner Tab */}
        <TabsContent value="anpassungen" className="mt-4 space-y-4">
          <Card>
            <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <Calculator className="h-5 w-5 text-primary" />
                  Mietanpassungen, Staffelmieten & Kappungsgrenzen-Rechner (§ 558 BGB)
                </CardTitle>
                <CardDescription>
                  Dokumentation aller Mieterhöhungen und Nebenkostenanpassungen mit automatischer historischer Bewertung
                </CardDescription>
              </div>
              <RentAdjustmentDialog
                properties={properties}
                onRefresh={fetchData}
                trigger={
                  <Button size="sm" className="gap-1.5 shrink-0">
                    <Plus className="h-4 w-4" /> Mietanpassung erfassen
                  </Button>
                }
              />
            </CardHeader>
            <CardContent>
              {allAdjustments.length === 0 ? (
                <div className="text-center py-8 text-sm text-muted-foreground">
                  Aktuell sind keine Mietanpassungen hinterlegt. Klicken Sie auf „Mietanpassung erfassen“, um eine Erhöhung einzutragen.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Wohnung</TableHead>
                      <TableHead>Typ</TableHead>
                      <TableHead>Wirksam ab</TableHead>
                      <TableHead>Warmmiete Entwicklung</TableHead>
                      <TableHead>Details (Kalt / NK)</TableHead>
                      <TableHead className="w-36">Kappungsgrenze (15%)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {allAdjustments.map((ra) => {
                      const prevCold = ra.previousColdRent ?? ra.currentColdRent;
                      const prevUtil = ra.previousUtilities ?? (ra as any).currentUtilities ?? 0;
                      const prevWarm = (prevCold || 0) + (prevUtil || 0);

                      const newCold = ra.newColdRent ?? prevCold;
                      const newUtil = ra.newUtilities ?? prevUtil;
                      const newWarm = (newCold || 0) + (newUtil || 0);
                      const diffWarm = newWarm - prevWarm;
                      const diffCold = (newCold || 0) - (prevCold || 0);
                      const pctCold = prevCold > 0 ? (diffCold / prevCold) * 100 : 0;
                      const withinCap = pctCold <= 15; // 15% Kappungsgrenze auf Kaltmiete

                      return (
                        <TableRow key={ra.id}>
                          <TableCell className="font-semibold text-sm">
                            <div>{ra.propertyName}</div>
                            {ra.notes && <div className="text-xs text-muted-foreground">{ra.notes}</div>}
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary" className="text-xs">
                              {ra.type === "NEBENKOSTEN" ? "Nebenkosten" :
                               ra.type === "STAFFEL" ? "Staffelmiete" :
                               ra.type === "SPIEGEL" ? "Mietspiegel" :
                               ra.type === "INDEX" ? "Indexmiete" :
                               ra.type === "MODERNISIERUNG" ? "Modernisierung" : "Sonstiges"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm font-medium whitespace-nowrap">
                            {formatDate(ra.effectiveDate)}
                          </TableCell>
                          <TableCell className="text-sm">
                            <div className="font-mono flex items-center gap-1 font-semibold">
                              <span>{formatCurrency(prevWarm)}</span>
                              <span className="text-muted-foreground">→</span>
                              <span className="text-primary font-bold">{formatCurrency(newWarm)}</span>
                              {diffWarm !== 0 && (
                                <span className={diffWarm > 0 ? "text-emerald-600 dark:text-emerald-400 text-xs font-bold" : "text-rose-500 text-xs"}>
                                  ({diffWarm > 0 ? `+${formatCurrency(diffWarm)}` : formatCurrency(diffWarm)})
                                </span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            <div>Kalt: {formatCurrency(prevCold || 0)} → {formatCurrency(newCold || 0)}</div>
                            <div>NK: {formatCurrency(prevUtil || 0)} → {formatCurrency(newUtil || 0)}</div>
                          </TableCell>
                          <TableCell>
                            {ra.type === "NEBENKOSTEN" ? (
                              <Badge variant="outline" className="text-[11px] text-cyan-600 border-cyan-500/30">
                                Keine Kaltmieterhöhung
                              </Badge>
                            ) : diffCold > 0 ? (
                              withinCap ? (
                                <Badge variant="success" className="text-[11px] gap-1">
                                  <Check className="h-3 w-3" /> Konform (≤ 15%)
                                </Badge>
                              ) : (
                                <Badge variant="destructive" className="text-[11px] gap-1">
                                  <AlertCircle className="h-3 w-3" /> Über 15%
                                </Badge>
                              )
                            ) : (
                              <span className="text-xs text-muted-foreground">Unverändert</span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}

              <div className="mt-4 p-4 rounded-xl bg-secondary/40 text-xs text-muted-foreground space-y-1">
                <p className="font-semibold text-foreground">💡 Gesetzliche Regelung gem. § 558 Abs. 3 BGB:</p>
                <p>
                  Die Miete darf sich innerhalb von 3 Jahren um nicht mehr als 20% (in Gemeinden mit angespanntem Wohnungsmarkt wie Berlin, Hamburg, München maximal 15% = Kappungsgrenze) erhöhen. Staffelmieten gem. § 557a BGB sind von der Kappungsgrenze ausgenommen, müssen jedoch mindestens 1 Jahr unverändert bleiben.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
