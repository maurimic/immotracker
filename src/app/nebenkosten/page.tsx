"use client";

import { useEffect, useState } from "react";
import {
  FileBarChart, Calculator, Euro, Building2, Download,
  Printer, CheckCircle, AlertCircle, FileText, ArrowRight,
  Plus, Trash2, Edit, AlertTriangle
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatCurrency, formatDate } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

interface UtilityBill {
  id: string;
  bookingDate: string;
  amount: number;
  vendor: string;
  category: string;
  isAllocatable: boolean;
  period?: string;
  description?: string;
  propertyId?: string | null;
  property?: { name: string } | null;
}

interface Property {
  id: string;
  name: string;
}

interface StatementItem {
  property: string;
  tenant: string;
  sqm: number;
  share: string;
  totalCosts: number;
  prepayments: number;
  balance: number;
}

const CATEGORY_LABEL: Record<string, string> = {
  HEATING: "Heizung & Warmwasser",
  WATER: "Kaltwasser & Abwasser",
  ELECTRICITY: "Allgemeinstrom & Treppenhaus",
  INSURANCE: "Gebäude- & Haftpflichtversicherung",
  TRASH: "Müllabfuhr & Straßenreinigung",
  CHIMNEY: "Schornsteinfeger & Immissionsmessung",
  OTHER: "Sonstige Betriebskosten gem. § 2 BetrKV",
};

const CATEGORY_ICON: Record<string, string> = {
  HEATING: "🔥",
  WATER: "💧",
  ELECTRICITY: "⚡",
  INSURANCE: "🛡️",
  TRASH: "🗑️",
  CHIMNEY: "🧹",
  OTHER: "📋",
};

// ─── Rechnung anlegen Dialog ──────────────────────────────────────────────────
function AddUtilityBillDialog({
  properties,
  defaultPeriod,
  onRefresh,
}: {
  properties: Property[];
  defaultPeriod: string;
  onRefresh: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const today = new Date().toISOString().slice(0, 10);

  const [form, setForm] = useState({
    vendor: "",
    amount: "",
    category: "HEATING",
    bookingDate: today,
    period: defaultPeriod,
    isAllocatable: true,
    propertyId: "ALL",
    description: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/utility-bills", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vendor: form.vendor,
          amount: parseFloat(form.amount),
          category: form.category,
          bookingDate: form.bookingDate,
          period: form.period,
          isAllocatable: form.isAllocatable,
          propertyId: form.propertyId === "ALL" ? null : form.propertyId,
          description: form.description || null,
        }),
      });

      if (res.ok) {
        toast({ title: "Rechnung erfasst", description: `${form.vendor} über ${formatCurrency(parseFloat(form.amount))} gespeichert.` });
        setOpen(false);
        setForm({
          vendor: "",
          amount: "",
          category: "HEATING",
          bookingDate: today,
          period: defaultPeriod,
          isAllocatable: true,
          propertyId: "ALL",
          description: "",
        });
        onRefresh();
      } else {
        const err = await res.json();
        toast({ title: "Fehler beim Erfassen", description: err.error || "Bitte Angaben prüfen", variant: "destructive" });
      }
    } catch {
      toast({ title: "Verbindungsfehler", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1.5 shadow-sm">
          <Plus className="h-4 w-4" /> Neue Rechnung erfassen
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Betriebskosten-Rechnung erfassen</DialogTitle>
          <DialogDescription>
            Erfassen Sie Lieferantenrechnungen für die jährliche Nebenkostenabrechnung.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3.5 pt-2">
          <div className="space-y-1">
            <Label className="text-xs">Versorger / Dienstleister *</Label>
            <Input
              placeholder="z.B. Berliner Stadtwerke GmbH"
              value={form.vendor}
              onChange={(e) => setForm({ ...form, vendor: e.target.value })}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Rechnungsbetrag (€) *</Label>
              <Input
                type="number"
                step="0.01"
                placeholder="z.B. 1250.00"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                required
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Abrechnungsjahr *</Label>
              <Input
                type="text"
                placeholder="2026"
                value={form.period}
                onChange={(e) => setForm({ ...form, period: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Kategorie *</Label>
              <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(CATEGORY_LABEL).map(([key, label]) => (
                    <SelectItem key={key} value={key} className="text-xs">
                      {CATEGORY_ICON[key]} {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Buchungsdatum</Label>
              <Input
                type="date"
                value={form.bookingDate}
                onChange={(e) => setForm({ ...form, bookingDate: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Objekt-Zuordnung</Label>
            <Select value={form.propertyId} onValueChange={(v) => setForm({ ...form, propertyId: v })}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL" className="text-xs">Gesamte Liegenschaft (nach qm aufteilen)</SelectItem>
                {properties.map((p) => (
                  <SelectItem key={p.id} value={p.id} className="text-xs">{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2 pt-1 pb-1">
            <input
              type="checkbox"
              id="bill-allocatable"
              checked={form.isAllocatable}
              onChange={(e) => setForm({ ...form, isAllocatable: e.target.checked })}
              className="rounded border-input text-primary h-4 w-4 cursor-pointer"
            />
            <label htmlFor="bill-allocatable" className="text-xs font-medium cursor-pointer">
              Umlagefähig gem. § 2 BetrKV (wird auf Mieter umgelegt)
            </label>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Beschreibung / Belegnummer (optional)</Label>
            <Input
              placeholder="z.B. Jahresabrechnung Rechnungs-Nr. 94821"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>

          <DialogFooter className="pt-2">
            <Button variant="outline" type="button" onClick={() => setOpen(false)}>
              Abbrechen
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Speichern..." : "Rechnung erfassen"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Rechnung löschen Dialog ──────────────────────────────────────────────────
function DeleteUtilityBillDialog({
  bill,
  onRefresh,
}: {
  bill: UtilityBill;
  onRefresh: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/utility-bills/${bill.id}`, { method: "DELETE" });
      if (res.ok) {
        toast({ title: "Rechnung gelöscht" });
        setOpen(false);
        onRefresh();
      } else {
        toast({ title: "Fehler beim Löschen", variant: "destructive" });
      }
    } catch {
      toast({ title: "Verbindungsfehler", variant: "destructive" });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive">
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Rechnung löschen?
          </DialogTitle>
          <DialogDescription>
            Soll die Rechnung von <strong>{bill.vendor}</strong> ({formatCurrency(bill.amount)}) wirklich gelöscht werden?
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-0 pt-2">
          <Button variant="outline" onClick={() => setOpen(false)} disabled={deleting}>
            Abbrechen
          </Button>
          <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
            {deleting ? "Wird gelöscht..." : "Löschen"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function NebenkostenPage() {
  const [bills, setBills] = useState<UtilityBill[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState("2025");
  const [generating, setGenerating] = useState(false);
  const [statements, setStatements] = useState<StatementItem[]>([]);

  const fetchData = async () => {
    try {
      const [billsRes, propsRes] = await Promise.all([
        fetch("/api/utility-bills"),
        fetch("/api/properties"),
      ]);
      if (billsRes.ok) setBills(await billsRes.json());
      if (propsRes.ok) {
        const propsData = await propsRes.json();
        setProperties(propsData.map((p: any) => ({ id: p.id, name: p.name })));
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

  const generateStatements = async () => {
    setGenerating(true);
    try {
      const res = await fetch(`/api/utility-bills/statement?period=${period}`, { method: "POST" });
      const data = await res.json();
      setGenerating(false);

      if (res.ok && data.statements) {
        setStatements(data.statements);
        toast({
          title: "Nebenkostenabrechnungen berechnet",
          description: `${data.statements.length} Einzelabrechnungen für das Jahr ${period} erfolgreich erstellt.`,
        });
      } else {
        toast({ title: "Hinweis", description: data.error || "Keine umlegbaren Kosten gefunden", variant: "destructive" });
      }
    } catch {
      setGenerating(false);
      toast({ title: "Fehler", description: "Verbindungsfehler beim Erstellen", variant: "destructive" });
    }
  };

  const printTenantStatement = (st: StatementItem) => {
    const win = window.open("", "_blank");
    if (!win) return;
    const isCredit = st.balance >= 0;

    win.document.write(`
      <html>
        <head>
          <title>Nebenkostenabrechnung ${period} – ${st.tenant}</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 48px; color: #1a1a1a; line-height: 1.5; font-size: 13px; }
            .header { display: flex; justify-content: space-between; border-bottom: 2px solid #2563eb; padding-bottom: 16px; margin-bottom: 28px; }
            h1 { font-size: 20px; font-weight: 700; color: #1e3a8a; margin: 0 0 4px 0; }
            .sub { color: #64748b; font-size: 12px; }
            .box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px 18px; margin-bottom: 20px; }
            table { width: 100%; border-collapse: collapse; margin: 16px 0; }
            th, td { padding: 9px 12px; border-bottom: 1px solid #e2e8f0; text-align: left; }
            th { background: #f1f5f9; font-weight: 600; color: #475569; }
            .right { text-align: right; }
            .total-row { font-weight: bold; background: #f8fafc; border-top: 2px solid #cbd5e1; }
            .result-box { padding: 16px 20px; border-radius: 8px; margin-top: 24px; font-size: 14px; font-weight: bold; }
            .credit { background: #ecfdf5; border: 1px solid #a7f3d0; color: #065f46; }
            .debit { background: #fef2f2; border: 1px solid #fecaca; color: #991b1b; }
            .footer { margin-top: 40px; font-size: 11px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 14px; }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <h1>Betriebskostenabrechnung ${period}</h1>
              <div class="sub">Wohnung: ${st.property} · Abrechnungszeitraum 01.01.${period} – 31.12.${period}</div>
            </div>
            <div style="text-align: right;">
              <strong>Immotracker Verwaltung</strong><br />
              Datum: ${new Date().toLocaleDateString("de-DE")}
            </div>
          </div>

          <div class="box">
            <strong>Mieter:</strong> ${st.tenant}<br />
            <strong>Wohnfläche:</strong> ${st.sqm} m² (Ihr Anteil an der Liegenschaft: <strong>${st.share}%</strong>)
          </div>

          <table>
            <thead>
              <tr>
                <th>Kostenart gem. § 2 BetrKV</th>
                <th>Verteilerschlüssel</th>
                <th class="right">Ihr Anteil</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Laufende umlagefähige Betriebskosten gesamt</td>
                <td>Wohnfläche (${st.share}%)</td>
                <td class="right">${formatCurrency(st.totalCosts)}</td>
              </tr>
              <tr class="total-row">
                <td colspan="2">Gesamtkosten für Ihre Wohnung</td>
                <td class="right">${formatCurrency(st.totalCosts)}</td>
              </tr>
              <tr>
                <td colspan="2">./. Ihre geleisteten Nebenkostenvorauszahlungen (${period})</td>
                <td class="right" style="color: #2563eb;">-${formatCurrency(st.prepayments)}</td>
              </tr>
            </tbody>
          </table>

          <div class="result-box ${isCredit ? 'credit' : 'debit'}">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span>${isCredit ? 'Abrechnungsergebnis: IHR GUTHABEN' : 'Abrechnungsergebnis: IHRE NACHZAHLUNG'}</span>
              <span style="font-size: 18px;">${formatCurrency(Math.abs(st.balance))}</span>
            </div>
            <div style="font-size: 11px; margin-top: 6px; font-weight: normal;">
              ${isCredit 
                ? 'Das Guthaben wird mit der übernächsten Miete verrechnet oder auf Ihr Bankkonto erstattet.'
                : 'Bitte überweisen Sie den Nachzahlungsbetrag innerhalb von 30 Tagen auf das angegebene Mietkonto.'}
            </div>
          </div>

          <div class="footer">
            Erstellt automatisch durch Immotracker · Rechtskonform nach HeizkostenV & § 556 BGB · Einsicht in die Originalbelege kann nach Terminabsprache gewährt werden.
          </div>
          <script>window.print();</script>
        </body>
      </html>
    `);
    win.document.close();
  };

  const filteredBills = bills.filter((b) => !b.period || b.period === period);
  const allocatable = filteredBills.filter((b) => b.isAllocatable);
  const notAllocatable = filteredBills.filter((b) => !b.isAllocatable);

  const totalAllocatable = allocatable.reduce((s, b) => s + b.amount, 0);
  const totalNotAllocatable = notAllocatable.reduce((s, b) => s + b.amount, 0);

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Nebenkosten & Betriebskostenabrechnung</h1>
          <p className="text-muted-foreground text-sm">
            Gesamtkosten-Erfassung, Umlageschlüssel & 1-Klick PDF-Abrechnungsgenerator
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground whitespace-nowrap hidden sm:inline">Abrechnungsjahr:</span>
            <Select value={period} onValueChange={(v) => { setPeriod(v); setStatements([]); }}>
              <SelectTrigger className="w-28 h-9 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {["2026", "2025", "2024", "2023"].map((y) => (
                  <SelectItem key={y} value={y}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <AddUtilityBillDialog
            properties={properties}
            defaultPeriod={period}
            onRefresh={fetchData}
          />

          <Button onClick={generateStatements} disabled={generating} className="gap-2 h-9 text-xs">
            <Calculator className={`h-4 w-4 ${generating ? "animate-spin" : ""}`} />
            {generating ? "Berechne..." : `Abrechnung ${period} berechnen`}
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground mb-1">Umlegbare Betriebskosten ({period})</p>
            <p className="text-2xl font-bold text-blue-500 font-mono">{formatCurrency(totalAllocatable)}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">{allocatable.length} Rechnungen nach BetrKV</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground mb-1">Nicht umlegbare Kosten (Eigentümer)</p>
            <p className="text-2xl font-bold text-orange-500 font-mono">{formatCurrency(totalNotAllocatable)}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">{notAllocatable.length} Rechnungen (z.B. Verwaltung)</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground mb-1">Gesamte Ausgaben Liegenschaft</p>
            <p className="text-2xl font-bold font-mono">{formatCurrency(totalAllocatable + totalNotAllocatable)}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">{filteredBills.length} Buchungen gesamt</p>
          </CardContent>
        </Card>
      </div>

      {/* Berechnete Abrechnungsergebnisse (sofern generiert) */}
      {statements.length > 0 && (
        <Card className="border-2 border-primary/30 shadow-md">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  Fertige Einzel-Nebenkostenabrechnungen ({period})
                </CardTitle>
                <CardDescription>
                  Rechtskonform nach Wohnflächenanteil (qm) berechnet inkl. Vorauszahlungsabgleich
                </CardDescription>
              </div>
              <Badge variant="success" className="text-xs">
                {statements.length} Einheiten berechnet
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Wohnung</TableHead>
                  <TableHead>Mieter</TableHead>
                  <TableHead className="text-right">Flächenanteil</TableHead>
                  <TableHead className="text-right">Kostenanteil</TableHead>
                  <TableHead className="text-right">Geleistete VZ</TableHead>
                  <TableHead className="text-right">Saldo (Guthaben / Nachzahlung)</TableHead>
                  <TableHead className="text-right">Abrechnung</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {statements.map((st) => {
                  const isCredit = st.balance >= 0;
                  return (
                    <TableRow key={st.property}>
                      <TableCell className="font-semibold text-sm">{st.property}</TableCell>
                      <TableCell className="text-sm font-medium">{st.tenant}</TableCell>
                      <TableCell className="text-right text-sm">
                        {st.sqm} m² <span className="text-xs text-muted-foreground">({st.share}%)</span>
                      </TableCell>
                      <TableCell className="text-right text-sm font-semibold">{formatCurrency(st.totalCosts)}</TableCell>
                      <TableCell className="text-right text-sm font-mono text-muted-foreground">{formatCurrency(st.prepayments)}</TableCell>
                      <TableCell className={`text-right text-sm font-bold font-mono ${isCredit ? "text-green-500" : "text-red-500"}`}>
                        {isCredit ? "+" : ""}{formatCurrency(st.balance)}
                        <span className="block text-[11px] font-normal">
                          {isCredit ? "Guthaben" : "Nachzahlung"}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 text-xs gap-1.5"
                          onClick={() => printTenantStatement(st)}
                        >
                          <Printer className="h-3.5 w-3.5" />
                          PDF drucken
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Erfasste Betriebskosten-Rechnungen */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Erfasste Betriebskosten-Buchungen {period}</CardTitle>
              <CardDescription>
                Heizung, Wasser, Versicherung, Müllabfuhr, Allgemeinstrom und sonstige Dienstleister
              </CardDescription>
            </div>
            <Badge variant="outline" className="text-xs font-mono">
              {filteredBills.length} Rechnung{filteredBills.length !== 1 ? "en" : ""}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4].map((i) => <div key={i} className="h-12 skeleton rounded-lg" />)}
            </div>
          ) : filteredBills.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <FileBarChart className="h-12 w-12 mx-auto mb-3 opacity-40" />
              <p className="text-sm font-medium">Keine Buchungen für das Jahr {period} vorhanden.</p>
              <p className="text-xs mt-1">Erfassen Sie eine neue Rechnung über den Button oben oder wählen Sie ein anderes Jahr.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Buchungsdatum</TableHead>
                  <TableHead>Versorger / Dienstleister</TableHead>
                  <TableHead>Kategorie</TableHead>
                  <TableHead className="text-right">Rechnungsbetrag</TableHead>
                  <TableHead>Umlagefähig</TableHead>
                  <TableHead>Zuordnung</TableHead>
                  <TableHead className="w-16 text-center">Aktion</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredBills.map((bill) => (
                  <TableRow key={bill.id}>
                    <TableCell className="text-sm text-muted-foreground font-mono">
                      {formatDate(bill.bookingDate)}
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="text-sm font-semibold">{bill.vendor}</p>
                        {bill.description && (
                          <p className="text-xs text-muted-foreground">{bill.description}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm font-medium">
                        {CATEGORY_ICON[bill.category] || "📋"} {CATEGORY_LABEL[bill.category] || bill.category}
                      </span>
                    </TableCell>
                    <TableCell className="text-right font-semibold text-sm text-foreground font-mono">
                      {formatCurrency(bill.amount)}
                    </TableCell>
                    <TableCell>
                      {bill.isAllocatable ? (
                        <Badge variant="success" className="text-xs">Ja (BetrKV)</Badge>
                      ) : (
                        <Badge variant="secondary" className="text-xs">Nein (Eigentümer)</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {bill.property?.name || "Gesamte Liegenschaft"}
                    </TableCell>
                    <TableCell className="text-center">
                      <DeleteUtilityBillDialog bill={bill} onRefresh={fetchData} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
