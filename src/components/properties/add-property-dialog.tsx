"use client";

import { useState } from "react";
import {
  Plus, Building2, Users, Euro, Receipt, ChevronDown, ChevronUp,
  Calculator, AlertCircle, Calendar, Home, Coins, Clock
} from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogTrigger
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { DateInput } from "@/components/ui/date-input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  formatCurrency, formatGermanNumber, parseGermanNumber, formatGermanInput
} from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { parseUnitTokens } from "@/lib/property-matching";
import { DetailedAncillaryCostsSection } from "./detailed-ancillary-costs-section";

export function AddPropertyDialog({ onRefresh }: { onRefresh: () => void }) {
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
