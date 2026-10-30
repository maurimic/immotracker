"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import {
  ReceiptText,
  FileSpreadsheet,
  Download,
  Printer,
  Copy,
  Check,
  Building2,
  Users,
  Coins,
  ShieldAlert,
  Percent,
  Calendar,
  Layers,
  HelpCircle,
  Plus,
  Trash2,
  Info,
  Car,
  Laptop,
  CheckCircle2,
  Sparkles,
  ArrowRight,
  Calculator,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatCurrency, formatDate } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

interface Property {
  id: string;
  name: string;
  address: string;
  sqm: number;
  floor?: string | null;
  rooms?: number | null;
  purchasePrice?: number | null;
  purchasedAt?: string | null;
  possessionAt?: string | null;
  ancillaryCosts?: number | null;
  tenant?: {
    firstName: string;
    lastName: string;
    coldRent: number;
    utilities: number;
  } | null;
  loans?: Loan[];
}

interface Loan {
  id: string;
  propertyId: string;
  label?: string;
  bank?: string | null;
  originalAmount: number;
  currentBalance: number;
  interestRate: number;
  monthlyPayment: number;
  startDate?: string;
}

interface Ticket {
  id: string;
  propertyId: string;
  title: string;
  description?: string;
  status: string;
  cost?: number | null;
  craftsman?: string | null;
  reportedAt: string;
  doneAt?: string | null;
}

interface UtilityBill {
  id: string;
  propertyId?: string | null;
  amount: number;
  category: string;
  isAllocatable: boolean;
  bookingDate: string;
}

interface CoOwner {
  id: string;
  name: string;
  taxId: string;
  sharePercent: number;
  role: string;
}

const DEFAULT_CO_OWNERS: CoOwner[] = [
  { id: "owner-1", name: "Eigentümer 1 (z.B. Sie selbst)", taxId: "12/345/67890", sharePercent: 50, role: "Ehegatte / Miteigentümer A" },
  { id: "owner-2", name: "Eigentümer 2 (z.B. Ehepartner)", taxId: "12/345/67891", sharePercent: 50, role: "Ehegatte / Miteigentümer B" },
];

export default function SteuernPage() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [utilityBills, setUtilityBills] = useState<UtilityBill[]>([]);
  const [loading, setLoading] = useState(true);

  // Steuereinstellungen
  const [taxYear, setTaxYear] = useState("2026");
  const [buildingSharePercent, setBuildingSharePercent] = useState<number>(75); // 75% Gebäude, 25% Grund und Boden
  const [afaRatePercent, setAfaRatePercent] = useState<number>(2.0); // 2,0% linear p.a.
  const [copiedLine, setCopiedLine] = useState<string | null>(null);

  // Zusätzliche abzugsfähige Werbungskosten (individuelle Pauschalen / Eingaben)
  const [drivenKm, setDrivenKm] = useState<number>(180); // Fahrten zum Objekt / WEG (0,30 € / km)
  const [accountFees, setAccountFees] = useState<number>(120); // Mietkonto-Gebühren p.a.
  const [softwareAndOffice, setSoftwareAndOffice] = useState<number>(180); // Fachliteratur, Immotracker, Büro
  const [customExpenses, setCustomExpenses] = useState<number>(0); // Sonstige Sonderwerbungskosten

  // Feststellungserklärung Beteiligte (Gemeinschaften)
  const [coOwners, setCoOwners] = useState<CoOwner[]>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("immotracker_tax_owners");
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch (e) {
          // ignore
        }
      }
    }
    return DEFAULT_CO_OWNERS;
  });

  // Save coOwners to localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("immotracker_tax_owners", JSON.stringify(coOwners));
    }
  }, [coOwners]);

  // Daten laden
  useEffect(() => {
    async function loadData() {
      try {
        const [propsRes, loansRes, ticketsRes, billsRes] = await Promise.all([
          fetch("/api/properties"),
          fetch("/api/loans"),
          fetch("/api/tickets"),
          fetch("/api/utility-bills"),
        ]);

        if (propsRes.ok) setProperties(await propsRes.json());
        if (loansRes.ok) setLoans(await loansRes.json());
        if (ticketsRes.ok) setTickets(await ticketsRes.json());
        if (billsRes.ok) setUtilityBills(await billsRes.json());
      } catch (e) {
        console.error("Fehler beim Laden der Steuerdaten", e);
        toast({ title: "Fehler beim Laden der Daten", variant: "destructive" });
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  // ─── STEUERLICHE BERECHNUNGEN (Anlage V) ──────────────────────────────────────
  const calculations = useMemo(() => {
    // 1. Einnahmen (§ 21 EStG)
    const annualColdRent = properties.reduce((sum, p) => sum + (p.tenant?.coldRent || 0) * 12, 0);
    const annualUtilitiesAdvances = properties.reduce((sum, p) => sum + (p.tenant?.utilities || 0) * 12, 0);
    const otherRevenues = 0; // z.B. Sondervergütungen / Garagen separat
    const totalRevenues = annualColdRent + annualUtilitiesAdvances + otherRevenues;

    // 2. Werbungskosten (§ 9 EStG)
    // 2.1 Schuldzinsen (Zeile 33)
    const annualMortgageInterest = loans.reduce((sum, l) => {
      return sum + (l.currentBalance * (l.interestRate / 100));
    }, 0);

    // 2.2 Geldbeschaffungskosten (Zeile 34)
    const financingFees = 0;

    // 2.3 Gebäude-AfA (Zeile 37 / § 7 Abs. 4 EStG)
    // Berechnung je Wohnung: (purchasePrice + ancillaryCosts) * (buildingSharePercent / 100) * (afaRatePercent / 100)
    let totalBuildingAfa = 0;
    const propertyAfaList = properties.map((p) => {
      const basePrice = (p.purchasePrice || 0) + (p.ancillaryCosts || 0);
      const buildingShare = basePrice * (buildingSharePercent / 100);
      let yearAfa = buildingShare * (afaRatePercent / 100);

      // Zeitanteilige AfA im Anschaffungsjahr prüfen (§ 7 Abs. 1 Satz 4 EStG)
      if (p.possessionAt) {
        const possDate = new Date(p.possessionAt);
        const possYear = possDate.getFullYear();
        const taxYearNum = Number(taxYear);
        if (possYear === taxYearNum) {
          const monthsActive = 12 - possDate.getMonth(); // inklusive Übergangsmonat
          yearAfa = (yearAfa / 12) * monthsActive;
        } else if (possYear > taxYearNum) {
          // Erwerb liegt in der Zukunft: Im aktuellen Steuerjahr noch keine AfA
          yearAfa = 0;
        }
      }

      totalBuildingAfa += yearAfa;
      return {
        propertyId: p.id,
        propertyName: p.name,
        basePrice,
        buildingShare,
        yearAfa,
      };
    });

    // Fallback falls bei keiner Wohnung ein Kaufpreis gepflegt ist:
    // Wenn 0, nehmen wir als praxisnahen Referenzwert 2% auf ca. 1.800€/m²
    const estimatedAfaFallback = totalBuildingAfa > 0
      ? totalBuildingAfa
      : properties.reduce((sum, p) => sum + p.sqm * 2000 * (buildingSharePercent / 100) * (afaRatePercent / 100), 0);
    const finalAfa = totalBuildingAfa > 0 ? totalBuildingAfa : estimatedAfaFallback;

    // 2.4 Erhaltungsaufwand (Zeile 39 / Reparaturen)
    const yearTickets = tickets.filter((t) => {
      // Wenn Status DONE ist und Kosten hinterlegt sind
      if (t.status !== "DONE" || !t.cost) return false;
      if (t.doneAt) {
        return new Date(t.doneAt).getFullYear().toString() === taxYear;
      }
      return new Date(t.reportedAt).getFullYear().toString() === taxYear;
    });
    // Wenn im ausgewählten Jahr noch keine Tickets erledigt sind, alle vorhandenen Tickets heranziehen
    const effectiveTickets = yearTickets.length > 0
      ? yearTickets
      : tickets.filter((t) => t.cost);

    const maintenanceExpenses = effectiveTickets.reduce((sum, t) => sum + (t.cost || 0), 0);
    // Handwerker-Lohnkostenanteil (~70% gem. Gutachten / Handwerkerrechnungen)
    const craftsmanLabourShare = maintenanceExpenses * 0.70;
    // § 35a Abs. 3 EStG Steuerermäßigung: 20% der Lohnkosten, maximal 1.200 € direkte Steuerermäßigung
    const craftsmanTaxBonus = Math.min(1200, craftsmanLabourShare * 0.20);

    // 2.5 Laufende Betriebskosten / Hausgeld (Zeile 46)
    // Entweder aus gebuchten UtilityBills oder basierend auf den Umlagen (ca. 95% der Vorauszahlungen)
    const billsForYear = utilityBills.filter((b) => new Date(b.bookingDate).getFullYear().toString() === taxYear);
    const utilityBillsSum = billsForYear.reduce((sum, b) => sum + b.amount, 0);
    const propertyOperatingExpenses = utilityBillsSum > 0
      ? utilityBillsSum
      : annualUtilitiesAdvances * 0.95;

    // 2.6 Verwaltungskosten & sonstiges (Zeile 47)
    // Fahrtkosten: 0,30 € je gefahrenem Kilometer (§ 9 Abs. 1 Nr. 4a EStG)
    const travelExpenses = drivenKm * 0.30;
    // Kontoführung & Bankspesen
    const bankFees = accountFees;
    // Fachliteratur, Software, Büro
    const softwareFees = softwareAndOffice;
    // WEG-Verwaltungskosten (ca. 300 € je Sondereigentumseinheit p.a. Marktstandard)
    const propertyManagementFees = properties.length * 320;

    const administrationExpenses = travelExpenses + bankFees + softwareFees + propertyManagementFees + customExpenses;

    // Gesamte Werbungskosten
    const totalExpenses = annualMortgageInterest + financingFees + finalAfa + maintenanceExpenses + propertyOperatingExpenses + administrationExpenses;

    // Netto-Ergebnis V+V (§ 21 Abs. 1 EStG)
    const netTaxableIncome = totalRevenues - totalExpenses;

    // ─── Aufteilung je Immobilie (Objektweise Aufstellung) ────────────────────────
    const perPropertyBreakdown = properties.map((prop) => {
      const pRent = (prop.tenant?.coldRent || 0) * 12;
      const pUtils = (prop.tenant?.utilities || 0) * 12;
      const pRev = pRent + pUtils;

      // Zinsen für dieser Wohnung zugeordnete Darlehen
      const propLoans = loans.filter((l) => l.propertyId === prop.id);
      const pInterest = propLoans.reduce((s, l) => s + (l.currentBalance * (l.interestRate / 100)), 0);

      // Tickets dieser Wohnung
      const propTickets = effectiveTickets.filter((t) => t.propertyId === prop.id);
      const pMaint = propTickets.reduce((s, t) => s + (t.cost || 0), 0);

      // AfA
      const foundAfa = propertyAfaList.find((a) => a.propertyId === prop.id);
      const pAfa = foundAfa && foundAfa.yearAfa > 0
        ? foundAfa.yearAfa
        : prop.sqm * 2000 * (buildingSharePercent / 100) * (afaRatePercent / 100);

      // Betriebskostenanteil
      const pOps = pUtils * 0.95;
      // Verwaltung
      const pAdmin = 320 + (travelExpenses / Math.max(1, properties.length));

      const pExp = pInterest + pMaint + pAfa + pOps + pAdmin;
      const pNet = pRev - pExp;

      return {
        id: prop.id,
        name: prop.name,
        address: prop.address,
        sqm: prop.sqm,
        tenant: prop.tenant ? `${prop.tenant.firstName} ${prop.tenant.lastName}` : "Leerstand",
        rent: pRent,
        utilities: pUtils,
        totalRev: pRev,
        interest: pInterest,
        maintenance: pMaint,
        afa: pAfa,
        operating: pOps,
        admin: pAdmin,
        totalExp: pExp,
        netIncome: pNet,
      };
    });

    return {
      annualColdRent,
      annualUtilitiesAdvances,
      otherRevenues,
      totalRevenues,
      annualMortgageInterest,
      financingFees,
      finalAfa,
      isAfaEstimated: totalBuildingAfa === 0,
      propertyAfaList,
      maintenanceExpenses,
      craftsmanLabourShare,
      craftsmanTaxBonus,
      propertyOperatingExpenses,
      travelExpenses,
      bankFees,
      softwareFees,
      propertyManagementFees,
      administrationExpenses,
      totalExpenses,
      netTaxableIncome,
      perPropertyBreakdown,
    };
  }, [properties, loans, tickets, utilityBills, taxYear, buildingSharePercent, afaRatePercent, drivenKm, accountFees, softwareAndOffice, customExpenses]);

  // Feststellungserklärung (Gemeinschaften) Quote Validation
  const totalOwnerShare = coOwners.reduce((s, o) => s + (Number(o.sharePercent) || 0), 0);
  const isShareValid = Math.abs(totalOwnerShare - 100) < 0.01;

  // Copy helper
  const copyValue = (label: string, value: string | number) => {
    const strVal = typeof value === "number" ? value.toFixed(2).replace(".", ",") + " €" : value;
    navigator.clipboard.writeText(typeof value === "number" ? value.toFixed(2) : value);
    setCopiedLine(label);
    toast({
      title: "Wert kopiert!",
      description: `"${label}": ${strVal} in die Zwischenablage kopiert (bereit für ELSTER).`,
    });
    setTimeout(() => setCopiedLine(null), 2500);
  };

  // Co-Owner Handlers
  const addCoOwner = () => {
    const newId = `owner-${Date.now()}`;
    const remainingShare = Math.max(0, 100 - totalOwnerShare);
    setCoOwners([
      ...coOwners,
      {
        id: newId,
        name: `Miteigentümer ${coOwners.length + 1}`,
        taxId: "",
        sharePercent: remainingShare > 0 ? remainingShare : 0,
        role: "Miteigentümer",
      },
    ]);
  };

  const updateCoOwner = (id: string, field: keyof CoOwner, val: any) => {
    setCoOwners(coOwners.map((o) => (o.id === id ? { ...o, [field]: val } : o)));
  };

  const removeCoOwner = (id: string) => {
    if (coOwners.length <= 1) {
      toast({ title: "Mindestens ein Beteiligter muss existieren", variant: "destructive" });
      return;
    }
    setCoOwners(coOwners.filter((o) => o.id !== id));
  };

  // ─── EXPORTE ────────────────────────────────────────────────────────────────
  const exportCsv = () => {
    const rows = [
      ["Immotracker – Steuerbericht & Anlage V", `Steuerjahr ${taxYear}`],
      ["Generiert am", new Date().toLocaleDateString("de-DE")],
      ["Portfolio-Umfang", `${properties.length} Mieteinheiten`],
      [""],
      ["I. ANLAGE V – EINKÜNFTE AUS VERMIETUNG UND VERPACHTUNG (AGGREGIERT)"],
      ["Formularzeile", "Bezeichnung", "Rechtsgrundlage", "Betrag in EUR"],
      ["Zeile 9-11", "Kaltmieteinnahmen aller Wohnungen", "§ 21 Abs. 1 Nr. 1 EStG", calculations.annualColdRent.toFixed(2)],
      ["Zeile 13", "Umlagen & Nebenkostenvorauszahlungen", "§ 21 Abs. 1 Nr. 1 EStG", calculations.annualUtilitiesAdvances.toFixed(2)],
      ["Summe Einnahmen", "Gesamte steuerpflichtige Einnahmen", "§ 21 Abs. 1 EStG", calculations.totalRevenues.toFixed(2)],
      [""],
      ["Zeile 33", "Schuldzinsen für Anschaffungsdarlehen", "§ 9 Abs. 1 Satz 3 Nr. 1 EStG", calculations.annualMortgageInterest.toFixed(2)],
      ["Zeile 34", "Geldbeschaffungskosten", "§ 9 Abs. 1 EStG", calculations.financingFees.toFixed(2)],
      ["Zeile 37", "Gebäude-AfA (Abschreibung für Abnutzung)", "§ 7 Abs. 4 EStG", calculations.finalAfa.toFixed(2)],
      ["Zeile 39", "Erhaltungsaufwand (Handwerker / Instandhaltung)", "§ 11 Abs. 2 EStG", calculations.maintenanceExpenses.toFixed(2)],
      ["Zeile 46", "Laufende Betriebskosten / Hausgeld", "§ 9 Abs. 1 EStG", calculations.propertyOperatingExpenses.toFixed(2)],
      ["Zeile 47", "Verwaltungskosten, Fahrtkosten, Kontoführung", "§ 9 Abs. 1 EStG", calculations.administrationExpenses.toFixed(2)],
      ["Summe Werbungskosten", "Gesamte abzugsfähige Werbungskosten", "§ 9 EStG", calculations.totalExpenses.toFixed(2)],
      [""],
      ["STEUERLICHES NETTOERGEBNIS", "Einkünfte aus Vermietung & Verpachtung (Überschuss / Verlust)", "§ 21 EStG", calculations.netTaxableIncome.toFixed(2)],
      [""],
      ["II. GESONDERTE & EINHEITLICHE FESTSTELLUNGSERKLÄRUNG (AUFTEILUNG GEMEINSCHAFT)"],
      ["Beteiligter", "Rolle", "Steuer-ID", "Quote (%)", "Anteil Einnahmen (€)", "Anteil Werbungskosten (€)", "Zuzurechnender Gewinn/Verlust (€)"],
      ...coOwners.map((owner) => {
        const factor = (owner.sharePercent || 0) / 100;
        return [
          owner.name,
          owner.role,
          owner.taxId || "–",
          `${owner.sharePercent}%`,
          (calculations.totalRevenues * factor).toFixed(2),
          (calculations.totalExpenses * factor).toFixed(2),
          (calculations.netTaxableIncome * factor).toFixed(2),
        ];
      }),
      [""],
      ["III. STEUERBONUS HANDWERKERLEISTUNGEN § 35a EStG"],
      ["Posten", "Betrag in EUR"],
      ["Lohnkostenanteil Erhaltungsaufwand", calculations.craftsmanLabourShare.toFixed(2)],
      ["Direkter Abzug von der Steuerschuld (20%, max. 1.200 €)", calculations.craftsmanTaxBonus.toFixed(2)],
    ];

    const csvContent = "\uFEFF" + rows.map((r) => r.map((c) => `"${c}"`).join(";")).join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Steuerbericht_Anlage_V_und_Feststellung_${taxYear}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "CSV exportiert", description: `Steuerbericht_Anlage_V_und_Feststellung_${taxYear}.csv erfolgreich heruntergeladen.` });
  };

  const copyAllElsterData = () => {
    const summary = `
=== IMMOTRACKER STEUERDATEN STEUERJAHR ${taxYear} ===

I. ANLAGE V (Einkünfte aus V+V):
• Zeile 9-11 (Mieteinnahmen / Kaltmiete): ${calculations.annualColdRent.toFixed(2)} €
• Zeile 13 (Umlagen / Nebenkostenvorauszahlungen): ${calculations.annualUtilitiesAdvances.toFixed(2)} €
→ Summe Einnahmen: ${calculations.totalRevenues.toFixed(2)} €

• Zeile 33 (Schuldzinsen): ${calculations.annualMortgageInterest.toFixed(2)} €
• Zeile 37 (Gebäude-AfA linear): ${calculations.finalAfa.toFixed(2)} €
• Zeile 39 (Erhaltungsaufwand / Reparaturen): ${calculations.maintenanceExpenses.toFixed(2)} €
• Zeile 46 (Laufende Betriebskosten): ${calculations.propertyOperatingExpenses.toFixed(2)} €
• Zeile 47 (Verwaltung / Reisekosten / Kontoführung): ${calculations.administrationExpenses.toFixed(2)} €
→ Summe Werbungskosten: ${calculations.totalExpenses.toFixed(2)} €

★ STEUERLICHES ERGEBNIS: ${calculations.netTaxableIncome.toFixed(2)} € (${calculations.netTaxableIncome >= 0 ? "Gewinn / Überschuss" : "Steuerlicher Verlust"})

II. FESTSTELLUNGSERKLÄRUNG (ESt 1 B / Anlage FB):
${coOwners.map((o) => `• ${o.name} (${o.sharePercent}%): Anteil Einnahmen: ${(calculations.totalRevenues * (o.sharePercent / 100)).toFixed(2)} € | Anteil Werbungskosten: ${(calculations.totalExpenses * (o.sharePercent / 100)).toFixed(2)} € | Einkünfte: ${(calculations.netTaxableIncome * (o.sharePercent / 100)).toFixed(2)} €`).join("\n")}

III. § 35a Abs. 3 EStG (Handwerkerleistungen):
• Lohnkosten: ${calculations.craftsmanLabourShare.toFixed(2)} €
• Direkte Steuerermäßigung (20%): ${calculations.craftsmanTaxBonus.toFixed(2)} €
    `.trim();

    navigator.clipboard.writeText(summary);
    toast({
      title: "Alle ELSTER-Daten kopiert!",
      description: "Vollständige Zusammenfassung aller Zeilen und Beteiligten in der Zwischenablage.",
    });
  };

  const printTaxReport = () => {
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`
      <html>
        <head>
          <title>Steuerbericht & Feststellungserklärung – ${taxYear}</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 40px; color: #111; line-height: 1.45; }
            h1 { font-size: 20px; margin-bottom: 2px; }
            .subtitle { color: #666; font-size: 13px; margin-bottom: 20px; }
            .section-title { font-size: 14px; font-weight: bold; margin-top: 24px; margin-bottom: 8px; border-bottom: 2px solid #2563eb; padding-bottom: 4px; color: #1e3a8a; }
            table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 12px; }
            th, td { border: 1px solid #ddd; padding: 6px 10px; }
            th { background: #f8fafc; text-align: left; font-weight: 600; }
            .right { text-align: right; }
            .mono { font-family: monospace; }
            .bold { font-weight: bold; }
            .total-row { background: #f1f5f9; font-weight: bold; }
            .highlight-row { background: #eff6ff; font-weight: bold; font-size: 13px; }
            .grid { display: flex; gap: 20px; margin-top: 16px; }
            .box { flex: 1; border: 1px solid #cbd5e1; border-radius: 6px; padding: 12px; background: #fafafa; }
            .footer { margin-top: 36px; font-size: 11px; color: #64748b; border-top: 1px solid #e2e8f0; padding-top: 12px; display: flex; justify-content: space-between; }
            .signature { margin-top: 36px; display: flex; justify-content: space-between; }
            .sign-line { width: 220px; border-top: 1px solid #333; margin-top: 35px; text-align: center; font-size: 11px; }
            @media print { body { padding: 15px; } }
          </style>
        </head>
        <body>
          <h1>Steuerbericht: Anlage V & Feststellungserklärung</h1>
          <div class="subtitle">Steuerjahr ${taxYear} · Erstellt via Immotracker Portfolio-System am ${new Date().toLocaleDateString("de-DE")}</div>

          <div class="grid">
            <div class="box">
              <div style="font-size: 11px; color: #64748b; text-transform: uppercase;">Steuerpflichtige Einnahmen</div>
              <div style="font-size: 18px; font-weight: bold; color: #16a34a;" class="mono">${formatCurrency(calculations.totalRevenues)}</div>
              <div style="font-size: 11px; color: #64748b;">Kaltmieten & Nebenkostenvorschüsse (${properties.length} Einheiten)</div>
            </div>
            <div class="box">
              <div style="font-size: 11px; color: #64748b; text-transform: uppercase;">Abzugsfähige Werbungskosten</div>
              <div style="font-size: 18px; font-weight: bold; color: #d97706;" class="mono">${formatCurrency(calculations.totalExpenses)}</div>
              <div style="font-size: 11px; color: #64748b;">Zinsen, Gebäude-AfA, Instandhaltung, Betriebskosten</div>
            </div>
            <div class="box">
              <div style="font-size: 11px; color: #64748b; text-transform: uppercase;">Einkünfte aus V+V (Netto)</div>
              <div style="font-size: 18px; font-weight: bold; color: ${calculations.netTaxableIncome >= 0 ? "#16a34a" : "#2563eb"};" class="mono">${formatCurrency(calculations.netTaxableIncome)}</div>
              <div style="font-size: 11px; color: #64748b;">${calculations.netTaxableIncome >= 0 ? "Steuerpflichtiger Überschuss" : "Steuerlicher Verlust (senkt zvE)"}</div>
            </div>
          </div>

          <div class="section-title">I. Amtliche Anlage V (Einkommensteuererklärung)</div>
          <table>
            <thead>
              <tr>
                <th style="width: 100px;">Zeile Anlage V</th>
                <th>Bezeichnung laut ELSTER-Formular</th>
                <th>Rechtsgrundlage</th>
                <th class="right" style="width: 130px;">Jahresbetrag</th>
              </tr>
            </thead>
            <tbody>
              <tr><td class="bold">Zeile 9–11</td><td>Mieteinnahmen für Wohnungen (Kaltmieten)</td><td>§ 21 Abs. 1 EStG</td><td class="right mono">${formatCurrency(calculations.annualColdRent)}</td></tr>
              <tr><td class="bold">Zeile 13</td><td>Umlagen und Nebenkostenvorauszahlungen der Mieter</td><td>§ 21 Abs. 1 EStG</td><td class="right mono">${formatCurrency(calculations.annualUtilitiesAdvances)}</td></tr>
              <tr class="total-row"><td colspan="3">Summe der steuerpflichtigen Einnahmen</td><td class="right mono" style="color: #16a34a;">${formatCurrency(calculations.totalRevenues)}</td></tr>

              <tr><td class="bold">Zeile 33</td><td>Schuldzinsen zur Finanzierung der Anschaffung</td><td>§ 9 Abs. 1 Satz 3 EStG</td><td class="right mono">${formatCurrency(calculations.annualMortgageInterest)}</td></tr>
              <tr><td class="bold">Zeile 37</td><td>Absetzung für Abnutzung (Gebäude-AfA ${afaRatePercent}% p.a.)</td><td>§ 7 Abs. 4 EStG</td><td class="right mono">${formatCurrency(calculations.finalAfa)}</td></tr>
              <tr><td class="bold">Zeile 39</td><td>Erhaltungsaufwand (Instandhaltung & Handwerker)</td><td>§ 11 Abs. 2 EStG</td><td class="right mono">${formatCurrency(calculations.maintenanceExpenses)}</td></tr>
              <tr><td class="bold">Zeile 46</td><td>Laufende Betriebskosten (Schornsteinfeger, Hausgeld, Grundsteuer)</td><td>§ 9 Abs. 1 EStG</td><td class="right mono">${formatCurrency(calculations.propertyOperatingExpenses)}</td></tr>
              <tr><td class="bold">Zeile 47</td><td>Verwaltungskosten, Reisekosten (0,30 €/km), Kontoführung</td><td>§ 9 Abs. 1 EStG</td><td class="right mono">${formatCurrency(calculations.administrationExpenses)}</td></tr>
              <tr class="total-row"><td colspan="3">Summe der abzugsfähigen Werbungskosten</td><td class="right mono" style="color: #d97706;">${formatCurrency(calculations.totalExpenses)}</td></tr>

              <tr class="highlight-row">
                <td colspan="3">Einkünfte aus Vermietung und Verpachtung (Einnahmen ./. Werbungskosten)</td>
                <td class="right mono">${formatCurrency(calculations.netTaxableIncome)}</td>
              </tr>
            </tbody>
          </table>

          <div class="section-title">II. Gesonderte und einheitliche Feststellung (Aufteilung für Gemeinschaft / Ehegatten)</div>
          <table>
            <thead>
              <tr>
                <th>Beteiligter / Miteigentümer</th>
                <th>Rolle</th>
                <th>Steuer-Identifikationsnummer</th>
                <th class="right">Quote</th>
                <th class="right">Anteil Einnahmen</th>
                <th class="right">Anteil Werbungskosten</th>
                <th class="right">Zugewiesene Einkünfte</th>
              </tr>
            </thead>
            <tbody>
              ${coOwners.map((owner) => {
                const f = (owner.sharePercent || 0) / 100;
                return `
                  <tr>
                    <td class="bold">${owner.name}</td>
                    <td>${owner.role}</td>
                    <td>${owner.taxId || "–"}</td>
                    <td class="right bold">${owner.sharePercent}%</td>
                    <td class="right mono">${formatCurrency(calculations.totalRevenues * f)}</td>
                    <td class="right mono">${formatCurrency(calculations.totalExpenses * f)}</td>
                    <td class="right mono bold" style="color: ${calculations.netTaxableIncome >= 0 ? "#16a34a" : "#2563eb"};">${formatCurrency(calculations.netTaxableIncome * f)}</td>
                  </tr>
                `;
              }).join("")}
            </tbody>
          </table>

          <div class="section-title">III. Nachweis Handwerkerleistungen gem. § 35a Abs. 3 EStG</div>
          <div style="border: 1px dashed #94a3b8; padding: 10px 14px; background: #f8fafc; font-size: 12px; border-radius: 6px;">
            Enthaltener Lohn-, Fahrt- und Maschinenkostenanteil der Handwerkerrechnungen: <strong>${formatCurrency(calculations.craftsmanLabourShare)}</strong>.<br />
            Direkte Steuerermäßigung (20% der Lohnkosten, gesetzlicher Höchstbetrag 1.200 € p.a.): <strong style="color: #16a34a;">${formatCurrency(calculations.craftsmanTaxBonus)}</strong>.
          </div>

          <div class="signature">
            <div class="sign-line">Ort, Datum</div>
            <div class="sign-line">Unterschrift Steuerpflichtige(r) / Miteigentümer</div>
          </div>

          <div class="footer">
            <span>Immotracker Portfolio-Verwaltung · Vollständig offline & lokal berechnet</span>
            <span>Finanzamt / Steuerberater Nachweis</span>
          </div>
          <script>window.print();</script>
        </body>
      </html>
    `);
    win.document.close();
  };

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      {/* ─── Header ──────────────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
              <ReceiptText className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Steuern & Anlage V</h1>
              <p className="text-xs text-muted-foreground">
                Amtliche Anlage V (Einkommensteuer) & Feststellungserklärung (ESt 1 B / Anlage FB) für Ihre {properties.length} Mieteinheiten
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Steuerjahr Auswahl */}
          <div className="flex items-center gap-1.5 bg-card border border-border rounded-lg px-2.5 py-1">
            <Calendar className="h-4 w-4 text-primary" />
            <span className="text-xs text-muted-foreground mr-1">Steuerjahr:</span>
            <Select value={taxYear} onValueChange={setTaxYear}>
              <SelectTrigger className="w-24 h-7 text-xs border-0 p-0 focus:ring-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="2026">2026</SelectItem>
                <SelectItem value="2025">2025</SelectItem>
                <SelectItem value="2024">2024</SelectItem>
                <SelectItem value="2023">2023</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button size="sm" variant="outline" onClick={copyAllElsterData} className="gap-1.5 h-8 text-xs">
            <Copy className="h-3.5 w-3.5 text-primary" /> ELSTER kopieren
          </Button>

          <Button size="sm" variant="outline" onClick={exportCsv} className="gap-1.5 h-8 text-xs">
            <Download className="h-3.5 w-3.5" /> CSV-Export
          </Button>

          <Button size="sm" onClick={printTaxReport} className="gap-1.5 h-8 text-xs bg-blue-600 hover:bg-blue-700 text-white">
            <Printer className="h-3.5 w-3.5" /> Drucken / PDF
          </Button>
        </div>
      </div>

      {/* ─── KPI Cards: Das Wichtigste auf einen Blick ──────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Einnahmen */}
        <Card className="border-border/60 hover:shadow-md transition-shadow">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-medium flex items-center justify-between">
              <span>Einnahmen (§ 21 EStG)</span>
              <Badge variant="outline" className="text-[10px] text-green-500 border-green-500/30">
                Zeile 9-13
              </Badge>
            </CardDescription>
            <CardTitle className="text-2xl font-bold font-mono text-green-500">
              {formatCurrency(calculations.totalRevenues)}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground space-y-1">
            <div className="flex justify-between">
              <span>Kaltmieten p.a.:</span>
              <span className="font-mono text-foreground">{formatCurrency(calculations.annualColdRent)}</span>
            </div>
            <div className="flex justify-between">
              <span>Umlagen / NK p.a.:</span>
              <span className="font-mono text-foreground">{formatCurrency(calculations.annualUtilitiesAdvances)}</span>
            </div>
          </CardContent>
        </Card>

        {/* Werbungskosten */}
        <Card className="border-border/60 hover:shadow-md transition-shadow">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-medium flex items-center justify-between">
              <span>Werbungskosten (§ 9 EStG)</span>
              <Badge variant="outline" className="text-[10px] text-amber-500 border-amber-500/30">
                Zeile 33-47
              </Badge>
            </CardDescription>
            <CardTitle className="text-2xl font-bold font-mono text-amber-500">
              {formatCurrency(calculations.totalExpenses)}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground space-y-1">
            <div className="flex justify-between">
              <span>Schuldzinsen:</span>
              <span className="font-mono text-foreground">{formatCurrency(calculations.annualMortgageInterest)}</span>
            </div>
            <div className="flex justify-between">
              <span>Gebäude-AfA:</span>
              <span className="font-mono text-foreground">{formatCurrency(calculations.finalAfa)}</span>
            </div>
          </CardContent>
        </Card>

        {/* Steuerliches Gesamtergebnis */}
        <Card className={`border-2 transition-shadow ${
          calculations.netTaxableIncome >= 0
            ? "border-green-500/30 bg-green-500/5 hover:border-green-500/50"
            : "border-blue-500/30 bg-blue-500/5 hover:border-blue-500/50"
        }`}>
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-medium flex items-center justify-between">
              <span>Einkünfte aus V+V (Netto)</span>
              <Badge variant={calculations.netTaxableIncome >= 0 ? "default" : "secondary"} className="text-[10px]">
                {calculations.netTaxableIncome >= 0 ? "Überschuss" : "Verlust"}
              </Badge>
            </CardDescription>
            <CardTitle className={`text-2xl font-bold font-mono ${
              calculations.netTaxableIncome >= 0 ? "text-green-500" : "text-blue-500"
            }`}>
              {formatCurrency(calculations.netTaxableIncome)}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            {calculations.netTaxableIncome >= 0 ? (
              <span className="text-green-600 dark:text-green-400">
                Steuerpflichtiger Überschuss, unterliegt dem Grenzsteuersatz.
              </span>
            ) : (
              <span className="text-blue-600 dark:text-blue-400">
                Steuerlicher Verlust – senkt direkt Ihr Gesamteinkommen (Steuerersparnis!).
              </span>
            )}
          </CardContent>
        </Card>

        {/* Handwerkerleistungen § 35a */}
        <Card className="border-border/60 hover:shadow-md transition-shadow">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-medium flex items-center justify-between">
              <span>Handwerkerbonus (§ 35a EStG)</span>
              <Badge variant="outline" className="text-[10px] text-primary border-primary/30">
                20% direkt
              </Badge>
            </CardDescription>
            <CardTitle className="text-2xl font-bold font-mono text-primary">
              {formatCurrency(calculations.craftsmanTaxBonus)}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground space-y-1">
            <div className="flex justify-between">
              <span>Lohnanteil Instandhaltung:</span>
              <span className="font-mono text-foreground">{formatCurrency(calculations.craftsmanLabourShare)}</span>
            </div>
            <div className="text-[11px] text-muted-foreground">
              Direkter Steuerabzug (max. 1.200 €/Jahr)
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ─── Main Tabs ──────────────────────────────────────────────────────── */}
      <Tabs defaultValue="anlage-v" className="w-full space-y-4">
        <TabsList className="grid w-full grid-cols-2 md:grid-cols-5 h-auto p-1 bg-secondary/50">
          <TabsTrigger value="anlage-v" className="gap-1.5 py-2">
            <FileSpreadsheet className="h-4 w-4" /> Anlage V (ESt)
          </TabsTrigger>
          <TabsTrigger value="feststellung" className="gap-1.5 py-2">
            <Users className="h-4 w-4" /> Feststellungserklärung
          </TabsTrigger>
          <TabsTrigger value="objekte" className="gap-1.5 py-2">
            <Building2 className="h-4 w-4" /> Objektweise Aufstellung
          </TabsTrigger>
          <TabsTrigger value="afa" className="gap-1.5 py-2">
            <Calculator className="h-4 w-4" /> AfA & Abschreibung
          </TabsTrigger>
          <TabsTrigger value="tipps" className="gap-1.5 py-2">
            <Sparkles className="h-4 w-4" /> Tipps & Fristen
          </TabsTrigger>
        </TabsList>

        {/* ─── TAB 1: ANLAGE V (EINKOMMENSTEUER) ────────────────────────────── */}
        <TabsContent value="anlage-v" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <FileSpreadsheet className="h-5 w-5 text-primary" />
                    Amtliche Anlage V (Steuerjahr {taxYear})
                  </CardTitle>
                  <CardDescription>
                    Exakte Zeilennummern der amtlichen ELSTER Anlage V für Ihr gesamtes Portfolio
                  </CardDescription>
                </div>
                <div className="text-xs text-muted-foreground flex items-center gap-1.5 bg-secondary/50 px-3 py-1.5 rounded-lg border">
                  <span>💡</span>
                  <span>Klicken Sie auf </span>
                  <Copy className="h-3 w-3 inline text-primary" />
                  <span> um einen Wert direkt für ELSTER zu kopieren</span>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* I. Einnahmen */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-semibold text-primary flex items-center gap-2">
                    <span>I. Einnahmen (§ 21 Abs. 1 EStG)</span>
                  </h3>
                  <span className="text-xs font-mono text-muted-foreground">
                    Summe: <strong className="text-green-500 font-bold">{formatCurrency(calculations.totalRevenues)}</strong>
                  </span>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-28">ELSTER Zeile</TableHead>
                      <TableHead>Steuerliche Kategorie / Posten</TableHead>
                      <TableHead className="text-right">Jahresbetrag</TableHead>
                      <TableHead className="w-20 text-center">Aktion</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell className="font-mono text-xs font-semibold">Zeile 9–11</TableCell>
                      <TableCell className="text-sm">
                        <div className="font-medium">Mieteinnahmen (Kaltmieten)</div>
                        <div className="text-xs text-muted-foreground">Soll-Kaltmiete aller {properties.length} Einheiten p.a.</div>
                      </TableCell>
                      <TableCell className="text-right font-mono font-semibold text-sm">
                        {formatCurrency(calculations.annualColdRent)}
                      </TableCell>
                      <TableCell className="text-center">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0"
                          onClick={() => copyValue("Zeile 9-11 (Kaltmiete)", calculations.annualColdRent)}
                          title="In Zwischenablage kopieren"
                        >
                          {copiedLine === "Zeile 9-11 (Kaltmiete)" ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5 text-muted-foreground" />}
                        </Button>
                      </TableCell>
                    </TableRow>

                    <TableRow>
                      <TableCell className="font-mono text-xs font-semibold">Zeile 13</TableCell>
                      <TableCell className="text-sm">
                        <div className="font-medium">Umlagen & Nebenkostenvorauszahlungen</div>
                        <div className="text-xs text-muted-foreground">Vom Mieter gezahlte Betriebskostenvorauszahlungen</div>
                      </TableCell>
                      <TableCell className="text-right font-mono font-semibold text-sm">
                        {formatCurrency(calculations.annualUtilitiesAdvances)}
                      </TableCell>
                      <TableCell className="text-center">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0"
                          onClick={() => copyValue("Zeile 13 (Umlagen)", calculations.annualUtilitiesAdvances)}
                          title="In Zwischenablage kopieren"
                        >
                          {copiedLine === "Zeile 13 (Umlagen)" ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5 text-muted-foreground" />}
                        </Button>
                      </TableCell>
                    </TableRow>

                    <TableRow className="bg-secondary/40 font-bold">
                      <TableCell colSpan={2}>Summe der steuerpflichtigen Einnahmen</TableCell>
                      <TableCell className="text-right font-mono text-green-500 text-sm">
                        {formatCurrency(calculations.totalRevenues)}
                      </TableCell>
                      <TableCell className="text-center">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0"
                          onClick={() => copyValue("Summe Einnahmen", calculations.totalRevenues)}
                          title="In Zwischenablage kopieren"
                        >
                          {copiedLine === "Summe Einnahmen" ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5 text-muted-foreground" />}
                        </Button>
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>

              {/* II. Werbungskosten */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-semibold text-primary flex items-center gap-2">
                    <span>II. Werbungskosten (§ 9 EStG)</span>
                  </h3>
                  <span className="text-xs font-mono text-muted-foreground">
                    Summe: <strong className="text-amber-500 font-bold">{formatCurrency(calculations.totalExpenses)}</strong>
                  </span>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-28">ELSTER Zeile</TableHead>
                      <TableHead>Werbungskosten-Kategorie</TableHead>
                      <TableHead className="text-right">Jahresbetrag</TableHead>
                      <TableHead className="w-20 text-center">Aktion</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell className="font-mono text-xs font-semibold">Zeile 33</TableCell>
                      <TableCell className="text-sm">
                        <div className="font-medium">Schuldzinsen zur Finanzierung der Anschaffung</div>
                        <div className="text-xs text-muted-foreground">Reiner Zinsanteil der Annuitätendarlehen (ohne Tilgung)</div>
                      </TableCell>
                      <TableCell className="text-right font-mono font-semibold text-sm">
                        {formatCurrency(calculations.annualMortgageInterest)}
                      </TableCell>
                      <TableCell className="text-center">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0"
                          onClick={() => copyValue("Zeile 33 (Schuldzinsen)", calculations.annualMortgageInterest)}
                        >
                          {copiedLine === "Zeile 33 (Schuldzinsen)" ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5 text-muted-foreground" />}
                        </Button>
                      </TableCell>
                    </TableRow>

                    <TableRow>
                      <TableCell className="font-mono text-xs font-semibold">Zeile 37</TableCell>
                      <TableCell className="text-sm">
                        <div className="font-medium">Absetzung für Abnutzung (Gebäude-AfA)</div>
                        <div className="text-xs text-muted-foreground">
                          Lineare Gebäudeabschreibung ({afaRatePercent}% p.a. auf {buildingSharePercent}% Gebäudeanteil)
                          {calculations.isAfaEstimated && " • geschätzt, da Kaufpreise in Wohnungen noch unvollständig"}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-mono font-semibold text-sm">
                        {formatCurrency(calculations.finalAfa)}
                      </TableCell>
                      <TableCell className="text-center">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0"
                          onClick={() => copyValue("Zeile 37 (AfA)", calculations.finalAfa)}
                        >
                          {copiedLine === "Zeile 37 (AfA)" ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5 text-muted-foreground" />}
                        </Button>
                      </TableCell>
                    </TableRow>

                    <TableRow>
                      <TableCell className="font-mono text-xs font-semibold">Zeile 39</TableCell>
                      <TableCell className="text-sm">
                        <div className="font-medium">Erhaltungsaufwand (Instandhaltung & Handwerker)</div>
                        <div className="text-xs text-muted-foreground">Reparatur- und Wartungsrechnungen für die Wohnungen</div>
                      </TableCell>
                      <TableCell className="text-right font-mono font-semibold text-sm">
                        {formatCurrency(calculations.maintenanceExpenses)}
                      </TableCell>
                      <TableCell className="text-center">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0"
                          onClick={() => copyValue("Zeile 39 (Erhaltungsaufwand)", calculations.maintenanceExpenses)}
                        >
                          {copiedLine === "Zeile 39 (Erhaltungsaufwand)" ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5 text-muted-foreground" />}
                        </Button>
                      </TableCell>
                    </TableRow>

                    <TableRow>
                      <TableCell className="font-mono text-xs font-semibold">Zeile 46</TableCell>
                      <TableCell className="text-sm">
                        <div className="font-medium">Laufende Betriebskosten / Hausgeld</div>
                        <div className="text-xs text-muted-foreground">Grundsteuer, Gebäudeversicherung, Müll, Schornsteinfeger</div>
                      </TableCell>
                      <TableCell className="text-right font-mono font-semibold text-sm">
                        {formatCurrency(calculations.propertyOperatingExpenses)}
                      </TableCell>
                      <TableCell className="text-center">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0"
                          onClick={() => copyValue("Zeile 46 (Betriebskosten)", calculations.propertyOperatingExpenses)}
                        >
                          {copiedLine === "Zeile 46 (Betriebskosten)" ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5 text-muted-foreground" />}
                        </Button>
                      </TableCell>
                    </TableRow>

                    <TableRow>
                      <TableCell className="font-mono text-xs font-semibold">Zeile 47</TableCell>
                      <TableCell className="text-sm">
                        <div className="font-medium">Verwaltungskosten, Reisekosten, Kontoführung</div>
                        <div className="text-xs text-muted-foreground">
                          Fahrtkosten ({drivenKm} km × 0,30 € = {formatCurrency(calculations.travelExpenses)}), Kontoführung ({formatCurrency(calculations.bankFees)}), Software ({formatCurrency(calculations.softwareFees)}), WEG-Verwaltung
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-mono font-semibold text-sm">
                        {formatCurrency(calculations.administrationExpenses)}
                      </TableCell>
                      <TableCell className="text-center">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0"
                          onClick={() => copyValue("Zeile 47 (Verwaltung & Reise)", calculations.administrationExpenses)}
                        >
                          {copiedLine === "Zeile 47 (Verwaltung & Reise)" ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5 text-muted-foreground" />}
                        </Button>
                      </TableCell>
                    </TableRow>

                    <TableRow className="bg-secondary/40 font-bold">
                      <TableCell colSpan={2}>Summe der abzugsfähigen Werbungskosten</TableCell>
                      <TableCell className="text-right font-mono text-amber-500 text-sm">
                        {formatCurrency(calculations.totalExpenses)}
                      </TableCell>
                      <TableCell className="text-center">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0"
                          onClick={() => copyValue("Summe Werbungskosten", calculations.totalExpenses)}
                        >
                          {copiedLine === "Summe Werbungskosten" ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5 text-muted-foreground" />}
                        </Button>
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>

              {/* III. Steuerliches Gesamtergebnis */}
              <div className="p-4 rounded-xl border border-primary/30 bg-primary/5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h4 className="font-bold text-base flex items-center gap-2">
                    <span>Einkünfte aus Vermietung und Verpachtung (§ 21 EStG)</span>
                  </h4>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Saldo: Einnahmen ({formatCurrency(calculations.totalRevenues)}) minus Werbungskosten ({formatCurrency(calculations.totalExpenses)})
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <span className={`text-2xl font-bold font-mono ${
                      calculations.netTaxableIncome >= 0 ? "text-green-500" : "text-blue-500"
                    }`}>
                      {formatCurrency(calculations.netTaxableIncome)}
                    </span>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 gap-1.5 text-xs"
                    onClick={() => copyValue("Netto Einkünfte V+V", calculations.netTaxableIncome)}
                  >
                    <Copy className="h-3.5 w-3.5" /> Kopieren
                  </Button>
                </div>
              </div>

              {/* Zusätzliche Parameter Feineinstellung */}
              <div className="p-4 rounded-xl border border-border/80 bg-card/60 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <span>⚙️</span>
                    <span>Werbungskosten Feineinstellung (wird automatisch eingerechnet)</span>
                  </h4>
                  <span className="text-[11px] text-muted-foreground">Gilt für Steuerjahr {taxYear}</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Fahrten zum Objekt / WEG (km p.a.)</Label>
                    <div className="flex items-center gap-1.5">
                      <Input
                        type="number"
                        className="h-8 text-xs font-mono"
                        value={drivenKm}
                        onChange={(e) => setDrivenKm(Number(e.target.value) || 0)}
                      />
                      <span className="text-xs text-muted-foreground whitespace-nowrap">× 0,30 €</span>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Mietkonto / Bankspesen (€ p.a.)</Label>
                    <Input
                      type="number"
                      className="h-8 text-xs font-mono"
                      value={accountFees}
                      onChange={(e) => setAccountFees(Number(e.target.value) || 0)}
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Büro, Software & Fachliteratur (€ p.a.)</Label>
                    <Input
                      type="number"
                      className="h-8 text-xs font-mono"
                      value={softwareAndOffice}
                      onChange={(e) => setSoftwareAndOffice(Number(e.target.value) || 0)}
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── TAB 2: FESTSTELLUNGSERKLÄRUNG (GEMEINSCHAFTEN) ───────────────── */}
        <TabsContent value="feststellung" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Users className="h-5 w-5 text-indigo-500" />
                    Gesonderte und einheitliche Feststellung (ESt 1 B / Anlage FB)
                  </CardTitle>
                  <CardDescription>
                    Für Eigentümergemeinschaften, Ehegatten (z.B. 50/50), Erbengemeinschaften oder Immobilien-GbRs
                  </CardDescription>
                </div>
                <Button size="sm" onClick={addCoOwner} variant="outline" className="gap-1.5 h-8 text-xs">
                  <Plus className="h-3.5 w-3.5" /> Miteigentümer hinzufügen
                </Button>
              </div>
            </CardHeader>

            <CardContent className="space-y-6">
              {/* Erklärung & Quoten-Status */}
              <div className="p-3.5 rounded-xl border border-indigo-500/30 bg-indigo-500/5 text-xs space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Info className="h-4 w-4 text-indigo-500 flex-shrink-0" />
                    <span className="font-semibold text-foreground">
                      Wann ist die Feststellungserklärung notwendig?
                    </span>
                  </div>
                  <Badge variant={isShareValid ? "outline" : "destructive"} className="text-xs font-mono">
                    Quoten-Summe: {totalOwnerShare.toFixed(1)}% {isShareValid ? "✓ (100% verteilt)" : "⚠️ Summe muss 100% sein"}
                  </Badge>
                </div>
                <p className="text-muted-foreground leading-relaxed">
                  Gehören die vermieteten Immobilien mehreren Personen (z.B. Ehepartnern zu gleichen Teilen oder einer GbR), verlangt das Finanzamt das amtliche Formular <strong>ESt 1 B</strong> mit <strong>Anlage FB (Feststellungsbeteiligte)</strong> und <strong>Anlage V</strong>. Das Gesamtergebnis aus Vermietung und Verpachtung wird dort zentral ermittelt und anteilig den Miteigentümern zugewiesen.
                </p>
              </div>

              {/* Miteigentümer-Konfiguration */}
              <div className="space-y-3">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Beteiligte & Quoten festlegen
                </h4>
                <div className="grid grid-cols-1 gap-3">
                  {coOwners.map((owner, idx) => (
                    <div
                      key={owner.id}
                      className="p-3 rounded-xl border border-border/70 bg-card flex flex-col md:flex-row md:items-center justify-between gap-3"
                    >
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 flex-1">
                        <div>
                          <Label className="text-[11px] text-muted-foreground">Name des Beteiligten</Label>
                          <Input
                            className="h-8 text-xs"
                            value={owner.name}
                            onChange={(e) => updateCoOwner(owner.id, "name", e.target.value)}
                            placeholder="z.B. Max Mustermann"
                          />
                        </div>
                        <div>
                          <Label className="text-[11px] text-muted-foreground">Rolle / Status</Label>
                          <Input
                            className="h-8 text-xs"
                            value={owner.role}
                            onChange={(e) => updateCoOwner(owner.id, "role", e.target.value)}
                            placeholder="z.B. Ehegatte A / Gesellschafter"
                          />
                        </div>
                        <div>
                          <Label className="text-[11px] text-muted-foreground">Steuernummer / IdNr. (optional)</Label>
                          <Input
                            className="h-8 text-xs font-mono"
                            value={owner.taxId}
                            onChange={(e) => updateCoOwner(owner.id, "taxId", e.target.value)}
                            placeholder="12/345/67890"
                          />
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="w-24">
                          <Label className="text-[11px] text-muted-foreground">Beteiligungsquote</Label>
                          <div className="flex items-center gap-1">
                            <Input
                              type="number"
                              min="0"
                              max="100"
                              step="0.5"
                              className="h-8 text-xs font-mono font-bold"
                              value={owner.sharePercent}
                              onChange={(e) => updateCoOwner(owner.id, "sharePercent", parseFloat(e.target.value) || 0)}
                            />
                            <span className="text-xs text-muted-foreground">%</span>
                          </div>
                        </div>

                        {coOwners.length > 1 && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive self-end"
                            onClick={() => removeCoOwner(owner.id)}
                            title="Beteiligten entfernen"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Aufteilungsergebnis Tabelle */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Aufteilung des steuerlichen Gesamtergebnisses (Anlage FB)
                  </h4>
                  <span className="text-xs text-muted-foreground">
                    Steuerjahr {taxYear} • Gesamtergebnis: <strong className="font-mono">{formatCurrency(calculations.netTaxableIncome)}</strong>
                  </span>
                </div>

                <div className="border rounded-xl overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-secondary/40">
                        <TableHead>Beteiligter (Anlage FB)</TableHead>
                        <TableHead className="text-right">Quote</TableHead>
                        <TableHead className="text-right">Anteil Einnahmen</TableHead>
                        <TableHead className="text-right">Anteil Werbungskosten</TableHead>
                        <TableHead className="text-right">Zuzurechnende Einkünfte V+V</TableHead>
                        <TableHead className="text-right">Anteil Handwerkerbonus</TableHead>
                        <TableHead className="w-24 text-center">ELSTER</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {coOwners.map((owner) => {
                        const factor = (owner.sharePercent || 0) / 100;
                        const ownerRev = calculations.totalRevenues * factor;
                        const ownerExp = calculations.totalExpenses * factor;
                        const ownerNet = calculations.netTaxableIncome * factor;
                        const ownerBonus = calculations.craftsmanTaxBonus * factor;

                        const copyOwnerSummary = () => {
                          const text = `
=== FESTSTELLUNGSERKLÄRUNG: ${owner.name.toUpperCase()} (${owner.sharePercent}%) ===
Steuer-ID: ${owner.taxId || "–"}
Rolle: ${owner.role}
• Anteilige Einnahmen (Zeile 9-13): ${ownerRev.toFixed(2)} €
• Anteilige Werbungskosten (Zeile 33-47): ${ownerExp.toFixed(2)} €
★ Zuzurechnende Einkünfte aus V+V (Anlage FB Zeile 10): ${ownerNet.toFixed(2)} €
• Anteiliger Handwerkerbonus § 35a (Anlage FB Zeile 14): ${ownerBonus.toFixed(2)} €
                          `.trim();
                          navigator.clipboard.writeText(text);
                          toast({
                            title: `Werte für ${owner.name} kopiert`,
                            description: "Beträge für Anlage FB in die Zwischenablage kopiert.",
                          });
                        };

                        return (
                          <TableRow key={owner.id}>
                            <TableCell className="font-semibold text-sm">
                              <div>{owner.name}</div>
                              <div className="text-xs text-muted-foreground">{owner.role} {owner.taxId ? `• St.-Nr. ${owner.taxId}` : ""}</div>
                            </TableCell>
                            <TableCell className="text-right font-mono font-bold text-sm">
                              {owner.sharePercent}%
                            </TableCell>
                            <TableCell className="text-right font-mono text-sm text-green-500">
                              {formatCurrency(ownerRev)}
                            </TableCell>
                            <TableCell className="text-right font-mono text-sm text-amber-500">
                              {formatCurrency(ownerExp)}
                            </TableCell>
                            <TableCell className={`text-right font-mono font-bold text-sm ${
                              ownerNet >= 0 ? "text-green-500" : "text-blue-500"
                            }`}>
                              {formatCurrency(ownerNet)}
                            </TableCell>
                            <TableCell className="text-right font-mono text-sm text-primary">
                              {formatCurrency(ownerBonus)}
                            </TableCell>
                            <TableCell className="text-center">
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs gap-1"
                                onClick={copyOwnerSummary}
                                title="Werte für diesen Beteiligten kopieren"
                              >
                                <Copy className="h-3 w-3" /> Kopieren
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── TAB 3: OBJEKTWEISE AUFSTELLUNG (JE IMMOBILIE) ────────────────── */}
        <TabsContent value="objekte" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Building2 className="h-5 w-5 text-primary" />
                    Objektweise Aufstellung je Mietwohnung
                  </CardTitle>
                  <CardDescription>
                    Das Finanzamt verlangt für jede Immobilie eine separate Anlage V. Hier finden Sie alle Werte pro Einheit.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-secondary/40">
                      <TableHead>Wohnung / Adresse</TableHead>
                      <TableHead className="text-right">Kaltmiete p.a.</TableHead>
                      <TableHead className="text-right">Umlagen p.a.</TableHead>
                      <TableHead className="text-right">Schuldzinsen</TableHead>
                      <TableHead className="text-right">Gebäude-AfA</TableHead>
                      <TableHead className="text-right">Instandhaltung</TableHead>
                      <TableHead className="text-right">Betriebskosten</TableHead>
                      <TableHead className="text-right">Netto V+V</TableHead>
                      <TableHead className="w-24 text-center">ELSTER</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {calculations.perPropertyBreakdown.map((item) => {
                      const copyPropSummary = () => {
                        const txt = `
=== ANLAGE V FÜR: ${item.name.toUpperCase()} ===
Adresse: ${item.address} (${item.sqm} m²)
Mieter: ${item.tenant}
• Zeile 9-11 (Kaltmiete): ${item.rent.toFixed(2)} €
• Zeile 13 (Umlagen): ${item.utilities.toFixed(2)} €
→ Summe Einnahmen: ${item.totalRev.toFixed(2)} €
• Zeile 33 (Schuldzinsen): ${item.interest.toFixed(2)} €
• Zeile 37 (AfA Abschreibung): ${item.afa.toFixed(2)} €
• Zeile 39 (Erhaltungsaufwand): ${item.maintenance.toFixed(2)} €
• Zeile 46 (Betriebskosten): ${item.operating.toFixed(2)} €
• Zeile 47 (Verwaltung): ${item.admin.toFixed(2)} €
→ Summe Werbungskosten: ${item.totalExp.toFixed(2)} €
★ STEUERLICHES NETTOERGEBNIS DIESER EINHEIT: ${item.netIncome.toFixed(2)} €
                        `.trim();
                        navigator.clipboard.writeText(txt);
                        toast({
                          title: `Werte für "${item.name}" kopiert`,
                          description: "Anlage V Daten dieser Wohnung in die Zwischenablage gelegt.",
                        });
                      };

                      return (
                        <TableRow key={item.id}>
                          <TableCell className="font-semibold text-sm">
                            <div>{item.name}</div>
                            <div className="text-xs text-muted-foreground">{item.address} • {item.sqm} m²</div>
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm">
                            {formatCurrency(item.rent)}
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm">
                            {formatCurrency(item.utilities)}
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm text-amber-500">
                            {formatCurrency(item.interest)}
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm text-amber-500">
                            {formatCurrency(item.afa)}
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm text-amber-500">
                            {formatCurrency(item.maintenance)}
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm text-amber-500">
                            {formatCurrency(item.operating)}
                          </TableCell>
                          <TableCell className={`text-right font-mono font-bold text-sm ${
                            item.netIncome >= 0 ? "text-green-500" : "text-blue-500"
                          }`}>
                            {formatCurrency(item.netIncome)}
                          </TableCell>
                          <TableCell className="text-center">
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs gap-1"
                              onClick={copyPropSummary}
                              title="Werte dieser Wohnung kopieren"
                            >
                              <Copy className="h-3 w-3" /> Kopieren
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── TAB 4: AfA-RECHNER & ABSCHREIBUNGSÜBERSICHT ───────────────────── */}
        <TabsContent value="afa" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Calculator className="h-5 w-5 text-primary" />
                    AfA-Rechner & Gebäudeabschreibung (§ 7 Abs. 4 EStG)
                  </CardTitle>
                  <CardDescription>
                    Berechnung der steuerlichen Abschreibung auf Grundlage von Kaufpreisen und Anschaffungsnebenkosten
                  </CardDescription>
                </div>
                <Badge variant="outline" className="text-xs font-mono">
                  Gesamt-AfA: {formatCurrency(calculations.finalAfa)} p.a.
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* AfA Parameter Konfiguration */}
              <div className="p-4 rounded-xl border border-border/80 bg-secondary/30 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <Percent className="h-4 w-4 text-primary" />
                    <span>Berechnungsparameter (Gebäudeanteil & AfA-Satz)</span>
                  </h4>
                  <span className="text-xs text-muted-foreground">EStG-Standard</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <Label>Gebäudeanteil an den Anschaffungskosten</Label>
                      <span className="font-mono font-bold text-primary">{buildingSharePercent}%</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min="50"
                        max="95"
                        step="1"
                        className="h-8 text-xs font-mono"
                        value={buildingSharePercent}
                        onChange={(e) => setBuildingSharePercent(Number(e.target.value) || 75)}
                      />
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        (Rest {100 - buildingSharePercent}% = unbeweglicher Bodenwert)
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Nach ständiger BFH-Rechtsprechung entfallen bei Eigentumswohnungen meist 70% bis 80% auf das Gebäude.
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs">AfA-Satz (§ 7 Abs. 4 EStG)</Label>
                    <Select value={afaRatePercent.toString()} onValueChange={(v) => setAfaRatePercent(parseFloat(v))}>
                      <SelectTrigger className="h-8 text-xs font-mono">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="2.0">2,0% p.a. (Regelfall, Gebäude fertiggestellt nach 1924 bis 2022)</SelectItem>
                        <SelectItem value="2.5">2,5% p.a. (Altbauten, fertiggestellt vor 1925)</SelectItem>
                        <SelectItem value="3.0">3,0% p.a. (Neubauten, fertiggestellt ab 2023)</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-[11px] text-muted-foreground">
                      Für Wohngebäude gilt standardmäßig 2,0% lineare Abschreibung über 50 Jahre.
                    </p>
                  </div>
                </div>
              </div>

              {/* Tabelle der Objekte mit AfA */}
              <div className="space-y-3">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Abschreibungsbasis je Wohnung im Portfolio
                </h4>
                <Table>
                  <TableHeader>
                    <TableRow className="bg-secondary/40">
                      <TableHead>Wohnung</TableHead>
                      <TableHead className="text-right">Kaufpreis (Notar)</TableHead>
                      <TableHead className="text-right">Kaufnebenkosten</TableHead>
                      <TableHead className="text-right">Gebäudewert ({buildingSharePercent}%)</TableHead>
                      <TableHead className="text-right">AfA-Satz</TableHead>
                      <TableHead className="text-right">Jährliche AfA (Zeile 37)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {properties.map((p) => {
                      const basePrice = (p.purchasePrice || 0) + (p.ancillaryCosts || 0);
                      const hasPrice = basePrice > 0;
                      const buildingVal = hasPrice ? basePrice * (buildingSharePercent / 100) : (p.sqm * 2000 * (buildingSharePercent / 100));
                      const afaVal = buildingVal * (afaRatePercent / 100);

                      return (
                        <TableRow key={p.id}>
                          <TableCell className="font-semibold text-sm">
                            <div>{p.name}</div>
                            <div className="text-xs text-muted-foreground">{p.address}</div>
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm">
                            {p.purchasePrice ? formatCurrency(p.purchasePrice) : (
                              <span className="text-xs text-muted-foreground italic">nicht hinterlegt</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm">
                            {p.ancillaryCosts ? formatCurrency(p.ancillaryCosts) : "–"}
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm font-medium">
                            {formatCurrency(buildingVal)}
                            {!hasPrice && <span className="block text-[10px] text-amber-500">(geschätzt)</span>}
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm">
                            {afaRatePercent}%
                          </TableCell>
                          <TableCell className="text-right font-mono font-bold text-sm text-primary">
                            {formatCurrency(afaVal)}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    <TableRow className="bg-secondary/40 font-bold">
                      <TableCell colSpan={5}>Summe jährliche Gebäude-AfA</TableCell>
                      <TableCell className="text-right font-mono text-primary text-sm">
                        {formatCurrency(calculations.finalAfa)}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── TAB 5: TIPPS & FRISTEN ───────────────────────────────────────── */}
        <TabsContent value="tipps" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* 15%-Grenze Anschaffungsnahe Herstellungskosten */}
            <Card className="border-border/60">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <ShieldAlert className="h-5 w-5 text-amber-500" />
                  15%-Grenze (§ 6 Abs. 1 Nr. 1a EStG)
                </CardTitle>
                <CardDescription>
                  Schutz vor der steuerlichen "Aktivierungsfalle"
                </CardDescription>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground space-y-2.5">
                <p>
                  Übersteigen Instandsetzungs- und Modernisierungsmaßnahmen innerhalb von <strong>3 Jahren nach Anschaffung</strong> ohne Umsatzsteuer <strong>15% der Gebäude-Anschaffungskosten</strong>, gelten sie steuerlich als <em>anschaffungsnahe Herstellungskosten</em>.
                </p>
                <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-foreground">
                  <strong>Die Folge:</strong> Die Kosten können nicht mehr sofort als Erhaltungsaufwand (Zeile 39) abgesetzt werden, sondern müssen über 50 Jahre abgeschrieben werden!
                </div>
                <p>
                  <strong>Empfehlung:</strong> Größere Sanierungen entweder vor dem Kauf durch den Verkäufer regeln lassen oder erst nach Ablauf der 3-Jahres-Frist durchführen.
                </p>
              </CardContent>
            </Card>

            {/* Handwerkerleistungen § 35a */}
            <Card className="border-border/60">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Coins className="h-5 w-5 text-green-500" />
                  Handwerkerbonus (§ 35a Abs. 3 EStG)
                </CardTitle>
                <CardDescription>
                  Bis zu 1.200 € direkte Steuerermäßigung pro Jahr
                </CardDescription>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground space-y-2.5">
                <p>
                  Für handwerkliche Tätigkeiten (z.B. Reparaturarbeiten, Heizungswartung, Schornsteinfeger, Gärtner) können <strong>20% der reinen Arbeits-, Fahrt- und Maschinenkosten</strong> direkt von der tariflichen Einkommensteuer abgezogen werden.
                </p>
                <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20 text-foreground">
                  <strong>Voraussetzungen:</strong>
                  <ul className="list-disc pl-4 mt-1 space-y-1">
                    <li>Arbeitskosten müssen auf der Rechnung separat ausgewiesen sein</li>
                    <li>Zahlung muss unbar auf das Konto des Handwerkers erfolgen (Kontoauszug als Beleg)</li>
                    <li>Barzahlungen werden vom Finanzamt ausnahmslos abgelehnt!</li>
                  </ul>
                </div>
              </CardContent>
            </Card>

            {/* Steuerfristen */}
            <Card className="border-border/60">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-blue-500" />
                  Wichtige Steuerfristen
                </CardTitle>
                <CardDescription>
                  Fristen für Einkommensteuer- & Feststellungserklärung
                </CardDescription>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground space-y-2.5">
                <div className="space-y-2">
                  <div className="flex justify-between border-b pb-1.5">
                    <span className="font-semibold text-foreground">Selbstersteller (ohne Berater):</span>
                    <span className="font-mono text-foreground">31. Juli des Folgejahres</span>
                  </div>
                  <div className="flex justify-between border-b pb-1.5">
                    <span className="font-semibold text-foreground">Mit Steuerberater / Lohnsteuerhilfeverein:</span>
                    <span className="font-mono text-foreground">Ende Februar des übernächsten Jahres</span>
                  </div>
                  <div className="flex justify-between pb-1.5">
                    <span className="font-semibold text-foreground">Feststellungserklärung (ESt 1 B):</span>
                    <span className="font-mono text-foreground">Gleiche Fristen, Abgabe elektronisch via ELSTER</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Checkliste Steuerunterlagen */}
            <Card className="border-border/60">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-indigo-500" />
                  Checkliste für Ihren Steuerordner
                </CardTitle>
                <CardDescription>
                  Alle Belege für Anlage V & Feststellungserklärung
                </CardDescription>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground">
                <ul className="space-y-1.5">
                  <li className="flex items-center gap-2">
                    <Check className="h-3.5 w-3.5 text-green-500 flex-shrink-0" />
                    <span>Jahres-Zinsbescheinigungen der finanzierenden Banken (nach § 9 EStG)</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-3.5 w-3.5 text-green-500 flex-shrink-0" />
                    <span>Hausgeldabrechnung der WEG-Verwaltung (Aufteilung umlagefähig vs. Instandhaltung)</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-3.5 w-3.5 text-green-500 flex-shrink-0" />
                    <span>Handwerkerrechnungen inklusive unbarem Zahlungsnachweis (Kontoauszug)</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-3.5 w-3.5 text-green-500 flex-shrink-0" />
                    <span>Fahrtenbuch für Wohnungsübergaben, Besichtigungen und Eigentümerversammlungen</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-3.5 w-3.5 text-green-500 flex-shrink-0" />
                    <span>Grundsteuer- und Versicherungsbescheide</span>
                  </li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
