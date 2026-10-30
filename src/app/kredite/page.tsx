"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
  Plus, TrendingDown, TrendingUp, Landmark, AlertTriangle, Clock,
  PiggyBank, Wallet, ArrowUpRight, ArrowDownRight, Layers, ShieldCheck,
  Edit, Trash2, Calendar, Sparkles, RefreshCw, Info
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Legend, LineChart, Line
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  formatCurrency,
  formatCompactCurrency,
  formatDate,
  getFixedRateStatus,
  calculateAmortization,
  calculateCurrentBalanceFromTerms,
  monthsDiff
} from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

interface Amortization {
  period: string;
  balanceBefore: number;
  interestPart: number;
  principalPart: number;
  balanceAfter: number;
}

interface Loan {
  id: string;
  propertyId: string;
  label: string;
  bank?: string;
  originalAmount: number;
  currentBalance: number;
  interestRate: number;
  monthlyPayment: number;
  startDate: string;
  fixedRateEnd: string;
  amortizations: Amortization[];
  property: { id: string; name: string; sqm: number };
}

interface Property {
  id: string;
  name: string;
  address: string;
  sqm: number;
  nonRecoverableCosts?: number | null;
  maintenanceReserve?: number | null;
  tenant?: {
    firstName: string;
    lastName: string;
    coldRent: number;
    utilities: number;
  } | null;
  loans?: Loan[];
}

const TRAFFIC_COLORS = {
  green: { dot: "bg-green-500", badge: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" },
  yellow: { dot: "bg-yellow-500 animate-pulse", badge: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400" },
  red: { dot: "bg-red-500 animate-pulse", badge: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400" },
};

// ─── Darlehen anlegen Dialog ─────────────────────────────────────────────────
function AddLoanDialog({
  properties,
  onRefresh,
}: {
  properties: Property[];
  onRefresh: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    propertyId: properties[0]?.id || "",
    label: "Hauptdarlehen",
    bank: "",
    originalAmount: "",
    currentBalance: "",
    interestRate: "",
    monthlyPayment: "",
    startDate: "",
    fixedRateEnd: "",
  });
  const [autoCalculated, setAutoCalculated] = useState(false);
  const [elapsedMonths, setElapsedMonths] = useState(0);
  const [saving, setSaving] = useState(false);

  // Automatische Restschuld-Berechnung aus den Eckdaten
  const recalculateBalance = (
    origAmount = form.originalAmount,
    rate = form.interestRate,
    payment = form.monthlyPayment,
    start = form.startDate
  ) => {
    const o = parseFloat(origAmount);
    const r = parseFloat(rate);
    const p = parseFloat(payment);
    if (!isNaN(o) && o > 0 && !isNaN(r) && !isNaN(p) && p > 0 && start) {
      const result = calculateCurrentBalanceFromTerms(o, r, p, start);
      setForm((prev) => ({
        ...prev,
        currentBalance: result.balance.toString(),
      }));
      setElapsedMonths(result.monthsElapsed);
      setAutoCalculated(true);
    }
  };

  const handleFieldChange = (field: string, value: string) => {
    const nextForm = { ...form, [field]: value };
    setForm(nextForm);
    if (["originalAmount", "interestRate", "monthlyPayment", "startDate"].includes(field)) {
      recalculateBalance(
        field === "originalAmount" ? value : form.originalAmount,
        field === "interestRate" ? value : form.interestRate,
        field === "monthlyPayment" ? value : form.monthlyPayment,
        field === "startDate" ? value : form.startDate
      );
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const res = await fetch("/api/loans", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setSaving(false);
    if (res.ok) {
      toast({ title: "Darlehen erfolgreich erstellt" });
      setOpen(false);
      setForm({
        propertyId: properties[0]?.id || "",
        label: "Hauptdarlehen",
        bank: "",
        originalAmount: "",
        currentBalance: "",
        interestRate: "",
        monthlyPayment: "",
        startDate: "",
        fixedRateEnd: "",
      });
      setAutoCalculated(false);
      onRefresh();
    } else {
      const err = await res.json();
      toast({
        title: "Fehler beim Anlegen des Darlehens",
        description: err.error || "Bitte Eingaben überprüfen",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="h-4 w-4 mr-1.5" /> Darlehen hinzufügen
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Landmark className="h-5 w-5 text-primary" />
            Neues Darlehen anlegen
          </DialogTitle>
          <CardDescription>
            Geben Sie Kreditsumme, Sollzins, Rate und Darlehensstart ein. Die aktuelle Restschuld wird automatisch ermittelt.
          </CardDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2 col-span-2">
              <Label className="text-xs">Wohnung *</Label>
              <Select
                value={form.propertyId}
                onValueChange={(v) => setForm({ ...form, propertyId: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Wohnung wählen" />
                </SelectTrigger>
                <SelectContent>
                  {properties.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Bezeichnung *</Label>
              <Input
                value={form.label}
                onChange={(e) => handleFieldChange("label", e.target.value)}
                placeholder="z.B. Hauptdarlehen 1"
                required
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Kreditinstitut / Bank</Label>
              <Input
                placeholder="z.B. Volksbank Berlin"
                value={form.bank}
                onChange={(e) => handleFieldChange("bank", e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Ursprüngliche Kreditsumme (€) *</Label>
                {form.originalAmount && !isNaN(parseFloat(form.originalAmount)) && (
                  <span className="text-[11px] font-semibold text-primary font-mono">
                    {parseFloat(form.originalAmount).toLocaleString("de-DE")} €
                  </span>
                )}
              </div>
              <Input
                type="number"
                step="0.01"
                placeholder="z.B. 200000"
                value={form.originalAmount}
                onChange={(e) => handleFieldChange("originalAmount", e.target.value)}
                required
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Sollzins (% p.a.) *</Label>
              <Input
                type="number"
                step="0.01"
                placeholder="3.50"
                value={form.interestRate}
                onChange={(e) => handleFieldChange("interestRate", e.target.value)}
                required
              />
            </div>
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Monatliche Annuität (€) *</Label>
                {form.monthlyPayment && !isNaN(parseFloat(form.monthlyPayment)) && (
                  <span className="text-[11px] font-semibold text-primary font-mono">
                    {parseFloat(form.monthlyPayment).toLocaleString("de-DE")} €
                  </span>
                )}
              </div>
              <Input
                type="number"
                step="0.01"
                placeholder="z.B. 900"
                value={form.monthlyPayment}
                onChange={(e) => handleFieldChange("monthlyPayment", e.target.value)}
                required
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Darlehensstart *</Label>
              <Input
                type="date"
                value={form.startDate}
                onChange={(e) => handleFieldChange("startDate", e.target.value)}
                required
              />
            </div>
            <div className="space-y-1 col-span-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs">
                  Aktuelle Restschuld (€)
                  {autoCalculated && (
                    <span className="text-primary font-normal ml-2">
                      (automatisch berechnet: {elapsedMonths} Monate Tilgung)
                    </span>
                  )}
                </Label>
                <div className="flex items-center gap-2">
                  {form.currentBalance && !isNaN(parseFloat(form.currentBalance)) && (
                    <span className="text-[11px] font-semibold text-primary font-mono">
                      {parseFloat(form.currentBalance).toLocaleString("de-DE")} €
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => recalculateBalance()}
                    className="text-[11px] text-primary hover:underline flex items-center gap-1"
                  >
                    <RefreshCw className="h-3 w-3" /> Neu berechnen
                  </button>
                </div>
              </div>
              <Input
                type="number"
                step="0.01"
                placeholder="Wird automatisch berechnet"
                value={form.currentBalance}
                onChange={(e) => setForm({ ...form, currentBalance: e.target.value })}
                required
              />
              <p className="text-[11px] text-muted-foreground">
                Berechnet aus Startdatum bis heute. Sie können den Betrag bei Bedarf manuell anpassen.
              </p>
            </div>
            <div className="space-y-1 col-span-2">
              <Label className="text-xs">Zinsbindungsende *</Label>
              <Input
                type="date"
                value={form.fixedRateEnd}
                onChange={(e) => handleFieldChange("fixedRateEnd", e.target.value)}
                required
              />
            </div>
          </div>
          <Button type="submit" className="w-full" disabled={saving}>
            {saving ? "Wird gespeichert..." : "Darlehen speichern"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Darlehen bearbeiten Dialog ──────────────────────────────────────────────
function EditLoanDialog({
  loan,
  properties,
  onRefresh,
}: {
  loan: Loan;
  properties: Property[];
  onRefresh: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    propertyId: loan.propertyId,
    label: loan.label,
    bank: loan.bank || "",
    originalAmount: loan.originalAmount.toString(),
    currentBalance: loan.currentBalance.toString(),
    interestRate: loan.interestRate.toString(),
    monthlyPayment: loan.monthlyPayment.toString(),
    startDate: loan.startDate ? loan.startDate.split("T")[0] : "",
    fixedRateEnd: loan.fixedRateEnd ? loan.fixedRateEnd.split("T")[0] : "",
  });

  const recalculateBalance = () => {
    const o = parseFloat(form.originalAmount);
    const r = parseFloat(form.interestRate);
    const p = parseFloat(form.monthlyPayment);
    if (!isNaN(o) && o > 0 && !isNaN(r) && !isNaN(p) && p > 0 && form.startDate) {
      const result = calculateCurrentBalanceFromTerms(o, r, p, form.startDate);
      setForm((prev) => ({
        ...prev,
        currentBalance: result.balance.toString(),
      }));
      toast({
        title: "Restschuld neu berechnet",
        description: `${result.monthsElapsed} Monate tilgungsbereinigt: ${formatCurrency(result.balance)}`,
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const res = await fetch(`/api/loans/${loan.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setSaving(false);
    if (res.ok) {
      toast({ title: "Darlehen erfolgreich aktualisiert" });
      setOpen(false);
      onRefresh();
    } else {
      toast({ title: "Fehler beim Speichern des Darlehens", variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          size="sm"
          variant="outline"
          className="h-8 text-xs gap-1"
          onClick={(e) => e.stopPropagation()}
        >
          <Edit className="h-3.5 w-3.5" /> Darlehen bearbeiten
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Edit className="h-5 w-5 text-primary" />
            Darlehen bearbeiten: {loan.label}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1 col-span-2">
              <Label className="text-xs">Zugeordnete Wohnung *</Label>
              <Select
                value={form.propertyId}
                onValueChange={(v) => setForm({ ...form, propertyId: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {properties.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Bezeichnung *</Label>
              <Input
                value={form.label}
                onChange={(e) => setForm({ ...form, label: e.target.value })}
                required
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Kreditinstitut / Bank</Label>
              <Input
                value={form.bank}
                onChange={(e) => setForm({ ...form, bank: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Ursprüngliche Kreditsumme (€) *</Label>
                {form.originalAmount && !isNaN(parseFloat(form.originalAmount)) && (
                  <span className="text-[11px] font-semibold text-primary font-mono">
                    {parseFloat(form.originalAmount).toLocaleString("de-DE")} €
                  </span>
                )}
              </div>
              <Input
                type="number"
                step="0.01"
                value={form.originalAmount}
                onChange={(e) => setForm({ ...form, originalAmount: e.target.value })}
                required
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Sollzins (% p.a.) *</Label>
              <Input
                type="number"
                step="0.01"
                value={form.interestRate}
                onChange={(e) => setForm({ ...form, interestRate: e.target.value })}
                required
              />
            </div>
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Monatliche Annuität (€) *</Label>
                {form.monthlyPayment && !isNaN(parseFloat(form.monthlyPayment)) && (
                  <span className="text-[11px] font-semibold text-primary font-mono">
                    {parseFloat(form.monthlyPayment).toLocaleString("de-DE")} €
                  </span>
                )}
              </div>
              <Input
                type="number"
                step="0.01"
                value={form.monthlyPayment}
                onChange={(e) => setForm({ ...form, monthlyPayment: e.target.value })}
                required
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Darlehensstart *</Label>
              <Input
                type="date"
                value={form.startDate}
                onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                required
              />
            </div>
            <div className="space-y-1 col-span-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Aktuelle Restschuld (€) *</Label>
                <div className="flex items-center gap-2">
                  {form.currentBalance && !isNaN(parseFloat(form.currentBalance)) && (
                    <span className="text-[11px] font-semibold text-primary font-mono">
                      {parseFloat(form.currentBalance).toLocaleString("de-DE")} €
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={recalculateBalance}
                    className="text-[11px] text-primary hover:underline flex items-center gap-1"
                  >
                    <RefreshCw className="h-3 w-3" /> Aus Laufzeit & Zins neu berechnen
                  </button>
                </div>
              </div>
              <Input
                type="number"
                step="0.01"
                value={form.currentBalance}
                onChange={(e) => setForm({ ...form, currentBalance: e.target.value })}
                required
              />
            </div>
            <div className="space-y-1 col-span-2">
              <Label className="text-xs">Zinsbindungsende *</Label>
              <Input
                type="date"
                value={form.fixedRateEnd}
                onChange={(e) => setForm({ ...form, fixedRateEnd: e.target.value })}
                required
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-3">
            <Button variant="outline" type="button" onClick={() => setOpen(false)}>
              Abbrechen
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Wird gespeichert..." : "Änderungen speichern"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Darlehen löschen Dialog ─────────────────────────────────────────────────
function DeleteLoanDialog({
  loan,
  onRefresh,
}: {
  loan: Loan;
  onRefresh: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    setDeleting(true);
    const res = await fetch(`/api/loans/${loan.id}`, { method: "DELETE" });
    setDeleting(false);
    if (res.ok) {
      toast({ title: `Darlehen '${loan.label}' gelöscht` });
      setOpen(false);
      onRefresh();
    } else {
      toast({ title: "Fehler beim Löschen des Darlehens", variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          size="sm"
          variant="outline"
          className="h-8 text-xs text-muted-foreground hover:text-destructive hover:border-destructive/40 gap-1"
          onClick={(e) => e.stopPropagation()}
        >
          <Trash2 className="h-3.5 w-3.5" /> Löschen
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Darlehen wirklich löschen?
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2 text-sm text-muted-foreground">
          <p>
            Möchten Sie das Darlehen <strong className="text-foreground">{loan.label}</strong> (
            {loan.property?.name}) mit Restschuld{" "}
            <strong className="text-foreground">{formatCurrency(loan.currentBalance)}</strong>{" "}
            unwiderruflich löschen?
          </p>
          <p className="text-xs">Alle zugehörigen Tilgungsplandaten werden ebenfalls gelöscht.</p>
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => setOpen(false)} disabled={deleting}>
            Abbrechen
          </Button>
          <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
            {deleting ? "Wird gelöscht..." : "Darlehen unwiderruflich löschen"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Nicht-umlagefähige Kosten Info Dialog ──────────────────────────────────
function NonRecoverableInfoDialog() {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center justify-center h-4 w-4 rounded-full text-muted-foreground hover:text-primary transition-colors cursor-pointer"
          title="Was sind nicht-umlagefähige Kosten? Klicken für Erklärung"
        >
          <Info className="h-3.5 w-3.5" />
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Info className="h-5 w-5 text-primary" />
            Nicht-umlagefähige Kosten
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3.5 pt-2 text-sm">
          <p className="text-muted-foreground leading-relaxed text-xs">
            <strong>Nicht-umlagefähige Kosten</strong> sind laufende Aufwendungen für eine Immobilie, die der Vermieter/Eigentümer nach der Betriebskostenverordnung (BetrKV) <strong>nicht auf den Mieter umlegen darf</strong> und daher aus den Mieteinnahmen selbst finanzieren muss.
          </p>

          <div className="p-3 bg-muted/40 rounded-xl space-y-1.5 text-xs">
            <span className="font-semibold text-foreground block">Dazu zählen insbesondere:</span>
            <ul className="list-disc pl-4 space-y-1 text-muted-foreground">
              <li><strong>Verwaltungskosten:</strong> WEG-Verwaltergebühr, Sondereigentumsverwaltung (SEV)</li>
              <li><strong>Instandhaltungsaufwand:</strong> Reparaturen und Modernisierungen am Gemeinschafts- oder Sondereigentum</li>
              <li><strong>Bankgebühren:</strong> Kontoführungsgebühren des Mietkontos</li>
              <li><strong>Mietausfall- & Leerstandswagnis</strong></li>
            </ul>
          </div>

          <div className="p-3 bg-primary/5 border border-primary/20 rounded-xl text-xs space-y-1">
            <span className="font-semibold text-foreground block">Berechnung in Immotracker:</span>
            <p className="text-muted-foreground">
              Für einen realistischen Netto-Cashflow setzt Immotracker hier standardmäßig einen Pauschalwert von <strong>0,35 €/m² Wohnfläche + 25 € monatlich je Einheit</strong> an.
            </p>
          </div>

          <div className="flex justify-end pt-1">
            <Button variant="outline" size="sm" onClick={() => setOpen(false)}>
              Verstanden
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Volltilger- & Refinanzierungsrechner ────────────────────────────────────
function VolltilgerCalculator({
  loans,
  properties,
  initialLoanId,
}: {
  loans: Loan[];
  properties: Property[];
  initialLoanId?: string;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const [selectedLoanId, setSelectedLoanId] = useState<string>(
    initialLoanId && loans.some((x) => x.id === initialLoanId)
      ? initialLoanId
      : loans[0]?.id || "CUSTOM"
  );
  const [customBalance, setCustomBalance] = useState("180000");
  const [customCurrentRate, setCustomCurrentRate] = useState("1.85");
  const [customCurrentPayment, setCustomCurrentPayment] = useState("750");

  const [simInterestRate, setSimInterestRate] = useState("3.75");
  const [targetYears, setTargetYears] = useState("15");

  // Sync when initialLoanId changes
  useEffect(() => {
    if (initialLoanId && loans.some((x) => x.id === initialLoanId)) {
      setSelectedLoanId(initialLoanId);
    }
  }, [initialLoanId, loans]);

  // Load selected loan defaults
  useEffect(() => {
    if (selectedLoanId !== "CUSTOM") {
      const l = loans.find((x) => x.id === selectedLoanId);
      if (l) {
        setCustomBalance(String(Number(l.currentBalance.toFixed(2))));
        setCustomCurrentRate(String(l.interestRate));
        setCustomCurrentPayment(String(Number(l.monthlyPayment.toFixed(2))));
      }
    }
  }, [selectedLoanId, loans]);

  const balance = Math.max(1000, parseFloat(customBalance) || 0);
  const currentRate = Math.max(0.1, parseFloat(customCurrentRate) || 0);
  const currentPayment = Math.max(10, parseFloat(customCurrentPayment) || 0);
  const newRate = Math.max(0.1, parseFloat(simInterestRate) || 0);
  const years = Math.max(1, Math.min(40, parseInt(targetYears, 10) || 15));

  // Volltilger Calculation
  const totalMonths = years * 12;
  const monthlyR = newRate / 100 / 12;
  const volltilgerPayment =
    monthlyR > 0
      ? (balance * monthlyR * Math.pow(1 + monthlyR, totalMonths)) /
        (Math.pow(1 + monthlyR, totalMonths) - 1)
      : balance / totalMonths;

  const totalVolltilgerPaid = volltilgerPayment * totalMonths;
  const totalVolltilgerInterest = Math.max(0, totalVolltilgerPaid - balance);
  const initialTilgungPct = ((volltilgerPayment * 12 - balance * (newRate / 100)) / balance) * 100;

  const paymentDiff = volltilgerPayment - currentPayment;
  const currentYear = new Date().getFullYear();
  const payoffYear = currentYear + years;

  // Projection year-by-year data for chart (exact decimals)
  const projectionData = [];
  let runningBalance = balance;
  for (let y = 0; y <= years; y++) {
    projectionData.push({
      year: currentYear + y,
      Restschuld: Number(runningBalance.toFixed(2)),
      ZinsanteilGesamt: Number((totalVolltilgerInterest * (y / years)).toFixed(2)),
    });
    // Deduct 12 months
    for (let m = 0; m < 12; m++) {
      const intMonth = runningBalance * monthlyR;
      const prinMonth = Math.min(runningBalance, volltilgerPayment - intMonth);
      runningBalance = Math.max(0, runningBalance - prinMonth);
    }
  }

  // Zinsschock-Stresstest Scenarios
  const scenarios = [
    { label: "Status Quo (Heute)", rate: currentRate, desc: "Aktuelle Konditionen bis Zinsbindungsende" },
    { label: "Moderat (+1.0%)", rate: currentRate + 1.0, desc: "Leichter Zinsanstieg bei Anschluss" },
    { label: `Simuliert (${newRate.toFixed(2)}%)`, rate: newRate, desc: "Ihr gewählter Zinssatz" },
    { label: "Zinsschock (5.50%)", rate: 5.5, desc: "Hochzins-Stresstest" },
  ].map((sc) => {
    // Keeping same initial repayment rate as current loan
    const initialCurrentTilgung = Math.max(1.0, ((currentPayment * 12 - balance * (currentRate / 100)) / balance) * 100);
    const requiredRateWithSameTilgung = (balance * ((sc.rate + initialCurrentTilgung) / 100)) / 12;
    const rateDiff = requiredRateWithSameTilgung - currentPayment;
    const yearDiff = rateDiff * 12;

    return {
      ...sc,
      requiredPayment: requiredRateWithSameTilgung,
      monthlyDelta: rateDiff,
      annualDelta: yearDiff,
    };
  });

  return (
    <div className="space-y-6">
      {/* Configuration Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Volltilger- & Anschlussfinanzierungs-Rechner
            </span>
            <Badge variant="secondary" className="font-mono text-xs">
              Refinanzierungs-Simulation
            </Badge>
          </CardTitle>
          <CardDescription>
            Simulieren Sie steigende Anschlusszinsen bei Zinsbindungsende und berechnen Sie die exakte Volltilger-Rate für vollständige Schuldenfreiheit.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Darlehensauswahl & Grunddaten */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 rounded-xl bg-secondary/30 border border-border/50">
            <div className="space-y-1.5 md:col-span-1">
              <Label className="text-xs">Darlehen auswählen</Label>
              <Select value={selectedLoanId} onValueChange={setSelectedLoanId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CUSTOM">-- Manuelle Eingabe --</SelectItem>
                  {loans.map((l) => (
                    <SelectItem key={l.id} value={l.id}>
                      {l.label} ({l.property?.name})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Restschuld / Darlehenssumme (€)</Label>
              <Input
                type="number"
                value={customBalance}
                onChange={(e) => {
                  setSelectedLoanId("CUSTOM");
                  setCustomBalance(e.target.value);
                }}
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Aktueller Zinssatz (%)</Label>
              <Input
                type="number"
                step="0.01"
                value={customCurrentRate}
                onChange={(e) => {
                  setSelectedLoanId("CUSTOM");
                  setCustomCurrentRate(e.target.value);
                }}
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Aktuelle Monatsrate (€)</Label>
              <Input
                type="number"
                value={customCurrentPayment}
                onChange={(e) => {
                  setSelectedLoanId("CUSTOM");
                  setCustomCurrentPayment(e.target.value);
                }}
              />
            </div>
          </div>

          {/* Simulation Slider / Inputs */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 rounded-xl bg-primary/5 border border-primary/20">
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Label className="text-sm font-semibold">Simulierter Anschlusszinssatz</Label>
                <span className="text-base font-bold text-primary font-mono">{newRate.toFixed(2)} % p.a.</span>
              </div>
              <input
                type="range"
                min="0.5"
                max="8.0"
                step="0.05"
                value={simInterestRate}
                onChange={(e) => setSimInterestRate(e.target.value)}
                className="w-full h-2 bg-secondary rounded-lg appearance-none cursor-pointer accent-primary"
              />
              <div className="flex justify-between text-[11px] text-muted-foreground font-mono">
                <span>0.5% (Niedrigzins)</span>
                <span>3.5% (Markt Ø)</span>
                <span>8.0% (Hochzins)</span>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Label className="text-sm font-semibold">Gewünschte Volltilger-Laufzeit</Label>
                <span className="text-base font-bold text-primary font-mono">{years} Jahre (bis {payoffYear})</span>
              </div>
              <input
                type="range"
                min="5"
                max="35"
                step="1"
                value={targetYears}
                onChange={(e) => setTargetYears(e.target.value)}
                className="w-full h-2 bg-secondary rounded-lg appearance-none cursor-pointer accent-primary"
              />
              <div className="flex justify-between text-[11px] text-muted-foreground font-mono">
                <span>5 Jahre (Schnelltilger)</span>
                <span>15-20 Jahre (Standard)</span>
                <span>35 Jahre</span>
              </div>
            </div>
          </div>

          {/* KPI Ergebnis-Karten */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="border-primary/30">
              <CardContent className="pt-4 pb-4">
                <p className="text-xs text-muted-foreground mb-1">Volltilger-Monatsrate</p>
                <p className="text-2xl font-bold font-mono text-primary">
                  {formatCurrency(volltilgerPayment)}
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Anfängl. Tilgung: {initialTilgungPct.toFixed(2)}%
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-4 pb-4">
                <p className="text-xs text-muted-foreground mb-1">Differenz zu heute</p>
                <p className={`text-2xl font-bold font-mono ${paymentDiff > 0 ? "text-amber-500" : "text-green-500"}`}>
                  {paymentDiff >= 0 ? "+" : ""}{formatCurrency(paymentDiff)}/Mo
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {paymentDiff >= 0 ? `+${formatCurrency(paymentDiff * 12)}/Jahr` : "Monatliche Entlastung"}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-4 pb-4">
                <p className="text-xs text-muted-foreground mb-1">Gesamte Zinskosten</p>
                <p className="text-2xl font-bold font-mono text-foreground">
                  {formatCurrency(totalVolltilgerInterest)}
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Gesamtaufwand: {formatCurrency(totalVolltilgerPaid)}
                </p>
              </CardContent>
            </Card>

            <Card className="stat-card-success text-white border-0">
              <CardContent className="pt-4 pb-4">
                <p className="text-green-100 text-xs mb-1">Schuldenfrei im Jahr</p>
                <p className="text-2xl font-bold font-mono">
                  {payoffYear}
                </p>
                <p className="text-green-100 text-[11px] mt-0.5">
                  100% getilgt nach {years} Jahren
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Chart Restschuldverlauf */}
          <div className="space-y-2 pt-2">
            <h4 className="text-sm font-semibold flex items-center gap-2">
              <TrendingDown className="h-4 w-4 text-primary" />
              Tilgungsverlauf bis €0,00 ({years} Jahre mit {newRate.toFixed(2)}% Sollzins)
            </h4>
            <div className="h-64 w-full">
              {mounted ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={projectionData} margin={{ top: 10, right: 20, left: 20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="volltilgerGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                    <XAxis dataKey="year" fontSize={11} />
                    <YAxis
                      fontSize={11}
                      tickFormatter={(v) => formatCompactCurrency(v)}
                    />
                    <Tooltip
                      formatter={(val: unknown) => [formatCurrency(Number(val) || 0), "Restschuld"]}
                      labelFormatter={(label) => `Jahr: ${label}`}
                    />
                    <Area
                      type="monotone"
                      dataKey="Restschuld"
                      stroke="#3b82f6"
                      strokeWidth={2.5}
                      fillOpacity={1}
                      fill="url(#volltilgerGrad)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="w-full h-full bg-muted/20 animate-pulse rounded-lg flex items-center justify-center text-xs text-muted-foreground">
                  Lade Diagramm...
                </div>
              )}
            </div>
          </div>

          {/* Zinsschock-Stresstest Vergleichstabelle */}
          <div className="space-y-3 pt-4 border-t border-border/50">
            <div>
              <h4 className="text-sm font-semibold flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                Zinsschock-Stresstest: Mehrbelastung bei verschiedenen Zinsniveaus
              </h4>
              <p className="text-xs text-muted-foreground mt-0.5">
                Vergleich der benötigten Rate bei gleicher Tilgungsgeschwindigkeit ggü. heutigem Zins
              </p>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Szenario</TableHead>
                  <TableHead>Zinssatz</TableHead>
                  <TableHead className="text-right">Erforderliche Monatsrate</TableHead>
                  <TableHead className="text-right">Monatliche Mehrbelastung</TableHead>
                  <TableHead className="text-right">Jährliche Mehrbelastung</TableHead>
                  <TableHead className="w-32">Cashflow-Einschätzung</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {scenarios.map((sc, idx) => (
                  <TableRow key={idx} className={sc.label.includes("Simuliert") ? "bg-primary/5 font-semibold" : ""}>
                    <TableCell className="text-sm font-medium">
                      <div>{sc.label}</div>
                      <div className="text-[11px] text-muted-foreground">{sc.desc}</div>
                    </TableCell>
                    <TableCell className="font-mono text-sm">{sc.rate.toFixed(2)} %</TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {formatCurrency(sc.requiredPayment)}
                    </TableCell>
                    <TableCell className={`text-right font-mono text-sm font-bold ${
                      sc.monthlyDelta > 0 ? "text-red-500" : "text-green-500"
                    }`}>
                      {sc.monthlyDelta >= 0 ? "+" : ""}{formatCurrency(sc.monthlyDelta)}
                    </TableCell>
                    <TableCell className={`text-right font-mono text-sm ${
                      sc.annualDelta > 0 ? "text-red-400" : "text-green-500"
                    }`}>
                      {sc.annualDelta >= 0 ? "+" : ""}{formatCurrency(sc.annualDelta)}
                    </TableCell>
                    <TableCell>
                      {sc.monthlyDelta <= 0 ? (
                        <Badge variant="success" className="text-[10px]">Unbedenklich</Badge>
                      ) : sc.monthlyDelta <= 150 ? (
                        <Badge variant="secondary" className="text-[10px]">Puffer ausreichend</Badge>
                      ) : sc.monthlyDelta <= 350 ? (
                        <Badge variant="warning" className="text-[10px]">Erhöhtes Risiko</Badge>
                      ) : (
                        <Badge variant="destructive" className="text-[10px]">Kritischer Cashflow</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Hauptseite Kredite ──────────────────────────────────────────────────────
function KrediteContent() {
  const searchParams = useSearchParams();
  const initialTab = searchParams.get("tab") || "darlehen";
  const initialLoanId = searchParams.get("loanId") || undefined;

  const [activeTab, setActiveTab] = useState(initialTab);
  const [selectedVolltilgerLoanId, setSelectedVolltilgerLoanId] = useState<string | undefined>(initialLoanId);
  const [mounted, setMounted] = useState(false);

  const [loans, setLoans] = useState<Loan[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLoan, setSelectedLoan] = useState<Loan | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const t = searchParams.get("tab");
    const l = searchParams.get("loanId");
    if (t) setActiveTab(t);
    if (l) setSelectedVolltilgerLoanId(l);
  }, [searchParams]);

  const fetchData = async () => {
    try {
      const [loansRes, propsRes] = await Promise.all([
        fetch("/api/loans"),
        fetch("/api/properties"),
      ]);
      const lData = await loansRes.json();
      const pData = await propsRes.json();
      setLoans(lData);
      setProperties(pData);
      // Wenn das aktuell gewählte Darlehen noch existiert, aktualisiere es; sonst nimm das erste
      if (lData.length > 0) {
        setSelectedLoan((prev) => {
          if (initialLoanId) {
            const foundParam = lData.find((l: Loan) => l.id === initialLoanId);
            if (foundParam) return foundParam;
          }
          if (!prev) return lData[0];
          const found = lData.find((l: Loan) => l.id === prev.id);
          return found || lData[0];
        });
      } else {
        setSelectedLoan(null);
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

  const totalOriginal = loans.reduce((s, l) => s + l.originalAmount, 0);
  const totalBalance = loans.reduce((s, l) => s + l.currentBalance, 0);
  const totalRepaid = totalOriginal - totalBalance;
  const totalInterest = loans.reduce(
    (s, l) => s + l.currentBalance * (l.interestRate / 100 / 12),
    0
  );
  const totalPrincipal = loans.reduce((s, l) => {
    const interest = l.currentBalance * (l.interestRate / 100 / 12);
    return s + Math.max(0, l.monthlyPayment - interest);
  }, 0);
  const totalLoanRate = loans.reduce((s, l) => s + l.monthlyPayment, 0);

  // Historische Tilgungsplan-Daten für Chart (mit exakten Kommazahlen / Cents)
  const chartData =
    selectedLoan?.amortizations
      ?.slice()
      .reverse()
      .map((a) => ({
        period: a.period,
        Zinsen: Number(a.interestPart.toFixed(2)),
        Tilgung: Number(a.principalPart.toFixed(2)),
        Restschuld: Number(a.balanceAfter.toFixed(2)),
      })) ?? [];

  // Netto-Cashflow Berechnung
  const totalColdRent = properties.reduce(
    (s, p) => s + (p.tenant?.coldRent || 0),
    0
  );
  const totalReserves = properties.reduce((s, p) => {
    const r = p.maintenanceReserve != null && p.maintenanceReserve > 0 ? p.maintenanceReserve : p.sqm * 1.20;
    return s + r;
  }, 0);
  const totalNonRecoverable = properties.reduce((s, p) => {
    const nr = p.nonRecoverableCosts != null && p.nonRecoverableCosts > 0 ? p.nonRecoverableCosts : p.sqm * 0.35 + 25;
    return s + nr;
  }, 0);
  const totalOperativeCashflow = totalColdRent - totalLoanRate;
  const totalNetCashflow =
    totalColdRent - totalLoanRate - totalReserves - totalNonRecoverable;

  // Dringende Zinsbindungen (Ampel rot oder gelb: < 36 Monate oder abgelaufen)
  const urgentLoans = loans
    .map((loan) => ({
      loan,
      frs: getFixedRateStatus(new Date(loan.fixedRateEnd)),
    }))
    .filter((x) => x.frs.color === "red" || x.frs.color === "yellow");

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Darlehens- & Cashflow-Management</h1>
          <p className="text-muted-foreground text-sm">
            Annuitäten, Darlehensstart, Zinsbindung-Ampel, Sondertilgungs-Tracker & echter Netto-Cashflow
          </p>
        </div>
        <AddLoanDialog properties={properties} onRefresh={fetchData} />
      </div>

      {/* Prominentes Zinsbindungs-Warnbanner falls Kredite < 36 Monate oder abgelaufen */}
      {urgentLoans.length > 0 && (
        <div className="space-y-3">
          {urgentLoans.map(({ loan, frs }) => {
            const isRed = frs.color === "red";
            return (
              <div
                key={loan.id}
                className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm ${
                  isRed
                    ? "bg-red-500/10 border-red-500/30 text-red-700 dark:text-red-300"
                    : "bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-300"
                }`}
              >
                <div className="flex items-start gap-3 min-w-0">
                  <AlertTriangle
                    className={`h-5 w-5 mt-0.5 shrink-0 ${
                      isRed ? "text-red-500" : "text-amber-500"
                    }`}
                  />
                  <div className="min-w-0">
                    <p className="font-bold text-sm flex items-center gap-2">
                      {isRed
                        ? "Dringende Warnung: Zinsbindung läuft ab!"
                        : "Hinweis: Zinsbindungsende rückt näher"}
                      <span
                        className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${
                          isRed
                            ? "bg-red-500/20 text-red-600 dark:text-red-300"
                            : "bg-amber-500/20 text-amber-600 dark:text-amber-300"
                        }`}
                      >
                        {frs.label}
                      </span>
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Darlehen <strong className="text-foreground">{loan.label}</strong>{" "}
                      {loan.bank ? `(${loan.bank})` : ""} für Objekt{" "}
                      <strong className="text-foreground">{loan.property?.name}</strong> endet am{" "}
                      <strong className="text-foreground">{formatDate(loan.fixedRateEnd)}</strong>.
                      Aktuelle Restschuld:{" "}
                      <strong className="text-foreground">{formatCurrency(loan.currentBalance)}</strong>{" "}
                      (Zins: {loan.interestRate.toFixed(2)} %, Rate: {formatCurrency(loan.monthlyPayment)}/Mo).
                    </p>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant={isRed ? "destructive" : "default"}
                  className="gap-1.5 shrink-0 self-start sm:self-center font-medium text-xs"
                  onClick={() => {
                    setSelectedLoan(loan);
                    setSelectedVolltilgerLoanId(loan.id);
                    setActiveTab("volltilger");
                  }}
                >
                  <Sparkles className="h-4 w-4" />
                  Anschlussfinanzierung berechnen
                </Button>
              </div>
            );
          })}
        </div>
      )}

      {/* KPI-Banner */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <Card className="stat-card-success text-white border-0">
          <CardContent className="pt-4 pb-4">
            <p className="text-green-100 text-xs mb-1">Getilgtes Vermögen</p>
            <p className="text-2xl font-bold">{formatCurrency(totalRepaid)}</p>
            <p className="text-green-100 text-xs mt-1">
              {totalOriginal > 0
                ? ((totalRepaid / totalOriginal) * 100).toFixed(1)
                : 0}
              % des Darlehensvolumens
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground mb-1">Offene Restschuld gesamt</p>
            <p className="text-2xl font-bold text-orange-500">
              {formatCurrency(totalBalance)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {loans.length} aktive{loans.length === 1 ? "s" : ""} Darlehen
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground mb-1">Monatliche Annuität gesamt</p>
            <p className="text-2xl font-bold">{formatCurrency(totalLoanRate)}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {formatCurrency(totalPrincipal)} Tilgung · {formatCurrency(totalInterest)} Zins
            </p>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => setActiveTab("cashflow")}>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center justify-between mb-1 gap-2">
              <p className="text-xs text-muted-foreground truncate">Echter Netto-Cashflow / Monat</p>
              <Badge variant={totalNetCashflow >= 0 ? "success" : "destructive"} className="text-[11px] font-medium px-2 py-0.5 h-auto whitespace-nowrap shrink-0">
                nach Rücklagen
              </Badge>
            </div>
            <p
              className={`text-2xl font-bold ${
                totalNetCashflow >= 0 ? "text-green-500" : "text-red-500"
              }`}
            >
              {totalNetCashflow >= 0 ? "+" : ""}
              {formatCurrency(totalNetCashflow)}
            </p>
            <div className="flex items-center justify-between text-xs text-muted-foreground mt-1">
              <span>Operativ (Miete − Rate):</span>
              <span className={`font-semibold font-mono ${totalOperativeCashflow >= 0 ? "text-green-600 dark:text-green-400" : "text-red-500"}`}>
                {totalOperativeCashflow >= 0 ? "+" : ""}{formatCurrency(totalOperativeCashflow)}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="darlehen" className="gap-1.5">
            <Landmark className="h-4 w-4" /> Darlehensübersicht & Tilgung ({loans.length})
          </TabsTrigger>
          <TabsTrigger value="sondertilgung" className="gap-1.5">
            <PiggyBank className="h-4 w-4" /> Sondertilgungs-Tracker (2026)
          </TabsTrigger>
          <TabsTrigger value="cashflow" className="gap-1.5">
            <Wallet className="h-4 w-4" /> Echter Netto-Cashflow je Objekt
          </TabsTrigger>
          <TabsTrigger value="volltilger" className="gap-1.5">
            <Sparkles className="h-4 w-4" /> Volltilger & Refinanzierung
          </TabsTrigger>
        </TabsList>

        {/* Darlehensübersicht Tab */}
        <TabsContent value="darlehen" className="mt-4">
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <div className="xl:col-span-1 space-y-3">
              <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                Aktive Darlehen ({loans.length})
              </h2>
              {loading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-28 skeleton rounded-xl" />
                  ))}
                </div>
              ) : loans.length === 0 ? (
                <Card className="text-center py-8">
                  <CardContent className="space-y-3">
                    <Landmark className="h-10 w-10 text-muted-foreground mx-auto" />
                    <p className="text-xs text-muted-foreground">
                      Noch keine Darlehen hinterlegt.
                    </p>
                    <AddLoanDialog properties={properties} onRefresh={fetchData} />
                  </CardContent>
                </Card>
              ) : (
                loans.map((loan) => {
                  const frs = getFixedRateStatus(new Date(loan.fixedRateEnd));
                  const repaidPct =
                    loan.originalAmount > 0
                      ? ((loan.originalAmount - loan.currentBalance) /
                          loan.originalAmount) *
                        100
                      : 0;
                  const { interestPart, principalPart } = calculateAmortization(
                    loan.currentBalance,
                    loan.interestRate,
                    loan.monthlyPayment
                  );
                  const tc = TRAFFIC_COLORS[frs.color];

                  return (
                    <Card
                      key={loan.id}
                      className={`cursor-pointer transition-all border-2 hover:shadow-md ${
                        selectedLoan?.id === loan.id
                          ? "border-primary shadow-lg bg-card"
                          : "border-border/60"
                      }`}
                      onClick={() => setSelectedLoan(loan)}
                    >
                      <CardContent className="pt-4 pb-4 space-y-3">
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="font-semibold text-sm leading-tight">
                              {loan.property?.name || "–"}
                            </p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {loan.label}
                            </p>
                            {loan.bank && (
                              <p className="text-xs text-muted-foreground/80 font-medium">
                                {loan.bank}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5">
                            <div className={`w-2 h-2 rounded-full ${tc.dot}`} />
                            <span className={`text-[11px] rounded-full px-2 py-0.5 font-medium ${tc.badge}`}>
                              {frs.label}
                            </span>
                          </div>
                        </div>

                        {/* Startdatum & Zinsbindung prominent anzeigen */}
                        <div className="bg-secondary/40 rounded-lg p-2 text-xs grid grid-cols-2 gap-2 border border-border/40">
                          <div>
                            <span className="text-[10px] text-muted-foreground block uppercase font-medium">
                              Darlehensstart
                            </span>
                            <span className="font-semibold text-foreground flex items-center gap-1 mt-0.5">
                              <Calendar className="h-3 w-3 text-muted-foreground" />
                              {formatDate(loan.startDate)}
                            </span>
                          </div>
                          <div>
                            <span className="text-[10px] text-muted-foreground block uppercase font-medium">
                              Zinsbindung bis
                            </span>
                            <span className="font-semibold text-foreground flex items-center gap-1 mt-0.5">
                              <Clock className="h-3 w-3 text-muted-foreground" />
                              {formatDate(loan.fixedRateEnd)}
                            </span>
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <div className="flex justify-between text-xs">
                            <span className="text-muted-foreground">Restschuld:</span>
                            <span className="font-bold font-mono text-primary">
                              {formatCurrency(loan.currentBalance)}
                            </span>
                          </div>
                          <Progress value={repaidPct} className="h-1.5" />
                          <div className="flex justify-between text-[11px] text-muted-foreground">
                            <span>Zins: {formatCurrency(interestPart)}/Mo</span>
                            <span>Tilg: {formatCurrency(principalPart)}/Mo</span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </div>

            {/* Chart & Details für ausgewähltes Darlehen */}
            <div className="xl:col-span-2 space-y-4">
              {selectedLoan ? (
                <>
                  <Card>
                    <CardHeader className="pb-3">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <CardTitle className="text-base font-bold">
                              {selectedLoan.property?.name
                                ? `${selectedLoan.property.name} – ${selectedLoan.label}`
                                : selectedLoan.label}
                            </CardTitle>
                            {selectedLoan.bank && (
                              <Badge variant="outline" className="text-xs">
                                {selectedLoan.bank}
                              </Badge>
                            )}
                          </div>
                          <CardDescription className="mt-1">
                            {selectedLoan.interestRate}% p.a. Sollzins · Rate:{" "}
                            {formatCurrency(selectedLoan.monthlyPayment)}/Mo · Ursprünglich:{" "}
                            {formatCurrency(selectedLoan.originalAmount)}
                          </CardDescription>
                        </div>
                        {/* Aktions-Buttons: Darlehen bearbeiten & löschen */}
                        <div className="flex items-center gap-2">
                          <EditLoanDialog
                            loan={selectedLoan}
                            properties={properties}
                            onRefresh={fetchData}
                          />
                          <DeleteLoanDialog
                            loan={selectedLoan}
                            onRefresh={fetchData}
                          />
                        </div>
                      </div>

                      {/* Detail-Leiste mit Darlehensstart und Zinsbindungsende */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-3 mt-2 border-t border-border/50 text-xs">
                        <div className="p-2 rounded bg-secondary/50">
                          <span className="text-muted-foreground block text-[10px] uppercase font-medium">
                            Darlehensstart
                          </span>
                          <span className="font-semibold text-sm">
                            {formatDate(selectedLoan.startDate)}
                          </span>
                        </div>
                        <div className="p-2 rounded bg-secondary/50">
                          <span className="text-muted-foreground block text-[10px] uppercase font-medium">
                            Zinsbindungsende
                          </span>
                          <span className="font-semibold text-sm">
                            {formatDate(selectedLoan.fixedRateEnd)}
                          </span>
                        </div>
                        <div className="p-2 rounded bg-secondary/50">
                          <span className="text-muted-foreground block text-[10px] uppercase font-medium">
                            Aktuelle Restschuld
                          </span>
                          <span className="font-bold text-sm text-primary font-mono">
                            {formatCurrency(selectedLoan.currentBalance)}
                          </span>
                        </div>
                        <div className="p-2 rounded bg-secondary/50">
                          <span className="text-muted-foreground block text-[10px] uppercase font-medium">
                            Getilgt bisher
                          </span>
                          <span className="font-bold text-sm text-green-500 font-mono">
                            {formatCurrency(
                              selectedLoan.originalAmount - selectedLoan.currentBalance
                            )}
                          </span>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-2">
                        Verlauf Zins vs. Tilgung (Letzte Monate)
                      </h4>
                      {mounted ? (
                        <ResponsiveContainer width="100%" height={220}>
                          <BarChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                            <XAxis
                              dataKey="period"
                              tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                              tickLine={false}
                              axisLine={false}
                            />
                            <YAxis
                              tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                              tickLine={false}
                              axisLine={false}
                              tickFormatter={(v) => formatCompactCurrency(v)}
                            />
                            <Tooltip
                              formatter={(v: number, name: string) => [formatCurrency(Number(v) || 0), name]}
                              contentStyle={{
                                backgroundColor: "hsl(var(--card))",
                                borderColor: "hsl(var(--border))",
                                borderRadius: "8px",
                                fontSize: "12px",
                                color: "hsl(var(--foreground))",
                              }}
                              itemStyle={{ color: "hsl(var(--foreground))" }}
                              labelStyle={{ color: "hsl(var(--foreground))", fontWeight: 600 }}
                            />
                            <Legend wrapperStyle={{ fontSize: "12px" }} />
                            <Bar dataKey="Zinsen" stackId="a" fill="#ef4444" radius={[0, 0, 0, 0]} />
                            <Bar dataKey="Tilgung" stackId="a" fill="#22c55e" radius={[4, 4, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="h-[220px] w-full bg-muted/20 animate-pulse rounded-lg flex items-center justify-center text-xs text-muted-foreground">
                          Lade Diagramm...
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Tilgungsplan-Tabelle */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Tilgungsplan Verlauf</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Periode</TableHead>
                            <TableHead className="text-right">Restschuld Anfang</TableHead>
                            <TableHead className="text-right text-red-400">Zinsanteil</TableHead>
                            <TableHead className="text-right text-green-500">Tilgungsanteil</TableHead>
                            <TableHead className="text-right">Restschuld Ende</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {selectedLoan.amortizations && selectedLoan.amortizations.length > 0 ? (
                            selectedLoan.amortizations.slice(0, 12).map((a) => (
                              <TableRow key={a.period}>
                                <TableCell className="font-mono text-sm">{a.period}</TableCell>
                                <TableCell className="text-right text-sm">
                                  {formatCurrency(a.balanceBefore)}
                                </TableCell>
                                <TableCell className="text-right text-sm text-red-400 font-mono">
                                  {formatCurrency(a.interestPart)}
                                </TableCell>
                                <TableCell className="text-right text-sm text-green-500 font-mono">
                                  {formatCurrency(a.principalPart)}
                                </TableCell>
                                <TableCell className="text-right text-sm font-medium font-mono">
                                  {formatCurrency(a.balanceAfter)}
                                </TableCell>
                              </TableRow>
                            ))
                          ) : (
                            <TableRow>
                              <TableCell colSpan={5} className="text-center py-4 text-xs text-muted-foreground">
                                Noch keine monatlichen Tilgungsbuchungen protokolliert.
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                </>
              ) : (
                <Card className="text-center py-16">
                  <CardContent>
                    <p className="text-sm text-muted-foreground">
                      Wählen Sie ein Darlehen aus der linken Liste, um Details und Tilgungsverlauf anzuzeigen.
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </TabsContent>

        {/* Sondertilgungs-Tracker Tab */}
        <TabsContent value="sondertilgung" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <PiggyBank className="h-5 w-5 text-primary" />
                Sondertilgungs-Kontingente (Kalenderjahr 2026)
              </CardTitle>
              <CardDescription>
                Vereinbartes Recht auf kostenfreie Sondertilgung (typisch 5% p.a. der ursprünglichen Kreditsumme)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Darlehen</TableHead>
                    <TableHead>Bank</TableHead>
                    <TableHead className="text-right">Urspr. Kreditsumme</TableHead>
                    <TableHead className="text-right">Kontingent (5% p.a.)</TableHead>
                    <TableHead className="text-right">Ausgeschöpft</TableHead>
                    <TableHead className="text-right">Verfügbar 2026</TableHead>
                    <TableHead className="w-40">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loans.map((loan) => {
                    const annualLimit = loan.originalAmount * 0.05; // 5% Sondertilgung
                    const used = 0; // 0 € genutzt im aktuellen Jahr
                    const available = annualLimit - used;
                    const percent = (used / annualLimit) * 100;

                    return (
                      <TableRow key={loan.id}>
                        <TableCell className="font-semibold text-sm">
                          <div>{loan.property?.name || "–"}</div>
                          <div className="text-xs text-muted-foreground">{loan.label}</div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{loan.bank || "–"}</TableCell>
                        <TableCell className="text-right text-sm font-mono">{formatCurrency(loan.originalAmount)}</TableCell>
                        <TableCell className="text-right text-sm font-semibold text-primary font-mono">
                          {formatCurrency(annualLimit)}
                        </TableCell>
                        <TableCell className="text-right text-sm font-mono text-muted-foreground">
                          {formatCurrency(used)}
                        </TableCell>
                        <TableCell className="text-right text-sm font-bold text-green-500 font-mono">
                          {formatCurrency(available)}
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <div className="flex justify-between text-[11px] text-muted-foreground">
                              <span>100% frei</span>
                              <span className="text-green-500 font-medium">Volles Kontingent</span>
                            </div>
                            <Progress value={percent} className="h-1.5" />
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>

              <div className="p-4 rounded-xl bg-secondary/40 text-xs text-muted-foreground mt-4 space-y-1.5">
                <div className="flex items-center gap-2 font-semibold text-foreground">
                  <ShieldCheck className="h-4 w-4 text-green-500" />
                  Sondertilgungspotenzial für das Portfolio gesamt:
                </div>
                <p>
                  Im Kalenderjahr 2026 stehen insgesamt bis zu{" "}
                  <strong className="text-foreground">{formatCurrency(totalOriginal * 0.05)}</strong> an
                  Sondertilgungen zur Verfügung. Durch eine vollständige Ausschöpfung sparen Sie ca.{" "}
                  <strong className="text-foreground">{formatCurrency((totalOriginal * 0.05) * 0.028)}</strong> Zinsen pro Folgejahr!
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Echter Netto-Cashflow Tab */}
        <TabsContent value="cashflow" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Wallet className="h-5 w-5 text-primary" />
                Detaillierte Netto-Cashflow-Gegenüberstellung je Objekt
              </CardTitle>
              <CardDescription>
                Kaltmiete abzüglich Darlehensrate (Zins & Tilgung) = Operativer Cashflow, abzüglich Instandhaltungsrücklage und nicht-umlagefähiger Kosten = Echter Netto-Cashflow
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Wohnung</TableHead>
                    <TableHead className="text-right text-green-500">Kaltmiete (Soll)</TableHead>
                    <TableHead className="text-right text-red-400">Darlehensrate</TableHead>
                    <TableHead className="text-right text-emerald-600 dark:text-emerald-400">Operativer Cashflow</TableHead>
                    <TableHead className="text-right text-amber-500">Instandhaltung</TableHead>
                    <TableHead className="text-right text-muted-foreground">
                      <div className="inline-flex items-center gap-1.5 justify-end">
                        <span>Nicht-umlagef. Kosten</span>
                        <NonRecoverableInfoDialog />
                      </div>
                    </TableHead>
                    <TableHead className="text-right font-bold">Echter Netto-Cashflow</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {properties.map((prop) => {
                    const coldRent = prop.tenant?.coldRent || 0;
                    const propLoans = loans.filter((l) => l.propertyId === prop.id);
                    const loanRate = propLoans.reduce((s, l) => s + l.monthlyPayment, 0);
                    const isCustomReserve = prop.maintenanceReserve != null && prop.maintenanceReserve > 0;
                    const reserve = isCustomReserve ? prop.maintenanceReserve! : prop.sqm * 1.20;
                    const isCustomNonRecoverable = prop.nonRecoverableCosts != null && prop.nonRecoverableCosts > 0;
                    const nonRecoverable = isCustomNonRecoverable ? prop.nonRecoverableCosts! : (prop.sqm * 0.35 + 25);
                    const operative = coldRent - loanRate;
                    const netCashflow = coldRent - loanRate - reserve - nonRecoverable;

                    return (
                      <TableRow key={prop.id}>
                        <TableCell className="font-semibold text-sm">
                          <div>{prop.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {prop.sqm} m² ·{" "}
                            {prop.tenant
                              ? `${prop.tenant.firstName} ${prop.tenant.lastName}`
                              : "Leerstand"}
                          </div>
                        </TableCell>
                        <TableCell className="text-right text-sm font-semibold text-green-500 font-mono">
                          +{formatCurrency(coldRent)}
                        </TableCell>
                        <TableCell className="text-right text-sm font-mono text-red-400">
                          -{formatCurrency(loanRate)}
                        </TableCell>
                        <TableCell className={`text-right text-sm font-semibold font-mono ${operative >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-500"}`}>
                          {operative >= 0 ? "+" : ""}{formatCurrency(operative)}
                        </TableCell>
                        <TableCell className="text-right text-sm font-mono text-amber-500">
                          <div>-{formatCurrency(reserve)}</div>
                          <Badge variant={isCustomReserve ? "secondary" : "outline"} className="text-[9px] h-3.5 px-1 font-sans">
                            {isCustomReserve ? "Individuell" : "1,20 €/m²"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right text-sm font-mono text-muted-foreground">
                          <div>-{formatCurrency(nonRecoverable)}</div>
                          <Badge variant={isCustomNonRecoverable ? "secondary" : "outline"} className="text-[9px] h-3.5 px-1 font-sans">
                            {isCustomNonRecoverable ? "Individuell" : "Pauschale"}
                          </Badge>
                        </TableCell>
                        <TableCell
                          className={`text-right text-sm font-bold font-mono ${
                            netCashflow >= 0 ? "text-green-500" : "text-red-500"
                          }`}
                        >
                          {netCashflow >= 0 ? "+" : ""}
                          {formatCurrency(netCashflow)}/Mo
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  <TableRow className="bg-secondary/40 font-bold border-t-2">
                    <TableCell>Portfolio Gesamt</TableCell>
                    <TableCell className="text-right text-green-500 font-mono">
                      +{formatCurrency(totalColdRent)}
                    </TableCell>
                    <TableCell className="text-right text-red-400 font-mono">
                      -{formatCurrency(totalLoanRate)}
                    </TableCell>
                    <TableCell className={`text-right font-mono ${totalOperativeCashflow >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-500"}`}>
                      {totalOperativeCashflow >= 0 ? "+" : ""}{formatCurrency(totalOperativeCashflow)}
                    </TableCell>
                    <TableCell className="text-right text-amber-500 font-mono">
                      -{formatCurrency(totalReserves)}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground font-mono">
                      -{formatCurrency(totalNonRecoverable)}
                    </TableCell>
                    <TableCell
                      className={`text-right font-mono text-base ${
                        totalNetCashflow >= 0 ? "text-green-500" : "text-red-500"
                      }`}
                    >
                      {totalNetCashflow >= 0 ? "+" : ""}
                      {formatCurrency(totalNetCashflow)}/Mo
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                <div className="p-3.5 rounded-xl bg-secondary/30 border border-border/50 text-xs space-y-1">
                  <span className="font-semibold text-foreground flex items-center gap-1.5">
                    <Wallet className="h-4 w-4 text-emerald-500" /> Operativer Cashflow vs. Echter Netto-Cashflow
                  </span>
                  <p className="text-muted-foreground leading-relaxed">
                    Der <strong>operative Cashflow</strong> ({formatCurrency(totalOperativeCashflow)}) zeigt den monatlichen Mietüberschuss nach Abzug der Darlehensannuitäten.
                    Der <strong>echte Netto-Cashflow</strong> ({formatCurrency(totalNetCashflow)}) zieht zusätzlich reale Rücklagen ({formatCurrency(totalReserves)}) und nicht-umlagefähige Betriebskosten ({formatCurrency(totalNonRecoverable)}) ab.
                  </p>
                </div>
                <div className="p-3.5 rounded-xl bg-secondary/30 border border-border/50 text-xs space-y-1">
                  <span className="font-semibold text-foreground flex items-center gap-1.5">
                    <Sparkles className="h-4 w-4 text-primary" /> Eigene Kostenwerte hinterlegen
                  </span>
                  <p className="text-muted-foreground leading-relaxed">
                    Sie können für jede Wohnung die tatsächlichen monatlichen <strong>nicht-umlagefähigen Kosten</strong> (z.B. laut WEG-Wirtschaftsplan) und die eigene <strong>Instandhaltungsrücklage</strong> direkt unter <strong className="text-foreground">Wohnungen & Mieter</strong> (✏️ Bearbeiten) hinterlegen. Liegt kein Wert vor, wird die standardmäßige Pauschale herangezogen.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Volltilger & Refinanzierungsrechner Tab */}
        <TabsContent value="volltilger" className="mt-4">
          <VolltilgerCalculator
            loans={loans}
            properties={properties}
            initialLoanId={selectedVolltilgerLoanId}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default function KreditePage() {
  return (
    <Suspense
      fallback={
        <div className="p-6 space-y-4">
          <div className="h-8 w-64 bg-muted/30 animate-pulse rounded" />
          <div className="h-32 w-full bg-muted/20 animate-pulse rounded-xl" />
        </div>
      }
    >
      <KrediteContent />
    </Suspense>
  );
}
