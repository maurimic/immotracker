"use client";

import { useEffect, useState, useRef } from "react";
import {
  FileBarChart, Calculator, Euro, Building2, Download,
  Printer, CheckCircle, AlertCircle, FileText, ArrowRight,
  Plus, Trash2, Edit, AlertTriangle, Sparkles, Upload, FileUp,
  RefreshCw, Check, HelpCircle, Calendar, User, Home, Shield,
  Receipt, ArrowDownRight, ArrowUpRight
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { DateInput } from "@/components/ui/date-input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatCurrency, formatDate } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

// ─── Typdefinitionen ──────────────────────────────────────────────────────────

interface StatementLineItem {
  id?: string;
  category: string;
  name?: string;
  totalCost: number;
  share?: number;
  distributionKey?: string;
  amount: number;
}

interface SavedStatement {
  id: string;
  propertyId: string;
  property?: {
    id: string;
    name: string;
    address: string;
    unitNumber?: string | null;
    sqm: number;
    unitDetails?: any;
  } | null;
  subUnitKey?: string | null;
  tenantName?: string | null;
  tenantAddress?: string | null;
  sqm?: number | null;
  period: string;
  totalCosts: number;
  prepayments: number;
  balance: number;
  notes?: string | null;
  detailsJson?: string | null;
  generatedAt: string;
  lineItems: StatementLineItem[];
}

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
  address: string;
  unitNumber?: string | null;
  sqm: number;
  unitDetails?: any;
  tenant?: {
    firstName: string;
    lastName: string;
    utilities: number;
  } | null;
}

const CATEGORY_LABEL: Record<string, string> = {
  HEATING: "Heizung & Warmwasser",
  WATER: "Wasser & Abwasser",
  TRASH: "Müll & Straßenreinigung",
  INSURANCE: "Gebäude- & Haftpflichtversicherung",
  ELECTRICITY: "Allgemeinstrom",
  CHIMNEY: "Schornsteinfeger",
  CLEANING: "Gebäudereinigung",
  GARDENING: "Gartenpflege",
  CARETAKER: "Hausmeister",
  ELEVATOR: "Aufzug",
  CABLE: "Kabelanschluss & Antenne",
  PROPERTY_TAX: "Grundsteuer B",
  OTHER: "Sonstige Betriebskosten",
};

const CATEGORY_ICON: Record<string, string> = {
  HEATING: "🔥",
  WATER: "💧",
  TRASH: "🗑️",
  INSURANCE: "🛡️",
  ELECTRICITY: "⚡",
  CHIMNEY: "🧹",
  CLEANING: "🧼",
  GARDENING: "🌿",
  CARETAKER: "🔧",
  ELEVATOR: "🛗",
  CABLE: "📺",
  PROPERTY_TAX: "🏛️",
  OTHER: "📋",
};

// ─── Hilfsfunktionen für Untereinheiten ──────────────────────────────────────

interface FlatTargetOption {
  id: string; // z.B. "cmv...|MAIN" oder "cmv...|WE5"
  propertyId: string;
  subUnitKey?: string;
  displayName: string;
  unitNumber: string;
  sqm: number;
  tenantName: string;
  defaultMonthlyPrepayment: number;
}

function buildTargetOptions(properties: Property[]): FlatTargetOption[] {
  const options: FlatTargetOption[] = [];

  for (const p of properties) {
    if (p.unitDetails) {
      try {
        const uObj = typeof p.unitDetails === "string" ? JSON.parse(p.unitDetails) : p.unitDetails;
        const subEntries = Object.entries<any>(uObj);
        if (subEntries.length > 0) {
          for (const [key, sub] of subEntries) {
            const subName = sub.name || `${p.name} (${sub.unitNumber || key})`;
            const subSqm = sub.sqm || sub.rentSqm || (p.sqm / subEntries.length);
            const subPrepayment = Number(sub.utilities) ||
              ((Number(sub.operatingCosts) || 0) + (Number(sub.heating) || 0)) ||
              (p.tenant?.utilities ? p.tenant.utilities / subEntries.length : 0);

            options.push({
              id: `${p.id}|${key}`,
              propertyId: p.id,
              subUnitKey: key,
              displayName: `${p.name} – ${sub.unitNumber || key} (${sub.floor || "Untereinheit"}, ${subSqm} m²)`,
              unitNumber: sub.unitNumber || key,
              sqm: subSqm,
              tenantName: p.tenant ? `${p.tenant.firstName} ${p.tenant.lastName}` : "Mieter",
              defaultMonthlyPrepayment: subPrepayment,
            });
          }
          continue;
        }
      } catch (err) {
        console.error("Failed to parse unitDetails for targets", err);
      }
    }

    // Standard-Wohnung ohne Verbund
    options.push({
      id: `${p.id}|MAIN`,
      propertyId: p.id,
      displayName: `${p.name} (${p.unitNumber || "WE"}, ${p.sqm} m²)`,
      unitNumber: p.unitNumber || "WE",
      sqm: p.sqm,
      tenantName: p.tenant ? `${p.tenant.firstName} ${p.tenant.lastName}` : "Mieter",
      defaultMonthlyPrepayment: p.tenant?.utilities || 0,
    });
  }

  return options;
}

// ─── PDF-Druckfunktion (DIN 5008 Rechtskonforme Mieter-Abrechnung) ─────────────

function printTenantUtilityStatement(st: SavedStatement) {
  const win = window.open("", "_blank");
  if (!win) return;

  const isCredit = st.balance >= 0;
  const prop = st.property;
  const address = st.tenantAddress || prop?.address || "Musteradresse";
  const unitLabel = st.subUnitKey
    ? `${prop?.name || "Wohnung"} – Untereinheit ${st.subUnitKey}`
    : `${prop?.name || "Wohnung"} (${prop?.unitNumber || "WE"})`;

  const details = st.detailsJson ? JSON.parse(st.detailsJson) : {};
  const landlordName = details.landlordName || "Immotracker Verwaltung / Vermieter";
  const landlordIban = details.landlordIban || "";
  const paymentDeadlineDays = details.paymentDeadlineDays || 30;

  const rowsHtml = (st.lineItems || []).map((it, idx) => {
    const icon = CATEGORY_ICON[it.category] || "📋";
    const label = it.name || CATEGORY_LABEL[it.category] || "Betriebskosten";
    const key = it.distributionKey || "Wohnfläche (m²)";
    const total = it.totalCost > 0 ? formatCurrency(it.totalCost) : "-";
    const amount = formatCurrency(it.amount);

    return `
      <tr>
        <td style="text-align: center; color: #64748b;">${idx + 1}</td>
        <td><strong>${icon} ${label}</strong></td>
        <td style="text-align: right; color: #475569;">${total}</td>
        <td style="text-align: center; color: #475569;">${key}</td>
        <td style="text-align: right; font-weight: 600;">${amount}</td>
      </tr>
    `;
  }).join("");

  win.document.write(`
    <!DOCTYPE html>
    <html lang="de">
      <head>
        <meta charset="utf-8" />
        <title>Betriebskostenabrechnung ${st.period} – ${st.tenantName || "Mieter"}</title>
        <style>
          @page { size: A4 portrait; margin: 20mm 15mm 20mm 15mm; }
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            color: #1e293b;
            line-height: 1.45;
            font-size: 12.5px;
            margin: 0;
            padding: 0;
          }
          .sender-line {
            font-size: 10px;
            color: #64748b;
            border-bottom: 1px solid #cbd5e1;
            padding-bottom: 4px;
            margin-bottom: 24px;
          }
          .recipient-box {
            margin-bottom: 30px;
            min-height: 70px;
          }
          .date-row {
            text-align: right;
            color: #475569;
            margin-bottom: 20px;
            font-size: 12px;
          }
          .title {
            font-size: 18px;
            font-weight: 800;
            color: #0f172a;
            margin: 0 0 6px 0;
          }
          .subtitle {
            font-size: 12px;
            color: #475569;
            margin-bottom: 18px;
          }
          .meta-box {
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 6px;
            padding: 12px 16px;
            margin-bottom: 22px;
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 8px;
            font-size: 12px;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 22px;
            font-size: 12px;
          }
          th {
            background: #f1f5f9;
            color: #334155;
            font-weight: 600;
            padding: 8px 10px;
            border-bottom: 2px solid #cbd5e1;
            text-align: left;
          }
          td {
            padding: 7px 10px;
            border-bottom: 1px solid #e2e8f0;
          }
          .total-row td {
            background: #f8fafc;
            font-weight: bold;
            border-top: 2px solid #94a3b8;
            border-bottom: 2px solid #94a3b8;
            font-size: 12.5px;
          }
          .result-container {
            border-radius: 8px;
            padding: 16px 20px;
            margin-bottom: 25px;
            border: 1.5px solid ${isCredit ? "#10b981" : "#ef4444"};
            background: ${isCredit ? "#f0fdf4" : "#fef2f2"};
          }
          .result-title {
            font-size: 14px;
            font-weight: 700;
            color: ${isCredit ? "#15803d" : "#b91c1c"};
            display: flex;
            justify-content: space-between;
            align-items: center;
          }
          .result-amount {
            font-size: 20px;
            font-weight: 800;
          }
          .result-desc {
            font-size: 11.5px;
            color: #334155;
            margin-top: 6px;
          }
          .legal-notice {
            font-size: 10.5px;
            color: #64748b;
            border-top: 1px solid #e2e8f0;
            padding-top: 14px;
            margin-top: 25px;
            line-height: 1.5;
          }
          .signature-box {
            margin-top: 35px;
            display: flex;
            justify-content: space-between;
          }
          @media print {
            body { padding: 0; }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="sender-line">
          ${landlordName} · Vermietung & Hausverwaltung
        </div>

        <div style="display: flex; justify-content: space-between; align-items: flex-start;">
          <div class="recipient-box">
            <strong>${st.tenantName || "Mieter"}</strong><br />
            ${address}<br />
            ${unitLabel}
          </div>
          <div class="date-row">
            Datum: ${new Date().toLocaleDateString("de-DE")}
          </div>
        </div>

        <div class="title">Betriebskostenabrechnung für das Jahr ${st.period}</div>
        <div class="subtitle">
          Abrechnung der umlagefähigen Betriebskosten gem. § 2 BetrKV und Heizkostenverordnung (HeizkostenV)
        </div>

        <div class="meta-box">
          <div>
            <strong>Mietobjekt:</strong> ${address}<br />
            <strong>Wohneinheit:</strong> ${unitLabel}<br />
            <strong>Wohnfläche:</strong> ${st.sqm || prop?.sqm || "-"} m²
          </div>
          <div>
            <strong>Abrechnungszeitraum:</strong> 01.01.${st.period} – 31.12.${st.period}<br />
            <strong>Erstellt am:</strong> ${new Date(st.generatedAt).toLocaleDateString("de-DE")}<br />
            <strong>Grundlage:</strong> Abrechnung der Liegenschaftsverwaltung
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width: 30px; text-align: center;">Pos.</th>
              <th>Kostenart gem. § 2 BetrKV</th>
              <th style="text-align: right;">Gesamtkosten Liegenschaft</th>
              <th style="text-align: center;">Verteilerschlüssel</th>
              <th style="text-align: right;">Ihr Anteil</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
            <tr class="total-row">
              <td colspan="4" style="text-align: right;">Ihre Gesamtkosten für den Abrechnungszeitraum:</td>
              <td style="text-align: right;">${formatCurrency(st.totalCosts)}</td>
            </tr>
            <tr>
              <td colspan="4" style="text-align: right; color: #2563eb;">
                ./. Ihre im Abrechnungsjahr ${st.period} geleisteten Vorauszahlungen:
              </td>
              <td style="text-align: right; color: #2563eb; font-weight: bold;">
                - ${formatCurrency(st.prepayments)}
              </td>
            </tr>
          </tbody>
        </table>

        <div class="result-container">
          <div class="result-title">
            <span>${isCredit ? "Abrechnungsergebnis: IHR GUTHABEN" : "Abrechnungsergebnis: IHRE NACHZAHLUNG"}</span>
            <span class="result-amount">${formatCurrency(Math.abs(st.balance))}</span>
          </div>
          <div class="result-desc">
            ${isCredit
              ? "Das Guthaben wird mit der übernächsten Monatsmiete verrechnet oder auf Ihr Bankkonto überwiesen."
              : `Bitte überweisen Sie den Nachzahlungsbetrag in Höhe von <strong>${formatCurrency(Math.abs(st.balance))}</strong> innerhalb von ${paymentDeadlineDays} Tagen (bis zum ${new Date(Date.now() + paymentDeadlineDays * 86400000).toLocaleDateString("de-DE")})${landlordIban ? ` auf das Konto <strong>${landlordIban}</strong>` : " auf das gewohnte Mietkonto"}.`
            }
          </div>
        </div>

        <div class="legal-notice">
          <strong>Rechtlicher Hinweis:</strong> Diese Abrechnung wurde auf Basis der von der Hausverwaltung vorgelegten Jahresabrechnung erstellt. 
          Gemäß § 556 Abs. 3 BGB kann der Mieter innerhalb einer Frist von 12 Monaten nach Zugang dieser Abrechnung Einwendungen erheben. 
          Einsicht in die Originalbelege der Liegenschaft kann nach vorheriger Terminabsprache gewährt werden.
        </div>

        <div class="signature-box">
          <div>
            Mit freundlichen Grüßen,<br /><br /><br />
            _______________________________<br />
            ${landlordName}
          </div>
        </div>

        <script>
          window.onload = function() {
            window.print();
          };
        </script>
      </body>
    </html>
  `);
  win.document.close();
}

// ─── Dialog: PDF der Hausverwaltung hochladen (KI-Extraktion) ──────────────────

function UploadUtilityPdfModal({
  properties,
  onParsed,
}: {
  properties: Property[];
  onParsed: (data: any) => void;
}) {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [selectedTarget, setSelectedTarget] = useState<string>("AUTO");
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const targets = buildTargetOptions(properties);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      toast({ title: "Keine Datei gewählt", description: "Bitte wählen Sie ein PDF aus.", variant: "destructive" });
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      if (selectedTarget !== "AUTO") {
        const [pId, subKey] = selectedTarget.split("|");
        formData.append("propertyId", pId);
        if (subKey && subKey !== "MAIN") {
          formData.append("subUnitKey", subKey);
        }
      }

      const res = await fetch("/api/utility-bills/parse-pdf", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Fehler beim Verarbeiten");
      }

      toast({
        title: "Abrechnung erfolgreich ausgelesen! ✨",
        description: `${data.items?.length || 0} Betriebskosten-Positionen erkannt für ${data.period}.`,
      });

      setOpen(false);
      setFile(null);
      onParsed(data);
    } catch (err: any) {
      toast({
        title: "Fehler beim Auslesen",
        description: err.message || "PDF konnte nicht automatisch ausgelesen werden.",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2 h-9 text-xs shadow-sm bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white border-0">
          <Sparkles className="h-4 w-4" />
          Hausgeldabrechnung hochladen (PDF)
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-indigo-500" />
            Hausgeldabrechnung der Verwaltung einlesen
          </DialogTitle>
          <DialogDescription>
            Laden Sie das PDF der Hausverwaltung hoch. Immotracker liest die umlagefähigen Betriebskosten (§ 2 BetrKV) automatisch aus und berechnet das Abrechnungsergebnis.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleUpload} className="space-y-4 pt-2">
          {/* Ziel-Wohnungsauswahl */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Ziel-Wohnung / Untereinheit</Label>
            <Select value={selectedTarget} onValueChange={setSelectedTarget}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder="Wohnung auswählen" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="AUTO" className="text-xs font-medium text-indigo-600 dark:text-indigo-400">
                  ⚡ Automatisch aus PDF erkennen (Adresse / WE)
                </SelectItem>
                {targets.map((t) => (
                  <SelectItem key={t.id} value={t.id} className="text-xs">
                    {t.displayName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground">
              Für <strong>Siemensstraße 2.OG</strong> können Sie direkt zwischen <em>WE05 (links, 41 m²)</em> und <em>WE06 (rechts, 55 m²)</em> wählen.
            </p>
          </div>

          {/* Drag & Drop Upload Zone */}
          <div
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
              file
                ? "border-primary bg-primary/5"
                : "border-muted-foreground/30 hover:border-primary/60 hover:bg-muted/40"
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,application/pdf"
              className="hidden"
              onChange={(e) => {
                if (e.target.files?.[0]) setFile(e.target.files[0]);
              }}
            />
            {file ? (
              <div className="flex flex-col items-center gap-1.5">
                <FileText className="h-10 w-10 text-primary animate-pulse" />
                <span className="text-sm font-semibold">{file.name}</span>
                <span className="text-xs text-muted-foreground">
                  ({(file.size / 1024).toFixed(1)} KB) – Klicken zum Ändern
                </span>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-1.5">
                <FileUp className="h-10 w-10 text-muted-foreground/60" />
                <span className="text-sm font-semibold">PDF-Datei hierher ziehen oder klicken</span>
                <span className="text-xs text-muted-foreground">
                  Abrechnung der Hausverwaltung (z.B. Domus, HausPerfekt, Techem etc.)
                </span>
              </div>
            )}
          </div>

          <DialogFooter className="pt-2">
            <Button variant="outline" type="button" onClick={() => setOpen(false)} disabled={uploading}>
              Abbrechen
            </Button>
            <Button type="submit" disabled={!file || uploading} className="gap-2">
              {uploading ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Wird analysiert...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  Abrechnung auslesen & prüfen
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Dialog: Abrechnung bearbeiten / erfassen (Editor) ─────────────────────────

function StatementEditorModal({
  open,
  onOpenChange,
  properties,
  initialData,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  properties: Property[];
  initialData?: any;
  onSaved: () => void;
}) {
  const targets = buildTargetOptions(properties);

  const [selectedTarget, setSelectedTarget] = useState<string>("");
  const [period, setPeriod] = useState<string>("2024");
  const [tenantName, setTenantName] = useState<string>("");
  const [sqm, setSqm] = useState<string>("");
  const [prepayments, setPrepayments] = useState<string>("");
  const [items, setItems] = useState<StatementLineItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [landlordIban, setLandlordIban] = useState<string>("");
  const [landlordName, setLandlordName] = useState<string>("Immotracker Verwaltung");

  // Initialisiere Formular bei Öffnen oder initialData-Wechsel
  useEffect(() => {
    if (!open) return;

    if (initialData) {
      // Wenn aus PDF-Parser oder bestehendem Statement
      const targetId = initialData.propertyId
        ? `${initialData.propertyId}|${initialData.subUnitKey || "MAIN"}`
        : targets[0]?.id || "";
      setSelectedTarget(targetId);

      const target = targets.find((t) => t.id === targetId);

      setPeriod(initialData.period || String(new Date().getFullYear() - 1));
      setTenantName(initialData.tenantName || target?.tenantName || "Mieter");
      setSqm(String(initialData.sqm || target?.sqm || 42));
      setPrepayments(String(initialData.prepayments ?? initialData.annualPrepayments ?? (target ? target.defaultMonthlyPrepayment * 12 : 0)));
      setItems(initialData.items || initialData.lineItems || []);

      if (initialData.detailsJson) {
        try {
          const d = JSON.parse(initialData.detailsJson);
          if (d.landlordIban) setLandlordIban(d.landlordIban);
          if (d.landlordName) setLandlordName(d.landlordName);
        } catch {}
      }
    } else {
      // Neuer manueller Entwurf
      const defaultTarget = targets[0];
      if (defaultTarget) {
        setSelectedTarget(defaultTarget.id);
        setTenantName(defaultTarget.tenantName);
        setSqm(String(defaultTarget.sqm));
        setPrepayments(String(defaultTarget.defaultMonthlyPrepayment * 12));
      }
      setPeriod(String(new Date().getFullYear() - 1));
      setItems([
        { category: "HEATING", name: "Heizung & Warmwasser", totalCost: 0, distributionKey: "Verbrauch (70/30)", amount: 0 },
        { category: "WATER", name: "Kaltwasser & Abwasser", totalCost: 0, distributionKey: "Wohnfläche (m²)", amount: 0 },
        { category: "INSURANCE", name: "Gebäude- & Haftpflichtversicherung", totalCost: 0, distributionKey: "Wohnfläche (m²)", amount: 0 },
        { category: "TRASH", name: "Müllbeseitigung & Straßenreinigung", totalCost: 0, distributionKey: "Wohnfläche (m²)", amount: 0 },
        { category: "ELECTRICITY", name: "Allgemeinstrom", totalCost: 0, distributionKey: "Wohnfläche (m²)", amount: 0 },
      ]);
    }
  }, [open, initialData]);

  // Bei Wechsel des Ziel-Objekts Werte anpassen
  const handleTargetChange = (targetId: string) => {
    setSelectedTarget(targetId);
    const target = targets.find((t) => t.id === targetId);
    if (target) {
      setTenantName(target.tenantName);
      setSqm(String(target.sqm));
      setPrepayments(String(target.defaultMonthlyPrepayment * 12));
    }
  };

  // Berechnungen
  const totalCosts = items.reduce((s, it) => s + (Number(it.amount) || 0), 0);
  const parsedPrepayments = parseFloat(prepayments) || 0;
  const balance = Math.round((parsedPrepayments - totalCosts) * 100) / 100;
  const isCredit = balance >= 0;

  // Item hinzufügen
  const handleAddItem = (category = "OTHER", defaultName = "Weitere Betriebskosten") => {
    setItems([
      ...items,
      {
        id: `custom-${Date.now()}`,
        category,
        name: defaultName,
        totalCost: 0,
        distributionKey: "Wohnfläche (m²)",
        amount: 0,
      },
    ]);
  };

  // Item löschen
  const handleDeleteItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  // Item ändern
  const handleItemChange = (index: number, field: keyof StatementLineItem, value: any) => {
    const updated = [...items];
    updated[index] = { ...updated[index], [field]: value };
    setItems(updated);
  };

  // Speichern
  const handleSave = async (printAfterSave = false) => {
    if (!selectedTarget) {
      toast({ title: "Bitte Ziel-Wohnung wählen", variant: "destructive" });
      return;
    }

    const [propertyId, subUnitKey] = selectedTarget.split("|");
    setSaving(true);

    try {
      const payload = {
        id: initialData?.id || undefined,
        propertyId,
        subUnitKey: subUnitKey !== "MAIN" ? subUnitKey : null,
        period,
        sqm: parseFloat(sqm) || 0,
        tenantName,
        totalCosts,
        prepayments: parsedPrepayments,
        balance,
        detailsJson: {
          landlordName,
          landlordIban,
          paymentDeadlineDays: 30,
        },
        items: items.map((it) => ({
          category: it.category,
          name: it.name,
          totalCost: Number(it.totalCost) || Number(it.amount) || 0,
          distributionKey: it.distributionKey,
          amount: Number(it.amount) || 0,
        })),
      };

      const res = await fetch("/api/utility-bills/statement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Fehler beim Speichern");

      toast({
        title: "Nebenkostenabrechnung gespeichert! ✅",
        description: `Abrechnung für ${tenantName} (${period}) erfolgreich hinterlegt.`,
      });

      onOpenChange(false);
      onSaved();

      if (printAfterSave && data.statement) {
        printTenantUtilityStatement(data.statement);
      }
    } catch (err: any) {
      toast({
        title: "Fehler beim Speichern",
        description: err.message || "Abrechnung konnte nicht gespeichert werden.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const hasPropertyTax = items.some((it) => it.category === "PROPERTY_TAX");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg flex items-center gap-2">
            <Receipt className="h-5 w-5 text-primary" />
            Mieter-Nebenkostenabrechnung bearbeiten & prüfen
          </DialogTitle>
          <DialogDescription>
            Prüfen Sie die Einzelpositionen aus der Abrechnung der Hausverwaltung vor der Freigabe.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-1">
          {/* Basisdaten */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 bg-muted/30 p-3.5 rounded-lg border">
            <div className="sm:col-span-2 space-y-1">
              <Label className="text-xs font-semibold">Wohnung / Einheit *</Label>
              <Select value={selectedTarget} onValueChange={handleTargetChange}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {targets.map((t) => (
                    <SelectItem key={t.id} value={t.id} className="text-xs">
                      {t.displayName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold">Abrechnungsjahr *</Label>
              <Input
                type="text"
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
                className="h-8 text-xs font-mono font-bold"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold">Wohnfläche (m²)</Label>
              <Input
                type="number"
                step="0.1"
                value={sqm}
                onChange={(e) => setSqm(e.target.value)}
                className="h-8 text-xs font-mono"
              />
            </div>

            <div className="sm:col-span-2 space-y-1">
              <Label className="text-xs font-semibold">Mietername</Label>
              <Input
                value={tenantName}
                onChange={(e) => setTenantName(e.target.value)}
                className="h-8 text-xs"
                placeholder="Vor- und Nachname"
              />
            </div>

            <div className="sm:col-span-2 space-y-1">
              <Label className="text-xs font-semibold">Geleistete Vorauszahlungen (€)</Label>
              <Input
                type="number"
                step="0.01"
                value={prepayments}
                onChange={(e) => setPrepayments(e.target.value)}
                className="h-8 text-xs font-mono font-bold text-blue-600 dark:text-blue-400"
              />
            </div>
          </div>

          {/* Einzelpositionen Tabelle */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Umlagefähige Betriebskosten gem. § 2 BetrKV ({items.length} Positionen)
                </Label>
                <p className="text-[11px] text-muted-foreground">
                  Tragen Sie die genauen Anteile für diese Wohnung aus dem Verwalter-Abrechnungsblatt ein.
                </p>
              </div>

              <div className="flex items-center gap-1.5">
                {!hasPropertyTax && (
                  <Button
                    size="sm"
                    variant="outline"
                    type="button"
                    onClick={() => handleAddItem("PROPERTY_TAX", "Grundsteuer B")}
                    className="h-7 text-xs gap-1 border-dashed text-amber-600 dark:text-amber-400"
                  >
                    🏛️ + Grundsteuer B
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  type="button"
                  onClick={() => handleAddItem()}
                  className="h-7 text-xs gap-1"
                >
                  <Plus className="h-3 w-3" /> Position hinzufügen
                </Button>
              </div>
            </div>

            <div className="border rounded-md overflow-hidden">
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow>
                    <TableHead className="w-10 text-center">Kat.</TableHead>
                    <TableHead className="w-60">Bezeichnung / Kostenart</TableHead>
                    <TableHead className="w-36 text-right">Gesamtkosten (€)</TableHead>
                    <TableHead className="w-40 text-center">Verteilerschlüssel</TableHead>
                    <TableHead className="w-32 text-right">Mieter-Anteil (€) *</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-6 text-muted-foreground text-xs">
                        Keine Positionen vorhanden. Klicken Sie auf "+ Position hinzufügen" oder laden Sie ein PDF hoch.
                      </TableCell>
                    </TableRow>
                  ) : (
                    items.map((it, idx) => (
                      <TableRow key={it.id || idx}>
                        <TableCell className="text-center text-sm">
                          {CATEGORY_ICON[it.category] || "📋"}
                        </TableCell>
                        <TableCell>
                          <Input
                            value={it.name || ""}
                            onChange={(e) => handleItemChange(idx, "name", e.target.value)}
                            className="h-7 text-xs"
                            placeholder="z.B. Heizkosten"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            step="0.01"
                            value={it.totalCost || ""}
                            onChange={(e) => handleItemChange(idx, "totalCost", parseFloat(e.target.value) || 0)}
                            className="h-7 text-xs text-right font-mono"
                            placeholder="0.00"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            value={it.distributionKey || ""}
                            onChange={(e) => handleItemChange(idx, "distributionKey", e.target.value)}
                            className="h-7 text-xs text-center"
                            placeholder="Wohnfläche (m²)"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            step="0.01"
                            value={it.amount || ""}
                            onChange={(e) => handleItemChange(idx, "amount", parseFloat(e.target.value) || 0)}
                            className="h-7 text-xs text-right font-mono font-bold"
                            placeholder="0.00"
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDeleteItem(idx)}
                            className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>

          {/* Saldo & Ergebnis Card */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 rounded-lg border bg-muted/20">
            <div className="space-y-0.5">
              <span className="text-[11px] text-muted-foreground font-medium">Umlagefähige Gesamtkosten:</span>
              <p className="text-lg font-bold font-mono">{formatCurrency(totalCosts)}</p>
            </div>
            <div className="space-y-0.5">
              <span className="text-[11px] text-muted-foreground font-medium">./. Geleistete Vorauszahlungen:</span>
              <p className="text-lg font-bold font-mono text-blue-600 dark:text-blue-400">
                - {formatCurrency(parsedPrepayments)}
              </p>
            </div>
            <div className={`space-y-0.5 p-2 rounded-md ${isCredit ? "bg-green-100/70 dark:bg-green-950/40 border border-green-200 dark:border-green-800" : "bg-red-100/70 dark:bg-red-950/40 border border-red-200 dark:border-red-800"}`}>
              <span className="text-[11px] font-semibold text-muted-foreground">
                {isCredit ? "Abrechnungsergebnis: GUTHABEN" : "Abrechnungsergebnis: NACHZAHLUNG"}
              </span>
              <p className={`text-xl font-black font-mono ${isCredit ? "text-green-700 dark:text-green-400" : "text-red-700 dark:text-red-400"}`}>
                {isCredit ? "+" : ""}{formatCurrency(balance)}
              </p>
            </div>
          </div>

          {/* Vermieter & Bankverbindung für Ausdruck */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div className="space-y-1">
              <Label className="text-xs">Vermieter-Name (für Briefkopf)</Label>
              <Input
                value={landlordName}
                onChange={(e) => setLandlordName(e.target.value)}
                className="h-8 text-xs"
                placeholder="z.B. Immotracker Verwaltung"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">IBAN für Nachzahlungen (optional)</Label>
              <Input
                value={landlordIban}
                onChange={(e) => setLandlordIban(e.target.value)}
                className="h-8 text-xs font-mono"
                placeholder="DE..."
              />
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0 pt-3">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Abbrechen
          </Button>
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={() => handleSave(false)} disabled={saving}>
              {saving ? "Speichern..." : "Nur Speichern"}
            </Button>
            <Button onClick={() => handleSave(true)} disabled={saving} className="gap-1.5">
              <Printer className="h-4 w-4" />
              {saving ? "Wird gespeichert..." : "Speichern & PDF drucken"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Dialog: Altrechnung anlegen (Legacy Tab) ──────────────────────────────────

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
        toast({ title: "Rechnung erfasst", description: `${form.vendor} gespeichert.` });
        setOpen(false);
        onRefresh();
      } else {
        const err = await res.json();
        toast({ title: "Fehler beim Erfassen", description: err.error, variant: "destructive" });
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
        <Button size="sm" variant="outline" className="gap-1.5 text-xs h-9">
          <Plus className="h-3.5 w-3.5" /> Einzelrechnung erfassen
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Lieferantenrechnung erfassen</DialogTitle>
          <DialogDescription>
            Für direkte Rechnungen von Handwerkern, Versorgern oder Versicherungen.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3 pt-2">
          <div className="space-y-1">
            <Label className="text-xs">Versorger / Dienstleister *</Label>
            <Input
              placeholder="z.B. Stadtwerke Essen AG"
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
                placeholder="z.B. 450.00"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                required
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Abrechnungsjahr *</Label>
              <Input
                type="text"
                value={form.period}
                onChange={(e) => setForm({ ...form, period: e.target.value })}
                required
              />
            </div>
          </div>

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
            <Label className="text-xs">Objekt-Zuordnung</Label>
            <Select value={form.propertyId} onValueChange={(v) => setForm({ ...form, propertyId: v })}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL" className="text-xs">Gesamte Liegenschaft (nach m² aufteilen)</SelectItem>
                {properties.map((p) => (
                  <SelectItem key={p.id} value={p.id} className="text-xs">{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
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

// ─── Hauptseite Nebenkosten ───────────────────────────────────────────────────

export default function NebenkostenPage() {
  const [savedStatements, setSavedStatements] = useState<SavedStatement[]>([]);
  const [bills, setBills] = useState<UtilityBill[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState("2024");
  const [propertyFilter, setPropertyFilter] = useState("ALL");

  // Editor Modal State
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorInitialData, setEditorInitialData] = useState<any>(null);

  // Daten abrufen
  const fetchData = async () => {
    try {
      setLoading(true);
      const [statementsRes, billsRes, propsRes] = await Promise.all([
        fetch(`/api/utility-bills/statement?period=${period}`),
        fetch("/api/utility-bills"),
        fetch("/api/properties"),
      ]);

      if (statementsRes.ok) {
        const sData = await statementsRes.json();
        setSavedStatements(sData.statements || []);
      }
      if (billsRes.ok) {
        setBills(await billsRes.json());
      }
      if (propsRes.ok) {
        const pData = await propsRes.json();
        setProperties(pData);
      }
    } catch (err) {
      console.error("Error loading data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [period]);

  // Wenn PDF erfolgreich geparst wurde -> direkt Editor mit vorbefüllten Daten öffnen
  const handlePdfParsed = (parsedData: any) => {
    setEditorInitialData(parsedData);
    setEditorOpen(true);
  };

  // Manuellen neuen Entwurf öffnen
  const handleCreateManual = () => {
    setEditorInitialData(null);
    setEditorOpen(true);
  };

  // Bestehende Abrechnung bearbeiten
  const handleEditStatement = (st: SavedStatement) => {
    setEditorInitialData({
      id: st.id,
      propertyId: st.propertyId,
      subUnitKey: st.subUnitKey,
      period: st.period,
      sqm: st.sqm,
      tenantName: st.tenantName,
      prepayments: st.prepayments,
      items: st.lineItems,
      detailsJson: st.detailsJson,
    });
    setEditorOpen(true);
  };

  // Abrechnung löschen
  const handleDeleteStatement = async (id: string, name: string) => {
    if (!confirm(`Soll die Nebenkostenabrechnung für ${name} wirklich gelöscht werden?`)) return;

    try {
      const res = await fetch(`/api/utility-bills/statement?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      if (res.ok) {
        toast({ title: "Abrechnung gelöscht" });
        fetchData();
      } else {
        toast({ title: "Fehler beim Löschen", variant: "destructive" });
      }
    } catch {
      toast({ title: "Verbindungsfehler", variant: "destructive" });
    }
  };

  // Filterung
  const filteredStatements = savedStatements.filter((st) => {
    if (propertyFilter !== "ALL" && st.propertyId !== propertyFilter) return false;
    return true;
  });

  // KPI-Berechnungen
  const totalAllocated = filteredStatements.reduce((s, st) => s + st.totalCosts, 0);
  const totalPrepaid = filteredStatements.reduce((s, st) => s + st.prepayments, 0);
  const totalBalance = filteredStatements.reduce((s, st) => s + st.balance, 0);

  return (
    <div className="space-y-6">
      {/* Seiten-Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
            <FileBarChart className="h-6 w-6 text-primary" />
            Nebenkostenabrechnung
          </h1>
          <p className="text-muted-foreground text-xs sm:text-sm">
            Rechtssichere Mieter-Abrechnungen auf Basis der Hausgeldabrechnung der Hausverwaltung gem. § 2 BetrKV.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Jahresauswahl */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground whitespace-nowrap">Abrechnungsjahr:</span>
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger className="w-28 h-9 text-xs font-bold">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {["2026", "2025", "2024", "2023", "ALL"].map((y) => (
                  <SelectItem key={y} value={y} className="text-xs">
                    {y === "ALL" ? "Alle Jahre" : y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Action 1: PDF hochladen */}
          <UploadUtilityPdfModal
            properties={properties}
            onParsed={handlePdfParsed}
          />

          {/* Action 2: Manuell anlegen */}
          <Button
            variant="outline"
            onClick={handleCreateManual}
            className="gap-1.5 h-9 text-xs shadow-sm"
          >
            <Plus className="h-4 w-4" />
            Manuell anlegen
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="shadow-sm">
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground mb-1">Umgelegte Betriebskosten ({period})</p>
            <p className="text-2xl font-bold text-foreground font-mono">{formatCurrency(totalAllocated)}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {filteredStatements.length} Mieter-Abrechnungen hinterlegt
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground mb-1">Geleistete Mieter-Vorauszahlungen</p>
            <p className="text-2xl font-bold text-blue-600 dark:text-blue-400 font-mono">{formatCurrency(totalPrepaid)}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Soll-Vorauszahlungen der Mieter
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground mb-1">Gesamtsaldo (Abrechnungsergebnis)</p>
            <p className={`text-2xl font-bold font-mono ${totalBalance >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
              {totalBalance >= 0 ? "+" : ""}{formatCurrency(totalBalance)}
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {totalBalance >= 0 ? "Guthaben für die Mieter gesamt" : "Nachzahlungsanspruch des Vermieters"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Haupt-Tabs */}
      <Tabs defaultValue="statements" className="space-y-4">
        <TabsList className="h-9">
          <TabsTrigger value="statements" className="gap-1.5 text-xs">
            <CheckCircle className="h-3.5 w-3.5 text-primary" />
            Fertige Mieter-Abrechnungen ({filteredStatements.length})
          </TabsTrigger>
          <TabsTrigger value="bills" className="gap-1.5 text-xs">
            <Receipt className="h-3.5 w-3.5 text-muted-foreground" />
            Einzelne Lieferantenrechnungen ({bills.length})
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Mieter-Abrechnungen */}
        <TabsContent value="statements" className="space-y-4">
          <Card className="shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <FileText className="h-4 w-4 text-primary" />
                    Mieter-Abrechnungen für {period === "ALL" ? "alle Zeiträume" : period}
                  </CardTitle>
                  <CardDescription>
                    Klicken Sie auf <strong>PDF drucken</strong>, um das rechtskonforme Mieteranschreiben gem. § 2 BetrKV und HeizkostenV zu generieren.
                  </CardDescription>
                </div>

                {/* Filter Wohnung */}
                <div className="flex items-center gap-2">
                  <Select value={propertyFilter} onValueChange={setPropertyFilter}>
                    <SelectTrigger className="w-48 h-8 text-xs">
                      <SelectValue placeholder="Alle Wohnungen" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL" className="text-xs">Alle Wohnungen</SelectItem>
                      {properties.map((p) => (
                        <SelectItem key={p.id} value={p.id} className="text-xs">
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>

            <CardContent>
              {loading ? (
                <div className="py-12 text-center text-xs text-muted-foreground">
                  <RefreshCw className="h-5 w-5 animate-spin mx-auto mb-2 text-primary" />
                  Lade Nebenkostenabrechnungen...
                </div>
              ) : filteredStatements.length === 0 ? (
                <div className="py-12 text-center border-2 border-dashed rounded-lg bg-muted/10 space-y-3">
                  <FileText className="h-10 w-10 text-muted-foreground/40 mx-auto" />
                  <div className="space-y-1">
                    <p className="text-sm font-semibold">Noch keine Abrechnungen für {period} angelegt</p>
                    <p className="text-xs text-muted-foreground max-w-md mx-auto">
                      Laden Sie einfach die Hausgeldabrechnung der Hausverwaltung als PDF hoch. Immotracker liest die umlagefähigen Kosten automatisch aus.
                    </p>
                  </div>
                  <div className="flex justify-center gap-2 pt-1">
                    <UploadUtilityPdfModal
                      properties={properties}
                      onParsed={handlePdfParsed}
                    />
                    <Button variant="outline" size="sm" onClick={handleCreateManual} className="h-8 text-xs">
                      Manuell erfassen
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="border rounded-md overflow-hidden">
                  <Table>
                    <TableHeader className="bg-muted/40">
                      <TableRow>
                        <TableHead>Mietobjekt & Einheit</TableHead>
                        <TableHead>Mieter</TableHead>
                        <TableHead className="text-center">Fläche</TableHead>
                        <TableHead className="text-right">Gesamtkosten</TableHead>
                        <TableHead className="text-right">Geleistete VZ</TableHead>
                        <TableHead className="text-right">Abrechnungsergebnis</TableHead>
                        <TableHead className="text-right">Aktionen</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredStatements.map((st) => {
                        const isCredit = st.balance >= 0;
                        const prop = st.property;
                        const unitBadge = st.subUnitKey
                          ? `${st.subUnitKey} (${st.sqm} m²)`
                          : prop?.unitNumber
                          ? `${prop.unitNumber} (${st.sqm || prop.sqm} m²)`
                          : `${st.sqm} m²`;

                        return (
                          <TableRow key={st.id} className="hover:bg-muted/30">
                            <TableCell className="font-medium">
                              <div className="flex flex-col">
                                <span className="font-semibold text-sm">{prop?.name || "Wohnung"}</span>
                                <div className="flex items-center gap-1.5 mt-0.5">
                                  <Badge variant="outline" className="text-[11px] font-mono py-0 h-4 bg-muted/40">
                                    {unitBadge}
                                  </Badge>
                                  <span className="text-[11px] text-muted-foreground font-mono">
                                    Jahr {st.period}
                                  </span>
                                </div>
                              </div>
                            </TableCell>

                            <TableCell>
                              <div className="flex items-center gap-1.5">
                                <User className="h-3.5 w-3.5 text-muted-foreground" />
                                <span className="text-sm font-medium">{st.tenantName || "Mieter"}</span>
                              </div>
                            </TableCell>

                            <TableCell className="text-center text-xs font-mono">
                              {st.sqm || prop?.sqm} m²
                            </TableCell>

                            <TableCell className="text-right font-mono font-semibold text-sm">
                              {formatCurrency(st.totalCosts)}
                              <span className="block text-[11px] text-muted-foreground font-normal">
                                {st.lineItems?.length || 0} Positionen
                              </span>
                            </TableCell>

                            <TableCell className="text-right font-mono text-sm text-blue-600 dark:text-blue-400">
                              {formatCurrency(st.prepayments)}
                            </TableCell>

                            <TableCell className="text-right">
                              <div className="flex flex-col items-end">
                                <span className={`font-mono font-bold text-sm ${isCredit ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                                  {isCredit ? "+" : ""}{formatCurrency(st.balance)}
                                </span>
                                <Badge
                                  variant={isCredit ? "success" : "destructive"}
                                  className="text-[10px] py-0 h-4 mt-0.5"
                                >
                                  {isCredit ? "Guthaben" : "Nachzahlung"}
                                </Badge>
                              </div>
                            </TableCell>

                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-8 text-xs gap-1.5 shadow-sm"
                                  onClick={() => printTenantUtilityStatement(st)}
                                >
                                  <Printer className="h-3.5 w-3.5 text-primary" />
                                  PDF drucken
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-8 w-8 p-0"
                                  onClick={() => handleEditStatement(st)}
                                  title="Bearbeiten"
                                >
                                  <Edit className="h-3.5 w-3.5 text-muted-foreground" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                                  onClick={() => handleDeleteStatement(st.id, st.tenantName || "Mieter")}
                                  title="Löschen"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 2: Einzelne Lieferantenrechnungen (Legacy) */}
        <TabsContent value="bills" className="space-y-4">
          <Card className="shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">Lieferanten- & Versorgerrechnungen</CardTitle>
                  <CardDescription>
                    Einzelne Rechnungen von Handwerkern, Grundsteuerbescheiden oder Versorgern.
                  </CardDescription>
                </div>
                <AddUtilityBillDialog
                  properties={properties}
                  defaultPeriod={period}
                  onRefresh={fetchData}
                />
              </div>
            </CardHeader>
            <CardContent>
              {bills.length === 0 ? (
                <p className="text-xs text-muted-foreground py-6 text-center">Keine Einzelrechnungen erfasst.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Datum</TableHead>
                      <TableHead>Versorger</TableHead>
                      <TableHead>Kategorie</TableHead>
                      <TableHead>Wohnung</TableHead>
                      <TableHead className="text-right">Betrag</TableHead>
                      <TableHead className="text-center">Umlagefähig</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bills.map((b) => (
                      <TableRow key={b.id}>
                        <TableCell className="text-xs">{formatDate(b.bookingDate)}</TableCell>
                        <TableCell className="font-semibold text-xs">{b.vendor}</TableCell>
                        <TableCell className="text-xs">
                          {CATEGORY_ICON[b.category] || "📋"} {CATEGORY_LABEL[b.category] || b.category}
                        </TableCell>
                        <TableCell className="text-xs">{b.property?.name || "Gesamte Liegenschaft"}</TableCell>
                        <TableCell className="text-right font-mono font-semibold text-xs">{formatCurrency(b.amount)}</TableCell>
                        <TableCell className="text-center">
                          <Badge variant={b.isAllocatable ? "success" : "secondary"} className="text-[10px]">
                            {b.isAllocatable ? "Ja" : "Nein"}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Editor Modal */}
      <StatementEditorModal
        open={editorOpen}
        onOpenChange={setEditorOpen}
        properties={properties}
        initialData={editorInitialData}
        onSaved={fetchData}
      />
    </div>
  );
}
