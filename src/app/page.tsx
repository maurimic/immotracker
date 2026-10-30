"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  TrendingDown,
  TrendingUp,
  Euro,
  Building2,
  AlertTriangle,
  CheckCircle,
  Clock,
  Wrench,
  ArrowUpRight,
  ArrowDownRight,
  Landmark,
  ShieldAlert,
  Calendar,
  Coins,
  Percent,
  Scale,
  ChevronRight,
  ShieldCheck,
  ReceiptText,
  CreditCard,
  ArrowRight,
} from "lucide-react";
import {
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  formatCurrency,
  formatDate,
  formatYearsAndMonthsShort,
  formatYearsAndMonthsLong,
} from "@/lib/utils";

interface DashboardData {
  totalOriginal: number;
  totalBalance: number;
  totalRepaid: number;
  repaidPercent: number;
  totalMonthlyInterest: number;
  totalMonthlyPrincipal: number;
  totalMonthlyLoanPayment: number;
  totalSollRent: number;
  totalColdRent?: number;
  totalIstRent: number;
  rentCollection: number;
  netCashflow: number;
  realNetCashflow?: number;
  totalReserves?: number;
  totalNonRecoverable?: number;
  paymentStatus: Array<{
    propertyId: string;
    propertyName: string;
    tenant: { name: string } | null;
    soll: number;
    ist: number;
    status: "PAID" | "PARTIAL" | "OVERDUE" | "PENDING" | "NO_TENANT";
  }>;
  fixedRateStatus: Array<{
    loanId: string;
    propertyId: string;
    propertyName?: string;
    label: string;
    bank: string | null;
    originalAmount: number;
    currentBalance: number;
    fixedRateEnd: string;
    months: number;
    trafficLight: "GREEN" | "YELLOW" | "RED";
  }>;
  openTickets: Array<{
    id: string;
    title: string;
    priority: string;
    status: string;
    property: { name: string };
  }>;
  upcomingRentAdjustments: Array<{
    id: string;
    type: string;
    effectiveDate: string;
    newColdRent: number | null;
    property: { name: string };
  }>;
  redFixedRates: Array<{
    loanId: string;
    propertyId: string;
    propertyName?: string;
    label: string;
    bank: string | null;
    originalAmount?: number;
    currentBalance?: number;
    fixedRateEnd: string;
    months: number;
    trafficLight: "GREEN" | "YELLOW" | "RED";
  }>;
  overduePayments: Array<{
    propertyId: string;
    propertyName: string;
    tenant: { name: string } | null;
    soll: number;
    ist: number;
    status: "PAID" | "PARTIAL" | "OVERDUE" | "PENDING" | "NO_TENANT";
  }>;
  historicCashflow: Array<{ period: string; amount: number }>;
  totalPurchasePrice?: number;
  totalAncillaryCosts?: number;
  totalInvestment?: number;
  propertiesWithPriceCount?: number;
  portfolioYield?: number;
  portfolioMultiplier?: number;
  accountBalance?: {
    amount: number;
    date: string;
    formattedDate: string;
  } | null;
}

const STATUS_CONFIG = {
  PAID: { label: "Bezahlt", color: "bg-green-500", icon: CheckCircle, textColor: "text-green-400" },
  PARTIAL: { label: "Teilzahlung", color: "bg-yellow-500", icon: Clock, textColor: "text-yellow-400" },
  OVERDUE: { label: "Überfällig", color: "bg-red-500", icon: AlertTriangle, textColor: "text-red-400" },
  PENDING: { label: "Ausstehend", color: "bg-gray-400", icon: Clock, textColor: "text-gray-400" },
  NO_TENANT: { label: "Leer", color: "bg-gray-300", icon: Building2, textColor: "text-gray-400" },
};

const TRAFFIC_CONFIG = {
  GREEN: { label: "OK", className: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" },
  YELLOW: { label: "Bald fällig", className: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400" },
  RED: { label: "Dringend!", className: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400" },
};

const PRIORITY_COLORS = { HIGH: "destructive", MEDIUM: "warning", LOW: "secondary" } as const;

export default function DashboardPage() {
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = async () => {
    try {
      const res = await fetch("/api/dashboard");
      const json = await res.json();
      setData(json);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const refresh = () => { setRefreshing(true); fetchData(); };

  const [warningsOpen, setWarningsOpen] = useState(false);

  const totalWarnings =
    (data?.redFixedRates.length ?? 0) +
    (data?.overduePayments.length ?? 0) +
    (data?.openTickets.filter((t) => t.priority === "HIGH").length ?? 0);

  const highTickets = data?.openTickets.filter((t) => t.priority === "HIGH") ?? [];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-muted-foreground text-sm">Lade Dashboard...</p>
        </div>
      </div>
    );
  }

  if (!data) return null;

  // Vermögensbilanz & Schulden-Kennzahlen
  const totalPropertyVal = data.totalPurchasePrice || 0;
  const totalDebt = data.totalBalance || 0;
  const netEquity = Math.max(0, totalPropertyVal - totalDebt);
  const ltvPercent = totalPropertyVal > 0 ? (totalDebt / totalPropertyVal) * 100 : 0;
  const equityPercent = totalPropertyVal > 0 ? Math.max(0, 100 - ltvPercent) : 0;

  const pieData = [
    { name: "Zinsanteil", value: Math.round(data.totalMonthlyInterest), color: "#ef4444" },
    { name: "Tilgungsanteil", value: Math.round(data.totalMonthlyPrincipal), color: "#22c55e" },
  ];

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Übersicht · {new Date().toLocaleDateString("de-DE", { month: "long", year: "numeric" })}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {totalWarnings > 0 && (
            <Dialog open={warningsOpen} onOpenChange={setWarningsOpen}>
              <DialogTrigger asChild>
                <Badge
                  variant="destructive"
                  className="gap-1.5 cursor-pointer hover:opacity-85 transition-opacity px-2.5 py-1 text-xs font-semibold select-none shadow-sm"
                  title="Aktive Warnungen anzeigen"
                >
                  <AlertTriangle className="h-3.5 w-3.5" />
                  {totalWarnings} Warnung{totalWarnings !== 1 ? "en" : ""}
                </Badge>
              </DialogTrigger>
              <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2 text-lg">
                    <AlertTriangle className="h-5 w-5 text-destructive" />
                    Aktive Warnungen & Handlungsbedarf ({totalWarnings})
                  </DialogTitle>
                  <DialogDescription>
                    Übersicht aller Vorfälle, die Ihre Aufmerksamkeit erfordern.
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 pt-2">
                  {/* 1. Mietrückstände / Überfällige Mieten */}
                  {data.overduePayments && data.overduePayments.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-xs font-semibold text-orange-500 uppercase tracking-wider">
                        <CreditCard className="h-4 w-4" />
                        Mietrückstände & Zahlungsverzug ({data.overduePayments.length})
                      </div>
                      <div className="space-y-2">
                        {data.overduePayments.map((op) => (
                          <div
                            key={op.propertyId}
                            className="p-3 rounded-lg border border-orange-500/30 bg-orange-500/10 flex items-center justify-between gap-3"
                          >
                            <div className="min-w-0">
                              <p className="font-semibold text-sm truncate">{op.propertyName}</p>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                Mieter: {op.tenant?.name || "Unbekannt"} · Offen:{" "}
                                <span className="font-semibold text-red-500 font-mono">
                                  {formatCurrency(Math.max(0, op.soll - op.ist))}
                                </span>{" "}
                                (Soll: {formatCurrency(op.soll)})
                              </p>
                            </div>
                            <Button
                              size="sm"
                              variant="outline"
                              className="gap-1 shrink-0 text-xs border-orange-500/40 text-orange-600 dark:text-orange-400 hover:bg-orange-500/10"
                              onClick={() => {
                                setWarningsOpen(false);
                                router.push("/zahlungen");
                              }}
                            >
                              Zu den Zahlungen <ArrowRight className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 2. Zinsbindungen (RED) */}
                  {data.redFixedRates && data.redFixedRates.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-xs font-semibold text-red-500 uppercase tracking-wider">
                        <Landmark className="h-4 w-4" />
                        Kredit-Zinsbindungen (&lt; 12 Monate oder abgelaufen) ({data.redFixedRates.length})
                      </div>
                      <div className="space-y-2">
                        {data.redFixedRates.map((rf) => (
                          <div
                            key={rf.loanId}
                            className="p-3 rounded-lg border border-red-500/30 bg-red-500/10 flex items-center justify-between gap-3"
                          >
                            <div className="min-w-0">
                              <p className="font-semibold text-sm truncate">
                                {rf.propertyName ? `${rf.propertyName}: ` : ""}{rf.label} {rf.bank ? `(${rf.bank})` : ""}
                              </p>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                Zinsbindung: {formatDate(rf.fixedRateEnd)}{" "}
                                {rf.months <= 0
                                  ? "· Bereits abgelaufen!"
                                  : `· Noch ${formatYearsAndMonthsLong(rf.months)} (${rf.months} Monate)`}
                              </p>
                            </div>
                            <Button
                              size="sm"
                              variant="destructive"
                              className="gap-1 shrink-0 text-xs"
                              onClick={() => {
                                setWarningsOpen(false);
                                router.push(`/kredite?loanId=${rf.loanId}&tab=volltilger`);
                              }}
                            >
                              Zum Kredit <ArrowRight className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 3. Dringende Tickets (Priorität HOCH) */}
                  {highTickets.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-xs font-semibold text-amber-500 uppercase tracking-wider">
                        <Wrench className="h-4 w-4" />
                        Dringende Reparaturen & Schäden ({highTickets.length})
                      </div>
                      <div className="space-y-2">
                        {highTickets.map((t) => (
                          <div
                            key={t.id}
                            className="p-3 rounded-lg border border-amber-500/30 bg-amber-500/10 flex items-center justify-between gap-3"
                          >
                            <div className="min-w-0">
                              <p className="font-semibold text-sm truncate">{t.title}</p>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                Objekt: {t.property?.name || "–"} · Status: {t.status}
                              </p>
                            </div>
                            <Button
                              size="sm"
                              variant="outline"
                              className="gap-1 shrink-0 text-xs border-amber-500/40 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10"
                              onClick={() => {
                                setWarningsOpen(false);
                                router.push("/instandhaltung");
                              }}
                            >
                              Zur Instandhaltung <ArrowRight className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      {/* ── KPI-Karten (Mit Hover-Effekt & Klick-Navigation) ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {/* 1. Getilgtes Kapital */}
        <Card
          onClick={() => router.push("/kredite")}
          className="stat-card-success text-white border-0 transition-all duration-300 ease-out hover:-translate-y-1 hover:shadow-xl cursor-pointer select-none group"
          title="Klicken für Darlehensübersicht & Tilgungspläne"
        >
          <CardContent className="pt-5">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-1 text-green-100 text-sm font-medium mb-1">
                  <span>Getilgtes Kapital</span>
                  <ChevronRight className="h-4 w-4 opacity-70 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                </div>
                <p className="text-3xl font-bold tracking-tight">{formatCurrency(data.totalRepaid)}</p>
                <p className="text-green-100 text-xs mt-1">von {formatCurrency(data.totalOriginal)}</p>
              </div>
              <div className="p-2.5 bg-white/20 rounded-xl group-hover:scale-110 transition-transform">
                <TrendingUp className="h-6 w-6" />
              </div>
            </div>
            <div className="mt-3">
              <div className="flex justify-between text-xs text-green-100 mb-1">
                <span>Tilgungsfortschritt</span>
                <span>{data.repaidPercent.toFixed(1)}%</span>
              </div>
              <div className="bg-white/20 rounded-full h-1.5">
                <div
                  className="bg-white rounded-full h-1.5 transition-all duration-700"
                  style={{ width: `${Math.min(100, data.repaidPercent)}%` }}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 2. Mieteinnahmen (Ist) */}
        <Card
          onClick={() => router.push("/wohnungen")}
          className="stat-card-primary text-white border-0 transition-all duration-300 ease-out hover:-translate-y-1 hover:shadow-xl cursor-pointer select-none group"
          title="Klicken für Wohnungs- & Mieterakten"
        >
          <CardContent className="pt-5">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-1 text-blue-100 text-sm font-medium mb-1">
                  <span>Mieteinnahmen (Ist)</span>
                  <ChevronRight className="h-4 w-4 opacity-70 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                </div>
                <p className="text-3xl font-bold">{formatCurrency(data.totalIstRent)}</p>
                <p className="text-blue-100 text-xs mt-1">
                  Soll: {formatCurrency(data.totalSollRent)}
                </p>
              </div>
              <div className="p-2.5 bg-white/20 rounded-xl group-hover:scale-110 transition-transform">
                <Euro className="h-6 w-6" />
              </div>
            </div>
            <div className="mt-3 bg-white/20 rounded-full h-1.5">
              <div
                className="bg-white rounded-full h-1.5"
                style={{ width: `${Math.min(100, data.rentCollection)}%` }}
              />
            </div>
            <p className="text-xs text-blue-100 mt-1">{data.rentCollection.toFixed(0)}% Eingangsquote</p>
          </CardContent>
        </Card>

        {/* 3. Aktueller Kontostand */}
        <Card
          onClick={() => router.push("/zahlungen?tab=buchungen")}
          className="stat-card-indigo text-white border-0 transition-all duration-300 ease-out hover:-translate-y-1 hover:shadow-xl cursor-pointer select-none group"
          title="Klicken für Zahlungsströme & Bankabgleich"
        >
          <CardContent className="pt-5">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-1 text-indigo-100 text-sm font-medium mb-1">
                  <span>Kontostand</span>
                  <ChevronRight className="h-4 w-4 opacity-70 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                </div>
                <p className="text-3xl font-bold tracking-tight">
                  {data.accountBalance ? formatCurrency(data.accountBalance.amount) : "–"}
                </p>
                <p className="text-indigo-100 text-xs mt-1">
                  {data.accountBalance
                    ? `Stand: ${data.accountBalance.formattedDate}`
                    : "Wird geladen..."}
                </p>
              </div>
              <div className="p-2.5 bg-white/20 rounded-xl group-hover:scale-110 transition-transform">
                <Landmark className="h-6 w-6" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 4. Netto-Cashflow (Operativ) */}
        <Card
          onClick={() => router.push("/kredite?tab=cashflow")}
          className={`border-0 text-white ${data.netCashflow >= 0 ? "stat-card-success" : "stat-card-destructive"} transition-all duration-300 ease-out hover:-translate-y-1 hover:shadow-xl cursor-pointer select-none group`}
          title="Klicken für detaillierte Cashflow-Gegenüberstellung je Objekt"
        >
          <CardContent className="pt-5">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-1 text-sm font-medium opacity-90 mb-1">
                  <span>Netto-Cashflow (Operativ)</span>
                  <ChevronRight className="h-4 w-4 opacity-70 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                </div>
                <p className="text-3xl font-bold">{formatCurrency(data.netCashflow)}</p>
                <p className="text-xs opacity-80 mt-1">Kaltmiete − Kreditraten</p>
              </div>
              <div className="p-2.5 bg-white/20 rounded-xl group-hover:scale-110 transition-transform">
                {data.netCashflow >= 0 ? <ArrowUpRight className="h-6 w-6" /> : <ArrowDownRight className="h-6 w-6" />}
              </div>
            </div>
            {data.realNetCashflow !== undefined && (
              <div className="mt-3 pt-2.5 border-t border-white/20 flex items-center justify-between text-xs">
                <span className="opacity-85">Echter Netto-Cashflow:</span>
                <span className="font-bold font-mono">
                  {data.realNetCashflow >= 0 ? "+" : ""}{formatCurrency(data.realNetCashflow)}
                </span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Vermögensbilanz: Immobilienwert vs. Schulden (Gegenüberstellung) ── */}
      <Card
        onClick={() => router.push(totalPropertyVal > 0 ? "/kredite" : "/wohnungen")}
        className="group border border-border/70 hover:border-primary/50 shadow-sm transition-all duration-300 ease-out hover:-translate-y-1 hover:shadow-xl cursor-pointer bg-gradient-to-br from-card via-card to-secondary/30 overflow-hidden"
        title={totalPropertyVal > 0 ? "Klicken für Kredit- und Vermögensdetails" : "Klicken, um Kaufpreise für Wohnungen einzutragen"}
      >
        <CardContent className="pt-5 pb-5">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="space-y-2 flex-1">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
                  <Scale className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base flex items-center gap-1.5 text-foreground">
                    Vermögensbilanz: Immobilienwert vs. Schulden
                    <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Gegenüberstellung von Sachwert (Portfolio-Kaufwert) und offenen Darlehensverbindlichkeiten
                  </p>
                </div>
              </div>

              {/* 3 Hauptzahlen: Wert, Schulden, Reinvermögen */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                <div className="bg-secondary/40 rounded-xl p-3 border border-border/50">
                  <span className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold block">
                    Gesamter Immobilienwert
                  </span>
                  <span className="text-xl font-bold font-mono text-foreground mt-0.5 block">
                    {totalPropertyVal > 0 ? formatCurrency(totalPropertyVal) : "Noch nicht erfasst"}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {totalPropertyVal > 0
                      ? `${data.propertiesWithPriceCount ?? 0} bewertete Einheit${(data.propertiesWithPriceCount ?? 0) === 1 ? "" : "en"}`
                      : "Kaufpreis in Wohnungen erfassen"}
                  </span>
                </div>

                <div className="bg-secondary/40 rounded-xl p-3 border border-border/50">
                  <span className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold block">
                    Offene Schulden (Restschuld)
                  </span>
                  <span className="text-xl font-bold font-mono text-orange-500 mt-0.5 block">
                    {formatCurrency(totalDebt)}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {data.fixedRateStatus.length} aktive Darlehen
                  </span>
                </div>

                <div className="bg-emerald-500/10 rounded-xl p-3 border border-emerald-500/20">
                  <span className="text-[11px] text-emerald-600 dark:text-emerald-400 uppercase tracking-wider font-semibold block">
                    Netto-Reinvermögen (Eigenkapital)
                  </span>
                  <span className="text-xl font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-0.5 block">
                    {totalPropertyVal > 0 ? formatCurrency(netEquity) : "–"}
                  </span>
                  <span className="text-[10px] text-emerald-600/80 dark:text-emerald-400/80">
                    {totalPropertyVal > 0 ? `${equityPercent.toFixed(1)}% EK-Quote` : "Kaufpreise hinterlegen"}
                  </span>
                </div>
              </div>
            </div>

            {/* Split-Balken & Beleihungsquote LTV */}
            <div className="lg:w-80 flex flex-col justify-center space-y-2 p-3 bg-secondary/30 rounded-xl border border-border/60">
              <div className="flex justify-between items-center text-xs">
                <span className="font-medium text-muted-foreground">Beleihungsauslauf (LTV):</span>
                <span className="font-bold font-mono text-foreground">
                  {totalPropertyVal > 0 ? `${ltvPercent.toFixed(1)}%` : "–"}
                </span>
              </div>
              {/* Zweifarbiger Split-Balken: Schulden vs. Reinvermögen */}
              <div className="h-3 w-full bg-secondary rounded-full overflow-hidden flex">
                <div
                  className="bg-orange-500 h-full transition-all duration-700"
                  style={{ width: totalPropertyVal > 0 ? `${Math.min(100, ltvPercent)}%` : totalDebt > 0 ? "100%" : "0%" }}
                  title={`Schulden: ${formatCurrency(totalDebt)} (${ltvPercent.toFixed(1)}%)`}
                />
                <div
                  className="bg-emerald-500 h-full transition-all duration-700"
                  style={{ width: totalPropertyVal > 0 ? `${Math.max(0, 100 - Math.min(100, ltvPercent))}%` : "0%" }}
                  title={`Eigenkapital: ${formatCurrency(netEquity)} (${equityPercent.toFixed(1)}%)`}
                />
              </div>
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span className="flex items-center gap-1 font-medium text-orange-500">
                  <span className="w-2 h-2 rounded-full bg-orange-500 inline-block" /> Fremdkapital ({ltvPercent.toFixed(0)}%)
                </span>
                <span className="flex items-center gap-1 font-medium text-emerald-500">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" /> Reinvermögen ({equityPercent.toFixed(0)}%)
                </span>
              </div>
              {data.portfolioYield && data.portfolioYield > 0 ? (
                <div className="pt-1.5 border-t border-border/40 flex justify-between text-[11px]">
                  <span className="text-muted-foreground">Mietrendite: <strong className="text-foreground">{data.portfolioYield.toFixed(2)}%</strong></span>
                  {data.portfolioMultiplier && (
                    <span className="text-muted-foreground">Faktor: <strong className="text-foreground">{data.portfolioMultiplier.toFixed(1)}x</strong></span>
                  )}
                </div>
              ) : null}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Mieteingangskontrolle & Zinsbindungen ── */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Mietstatus je Wohnung */}
        <Card
          onClick={() => router.push("/wohnungen")}
          className="transition-all duration-300 ease-out hover:-translate-y-1 hover:shadow-xl cursor-pointer group"
          title="Klicken für Wohnungs- und Mieterakten"
        >
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base flex items-center gap-1.5">
                  Mieteingangskontrolle
                  <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                </CardTitle>
                <CardDescription>
                  {new Date().toLocaleDateString("de-DE", { month: "long", year: "numeric" })}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.paymentStatus.map((ps) => {
              const conf = STATUS_CONFIG[ps.status];
              const StatusIcon = conf.icon;
              const pct = ps.soll > 0 ? Math.min(100, (ps.ist / ps.soll) * 100) : 0;
              return (
                <div key={ps.propertyId} className="space-y-1.5 hover:bg-secondary/40 p-1.5 rounded-lg -mx-1.5 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <StatusIcon className={`h-4 w-4 flex-shrink-0 ${conf.textColor}`} />
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{ps.propertyName}</p>
                        {ps.tenant && (
                          <p className="text-xs text-muted-foreground truncate">{ps.tenant.name}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                      <span className="text-xs text-muted-foreground">
                        {formatCurrency(ps.ist)} / {formatCurrency(ps.soll)}
                      </span>
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                        ps.status === "PAID" ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" :
                        ps.status === "PARTIAL" ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400" :
                        ps.status === "OVERDUE" ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400" :
                        "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                      }`}>
                        {conf.label}
                      </span>
                    </div>
                  </div>
                  {ps.soll > 0 && (
                    <div className="h-1.5 bg-secondary rounded-full">
                      <div
                        className={`h-1.5 rounded-full transition-all duration-500 ${
                          ps.status === "PAID" ? "bg-green-500" :
                          ps.status === "PARTIAL" ? "bg-yellow-500" :
                          ps.status === "OVERDUE" ? "bg-red-500" :
                          "bg-gray-400"
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Zinsbindungs-Ampel */}
        <Card
          onClick={() => router.push("/kredite")}
          className="transition-all duration-300 ease-out hover:-translate-y-1 hover:shadow-xl cursor-pointer group"
          title="Klicken für Zinsbindungskontrolle & Anschlussfinanzierung"
        >
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base flex items-center gap-1.5">
                  Zinsbindungs-Ampel
                  <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                </CardTitle>
                <CardDescription>Restlaufzeit der Zinsbindungen</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.fixedRateStatus.map((fs) => {
              const tl = TRAFFIC_CONFIG[fs.trafficLight];
              const dotColor =
                fs.trafficLight === "GREEN" ? "bg-green-500" :
                fs.trafficLight === "YELLOW" ? "bg-yellow-500" :
                "bg-red-500 animate-pulse";
              return (
                <div key={fs.loanId} className="space-y-1 py-1.5 border-b border-border/50 last:border-0 hover:bg-secondary/40 p-1.5 rounded-lg -mx-1.5 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${dotColor}`} />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="text-sm font-semibold truncate text-foreground">
                            {fs.propertyName || fs.label}
                          </p>
                          {fs.propertyName && fs.label && (
                            <span className="text-[11px] text-muted-foreground font-normal">
                              ({fs.label})
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground truncate">
                          {fs.bank ? `${fs.bank} · ` : ""}bis {formatDate(fs.fixedRateEnd)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2.5 flex-shrink-0 ml-2">
                      <div className="text-right">
                        <p className="text-xs font-bold text-foreground">
                          {formatCurrency(fs.originalAmount)}
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          Rest: {formatCurrency(fs.currentBalance)}
                        </p>
                      </div>
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${tl.className}`}
                        title={fs.months > 0 ? `Noch ${formatYearsAndMonthsLong(fs.months)} (${fs.months} Monate)` : "Zinsbindung abgelaufen"}
                      >
                        {formatYearsAndMonthsShort(fs.months)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>

      {/* ── Zins/Tilgung, Tickets & Anpassungen ── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Zins/Tilgung Pie */}
        <Card
          onClick={() => router.push("/kredite")}
          className="xl:col-span-1 transition-all duration-300 ease-out hover:-translate-y-1 hover:shadow-xl cursor-pointer group"
          title="Klicken für detaillierte Darlehensaufstellung"
        >
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base flex items-center gap-1.5">
                  Zins vs. Tilgung (monatl.)
                  <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                </CardTitle>
                <CardDescription>Aufschlüsselung der Gesamtrate</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={160}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={45}
                  outerRadius={70}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={index} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(v: number) => formatCurrency(v)}
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
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-2 mt-2">
              {pieData.map((d) => (
                <div key={d.name} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: d.color }} />
                    <span className="text-muted-foreground">{d.name}</span>
                  </div>
                  <span className="font-medium">{formatCurrency(d.value)}</span>
                </div>
              ))}
              <div className="flex items-center justify-between text-sm border-t pt-2 mt-2">
                <span className="text-muted-foreground font-medium">Gesamt</span>
                <span className="font-bold">{formatCurrency(data.totalMonthlyLoanPayment)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Offene Tickets */}
        <Card
          onClick={() => router.push("/instandhaltung")}
          className="xl:col-span-1 transition-all duration-300 ease-out hover:-translate-y-1 hover:shadow-xl cursor-pointer group"
          title="Klicken für Handwerker-Tickets & Instandhaltung"
        >
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Wrench className="h-4 w-4" />
                Offene Tickets
                <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
              </CardTitle>
              {data.openTickets.length > 0 && (
                <Badge variant="secondary" className="ml-auto">{data.openTickets.length}</Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.openTickets.length === 0 ? (
              <div className="text-center py-4 text-muted-foreground text-sm">
                <CheckCircle className="h-8 w-8 mx-auto mb-2 text-green-500" />
                Alles erledigt!
              </div>
            ) : (
              data.openTickets.slice(0, 5).map((ticket) => (
                <div key={ticket.id} className="flex items-start gap-2 py-1.5 border-b border-border/50 last:border-0 hover:bg-secondary/40 p-1 rounded transition-colors">
                  <Badge variant={PRIORITY_COLORS[ticket.priority as keyof typeof PRIORITY_COLORS] || "secondary"} className="flex-shrink-0 mt-0.5 text-xs">
                    {ticket.priority === "HIGH" ? "Hoch" : ticket.priority === "MEDIUM" ? "Mittel" : "Niedrig"}
                  </Badge>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{ticket.title}</p>
                    <p className="text-xs text-muted-foreground">{ticket.property?.name}</p>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Mietanpassungen */}
        <Card
          onClick={() => router.push("/wohnungen")}
          className="xl:col-span-1 transition-all duration-300 ease-out hover:-translate-y-1 hover:shadow-xl cursor-pointer group"
          title="Klicken für Mietanpassungen & Staffelmieten"
        >
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Anstehende Anpassungen
                <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.upcomingRentAdjustments.length === 0 ? (
              <div className="text-center py-4 text-muted-foreground text-sm">
                <CheckCircle className="h-8 w-8 mx-auto mb-2 text-green-500" />
                Keine anstehend
              </div>
            ) : (
              data.upcomingRentAdjustments.map((adj) => (
                <div key={adj.id} className="py-1.5 border-b border-border/50 last:border-0 hover:bg-secondary/40 p-1 rounded transition-colors">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium truncate">{adj.property?.name}</p>
                    <Badge variant={adj.type === "STAFFEL" ? "default" : "warning"} className="text-xs flex-shrink-0 ml-2">
                      {adj.type}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between mt-0.5">
                    <p className="text-xs text-muted-foreground">
                      {formatDate(adj.effectiveDate)}
                    </p>
                    {adj.newColdRent && (
                      <p className="text-xs font-medium text-green-500">
                        → {formatCurrency(adj.newColdRent)}/Mo
                      </p>
                    )}
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
