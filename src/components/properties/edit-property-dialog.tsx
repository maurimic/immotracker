"use client";

import { useState, Fragment } from "react";
import {
  Building2, Euro, Receipt, ChevronDown, ChevronUp, Calculator,
  AlertCircle, Calendar, Edit, Plus, Trash2, Layers, ShieldCheck,
  Home, Coins, Clock
} from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogTrigger, DialogFooter
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { DateInput } from "@/components/ui/date-input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import {
  formatCurrency, formatDate, parseGermanNumber,
  formatGermanNumber, formatGermanPercent, formatGermanInput
} from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { parseUnitTokens } from "@/lib/property-matching";
import { Property, SubUnitDetail, parseJsonSafe } from "./types";
import { DetailedAncillaryCostsSection } from "./detailed-ancillary-costs-section";

export function EditPropertyDialog({
  property,
  onRefresh,
}: {
  property: Property;
  onRefresh: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const initialUnitDetails: Record<string, string> = {};
  const parsedHausgeld = parseJsonSafe<Record<string, any>>(property.hausgeldDetails);
  if (parsedHausgeld) {
    for (const [k, v] of Object.entries(parsedHausgeld)) {
      const num = typeof v === "number" ? v : (v as any)?.hausgeld != null ? (v as any).hausgeld : null;
      if (num != null) initialUnitDetails[k] = formatGermanInput(num);
    }
  }
  const [unitDetails, setUnitDetails] = useState<Record<string, string>>(initialUnitDetails);

  const initialSubUnits: Record<string, SubUnitDetail> = parseJsonSafe<Record<string, SubUnitDetail>>(property.unitDetails) || {};
  const [subUnits, setSubUnits] = useState<Record<string, SubUnitDetail>>(initialSubUnits);
  const [expandedSubUnitCosts, setExpandedSubUnitCosts] = useState<Record<string, boolean>>({});

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
        'maintenanceReserve', 'totalWeg',
        'ancillaryCosts', 'propertyTransferTax', 'notaryCosts',
        'landRegisterCosts', 'brokerCosts', 'otherAncillaryCosts'
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
      if (['propertyTransferTax', 'notaryCosts', 'landRegisterCosts', 'brokerCosts', 'otherAncillaryCosts'].includes(field as string)) {
        const pTax = updatedUnit.propertyTransferTax || 0;
        const not = updatedUnit.notaryCosts || 0;
        const land = updatedUnit.landRegisterCosts || 0;
        const brok = updatedUnit.brokerCosts || 0;
        const oth = updatedUnit.otherAncillaryCosts || 0;
        const detailed = pTax + not + land + brok + oth;
        if (detailed > 0 || (field === 'propertyTransferTax' && pTax === 0)) {
          updatedUnit.ancillaryCosts = Math.round(detailed * 100) / 100;
        }
      }

      const nextSubUnits = { ...prev, [key]: updatedUnit };

      // Gesamtsummen für das Hauptobjekt automatisch synchronisieren
      const allUnits = Object.values(nextSubUnits);
      const sumPurchase = allUnits.reduce((s, u) => s + (u.purchasePrice || 0), 0);
      const sumSqm = allUnits.reduce((s, u) => s + (u.sqm || 0), 0);
      const sumHg = allUnits.reduce((s, u) => s + (u.hausgeld || 0), 0);
      const sumMr = allUnits.reduce((s, u) => s + (u.maintenanceReserve || 0), 0);
      const sumAncillary = allUnits.reduce((s, u) => s + (u.ancillaryCosts || 0), 0);
      const sumPTax = allUnits.reduce((s, u) => s + (u.propertyTransferTax || 0), 0);
      const sumNotary = allUnits.reduce((s, u) => s + (u.notaryCosts || 0), 0);
      const sumLandReg = allUnits.reduce((s, u) => s + (u.landRegisterCosts || 0), 0);
      const sumBroker = allUnits.reduce((s, u) => s + (u.brokerCosts || 0), 0);
      const sumOther = allUnits.reduce((s, u) => s + (u.otherAncillaryCosts || 0), 0);

      setForm((f) => ({
        ...f,
        ...(sumPurchase > 0 ? { purchasePrice: formatGermanInput(sumPurchase) } : {}),
        ...(sumSqm > 0 ? { sqm: sumSqm.toString() } : {}),
        ...(sumHg > 0 ? { hausgeld: formatGermanInput(sumHg) } : {}),
        ...(sumMr > 0 ? { maintenanceReserve: formatGermanInput(sumMr) } : {}),
        ...(sumAncillary > 0 ? { ancillaryCosts: formatGermanInput(sumAncillary) } : {}),
        ...(sumPTax > 0 ? { propertyTransferTax: formatGermanInput(sumPTax) } : {}),
        ...(sumNotary > 0 ? { notaryCosts: formatGermanInput(sumNotary) } : {}),
        ...(sumLandReg > 0 ? { landRegisterCosts: formatGermanInput(sumLandReg) } : {}),
        ...(sumBroker > 0 ? { brokerCosts: formatGermanInput(sumBroker) } : {}),
        ...(sumOther > 0 ? { otherAncillaryCosts: formatGermanInput(sumOther) } : {}),
      }));

      return nextSubUnits;
    });
  };

  const applyPercentToSubUnitField = (key: string, field: keyof SubUnitDetail, pct: number) => {
    const cur = subUnits[key];
    const p = cur?.purchasePrice || 0;
    if (p <= 0) {
      toast({
        title: "Kaufpreis benötigt",
        description: "Bitte zuerst einen Kaufpreis für diese Einheit eingeben.",
        variant: "destructive",
      });
      return;
    }
    const val = Math.round(p * (pct / 100) * 100) / 100;
    handleSubUnitFieldChange(key, field, formatGermanInput(val));
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
            {subUnits && Object.keys(subUnits).length > 0 ? (
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

                      {/* Kaufnebenkosten dieser Einheit */}
                      <div className="pt-2 border-t border-border/50 space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <Receipt className="h-3.5 w-3.5 text-primary" />
                            <span className="text-[11px] font-semibold text-foreground">Kaufnebenkosten dieser Einheit</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => setExpandedSubUnitCosts((prev) => ({ ...prev, [key]: !prev[key] }))}
                            className="text-[10px] text-primary hover:underline flex items-center gap-0.5 bg-primary/10 hover:bg-primary/20 px-1.5 py-0.5 rounded transition-colors"
                          >
                            {expandedSubUnitCosts[key] ? (
                              <>
                                <ChevronUp className="h-3 w-3" /> Details schließen
                              </>
                            ) : (
                              <>
                                <ChevronDown className="h-3 w-3" /> Aufschlüsselung {u.ancillaryCosts ? `(${formatCurrency(u.ancillaryCosts)})` : "öffnen"}
                              </>
                            )}
                          </button>
                        </div>

                        <div className="grid grid-cols-2 gap-2 items-center">
                          <div className="space-y-1">
                            <Label className="text-[10px] text-muted-foreground">Kaufnebenkosten gesamt (€)</Label>
                            <Input
                              type="text"
                              inputMode="decimal"
                              placeholder="z. B. 4.500,00"
                              value={u.ancillaryCosts != null && u.ancillaryCosts > 0 ? formatGermanInput(u.ancillaryCosts) : ""}
                              onChange={(e) => handleSubUnitFieldChange(key, "ancillaryCosts", e.target.value)}
                              className="h-7 text-xs font-mono"
                            />
                          </div>
                          <div className="text-[10px] text-muted-foreground leading-tight pt-3">
                            {(u.purchasePrice || 0) > 0 && (u.ancillaryCosts || 0) > 0 ? (
                              <span>
                                = <strong className="text-foreground">{formatGermanPercent(((u.ancillaryCosts || 0) / (u.purchasePrice || 1)) * 100, 1)}</strong> des Kaufpreises
                                <span className="block font-medium text-amber-600 dark:text-amber-400">
                                  Investition: {formatCurrency((u.purchasePrice || 0) + (u.ancillaryCosts || 0))}
                                </span>
                              </span>
                            ) : (
                              <span>GrESt, Notar, Grundbuch etc.</span>
                            )}
                          </div>
                        </div>

                        {expandedSubUnitCosts[key] && (
                          <div className="p-2.5 rounded-lg bg-secondary/30 border border-border/60 space-y-2 text-xs">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              {/* 1. Grunderwerbsteuer */}
                              <div className="space-y-1">
                                <div className="flex items-center justify-between">
                                  <Label className="text-[10px] text-muted-foreground">1. Grunderwerbsteuer (€)</Label>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="h-5 px-1 text-[9px] bg-background hover:bg-muted"
                                    onClick={() => applyPercentToSubUnitField(key, "propertyTransferTax", 6.5)}
                                  >
                                    6,5% (NRW)
                                  </Button>
                                </div>
                                <Input
                                  type="text"
                                  inputMode="decimal"
                                  placeholder="z. B. 3.412,50"
                                  value={u.propertyTransferTax != null && u.propertyTransferTax > 0 ? formatGermanInput(u.propertyTransferTax) : ""}
                                  onChange={(e) => handleSubUnitFieldChange(key, "propertyTransferTax", e.target.value)}
                                  className="h-7 text-xs font-mono"
                                />
                              </div>

                              {/* 2. Notarkosten */}
                              <div className="space-y-1">
                                <div className="flex items-center justify-between">
                                  <Label className="text-[10px] text-muted-foreground">2. Notarkosten (€)</Label>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="h-5 px-1 text-[9px] bg-background hover:bg-muted"
                                    onClick={() => applyPercentToSubUnitField(key, "notaryCosts", 1.5)}
                                  >
                                    ~1,5% Standard
                                  </Button>
                                </div>
                                <Input
                                  type="text"
                                  inputMode="decimal"
                                  placeholder="z. B. 787,50"
                                  value={u.notaryCosts != null && u.notaryCosts > 0 ? formatGermanInput(u.notaryCosts) : ""}
                                  onChange={(e) => handleSubUnitFieldChange(key, "notaryCosts", e.target.value)}
                                  className="h-7 text-xs font-mono"
                                />
                              </div>

                              {/* 3. Grundbuchamt */}
                              <div className="space-y-1">
                                <div className="flex items-center justify-between">
                                  <Label className="text-[10px] text-muted-foreground">3. Grundbuchamt (€)</Label>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="h-5 px-1 text-[9px] bg-background hover:bg-muted"
                                    onClick={() => applyPercentToSubUnitField(key, "landRegisterCosts", 0.5)}
                                  >
                                    ~0,5% Standard
                                  </Button>
                                </div>
                                <Input
                                  type="text"
                                  inputMode="decimal"
                                  placeholder="z. B. 262,50"
                                  value={u.landRegisterCosts != null && u.landRegisterCosts > 0 ? formatGermanInput(u.landRegisterCosts) : ""}
                                  onChange={(e) => handleSubUnitFieldChange(key, "landRegisterCosts", e.target.value)}
                                  className="h-7 text-xs font-mono"
                                />
                              </div>

                              {/* 4. Maklerprovision */}
                              <div className="space-y-1">
                                <Label className="text-[10px] text-muted-foreground">4. Maklerprovision (€)</Label>
                                <Input
                                  type="text"
                                  inputMode="decimal"
                                  placeholder="z. B. 0,00"
                                  value={u.brokerCosts != null && u.brokerCosts > 0 ? formatGermanInput(u.brokerCosts) : ""}
                                  onChange={(e) => handleSubUnitFieldChange(key, "brokerCosts", e.target.value)}
                                  className="h-7 text-xs font-mono"
                                />
                              </div>

                              {/* 5. Sonstige Nebenkosten */}
                              <div className="space-y-1 sm:col-span-2">
                                <Label className="text-[10px] text-muted-foreground">5. Sonstige Nebenkosten (€ Gutachten, etc.)</Label>
                                <Input
                                  type="text"
                                  inputMode="decimal"
                                  placeholder="z. B. 0,00"
                                  value={u.otherAncillaryCosts != null && u.otherAncillaryCosts > 0 ? formatGermanInput(u.otherAncillaryCosts) : ""}
                                  onChange={(e) => handleSubUnitFieldChange(key, "otherAncillaryCosts", e.target.value)}
                                  className="h-7 text-xs font-mono"
                                />
                              </div>
                            </div>
                          </div>
                        )}
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
