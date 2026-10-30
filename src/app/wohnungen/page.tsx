"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Building2, Plus, Users, Euro, FileText, ChevronRight,
  Phone, Mail, Calendar, CreditCard, Edit, Trash2, X, TrendingUp,
  AlertCircle, ShieldCheck, Clock, Calculator, Upload, Check,
  UserPlus, UserMinus, AlertTriangle, Home, Coins, Percent, ArrowUpRight, ArrowRight, Info
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatCurrency, formatDate } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { RentAdjustmentDialog } from "@/components/RentAdjustmentDialog";

interface Tenant {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  iban?: string;
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
  rooms?: number;
  purchasePrice?: number | null;
  purchasedAt?: string | null;
  possessionAt?: string | null;
  ancillaryCosts?: number | null;
  nonRecoverableCosts?: number | null;
  maintenanceReserve?: number | null;
  tenant: Tenant | null;
  loans: Array<{ id: string; originalAmount: number; currentBalance: number }>;
  tickets: Array<{ id: string; status: string; priority: string }>;
  rentAdjustments: RentAdjustment[];
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
  const [showAncillaryCalc, setShowAncillaryCalc] = useState(false);
  const [taxRate, setTaxRate] = useState("6.0");
  const [notaryRate, setNotaryRate] = useState("2.0");
  const [brokerRate, setBrokerRate] = useState("0.0");

  const [form, setForm] = useState({
    name: property.name,
    address: property.address,
    sqm: property.sqm.toString(),
    floor: property.floor || "",
    rooms: property.rooms ? property.rooms.toString() : "",
    purchasePrice: property.purchasePrice ? property.purchasePrice.toString() : "",
    purchasedAt: property.purchasedAt ? property.purchasedAt.split("T")[0] : "",
    possessionAt: property.possessionAt ? property.possessionAt.split("T")[0] : "",
    ancillaryCosts: property.ancillaryCosts ? property.ancillaryCosts.toString() : "",
    nonRecoverableCosts: property.nonRecoverableCosts != null ? property.nonRecoverableCosts.toString() : "",
    maintenanceReserve: property.maintenanceReserve != null ? property.maintenanceReserve.toString() : "",
  });

  const handleCalcAncillary = () => {
    const price = parseFloat(form.purchasePrice);
    if (!isNaN(price) && price > 0) {
      const tax = parseFloat(taxRate) || 0;
      const not = parseFloat(notaryRate) || 0;
      const brok = parseFloat(brokerRate) || 0;
      const totalPct = tax + not + brok;
      const calculated = Math.round(price * (totalPct / 100));
      setForm((prev) => ({ ...prev, ancillaryCosts: calculated.toString() }));
      toast({
        title: "Kaufnebenkosten berechnet",
        description: `${totalPct.toFixed(2)}% von ${formatCurrency(price)} = ${formatCurrency(calculated)}`,
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const res = await fetch(`/api/properties/${property.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
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
            <div className="grid grid-cols-3 gap-3">
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
                <Label className="text-xs">Etage</Label>
                <Input
                  value={form.floor}
                  onChange={(e) => setForm({ ...form, floor: e.target.value })}
                  placeholder="z.B. 1. OG"
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
            </div>
          </div>

          {/* Kaufpreis & Investitionsdaten (optional) */}
          <div className="space-y-3 pt-3 border-t border-border">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-primary flex items-center gap-1.5">
              <Coins className="h-3.5 w-3.5" /> Kaufpreis & Investition (optional)
            </h4>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Kaufpreis (€)</Label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="z.B. 220000"
                  value={form.purchasePrice}
                  onChange={(e) => setForm({ ...form, purchasePrice: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Kaufnebenkosten (€)</Label>
                  <button
                    type="button"
                    onClick={() => setShowAncillaryCalc(!showAncillaryCalc)}
                    className="text-[11px] text-primary hover:underline flex items-center gap-1"
                  >
                    <Calculator className="h-3 w-3" /> {showAncillaryCalc ? "Rechner zu" : "%-Rechner"}
                  </button>
                </div>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="z.B. 23500"
                  value={form.ancillaryCosts}
                  onChange={(e) => setForm({ ...form, ancillaryCosts: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs flex items-center gap-1">
                  <Calendar className="h-3 w-3 text-muted-foreground" /> Kaufvertrag (Notar)
                </Label>
                <Input
                  type="date"
                  value={form.purchasedAt}
                  onChange={(e) => setForm({ ...form, purchasedAt: e.target.value })}
                />
                <p className="text-[10px] text-muted-foreground">Datum der Beurkundung</p>
              </div>
              <div className="space-y-1">
                <Label className="text-xs flex items-center gap-1">
                  <Clock className="h-3 w-3 text-primary" /> Nutzen- & Lastenwechsel
                </Label>
                <Input
                  type="date"
                  value={form.possessionAt}
                  onChange={(e) => setForm({ ...form, possessionAt: e.target.value })}
                />
                <p className="text-[10px] text-muted-foreground">Wirtschaftlicher Übergang (Rechte/Miete)</p>
              </div>
            </div>

            {/* Optionaler Nebenkosten-Prozent-Rechner */}
            {showAncillaryCalc && (
              <div className="p-3 bg-secondary/40 rounded-xl space-y-2 border border-border/60 animate-fade-in text-xs">
                <p className="font-semibold text-foreground">Schnellrechner Kaufnebenkosten:</p>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <Label className="text-[10px] text-muted-foreground">Grunderwerbsteuer (%)</Label>
                    <Input
                      type="number"
                      step="0.1"
                      className="h-8 text-xs"
                      value={taxRate}
                      onChange={(e) => setTaxRate(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label className="text-[10px] text-muted-foreground">Notar & Grundbuch (%)</Label>
                    <Input
                      type="number"
                      step="0.1"
                      className="h-8 text-xs"
                      value={notaryRate}
                      onChange={(e) => setNotaryRate(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label className="text-[10px] text-muted-foreground">Makler (%)</Label>
                    <Input
                      type="number"
                      step="0.1"
                      className="h-8 text-xs"
                      value={brokerRate}
                      onChange={(e) => setBrokerRate(e.target.value)}
                    />
                  </div>
                </div>
                <div className="flex justify-between items-center pt-1">
                  <span className="text-muted-foreground text-[11px]">
                    Gesamt: {((parseFloat(taxRate) || 0) + (parseFloat(notaryRate) || 0) + (parseFloat(brokerRate) || 0)).toFixed(2)}%
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    onClick={handleCalcAncillary}
                    disabled={!form.purchasePrice}
                  >
                    Betrag berechnen & übernehmen
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Laufende Kosten & Rücklagen für Cashflow-Berechnung */}
          <div className="space-y-3 pt-3 border-t border-border">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
              <Coins className="h-3.5 w-3.5" /> Laufende Kosten & Rücklagen (Netto-Cashflow)
            </h4>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Nicht-umlagef. Kosten (€/Mo)</Label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder={`Pauschale: ${(parseFloat(form.sqm || "0") * 0.35 + 25).toFixed(2)} €`}
                  value={form.nonRecoverableCosts}
                  onChange={(e) => setForm({ ...form, nonRecoverableCosts: e.target.value })}
                />
                <p className="text-[10px] text-muted-foreground">
                  WEG-Hausgeld (nicht umlagef.), SEV, Verwaltergebühr. Wenn leer: Pauschale (0,35 €/m² + 25 €)
                </p>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Instandhaltungsrücklage (€/Mo)</Label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder={`Standard: ${(parseFloat(form.sqm || "0") * 1.20).toFixed(2)} €`}
                  value={form.maintenanceReserve}
                  onChange={(e) => setForm({ ...form, maintenanceReserve: e.target.value })}
                />
                <p className="text-[10px] text-muted-foreground">
                  Monatlicher Rücklagenbeitrag. Wenn leer: Standard (1,20 €/m²)
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

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Mietbeginn / Einzug *</Label>
              <Input
                type="date"
                value={form.moveInDate}
                onChange={(e) => setForm({ ...form, moveInDate: e.target.value })}
                required
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Vertragsbeginn *</Label>
              <Input
                type="date"
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

// ─── Mieter bearbeiten Dialog ────────────────────────────────────────────────
function EditTenantDialog({ tenant, onRefresh }: { tenant: Tenant; onRefresh: () => void }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
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
      toast({ title: "Mieterdaten erfolgreich aktualisiert" });
      setOpen(false);
      onRefresh();
    } else {
      toast({ title: "Fehler beim Speichern der Mieterdaten", variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="h-7 text-xs gap-1">
          <Edit className="h-3 w-3" /> Mieter bearbeiten
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Mieterakte: {tenant.firstName} {tenant.lastName}</DialogTitle>
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
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Einzugsdatum</Label>
              <Input type="date" value={form.moveInDate} onChange={(e) => setForm({ ...form, moveInDate: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Vertragsbeginn</Label>
              <Input type="date" value={form.contractStart} onChange={(e) => setForm({ ...form, contractStart: e.target.value })} />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Auszugsdatum (optional, bei Beendigung)</Label>
            <Input type="date" value={form.moveOutDate} onChange={(e) => setForm({ ...form, moveOutDate: e.target.value })} />
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

// ─── Mieter entfernen Dialog (Kündigung/Auszug) ──────────────────────────────
function RemoveTenantDialog({
  tenant,
  propertyName,
  onRefresh,
}: {
  tenant: Tenant;
  propertyName: string;
  onRefresh: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleRemove = async () => {
    setDeleting(true);
    const res = await fetch(`/api/tenants/${tenant.id}`, {
      method: "DELETE",
    });
    setDeleting(false);
    if (res.ok) {
      toast({
        title: `Mieter ${tenant.firstName} ${tenant.lastName} wurde entfernt`,
        description: `Wohnung '${propertyName}' ist nun wieder als Leerstand markiert.`,
      });
      setOpen(false);
      onRefresh();
    } else {
      toast({ title: "Fehler beim Entfernen des Mieters", variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-xs text-muted-foreground hover:text-destructive hover:border-destructive/40 gap-1"
          title="Mietverhältnis beenden / Mieter entfernen"
        >
          <UserMinus className="h-3 w-3" /> Auszug / Entfernen
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Mietverhältnis beenden / Mieter entfernen?
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2 text-sm text-muted-foreground">
          <p>
            Möchten Sie das Mietverhältnis von{" "}
            <strong className="text-foreground">{tenant.firstName} {tenant.lastName}</strong> in der Wohnung{" "}
            <strong className="text-foreground">{propertyName}</strong> beenden?
          </p>
          <p className="text-xs bg-secondary/50 p-3 rounded-lg">
            ℹ️ Die Wohnung wird anschließend wieder als <strong>Leerstand</strong> geführt. Historische Zahlungen bleiben im System erhalten.
          </p>
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => setOpen(false)} disabled={deleting}>
            Abbrechen
          </Button>
          <Button variant="destructive" onClick={handleRemove} disabled={deleting}>
            {deleting ? "Wird entfernt..." : "Mieter entfernen (Auszug)"}
          </Button>
        </DialogFooter>
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
  const sqmPrice = price > 0 && property.sqm > 0 ? (price / property.sqm).toFixed(0) : null;
  const annualColdRent = property.tenant ? property.tenant.coldRent * 12 : 0;
  const grossYield = price > 0 && annualColdRent > 0 ? ((annualColdRent / price) * 100).toFixed(2) : null;
  const multiplier = price > 0 && annualColdRent > 0 ? (price / annualColdRent).toFixed(1) : null;

  return (
    <Card className="hover:shadow-lg transition-all duration-300 flex flex-col justify-between">
      <CardContent className="pt-5 pb-5 space-y-4">
        {/* Header mit Titel, Adresse, m² & Aktions-Buttons */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white shadow-md flex-shrink-0">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-semibold text-sm leading-tight">{property.name}</h3>
              <p className="text-xs text-muted-foreground mt-0.5">{property.address}</p>
              {(property.floor || property.rooms) && (
                <p className="text-[11px] text-muted-foreground/80 mt-0.5">
                  {property.floor ? `${property.floor}` : ""}
                  {property.floor && property.rooms ? " · " : ""}
                  {property.rooms ? `${property.rooms} Zimmer` : ""}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1">
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
              <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                <span>+ Kaufnebenkosten:</span>
                <span className="font-mono">{formatCurrency(ancillary)} (Gesamt: {formatCurrency(totalInvestment)})</span>
              </div>
            )}
            {grossYield && (
              <div className="flex items-center justify-between pt-1 border-t border-border/30">
                <span className="text-muted-foreground">Mietrendite (brutto):</span>
                <div className="flex items-center gap-1.5">
                  <Badge variant="success" className="text-[10px] h-4 px-1.5 font-mono">
                    {grossYield}% p.a.
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
          </div>
        )}

        {/* Laufende Bewirtschaftungskosten (Netto-Cashflow Parameter) */}
        <div className="bg-secondary/30 rounded-xl p-2.5 text-xs space-y-1.5 border border-border/40">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="flex items-center gap-1">
              <Coins className="h-3 w-3 text-emerald-500" /> Nicht-umlagef. Kosten:
            </span>
            <div className="flex items-center gap-1.5 font-mono">
              <span className="font-semibold text-foreground">
                {property.nonRecoverableCosts != null && property.nonRecoverableCosts > 0
                  ? `${formatCurrency(property.nonRecoverableCosts)}/Mo`
                  : `${formatCurrency(property.sqm * 0.35 + 25)}/Mo`}
              </span>
              <Badge variant={property.nonRecoverableCosts != null && property.nonRecoverableCosts > 0 ? "secondary" : "outline"} className="text-[9px] h-4 px-1 py-0 font-sans">
                {property.nonRecoverableCosts != null && property.nonRecoverableCosts > 0 ? "Individuell" : "Pauschale"}
              </Badge>
            </div>
          </div>
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="flex items-center gap-1">
              <ShieldCheck className="h-3 w-3 text-amber-500" /> Instandhaltungsrücklage:
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
        </div>

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
  const [showAncillaryCalc, setShowAncillaryCalc] = useState(false);
  const [taxRate, setTaxRate] = useState("6.0");
  const [notaryRate, setNotaryRate] = useState("2.0");
  const [brokerRate, setBrokerRate] = useState("0.0");
  const [saving, setSaving] = useState(false);
  const today = new Date().toISOString().split("T")[0];

  const [form, setForm] = useState({
    name: "",
    address: "",
    sqm: "",
    floor: "",
    rooms: "",
    // Kaufpreis & Nebenkosten (optional)
    purchasePrice: "",
    purchasedAt: "",
    possessionAt: "",
    ancillaryCosts: "",
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

  const handleCalcAncillary = () => {
    const price = parseFloat(form.purchasePrice);
    if (!isNaN(price) && price > 0) {
      const tax = parseFloat(taxRate) || 0;
      const not = parseFloat(notaryRate) || 0;
      const brok = parseFloat(brokerRate) || 0;
      const totalPct = tax + not + brok;
      const calculated = Math.round(price * (totalPct / 100));
      setForm((prev) => ({ ...prev, ancillaryCosts: calculated.toString() }));
      toast({
        title: "Kaufnebenkosten berechnet",
        description: `${totalPct.toFixed(2)}% von ${formatCurrency(price)} = ${formatCurrency(calculated)}`,
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    const payload = {
      name: form.name,
      address: form.address,
      sqm: form.sqm,
      floor: form.floor || null,
      rooms: form.rooms || null,
      purchasePrice: form.purchasePrice ? parseFloat(form.purchasePrice) : null,
      purchasedAt: form.purchasedAt || null,
      possessionAt: form.possessionAt || null,
      ancillaryCosts: form.ancillaryCosts ? parseFloat(form.ancillaryCosts) : null,
      nonRecoverableCosts: form.nonRecoverableCosts ? parseFloat(form.nonRecoverableCosts) : null,
      maintenanceReserve: form.maintenanceReserve ? parseFloat(form.maintenanceReserve) : null,
      ...(withTenant && form.tenantLastName
        ? {
            tenant: {
              firstName: form.tenantFirstName || "Unbekannt",
              lastName: form.tenantLastName,
              email: form.tenantEmail || null,
              phone: form.tenantPhone || null,
              iban: form.tenantIban || null,
              coldRent: parseFloat(form.tenantColdRent || "0"),
              utilities: parseFloat(form.tenantUtilities || "0"),
              deposit: parseFloat(form.tenantDeposit || "0"),
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
        rooms: "",
        purchasePrice: "",
        purchasedAt: "",
        possessionAt: "",
        ancillaryCosts: "",
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
            <div className="grid grid-cols-3 gap-3">
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
                <Label className="text-xs">Etage</Label>
                <Input
                  placeholder="2. OG"
                  value={form.floor}
                  onChange={(e) => setForm({ ...form, floor: e.target.value })}
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
            </div>
          </div>

          {/* Kaufpreis & Nebenkosten (optional) */}
          <div className="space-y-3 pt-3 border-t border-border">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-primary flex items-center gap-1.5">
              <Coins className="h-3.5 w-3.5" /> Kaufpreis & Investition (optional)
            </h4>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Kaufpreis (€)</Label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="z.B. 240000"
                  value={form.purchasePrice}
                  onChange={(e) => setForm({ ...form, purchasePrice: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Kaufnebenkosten (€)</Label>
                  <button
                    type="button"
                    onClick={() => setShowAncillaryCalc(!showAncillaryCalc)}
                    className="text-[11px] text-primary hover:underline flex items-center gap-1"
                  >
                    <Calculator className="h-3 w-3" /> {showAncillaryCalc ? "Rechner zu" : "%-Rechner"}
                  </button>
                </div>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="z.B. 25000"
                  value={form.ancillaryCosts}
                  onChange={(e) => setForm({ ...form, ancillaryCosts: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs flex items-center gap-1">
                  <Calendar className="h-3 w-3 text-muted-foreground" /> Kaufvertrag (Notar)
                </Label>
                <Input
                  type="date"
                  value={form.purchasedAt}
                  onChange={(e) => setForm({ ...form, purchasedAt: e.target.value })}
                />
                <p className="text-[10px] text-muted-foreground">Datum der Beurkundung</p>
              </div>
              <div className="space-y-1">
                <Label className="text-xs flex items-center gap-1">
                  <Clock className="h-3 w-3 text-primary" /> Nutzen- & Lastenwechsel
                </Label>
                <Input
                  type="date"
                  value={form.possessionAt}
                  onChange={(e) => setForm({ ...form, possessionAt: e.target.value })}
                />
                <p className="text-[10px] text-muted-foreground">Wirtschaftlicher Übergang (Rechte/Miete)</p>
              </div>
            </div>

            {/* Optionaler Nebenkosten-Prozent-Rechner */}
            {showAncillaryCalc && (
              <div className="p-3 bg-secondary/40 rounded-xl space-y-2 border border-border/60 animate-fade-in text-xs">
                <p className="font-semibold text-foreground">Schnellrechner Kaufnebenkosten:</p>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <Label className="text-[10px] text-muted-foreground">Grunderwerbsteuer (%)</Label>
                    <Input
                      type="number"
                      step="0.1"
                      className="h-8 text-xs"
                      value={taxRate}
                      onChange={(e) => setTaxRate(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label className="text-[10px] text-muted-foreground">Notar & Grundbuch (%)</Label>
                    <Input
                      type="number"
                      step="0.1"
                      className="h-8 text-xs"
                      value={notaryRate}
                      onChange={(e) => setNotaryRate(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label className="text-[10px] text-muted-foreground">Makler (%)</Label>
                    <Input
                      type="number"
                      step="0.1"
                      className="h-8 text-xs"
                      value={brokerRate}
                      onChange={(e) => setBrokerRate(e.target.value)}
                    />
                  </div>
                </div>
                <div className="flex justify-between items-center pt-1">
                  <span className="text-muted-foreground text-[11px]">
                    Gesamt: {((parseFloat(taxRate) || 0) + (parseFloat(notaryRate) || 0) + (parseFloat(brokerRate) || 0)).toFixed(2)}%
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    onClick={handleCalcAncillary}
                    disabled={!form.purchasePrice}
                  >
                    Betrag berechnen & übernehmen
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Laufende Kosten & Rücklagen für Cashflow-Berechnung */}
          <div className="space-y-3 pt-3 border-t border-border">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
              <Coins className="h-3.5 w-3.5" /> Laufende Kosten & Rücklagen (Netto-Cashflow)
            </h4>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Nicht-umlagef. Kosten (€/Mo)</Label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder={`Pauschale: ${(parseFloat(form.sqm || "0") * 0.35 + 25).toFixed(2)} €`}
                  value={form.nonRecoverableCosts}
                  onChange={(e) => setForm({ ...form, nonRecoverableCosts: e.target.value })}
                />
                <p className="text-[10px] text-muted-foreground">
                  WEG-Hausgeld (nicht umlagef.), SEV, Verwaltergebühr. Wenn leer: Pauschale (0,35 €/m² + 25 €)
                </p>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Instandhaltungsrücklage (€/Mo)</Label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder={`Standard: ${(parseFloat(form.sqm || "0") * 1.20).toFixed(2)} €`}
                  value={form.maintenanceReserve}
                  onChange={(e) => setForm({ ...form, maintenanceReserve: e.target.value })}
                />
                <p className="text-[10px] text-muted-foreground">
                  Monatlicher Rücklagenbeitrag. Wenn leer: Standard (1,20 €/m²)
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

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Mietbeginn / Einzug</Label>
                  <Input
                    type="date"
                    value={form.tenantMoveInDate}
                    onChange={(e) => setForm({ ...form, tenantMoveInDate: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Vertragsbeginn</Label>
                  <Input
                    type="date"
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
                <div className="col-span-2">
                  <strong className="text-foreground">Durchschnittlicher m²-Kaufpreis:</strong>
                  <p>Portfolio-Kaufwert ÷ {totalSqm.toFixed(1)} m² Gesamtwohnfläche = ca. {avgSqmPrice.toLocaleString("de-DE")} €/m².</p>
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
                    const yld = price > 0 && cold > 0 ? ((cold * 12 / price) * 100).toFixed(2) : null;

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
                        <TableCell className="text-xs text-right text-muted-foreground">
                          {anc > 0 ? formatCurrency(anc) : "–"}
                        </TableCell>
                        <TableCell className="text-xs text-right">
                          {cold > 0 ? formatCurrency(cold) : <span className="text-muted-foreground italic">Leerstand</span>}
                        </TableCell>
                        <TableCell className="text-xs text-right font-semibold">
                          {yld ? (
                            <span className="text-green-600 dark:text-green-400">{yld}% p.a.</span>
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
    ? ((totalColdRent * 12 / totalPurchaseValue) * 100).toFixed(2)
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
    <div className="p-6 space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Objekt- & Mieterakten</h1>
          <p className="text-muted-foreground text-sm">
            {properties.length} {properties.length === 1 ? "Wohnung" : "Wohnungen"} im Portfolio · Kaufpreise, Mietverträge & Renditen
          </p>
        </div>
        <AddPropertyDialog onRefresh={fetchData} />
      </div>

      {/* Zusammenfassung KPI */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground mb-1">Vermietungsquote</p>
            <p className="text-2xl font-bold text-green-500">
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
            <p className="text-2xl font-bold">{formatCurrency(totalColdRent)}</p>
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
            <p className="text-2xl font-bold text-primary">
              {totalPurchaseValue > 0 ? formatCurrency(totalPurchaseValue) : `${totalSqm.toFixed(1)} m²`}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {portfolioYield
                ? `Ø Brutto-Rendite: ${portfolioYield}% p.a.`
                : `Ø ${totalSqm > 0 ? (totalColdRent / totalSqm).toFixed(2) : 0} €/m² Kalt`}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground mb-1">Geplante Mietanpassungen</p>
            <p className="text-2xl font-bold text-blue-500">{allAdjustments.length}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Staffel- & Indexmieten</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="akten">
        <TabsList>
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
