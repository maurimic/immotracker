"use client";

import { useEffect, useState, useMemo, useRef, Suspense, Fragment } from "react";
import { useSearchParams } from "next/navigation";
import {
  RefreshCw, Plus, Check, AlertCircle, Clock,
  Bot, User, Hash, Euro, Calendar, Filter, Upload, FileText,
  Copy, Printer, Send, FileSpreadsheet, Eye, EyeOff, Building2,
  ExternalLink, Info, CheckCircle2, ArrowDownLeft, ArrowUpRight, Search,
  Scale, TrendingUp, Landmark, X, Smartphone,
  Split, ChevronDown, ChevronUp, Trash2, Scissors
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatCurrency, formatDate, currentPeriod, formatRelativeDate } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { getRentForPeriod } from "@/lib/rent-history";
import { RentAdjustmentDialog } from "@/components/RentAdjustmentDialog";
import {
  findBestMatchingProperty,
  extractAddressKeywords,
  type PropertyMatchInfo,
} from "@/lib/property-matching";

export type { Tenant, Payment, MonthStatus, SplitItemState } from "@/components/payments";
import {
  Tenant,
  Payment,
  MonthStatus,
  SplitItemState,
  METHOD_CONFIG,
  CATEGORY_LABELS,
  STATUS_COLORS,
  GoogleSheetsDialog,
  N8nBankSyncButtons,
  RematchButton,
  OverpaymentDialog,
  CsvUploadDialog,
  MahnungDialog,
  EditPaymentDialog,
  SplitPaymentDialog,
  TenantMonthlyHistoryDialog,
} from "@/components/payments";

// ─── Hauptkomponente ─────────────────────────────────────────────────────────
function ZahlungenContent() {
  const searchParams = useSearchParams();
  const initialSearch = searchParams.get("search") || "";
  const initialPeriod = searchParams.get("period") || currentPeriod();
  const initialTab = searchParams.get("tab") || "status";

  const [allPayments, setAllPayments] = useState<Payment[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [properties, setProperties] = useState<PropertyMatchInfo[]>([]);
  const [loans, setLoans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [accountBalance, setAccountBalance] = useState<{
    amount: number;
    date: string;
    formattedDate: string;
  } | null>(null);
  const [period, setPeriod] = useState<string>(initialPeriod); // Standardmäßig auf den aktiven Monat
  const [activeTab, setActiveTab] = useState<string>(initialTab);
  const [showPurpose, setShowPurpose] = useState<boolean>(true); // Bonus: Verwendungszweck ein-/ausblenden
  const [searchQuery, setSearchQuery] = useState(initialSearch);
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [historyTenant, setHistoryTenant] = useState<Tenant | null>(null);
  const [splitDialogPayment, setSplitDialogPayment] = useState<Payment | null>(null);
  const [expandedSplitIds, setExpandedSplitIds] = useState<Set<string>>(new Set());

  const toggleExpandSplit = (id: string) => {
    setExpandedSplitIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  useEffect(() => {
    const s = searchParams.get("search");
    if (s !== null) {
      setSearchQuery(s);
    }
    const p = searchParams.get("period");
    if (p !== null) {
      setPeriod(p);
    }
    const t = searchParams.get("tab");
    if (t !== null) {
      setActiveTab(t);
    }
  }, [searchParams]);

  const fetchPayments = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/payments?period=ALL");
      const data: Payment[] = await res.json();
      setAllPayments(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchTenants = async () => {
    try {
      const res = await fetch("/api/tenants");
      setTenants(await res.json());
    } catch (err) {
      console.error(err);
    }
  };

  const fetchPropertiesAndLoans = async () => {
    try {
      const [propsRes, loansRes] = await Promise.all([
        fetch("/api/properties"),
        fetch("/api/loans"),
      ]);
      if (propsRes.ok) setProperties(await propsRes.json());
      if (loansRes.ok) setLoans(await loansRes.json());
    } catch (err) {
      console.error(err);
    }
  };

  const fetchAccountBalance = async () => {
    try {
      const res = await fetch(`/api/kontostand?t=${Date.now()}`, {
        cache: "no-store",
        headers: { "Cache-Control": "no-cache" },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && typeof data.amount === "number") {
          setAccountBalance({
            amount: data.amount,
            date: data.date,
            formattedDate: data.formattedDate,
          });
        }
        // Wenn sich der Kontostand geändert hat und der Server neue Bankumsätze nachgezogen hat:
        if (data.autoSyncedPayments?.triggered) {
          await Promise.all([fetchPayments(), fetchTenants()]);
          if ((data.autoSyncedPayments.imported ?? 0) > 0) {
            toast({
              title: "Kontostand & Bankumsätze aktualisiert",
              description: `${data.autoSyncedPayments.imported} neue Buchung(en) automatisch aus Google Sheets geladen.`,
            });
          }
        }
      }
    } catch (err) {
      console.error("Fehler beim Laden des Kontostands:", err);
    }
  };

  useEffect(() => {
    fetchTenants();
    fetchPayments();
    fetchPropertiesAndLoans();
    fetchAccountBalance();
  }, []);

  // Alle verfügbaren Perioden aus den Zahlungsdaten extrahieren
  const availablePeriods = useMemo(() => {
    const periodSet = new Set<string>();

    allPayments.forEach((p) => {
      if (p.period && /^\d{4}-\d{2}$/.test(p.period)) {
        periodSet.add(p.period);
      }
      if (p.bookingDate) {
        const d = new Date(p.bookingDate);
        if (!isNaN(d.getTime())) {
          periodSet.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
        }
      }
    });

    // Die letzten 6 Monate ergänzen
    const now = new Date();
    for (let i = 0; i < 6; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      periodSet.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    }

    return Array.from(periodSet).sort().reverse();
  }, [allPayments]);

  // Gefilterte Zahlungen basierend auf Monat und Filtern
  const displayedPayments = useMemo(() => {
    return allPayments.filter((p) => {
      // Split-Kinderbuchungen werden unter der übergeordneten Hauptbuchung angezeigt
      if (p.parentPaymentId) return false;

      // Monatsfilter (nach abrechnungsrelevantem Monat)
      if (period !== "ALL") {
        const pPeriod =
          p.period && /^\d{4}-\d{2}$/.test(p.period)
            ? p.period
            : p.bookingDate ? p.bookingDate.slice(0, 7) : "";

        // Falls Buchung aufgeteilt ist, prüfen ob eines der Split-Kinder in die Periode fällt
        const matchesSplitChild = p.isSplit && p.splitPayments?.some((sp) => {
          const spPeriod = sp.period && /^\d{4}-\d{2}$/.test(sp.period)
            ? sp.period
            : sp.bookingDate ? sp.bookingDate.slice(0, 7) : "";
          return spPeriod === period;
        });

        if (pPeriod !== period && !matchesSplitChild) return false;
      }

      // Kategorie-Filter
      if (categoryFilter !== "ALL") {
        if (categoryFilter === "REPAIR") {
          const matchesChild = p.isSplit && p.splitPayments?.some((sp) => sp.category === "REPAIR" || sp.category === "MAINTENANCE");
          if (p.category !== "REPAIR" && p.category !== "MAINTENANCE" && !matchesChild) return false;
        } else {
          const matchesChild = p.isSplit && p.splitPayments?.some((sp) => sp.category === categoryFilter);
          if (p.category !== categoryFilter && !matchesChild) return false;
        }
      }

      // Suchtext
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const payerMatch = (p.payerName || "").toLowerCase().includes(query);
        const refMatch = (p.reference || "").toLowerCase().includes(query);
        const tenantMatch = p.tenant
          ? `${p.tenant.firstName} ${p.tenant.lastName}`.toLowerCase().includes(query) ||
            (p.tenant.property?.name || "").toLowerCase().includes(query)
          : false;
        const propMatch = (p.property?.name || "").toLowerCase().includes(query);
        const loanMatch = (p.loan?.label || p.loan?.bank || "").toLowerCase().includes(query);
        const catLabel = (CATEGORY_LABELS[p.category]?.label || "").toLowerCase();
        const catMatch = catLabel.includes(query);

        const splitMatch = p.isSplit && p.splitPayments?.some((sp) => {
          const spTenant = sp.tenant ? `${sp.tenant.firstName} ${sp.tenant.lastName}`.toLowerCase().includes(query) : false;
          const spRef = (sp.reference || "").toLowerCase().includes(query);
          const spCat = (CATEGORY_LABELS[sp.category]?.label || "").toLowerCase().includes(query);
          return spTenant || spRef || spCat;
        });

        return payerMatch || refMatch || tenantMatch || propMatch || loanMatch || catMatch || Boolean(splitMatch);
      }

      return true;
    });
  }, [allPayments, period, categoryFilter, searchQuery]);

  // Soll-/Ist-Berechnung je Einheit (MonthStatus)
  const monthStatus = useMemo<MonthStatus[]>(() => {
    const now = new Date();

    if (period === "ALL") {
      // Audio 4: Wenn "Alle Monate" gewählt ist, werden NICHT alle Monate eines Mieters zu 20.000 € kumuliert,
      // sondern jeder Monat wird einzeln aufgelistet (Monat für Monat mit den jeweiligen ~1.200 €)!
      const result: MonthStatus[] = [];

      for (const pMonth of availablePeriods) {
        const [selYearStr, selMonthStr] = pMonth.split("-");
        const selYear = parseInt(selYearStr, 10);
        const selMonth = parseInt(selMonthStr, 10) - 1;
        const periodDueDate = new Date(selYear, selMonth, 4, 23, 59, 59);
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth();

        let dueDatePassed = false;
        let baseDaysOverdue = 0;
        if (selYear < currentYear || (selYear === currentYear && selMonth < currentMonth)) {
          dueDatePassed = true;
          const diffMs = now.getTime() - periodDueDate.getTime();
          baseDaysOverdue = Math.max(1, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
        } else if (selYear === currentYear && selMonth === currentMonth) {
          dueDatePassed = now.getDate() > 4;
          baseDaysOverdue = Math.max(0, now.getDate() - 4);
        }

        for (const t of tenants) {
          // Vor Einzug, vor Eigentums-/Nutzenübergang oder nach Auszug braucht der Mieter nicht aufzutauchen!
          const propPoss = t.property?.possessionAt || t.property?.purchasedAt;
          const possM = propPoss ? propPoss.slice(0, 7) : null;
          const tStartM = (t.moveInDate && possM)
            ? (t.moveInDate.slice(0, 7) > possM ? t.moveInDate.slice(0, 7) : possM)
            : (t.moveInDate ? t.moveInDate.slice(0, 7) : possM);

          if (tStartM && tStartM > pMonth) continue;
          if (t.moveOutDate && t.moveOutDate.slice(0, 7) < pMonth) continue;

          const tenantPayments = allPayments.filter((p) => {
            if (p.isSplit) return false;
            if (p.tenant?.id !== t.id) return false;
            const pMonthPayment =
              p.period && /^\d{4}-\d{2}$/.test(p.period)
                ? p.period
                : p.bookingDate.slice(0, 7);
            return pMonthPayment === pMonth;
          });

          const rentPayments = tenantPayments.filter((p) => p.category === "RENT");
          const utilityPayments = tenantPayments.filter((p) => p.category === "UTILITY_IN");
          const otherPayments = tenantPayments.filter((p) => p.category === "OTHER");

          const paid = rentPayments.reduce((s, p) => s + p.amount, 0);
          const utilityPaid = utilityPayments.reduce((s, p) => s + p.amount, 0);
          const otherPaid = otherPayments.reduce((s, p) => s + p.amount, 0);
          const totalPaid = paid + utilityPaid + otherPaid;

          // Dynamische Soll-Miete für DIESEN spezifischen Monat (berücksichtigt Mietanpassungen!)
          const resolvedRent = getRentForPeriod(t, pMonth, t.property?.rentAdjustments);
          const soll = resolvedRent.warmRent;

          const sortedRent = [...rentPayments].sort(
            (a, b) => new Date(b.bookingDate).getTime() - new Date(a.bookingDate).getTime()
          );
          const lastPayment = sortedRent[0] || tenantPayments[0];
          const paymentDate = lastPayment ? lastPayment.bookingDate : null;

          const rentReferences = sortedRent
            .map((p) => p.reference)
            .filter(Boolean)
            .join(" • ");

          const utilityReferences = utilityPayments
            .map((p) => `${p.reference || "Abrechnung"} (${formatCurrency(p.amount)})`)
            .filter(Boolean)
            .join(" • ");

          let st: MonthStatus["status"];
          if (paid === soll && paid > 0) {
            st = "PAID";
          } else if (paid > soll) {
            st = "OVERPAID";
          } else if (paid > 0) {
            st = "PARTIAL";
          } else if (dueDatePassed) {
            st = "OVERDUE";
          } else {
            st = "PENDING";
          }

          const daysOverdue = st === "OVERDUE" || st === "PARTIAL" ? baseDaysOverdue : 0;

          result.push({
            tenantId: `${t.id}-${pMonth}`,
            tenantName: `${t.firstName} ${t.lastName}`,
            propertyName: t.property?.name || "Wohnung",
            propertyAddress: t.property?.address || "",
            periodMonth: pMonth,
            soll,
            ist: paid,
            utilityPaid,
            otherPaid,
            totalPaid,
            paymentDate,
            reference: rentReferences || null,
            utilityReference: utilityReferences || null,
            status: st,
            daysOverdue,
            tenant: t,
            isAdjusted: resolvedRent.isAdjusted,
            adjustmentNote: resolvedRent.adjustmentNote,
          });
        }
      }

      return result;
    }

    // Wenn ein einzelner Monat gewählt ist:
    const [selYearStr, selMonthStr] = period.split("-");
    const selYear = parseInt(selYearStr, 10);
    const selMonth = parseInt(selMonthStr, 10) - 1;

    const periodDueDate = new Date(selYear, selMonth, 4, 23, 59, 59);
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    let dueDatePassed = false;
    let baseDaysOverdue = 0;

    if (selYear < currentYear || (selYear === currentYear && selMonth < currentMonth)) {
      dueDatePassed = true;
      const diffMs = now.getTime() - periodDueDate.getTime();
      baseDaysOverdue = Math.max(1, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
    } else if (selYear === currentYear && selMonth === currentMonth) {
      dueDatePassed = now.getDate() > 4;
      baseDaysOverdue = Math.max(0, now.getDate() - 4);
    }

    const activeTenants = tenants.filter((t) => {
      // Weder vor Einzug noch vor Eigentums-/Nutzenübergang oder nach Auszug berücksichtigen:
      const propPoss = t.property?.possessionAt || t.property?.purchasedAt;
      const possM = propPoss ? propPoss.slice(0, 7) : null;
      const tStartM = (t.moveInDate && possM)
        ? (t.moveInDate.slice(0, 7) > possM ? t.moveInDate.slice(0, 7) : possM)
        : (t.moveInDate ? t.moveInDate.slice(0, 7) : possM);

      if (tStartM && tStartM > period) return false;
      if (t.moveOutDate && t.moveOutDate.slice(0, 7) < period) return false;
      if (t.isCurrent === false) {
        const currentTenantOfProp = tenants.find((ot) => ot.property?.id === t.property?.id && ot.isCurrent);
        if (currentTenantOfProp?.moveInDate && currentTenantOfProp.moveInDate.slice(0, 7) <= period) {
          return false;
        }
      }
      return true;
    });

    return activeTenants.map((t) => {
      const tenantPayments = allPayments.filter((p) => {
        if (p.isSplit) return false;
        if (p.tenant?.id !== t.id) return false;
        const pMonthPayment =
          p.period && /^\d{4}-\d{2}$/.test(p.period)
            ? p.period
            : p.bookingDate.slice(0, 7);
        return pMonthPayment === period;
      });

      const rentPayments = tenantPayments.filter((p) => p.category === "RENT");
      const utilityPayments = tenantPayments.filter((p) => p.category === "UTILITY_IN");
      const otherPayments = tenantPayments.filter((p) => p.category === "OTHER");

      const paid = rentPayments.reduce((s, p) => s + p.amount, 0);
      const utilityPaid = utilityPayments.reduce((s, p) => s + p.amount, 0);
      const otherPaid = otherPayments.reduce((s, p) => s + p.amount, 0);
      const totalPaid = paid + utilityPaid + otherPaid;

      // Historisch korrekte Soll-Miete für diese Periode (berücksichtigt Mietanpassungen!)
      const resolvedRent = getRentForPeriod(t, period, t.property?.rentAdjustments);
      const soll = resolvedRent.warmRent;

      const sortedRent = [...rentPayments].sort(
        (a, b) => new Date(b.bookingDate).getTime() - new Date(a.bookingDate).getTime()
      );
      const lastPayment = sortedRent[0] || tenantPayments[0];
      const paymentDate = lastPayment ? lastPayment.bookingDate : null;

      const rentReferences = sortedRent
        .map((p) => p.reference)
        .filter(Boolean)
        .join(" • ");

      const utilityReferences = utilityPayments
        .map((p) => `${p.reference || "Abrechnung"} (${formatCurrency(p.amount)})`)
        .filter(Boolean)
        .join(" • ");

      let st: MonthStatus["status"];
      if (paid === soll && paid > 0) {
        st = "PAID";
      } else if (paid > soll) {
        st = "OVERPAID";
      } else if (paid > 0) {
        st = "PARTIAL";
      } else if (dueDatePassed) {
        st = "OVERDUE";
      } else {
        st = "PENDING";
      }

      const daysOverdue = st === "OVERDUE" || st === "PARTIAL" ? baseDaysOverdue : 0;

      return {
        tenantId: t.id,
        tenantName: `${t.firstName} ${t.lastName}`,
        propertyName: t.property?.name || "Wohnung",
        propertyAddress: t.property?.address || "",
        periodMonth: period,
        soll,
        ist: paid,
        utilityPaid,
        otherPaid,
        totalPaid,
        paymentDate,
        reference: rentReferences || null,
        utilityReference: utilityReferences || null,
        status: st,
        daysOverdue,
        tenant: t,
        isAdjusted: resolvedRent.isAdjusted,
        adjustmentNote: resolvedRent.adjustmentNote,
      };
    });
  }, [tenants, allPayments, period, availablePeriods]);

  // Gefilterter Mieteingangsstatus basierend auf Suchtext (Mieter, Wohnung, Adresse, Verwendungszweck, Status)
  const displayedMonthStatus = useMemo(() => {
    if (!searchQuery.trim()) return monthStatus;
    const query = searchQuery.toLowerCase().trim();
    return monthStatus.filter((ms) => {
      const tenantMatch = ms.tenantName.toLowerCase().includes(query);
      const propNameMatch = ms.propertyName.toLowerCase().includes(query);
      const propAddrMatch = (ms.propertyAddress || "").toLowerCase().includes(query);
      const refMatch = (ms.reference || "").toLowerCase().includes(query);
      const utilRefMatch = (ms.utilityReference || "").toLowerCase().includes(query);
      const noteMatch = (ms.adjustmentNote || "").toLowerCase().includes(query);
      const periodMatch = (ms.periodMonth || "").toLowerCase().includes(query);

      const statusLabels =
        ms.status === "PAID"
          ? "vollständig bezahlt pünktlich"
          : ms.status === "OVERPAID"
          ? "überzahlung überzahlt zuviel"
          : ms.status === "PARTIAL"
          ? "teilzahlung teilüberweisung zuwenig"
          : ms.status === "OVERDUE"
          ? "verzug überfällig rückstand mahnung unbezahlt"
          : "ausstehend offen";
      const statusMatch = statusLabels.includes(query);

      return (
        tenantMatch ||
        propNameMatch ||
        propAddrMatch ||
        refMatch ||
        utilRefMatch ||
        noteMatch ||
        periodMatch ||
        statusMatch
      );
    });
  }, [monthStatus, searchQuery]);

  // Kennzahlen für die KPI-Karten (Eingänge, Ausgänge, Balance)
  // Ausschluss von Eltern-Split-Buchungen, damit Beträge bei Aufteilung nicht doppelt erfasst werden
  const effectivePaymentsForKpis = useMemo(() => {
    return allPayments.filter((p) => {
      if (p.isSplit) return false; // Eltern nicht zählen, nur Split-Kinder
      if (period !== "ALL") {
        const pPeriod =
          p.period && /^\d{4}-\d{2}$/.test(p.period)
            ? p.period
            : p.bookingDate.slice(0, 7);
        if (pPeriod !== period) return false;
      }
      if (categoryFilter !== "ALL") {
        if (categoryFilter === "REPAIR") {
          if (p.category !== "REPAIR" && p.category !== "MAINTENANCE") return false;
        } else if (p.category !== categoryFilter) {
          return false;
        }
      }
      return true;
    });
  }, [allPayments, period, categoryFilter]);

  const totalIn = useMemo(() => {
    return effectivePaymentsForKpis
      .filter((p) => p.amount > 0)
      .reduce((s, p) => s + p.amount, 0);
  }, [effectivePaymentsForKpis]);

  const totalOut = useMemo(() => {
    return effectivePaymentsForKpis
      .filter((p) => p.amount < 0)
      .reduce((s, p) => s + p.amount, 0);
  }, [effectivePaymentsForKpis]);

  // Balance: Eingegangen minus Abgegangen (totalOut ist bereits negativ gespeichert)
  const balance = useMemo(() => {
    return totalIn + totalOut;
  }, [totalIn, totalOut]);

  const incomingCount = displayedPayments.filter((p) => p.amount > 0).length;
  const outgoingCount = displayedPayments.filter((p) => p.amount < 0).length;
  const matchedCount = displayedPayments.filter((p) => p.tenant?.id).length;
  const overdueCount = displayedMonthStatus.filter(
    (m) => m.status === "OVERDUE" || m.status === "PARTIAL"
  ).length;
  const overpaidCount = displayedMonthStatus.filter((m) => m.status === "OVERPAID").length;

  return (
    <div className="p-3.5 sm:p-6 space-y-4 sm:space-y-6 animate-fade-in">
      {/* Header mit Titel & Aktionen */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Zahlungsströme & Bankabgleich</h1>
            <Badge variant="outline" className="border-emerald-500/40 text-emerald-600 dark:text-emerald-400 text-xs gap-1 py-0.5 shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Google Sheets Live
            </Badge>
          </div>
          <p className="text-muted-foreground text-xs sm:text-sm mt-0.5">
            Automatischer Soll-/Ist-Vergleich, Bank-Import aus „Kontobewegung“ & 1-Klick Mahnwesen
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Bonus: Verwendungszweck Toggle-Button */}
          <Button
            variant={showPurpose ? "secondary" : "outline"}
            size="sm"
            onClick={() => setShowPurpose(!showPurpose)}
            className="gap-1.5 shadow-sm"
            title="Verwendungszweck-Spalte in beiden Tabellen ein- oder ausblenden"
          >
            {showPurpose ? (
              <EyeOff className="h-4 w-4 text-muted-foreground" />
            ) : (
              <Eye className="h-4 w-4 text-primary" />
            )}
            <span>Verwendungszweck</span>
            <Badge variant="outline" className="text-[10px] px-1 py-0 h-4">
              {showPurpose ? "Sichtbar" : "Versteckt"}
            </Badge>
          </Button>

          {/* Monats- / Zeitraums-Auswahl */}
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-full sm:w-44 h-9">
              <Calendar className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Alle Monate (Gesamt)</SelectItem>
              {availablePeriods.map((val) => {
                const [y, m] = val.split("-");
                const d = new Date(parseInt(y, 10), parseInt(m, 10) - 1, 1);
                const label = d.toLocaleDateString("de-DE", { month: "long", year: "numeric" });
                return (
                  <SelectItem key={val} value={val}>
                    {label}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>

          {/* n8n Comdirect Bankabruf (Maurizio & Steven) mit Auto-Sync */}
          <N8nBankSyncButtons
            currentBalance={accountBalance}
            onSyncComplete={(newBal) => {
              fetchPayments();
              fetchTenants();
              if (newBal) setAccountBalance(newBal);
              else fetchAccountBalance();
            }}
          />

          {/* Zuordnungen neu abgleichen (Re-Match) */}
          <RematchButton onRematchComplete={() => { fetchPayments(); fetchTenants(); fetchAccountBalance(); }} />

          {/* Google Sheets Sync & Status */}
          <GoogleSheetsDialog currentBalance={accountBalance} onSyncComplete={(newBal) => { fetchPayments(); if (newBal) setAccountBalance(newBal); else fetchAccountBalance(); }} />

          {/* Optionaler manueller CSV Import */}
          <CsvUploadDialog onUploaded={() => { fetchPayments(); fetchAccountBalance(); }} />
        </div>
      </div>

      {/* KPI Cards: Kontostand, Geldeingänge, Geldausgänge, Balance, Buchungen, Handlungsbedarf */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* 1. Aktueller Kontostand */}
        <Card className="shadow-sm border-blue-500/20 bg-blue-500/5 dark:bg-blue-500/10">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
              <span className="font-semibold text-foreground">Kontostand</span>
              <Landmark className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            </div>
            <p className="text-xl md:text-2xl font-bold text-blue-600 dark:text-blue-400">
              {accountBalance ? formatCurrency(accountBalance.amount) : "–"}
            </p>
            <p
              className="text-[11px] text-muted-foreground mt-0.5 truncate"
              title={
                accountBalance
                  ? `Stand: ${accountBalance.formattedDate}${
                      formatRelativeDate(accountBalance.date || accountBalance.formattedDate)
                        ? ` (${formatRelativeDate(accountBalance.date || accountBalance.formattedDate)})`
                        : ""
                    }`
                  : undefined
              }
            >
              {accountBalance ? (
                <>
                  Stand: {accountBalance.formattedDate}
                  {formatRelativeDate(accountBalance.date || accountBalance.formattedDate) && (
                    <span className="font-medium text-foreground/80 dark:text-foreground/70 ml-1">
                      ({formatRelativeDate(accountBalance.date || accountBalance.formattedDate)})
                    </span>
                  )}
                </>
              ) : (
                "Wird geladen..."
              )}
            </p>
          </CardContent>
        </Card>

        {/* 2. Geldeingänge */}
        <Card className="shadow-sm">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
              <span>Geldeingänge</span>
              <ArrowDownLeft className="h-4 w-4 text-emerald-500" />
            </div>
            <p className="text-xl md:text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              +{formatCurrency(totalIn)}
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {incomingCount} {incomingCount === 1 ? "Eingang" : "Eingänge"}
            </p>
          </CardContent>
        </Card>

        {/* 2. Geldausgänge */}
        <Card className="shadow-sm">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
              <span>Geldausgänge</span>
              <ArrowUpRight className="h-4 w-4 text-rose-500" />
            </div>
            <p className="text-xl md:text-2xl font-bold text-rose-600 dark:text-rose-400">
              {formatCurrency(totalOut)}
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {outgoingCount} {outgoingCount === 1 ? "Ausgang" : "Ausgänge"}
            </p>
          </CardContent>
        </Card>

        {/* 3. Balance (Eingegangen minus Abgegangen) */}
        <Card
          className={`shadow-sm border-2 ${
            balance >= 0
              ? "border-emerald-500/30 bg-emerald-500/5 dark:bg-emerald-500/10"
              : "border-rose-500/30 bg-rose-500/5 dark:bg-rose-500/10"
          }`}
        >
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
              <span className="font-semibold text-foreground">Balance (Saldo)</span>
              <Scale className={`h-4 w-4 ${balance >= 0 ? "text-emerald-500" : "text-rose-500"}`} />
            </div>
            <p
              className={`text-xl md:text-2xl font-extrabold ${
                balance >= 0
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-rose-600 dark:text-rose-400"
              }`}
            >
              {balance > 0 ? "+" : ""}
              {formatCurrency(balance)}
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Eingegangen − Abgegangen
            </p>
          </CardContent>
        </Card>

        {/* 4. Gebuchte Umsätze */}
        <Card className="shadow-sm">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
              <span>Gebuchte Umsätze</span>
              <Euro className="h-4 w-4 text-primary" />
            </div>
            <p className="text-xl md:text-2xl font-bold">{displayedPayments.length}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {matchedCount} zugeordnete Miete{matchedCount === 1 ? "" : "n"}
            </p>
          </CardContent>
        </Card>

        {/* 5. Status & Handlungsbedarf */}
        <Card className="shadow-sm">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
              <span>Status & Verzug</span>
              <AlertCircle
                className={`h-4 w-4 ${
                  overdueCount > 0
                    ? "text-rose-500"
                    : overpaidCount > 0
                    ? "text-amber-500"
                    : "text-emerald-500"
                }`}
              />
            </div>
            <p
              className={`text-xl md:text-2xl font-bold ${
                overdueCount > 0
                  ? "text-rose-500"
                  : overpaidCount > 0
                  ? "text-amber-500"
                  : "text-emerald-600 dark:text-emerald-400"
              }`}
            >
              {overdueCount > 0
                ? `${overdueCount} im Verzug`
                : overpaidCount > 0
                ? `${overpaidCount} Überzahlung`
                : "Alles ausgeglichen"}
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {overdueCount > 0
                ? `${overdueCount} Mieter überfällig`
                : overpaidCount > 0
                ? "Überzahlung überprüfen"
                : "Kein Handlungsbedarf"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <TabsList className="grid grid-cols-2 w-full sm:w-[480px] max-w-full h-10 p-1">
            <TabsTrigger value="status" className="px-2 sm:px-3 text-xs sm:text-sm font-medium whitespace-nowrap">
              Mieteingangsstatus ({displayedMonthStatus.length})
            </TabsTrigger>
            <TabsTrigger value="buchungen" className="px-2 sm:px-3 text-xs sm:text-sm font-medium whitespace-nowrap">
              Bankumsätze ({displayedPayments.length})
            </TabsTrigger>
          </TabsList>

          {/* Universelle Suche & Filter für beide Tabs (Mieteingangsstatus & Bankumsätze) */}
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative w-full sm:w-56 md:w-80">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Mieter, Wohnung, Zweck, Status..."
                className="pl-8 pr-7 h-8 text-xs font-normal"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2 top-2 text-muted-foreground hover:text-foreground transition-colors"
                  title="Suche zurücksetzen"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Tab 1: Mieteingangsstatus & Mahnwesen */}
        <TabsContent value="status" className="space-y-4">
          <Card className="shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-primary" />
                    Soll-/Ist-Vergleich je Einheit & Wohnung
                  </CardTitle>
                  <CardDescription>
                    Übersicht der Mieteinnahmen mit Fälligkeit zum 3. Werktag (§ 556b Abs. 1 BGB)
                  </CardDescription>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {searchQuery.trim() && (
                    <Badge variant="secondary" className="text-xs font-normal gap-1 py-0.5 px-2 bg-primary/10 text-primary border border-primary/20">
                      <span>Suche: „{searchQuery.trim()}“</span>
                      <button
                        type="button"
                        onClick={() => setSearchQuery("")}
                        className="hover:text-destructive ml-0.5"
                        title="Filter entfernen"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  )}
                  {period !== "ALL" && (
                    <Badge variant="outline" className="text-xs font-normal">
                      Abrechnungsmonat: {period}
                    </Badge>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg border overflow-hidden">
                <Table>
                  <TableHeader className="bg-muted/40">
                    <TableRow>
                      {period === "ALL" && (
                        <TableHead className="font-semibold">Monat</TableHead>
                      )}
                      <TableHead className="font-semibold">Wohnung</TableHead>
                      <TableHead className="font-semibold">Mieter</TableHead>
                      <TableHead className="font-semibold">Eingangsdatum</TableHead>
                      <TableHead className="text-right font-semibold">Soll-Warmmiete</TableHead>
                      <TableHead className="text-right font-semibold">Tatsächlicher Eingang</TableHead>
                      <TableHead className="text-right font-semibold">Saldo / Differenz</TableHead>
                      <TableHead className="font-semibold">Status</TableHead>
                      {showPurpose && (
                        <TableHead className="font-semibold">Verwendungszweck (Bank)</TableHead>
                      )}
                      <TableHead className="text-right font-semibold">Mahnwesen / Aktion</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {displayedMonthStatus.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={(showPurpose ? 9 : 8) + (period === "ALL" ? 1 : 0)} className="text-center py-10 text-muted-foreground">
                          <div className="flex flex-col items-center justify-center gap-2 max-w-md mx-auto">
                            <Building2 className="h-8 w-8 text-muted-foreground/40 mb-1" />
                            <p className="font-semibold text-sm text-foreground">
                              Keine Einheiten oder Mieter gefunden
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {searchQuery.trim()
                                ? `Keine Einheiten für den Suchbegriff „${searchQuery.trim()}“ im gewählten Zeitraum gefunden.`
                                : period !== "ALL"
                                ? `Für den Abrechnungsmonat ${period} liegen keine fälligen Mieten vor.`
                                : "Keine Einheiten oder Mieter vorhanden."}
                            </p>
                            <div className="flex flex-wrap items-center justify-center gap-2 mt-2">
                              {period !== "ALL" && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-8 text-xs gap-1.5 shadow-sm"
                                  onClick={() => setPeriod("ALL")}
                                >
                                  <Calendar className="h-3.5 w-3.5 text-primary" />
                                  Alle Monate anzeigen
                                </Button>
                              )}
                              {searchQuery.trim() && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-8 text-xs gap-1.5 shadow-sm"
                                  onClick={() => setSearchQuery("")}
                                >
                                  <X className="h-3.5 w-3.5" />
                                  Suche zurücksetzen
                                </Button>
                              )}
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      displayedMonthStatus.map((ms) => {
                        const diff = ms.ist - ms.soll;
                        const hasDeficit = ms.ist < ms.soll;
                        const isOverpaid = ms.status === "OVERPAID";

                        return (
                          <TableRow key={ms.tenantId} className="hover:bg-muted/50 transition-colors">
                            {/* 0. Monat (nur bei 'Alle Monate') */}
                            {period === "ALL" && (
                              <TableCell className="text-xs font-semibold whitespace-nowrap">
                                <Badge variant="outline" className="font-medium text-xs bg-muted/30">
                                  {ms.periodMonth
                                    ? new Date(`${ms.periodMonth}-01`).toLocaleDateString("de-DE", { month: "short", year: "numeric" })
                                    : "–"}
                                </Badge>
                              </TableCell>
                            )}

                            {/* 1. Wohnung (z.B. Weber Wiesen / Siemensstraße EG) */}
                            <TableCell className="font-semibold text-sm">
                              <div className="flex items-center gap-1.5">
                                <Building2 className="h-4 w-4 text-primary shrink-0" />
                                <div>
                                  <div className="font-medium text-foreground">{ms.propertyName}</div>
                                  {ms.propertyAddress && (
                                    <div className="text-xs text-muted-foreground font-normal truncate max-w-[200px]">
                                      {ms.propertyAddress}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </TableCell>

                            {/* 2. Mieter */}
                            <TableCell className="text-sm font-medium">
                              <div className="font-semibold text-foreground">{ms.tenantName}</div>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-5 px-1.5 text-[11px] text-primary hover:text-primary/90 hover:bg-primary/10 gap-1 mt-0.5"
                                onClick={() => setHistoryTenant(ms.tenant)}
                              >
                                <Calendar className="h-3 w-3" />
                                Monatsverlauf
                              </Button>
                            </TableCell>

                            {/* 3. Datum / Eingangsdatum */}
                            <TableCell className="text-xs">
                              {ms.paymentDate ? (
                                <span className="inline-flex items-center gap-1 text-foreground font-mono">
                                  <Calendar className="h-3 w-3 text-muted-foreground" />
                                  {formatDate(ms.paymentDate)}
                                </span>
                              ) : (
                                <span className="text-muted-foreground italic">Ausstehend</span>
                              )}
                            </TableCell>

                            {/* 4. Wie hoch die Miete war (Soll) */}
                            <TableCell className="text-right text-sm">
                              <span className="font-semibold">{formatCurrency(ms.soll)}</span>
                              {ms.isAdjusted && (
                                <div className="text-[10px] text-blue-600 dark:text-blue-400 font-normal" title={ms.adjustmentNote || ""}>
                                  Historischer Soll
                                </div>
                              )}
                            </TableCell>

                            {/* 5. Wie viel tatsächlich eingegangen ist (Ist / Geldeingang) */}
                            <TableCell className="text-right text-sm font-semibold">
                              <div className={ms.ist > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"}>
                                {formatCurrency(ms.ist)}
                              </div>
                              {ms.utilityPaid > 0 && (
                                <div
                                  className="inline-flex items-center gap-1 mt-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-cyan-100 text-cyan-800 dark:bg-cyan-900/40 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-800 cursor-pointer hover:bg-cyan-200 transition-colors"
                                  title={`Nebenkostenabrechnung: ${ms.utilityReference || ''}`}
                                  onClick={() => setHistoryTenant(ms.tenant)}
                                >
                                  +{formatCurrency(ms.utilityPaid)} NK-Abrechnung
                                </div>
                              )}
                            </TableCell>

                            {/* 6. Saldo / Differenz */}
                            <TableCell className="text-right text-sm font-bold">
                              {diff === 0 ? (
                                <span className="text-emerald-600 dark:text-emerald-400">±0,00 €</span>
                              ) : diff > 0 ? (
                                <span className="text-amber-600 dark:text-amber-400">+{formatCurrency(diff)}</span>
                              ) : (
                                <span className="text-red-600 dark:text-red-400">{formatCurrency(diff)}</span>
                              )}
                            </TableCell>

                            {/* 7. Status */}
                            <TableCell>
                              <span
                                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                                  STATUS_COLORS[ms.status] || ""
                                }`}
                              >
                                {ms.status === "PAID"
                                  ? "● Vollständig bezahlt"
                                  : ms.status === "OVERPAID"
                                  ? "● Zu viel gezahlt (überprüfen)"
                                  : ms.status === "PARTIAL"
                                  ? "● Teilzahlung"
                                  : ms.status === "OVERDUE"
                                  ? `● Überfällig (${ms.daysOverdue} T.)`
                                  : "● Ausstehend"}
                              </span>
                            </TableCell>

                            {/* 8. Verwendungszweck (Bonus ein-/ausblendbar) */}
                            {showPurpose && (
                              <TableCell className="text-xs text-muted-foreground font-mono min-w-[180px] max-w-[320px]">
                                <div className="line-clamp-4 leading-snug break-words whitespace-normal" title={ms.reference || ""}>
                                  {ms.reference || "–"}
                                </div>
                                {ms.utilityReference && (
                                  <div className="line-clamp-1 truncate text-cyan-700 dark:text-cyan-300 text-[10px] mt-0.5 font-sans" title={ms.utilityReference}>
                                    NK: {ms.utilityReference}
                                  </div>
                                )}
                              </TableCell>
                            )}

                            {/* 9. Mahnwesen / Aktion */}
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-7 text-xs gap-1 shadow-sm"
                                  onClick={() => setHistoryTenant(ms.tenant)}
                                  title="Monatsverlauf je Mieter anzeigen"
                                >
                                  <Calendar className="h-3.5 w-3.5 text-primary" />
                                  <span className="hidden sm:inline">Monatsverlauf</span>
                                </Button>

                                {hasDeficit ? (
                                  <MahnungDialog status={ms} period={period} />
                                ) : isOverpaid ? (
                                  <OverpaymentDialog status={ms} />
                                ) : (
                                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                                    <Check className="h-3.5 w-3.5 text-emerald-500" /> Ausgeglichen
                                  </span>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 2: Bankumsätze aus Google Sheets */}
        <TabsContent value="buchungen" className="space-y-4">
          <Card className="shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <FileSpreadsheet className="h-4 w-4 text-emerald-500" />
                    Google Sheets Buchungen im Detail
                  </CardTitle>
                  <CardDescription>
                    Live-Synchronisation aus Tabellenblatt „Kontobewegung“ mit automatischer Zuordnung
                  </CardDescription>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {searchQuery.trim() && (
                    <Badge variant="secondary" className="text-xs font-normal gap-1 py-0.5 px-2 bg-primary/10 text-primary border border-primary/20">
                      <span>Suche: „{searchQuery.trim()}“</span>
                      <button
                        type="button"
                        onClick={() => setSearchQuery("")}
                        className="hover:text-destructive ml-0.5"
                        title="Filter entfernen"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  )}
                  <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                    <SelectTrigger className="w-full sm:w-44 h-8 text-xs">
                      <SelectValue placeholder="Kategorie" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">Alle Kategorien</SelectItem>
                      <SelectItem value="RENT">Miete</SelectItem>
                      <SelectItem value="LOAN">Darlehen / Annuität</SelectItem>
                      <SelectItem value="HAUSGELD">Hausgeld</SelectItem>
                      <SelectItem value="REPAIR">Baumaterial & Reparatur</SelectItem>
                      <SelectItem value="UTILITY_IN">Nebenkosten-Abrechnung</SelectItem>
                      <SelectItem value="OTHER">Sonstiges</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-2">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="h-12 skeleton rounded-lg" />
                  ))}
                </div>
              ) : (
                <div className="rounded-lg border overflow-hidden">
                  <Table>
                    <TableHeader className="bg-muted/40">
                      <TableRow>
                        <TableHead className="font-semibold">Datum</TableHead>
                        <TableHead className="font-semibold">Wohnung</TableHead>
                        <TableHead className="font-semibold min-w-[160px] max-w-[220px]">Zahlungspartner / Payer</TableHead>
                        {showPurpose && (
                          <TableHead className="font-semibold min-w-[180px] max-w-[320px]">Verwendungszweck (Bank)</TableHead>
                        )}
                        <TableHead className="text-right font-semibold">Soll (Miete/Kredit)</TableHead>
                        <TableHead className="text-right font-semibold">Tatsächlicher Betrag</TableHead>
                        <TableHead className="text-right font-semibold">Saldo / Diff.</TableHead>
                        <TableHead className="font-semibold">Kategorie & Matching</TableHead>
                        <TableHead className="font-semibold">Zuordnung</TableHead>
                        <TableHead className="text-right font-semibold">Aktion</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {displayedPayments.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={showPurpose ? 10 : 9} className="text-center py-10 text-muted-foreground">
                            <div className="flex flex-col items-center justify-center gap-2 max-w-md mx-auto">
                              <FileSpreadsheet className="h-8 w-8 text-muted-foreground/40 mb-1" />
                              <p className="font-semibold text-sm text-foreground">
                                Keine Bankbuchungen gefunden
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {searchQuery.trim()
                                  ? `Keine Buchungen für die Suche „${searchQuery.trim()}“ im Monat ${period === "ALL" ? "Gesamt" : period}.`
                                  : period !== "ALL"
                                  ? `Für den Abrechnungsmonat ${period} liegen noch keine importierten Buchungen vor.`
                                  : "Keine Bankbuchungen erfasst."}
                              </p>
                              <div className="flex flex-wrap items-center justify-center gap-2 mt-2">
                                {period !== "ALL" && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-8 text-xs gap-1.5 shadow-sm"
                                    onClick={() => setPeriod("ALL")}
                                  >
                                    <Calendar className="h-3.5 w-3.5 text-primary" />
                                    Alle Monate anzeigen
                                  </Button>
                                )}
                                {searchQuery.trim() && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-8 text-xs gap-1.5 shadow-sm"
                                    onClick={() => setSearchQuery("")}
                                  >
                                    <X className="h-3.5 w-3.5" />
                                    Suche zurücksetzen
                                  </Button>
                                )}
                                {categoryFilter !== "ALL" && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-8 text-xs shadow-sm"
                                    onClick={() => setCategoryFilter("ALL")}
                                  >
                                    Alle Kategorien
                                  </Button>
                                )}
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      ) : (
                        displayedPayments.map((payment) => {
                          const method =
                            METHOD_CONFIG[payment.matchMethod as keyof typeof METHOD_CONFIG] ||
                            METHOD_CONFIG.UNMATCHED;
                          const MethodIcon = method.icon;

                          const tenant = payment.tenant;
                          const fullTenant = tenant
                            ? (tenants.find((t) => t.id === tenant.id) || tenant)
                            : null;
                          const isRent = payment.category === "RENT";
                          const isUtility = payment.category === "UTILITY_IN";
                          const isLoan = payment.category === "LOAN";
                          const isHausgeld = payment.category === "HAUSGELD";
                          const isRepair = payment.category === "REPAIR" || payment.category === "MAINTENANCE";

                          const matchedLoan =
                            payment.loan ||
                            loans.find((l) => Math.abs(l.monthlyPayment - Math.abs(payment.amount)) < 0.05);

                          const matchedProperty =
                            payment.property ||
                            properties.find((p) => p.id === payment.propertyId) ||
                            fullTenant?.property ||
                            matchedLoan?.property ||
                            (isHausgeld
                              ? findBestMatchingProperty(
                                  `${payment.payerName || ""} ${payment.reference || ""}`,
                                  properties
                                )?.property
                              : null);

                          const propName =
                            tenant?.property?.name ||
                            payment.property?.name ||
                            payment.loan?.property?.name ||
                            matchedLoan?.property?.name ||
                            (isHausgeld ? matchedProperty?.name : null);

                          const paymentMonth =
                            payment.period && /^\d{4}-\d{2}$/.test(payment.period)
                              ? payment.period
                              : payment.bookingDate
                              ? payment.bookingDate.slice(0, 7)
                              : null;

                          const rentAdjustments =
                            fullTenant?.property?.rentAdjustments ||
                            tenant?.property?.rentAdjustments ||
                            [];

                          const resolvedRent =
                            isRent && fullTenant && paymentMonth
                              ? getRentForPeriod(
                                  {
                                    coldRent: fullTenant.coldRent || 0,
                                    utilities: fullTenant.utilities || 0,
                                  },
                                  paymentMonth,
                                  rentAdjustments
                                )
                              : null;

                          let soll: number | null = null;
                          let diff: number | null = null;
                          let hausgeldUnitHint: string | null = null;

                          if (isRent) {
                            soll = resolvedRent
                              ? resolvedRent.warmRent
                              : fullTenant
                              ? (fullTenant.coldRent || 0) + (fullTenant.utilities || 0)
                              : null;
                            diff = soll !== null ? payment.amount - soll : null;
                          } else if (isLoan) {
                            if (matchedLoan) {
                              soll = matchedLoan.monthlyPayment;
                              diff = Math.abs(payment.amount) - matchedLoan.monthlyPayment;
                            }
                          } else if (isHausgeld && matchedProperty) {
                            // 1. Prüfen auf Wohneinheiten-Detail (z.B. WE 5: 250 €, WE 6: 340 €)
                            if (matchedProperty.hausgeldDetails) {
                              try {
                                const details =
                                  typeof matchedProperty.hausgeldDetails === "string"
                                    ? JSON.parse(matchedProperty.hausgeldDetails)
                                    : matchedProperty.hausgeldDetails;
                                const refText = `${payment.reference || ""} ${payment.payerName || ""}`.toLowerCase();

                                for (const [unitKey, unitVal] of Object.entries(details)) {
                                  const uNum = unitKey.replace(/\D/g, "");
                                  const normKey = unitKey.toLowerCase();
                                  const matchesUnit =
                                    refText.includes(normKey) ||
                                    (uNum &&
                                      (refText.includes(`we${uNum}`) ||
                                        refText.includes(`w${uNum}`) ||
                                        refText.includes(`we ${uNum}`) ||
                                        refText.includes(`whg ${uNum}`) ||
                                        refText.includes(`whg. ${uNum}`)));

                                  if (matchesUnit) {
                                    const valNum =
                                      typeof unitVal === "number"
                                        ? unitVal
                                        : (unitVal as any)?.hausgeld != null
                                        ? Number((unitVal as any).hausgeld) + Number((unitVal as any).maintenanceReserve || 0)
                                        : null;
                                    if (valNum != null && valNum > 0) {
                                      soll = valNum;
                                      hausgeldUnitHint = unitKey;
                                      break;
                                    }
                                  }
                                }
                              } catch (e) {
                                // ignore
                              }
                            }

                            // 2. Falls kein Einheiten-Match, Gesamt-Soll der Wohnung verwenden (Hausgeld + Erhaltungsrücklage)
                            if (soll === null) {
                              const totalWeg = (matchedProperty.hausgeld || 0) + (matchedProperty.maintenanceReserve || 0);
                              if (totalWeg > 0) {
                                soll = totalWeg;
                              }
                            }

                            if (soll !== null) {
                              diff = Math.abs(payment.amount) - soll;
                            }
                          }

                          return (
                            <Fragment key={payment.id}>
                            <TableRow className="hover:bg-muted/50 transition-colors">
                              {/* 1. Datum */}
                              <TableCell className="text-xs font-mono text-muted-foreground whitespace-nowrap">
                                {formatDate(payment.bookingDate)}
                              </TableCell>

                              {/* 2. Wohnung (z.B. Weber Wiesen / Siemensstraße EG) */}
                              <TableCell className="text-sm">
                                {propName ? (
                                  <div className="flex items-center gap-1.5 font-medium text-foreground">
                                    <Building2 className="h-3.5 w-3.5 text-primary shrink-0" />
                                    <span>{propName}</span>
                                  </div>
                                ) : (
                                  <span className="text-muted-foreground text-xs italic">–</span>
                                )}
                              </TableCell>

                              {/* 3. Zahlungspartner (3-zeilig) */}
                              <TableCell className="text-sm font-medium min-w-[160px] max-w-[240px]">
                                <div className="line-clamp-3 leading-snug break-words whitespace-normal font-semibold text-foreground" title={payment.payerName}>
                                  {payment.payerName || "–"}
                                </div>
                                {payment.payerIban && (
                                  <div className="text-[10px] text-muted-foreground font-mono truncate mt-0.5" title={payment.payerIban}>
                                    {payment.payerIban}
                                  </div>
                                )}
                              </TableCell>

                              {/* 4. Verwendungszweck (4-zeilig ein-/ausblendbar) */}
                              {showPurpose && (
                                <TableCell className="text-xs text-muted-foreground font-mono min-w-[180px] max-w-[340px]">
                                  <div className="line-clamp-4 leading-snug break-words whitespace-normal select-text" title={payment.reference || ""}>
                                    {payment.reference || "–"}
                                  </div>
                                </TableCell>
                              )}

                              {/* 5. Soll (Miete / Kredit) */}
                              <TableCell className="text-right text-xs text-muted-foreground">
                                {isRent && soll !== null ? (
                                  <div>
                                    <span className="font-semibold text-foreground">{formatCurrency(soll)}</span>
                                    {resolvedRent?.isAdjusted ? (
                                      <div className="text-[10px] text-blue-600 dark:text-blue-400 font-normal" title={resolvedRent.adjustmentNote || ""}>
                                        Historischer Soll
                                      </div>
                                    ) : matchedProperty?.unitDetails ? (() => {
                                      try {
                                        const uDetails = typeof matchedProperty.unitDetails === "string" ? JSON.parse(matchedProperty.unitDetails) : matchedProperty.unitDetails;
                                        const parts = Object.entries(uDetails).map(([k, v]: [string, any]) => `${k}: ${formatCurrency(v.warmRent || (v.coldRent + (v.utilities || 0)))}`);
                                        if (parts.length > 1) {
                                          return (
                                            <div className="text-[10px] text-indigo-600 dark:text-indigo-400 font-normal truncate max-w-[170px] ml-auto" title={parts.join(" + ")}>
                                              {parts.join(" + ")}
                                            </div>
                                          );
                                        }
                                      } catch {}
                                      return null;
                                    })() : null}
                                  </div>
                                ) : isLoan && soll !== null ? (
                                  <div>
                                    <span className="font-semibold text-foreground">{formatCurrency(soll)}</span>
                                    <div className="text-[10px] text-purple-600 dark:text-purple-400 font-normal">
                                      Soll-Annuität
                                    </div>
                                  </div>
                                ) : isUtility ? (
                                  <span className="text-cyan-700 dark:text-cyan-300 italic text-[11px]">NK-Abrechnung</span>
                                ) : isHausgeld ? (
                                  soll !== null ? (
                                    <div>
                                      <span className="font-semibold text-foreground">{formatCurrency(soll)}</span>
                                      <div className="text-[10px] text-indigo-600 dark:text-indigo-400 font-normal">
                                        Soll-Hausgeld{hausgeldUnitHint ? ` (${hausgeldUnitHint})` : ""}
                                      </div>
                                    </div>
                                  ) : (
                                    <span className="text-indigo-700 dark:text-indigo-300 italic text-[11px]">Hausgeld</span>
                                  )
                                ) : isRepair ? (
                                  <span className="text-amber-700 dark:text-amber-300 italic text-[11px]">Baumaterial / Reparatur</span>
                                ) : (
                                  "–"
                                )}
                              </TableCell>

                              {/* 6. Tatsächlicher Eingang / Ausgang */}
                              <TableCell className="text-right font-semibold text-sm">
                                <span
                                  className={
                                    payment.amount >= 0
                                      ? "text-emerald-600 dark:text-emerald-400"
                                      : "text-rose-600 dark:text-rose-400"
                                  }
                                >
                                  {payment.amount > 0 ? "+" : ""}
                                  {formatCurrency(payment.amount)}
                                </span>
                              </TableCell>

                              {/* 7. Saldo / Differenz */}
                              <TableCell className="text-right text-xs font-bold">
                                {isRent && diff !== null ? (
                                  diff === 0 ? (
                                    <span className="text-emerald-600 dark:text-emerald-400">±0,00 €</span>
                                  ) : diff > 0 ? (
                                    <span className="text-amber-600 dark:text-amber-400" title="Zahlung übersteigt Soll-Miete">
                                      +{formatCurrency(diff)} (Überzahlung)
                                    </span>
                                  ) : (
                                    <span className="text-rose-600 dark:text-rose-400">{formatCurrency(diff)}</span>
                                  )
                                ) : isLoan && diff !== null ? (
                                  Math.abs(diff) < 0.01 ? (
                                    <span className="text-emerald-600 dark:text-emerald-400">±0,00 € (vollständig)</span>
                                  ) : diff > 0 ? (
                                    <span className="text-amber-600 dark:text-amber-400" title="Zahlung übersteigt monatliche Rate">
                                      +{formatCurrency(diff)} (Sondertilgung)
                                    </span>
                                  ) : (
                                    <span className="text-rose-600 dark:text-rose-400">{formatCurrency(diff)}</span>
                                  )
                                ) : isUtility ? (
                                  <span className="text-cyan-700 dark:text-cyan-300 font-semibold text-[11px]" title="Zahlung für Nebenkostenabrechnung (keine Mietüberzahlung)">
                                    {payment.amount > 0 ? "+" : ""}{formatCurrency(payment.amount)} (NK)
                                  </span>
                                ) : isHausgeld ? (
                                  payment.amount > 0 ? (
                                    <span className="text-emerald-600 dark:text-emerald-400 font-semibold text-[11px]" title="Hausgeld-Guthaben / Abrechnung">
                                      +{formatCurrency(payment.amount)} (Guthaben)
                                    </span>
                                  ) : diff !== null ? (
                                    Math.abs(diff) < 0.01 ? (
                                      <span className="text-emerald-600 dark:text-emerald-400">±0,00 € (vollständig)</span>
                                    ) : diff > 0 ? (
                                      <span className="text-amber-600 dark:text-amber-400" title="Zahlung übersteigt monatliches Soll-Hausgeld">
                                        +{formatCurrency(diff)} (Überzahlung)
                                      </span>
                                    ) : (
                                      <span className="text-rose-600 dark:text-rose-400" title="Zahlung geringer als monatliches Soll-Hausgeld">
                                        {formatCurrency(diff)}
                                      </span>
                                    )
                                  ) : (
                                    <span className="text-muted-foreground">–</span>
                                  )
                                ) : (
                                  <span className="text-muted-foreground">–</span>
                                )}
                              </TableCell>

                              {/* 8. Kategorie & Matching */}
                              <TableCell>
                                {payment.isSplit ? (
                                  <div className="flex flex-col gap-1 items-start">
                                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                                      <Split className="h-3 w-3" />
                                      Split ({payment.splitPayments?.length || 0} Teile)
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => toggleExpandSplit(payment.id)}
                                      className="text-[10px] text-purple-600 dark:text-purple-400 hover:underline flex items-center gap-0.5 mt-0.5 font-medium"
                                    >
                                      {expandedSplitIds.has(payment.id) ? (
                                        <>
                                          <ChevronUp className="h-3 w-3" /> Details einklappen
                                        </>
                                      ) : (
                                        <>
                                          <ChevronDown className="h-3 w-3" /> Details anzeigen
                                        </>
                                      )}
                                    </button>
                                  </div>
                                ) : (
                                  <div className="flex flex-col gap-1 items-start">
                                    <span
                                      className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${
                                        CATEGORY_LABELS[payment.category]?.color || "bg-muted text-muted-foreground"
                                      }`}
                                    >
                                      {CATEGORY_LABELS[payment.category]?.label || payment.category}
                                    </span>
                                    <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                                      <MethodIcon className="h-3 w-3" />
                                      <span>{method.label}</span>
                                      {payment.matchConfidence && payment.matchMethod === "AI" && (
                                        <span>({(payment.matchConfidence * 100).toFixed(0)}%)</span>
                                      )}
                                    </div>
                                  </div>
                                )}
                              </TableCell>

                              {/* 9. Mieter / Zuordnung */}
                              <TableCell className="text-sm">
                                {payment.isSplit ? (
                                  <div className="flex flex-col gap-1">
                                    {payment.splitPayments && payment.splitPayments.length > 0 ? (
                                      payment.splitPayments.map((sp, sIdx) => (
                                        <div key={sp.id || sIdx} className="text-xs flex items-center gap-1.5 text-muted-foreground flex-wrap">
                                          <span className="font-semibold text-foreground">{formatCurrency(sp.amount)}</span>
                                          <span className="text-[10px] px-1 py-0.2 rounded bg-muted/70 text-foreground font-medium">
                                            {CATEGORY_LABELS[sp.category]?.label || sp.category}
                                          </span>
                                          <span className="font-medium text-foreground">
                                            {sp.tenant ? `${sp.tenant.firstName} ${sp.tenant.lastName}` : sp.property?.name || "Allgemein"}
                                          </span>
                                          {sp.period && <span className="font-mono text-[10px] text-muted-foreground">({sp.period})</span>}
                                        </div>
                                      ))
                                    ) : (
                                      <span className="text-muted-foreground text-xs italic">Aufgeteilt</span>
                                    )}
                                  </div>
                                ) : tenant ? (
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="font-medium text-foreground">
                                      {tenant.firstName} {tenant.lastName}
                                    </span>
                                    {tenant.isCurrent === false && (
                                      <span className="text-[10px] bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/30 px-1 py-0.5 rounded font-medium">
                                        Vormieter
                                      </span>
                                    )}
                                  </div>
                                ) : payment.loan || matchedLoan ? (
                                  <div className="flex items-center gap-1 font-medium text-purple-700 dark:text-purple-300 text-xs">
                                    <Landmark className="h-3 w-3 shrink-0" />
                                    <span>{(payment.loan || matchedLoan)?.bank || (payment.loan || matchedLoan)?.label}</span>
                                  </div>
                                ) : payment.property || (isHausgeld && matchedProperty) ? (
                                  <div className="flex items-center gap-1.5 font-medium text-xs flex-wrap">
                                    <div className="flex items-center gap-1 text-muted-foreground">
                                      <Building2 className="h-3 w-3 shrink-0" />
                                      <span>{(payment.property || matchedProperty)?.name}</span>
                                    </div>
                                    {hausgeldUnitHint && (
                                      <span className="text-[10px] bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border border-indigo-500/30 px-1 py-0.2 rounded font-medium">
                                        {hausgeldUnitHint}
                                      </span>
                                    )}
                                  </div>
                                ) : (() => {
                                  const bldgMatch = findBestMatchingProperty(
                                    `${payment.payerName || ""} ${payment.reference || ""}`,
                                    properties
                                  );
                                  const multiUnits = bldgMatch?.ambiguousBuildingProperties;
                                  if (multiUnits && multiUnits.length > 1) {
                                    return (
                                      <div className="flex flex-col gap-0.5 items-start">
                                        <span className="text-[11px] font-medium text-amber-700 dark:text-amber-300 flex items-center gap-1">
                                          <Building2 className="h-3 w-3 shrink-0" />
                                          Mehrere Einheiten ({multiUnits.length} im Haus)
                                        </span>
                                        <button
                                          type="button"
                                          onClick={() => setSplitDialogPayment(payment)}
                                          className="text-[11px] font-semibold text-purple-600 dark:text-purple-400 hover:underline flex items-center gap-1"
                                        >
                                          <Split className="h-3 w-3" />
                                          Auf alle {multiUnits.length} Wohnungen aufteilen
                                        </button>
                                      </div>
                                    );
                                  }
                                  return (
                                    <span className="text-muted-foreground text-xs italic">
                                      Nicht zugeordnet
                                    </span>
                                  );
                                })()}
                              </TableCell>

                              {/* 10. Aktion */}
                              <TableCell className="text-right">
                                <div className="flex items-center justify-end gap-1">
                                  {payment.isSplit ? (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="h-7 px-2 text-xs gap-1 border-purple-500/40 text-purple-700 dark:text-purple-300 hover:bg-purple-500/10"
                                      onClick={() => setSplitDialogPayment(payment)}
                                    >
                                      <Split className="h-3.5 w-3.5" />
                                      <span>Split bearbeiten</span>
                                    </Button>
                                  ) : (
                                    <>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-7 px-2 text-xs gap-1 border-dashed text-purple-600 dark:text-purple-400 hover:bg-purple-500/10 hover:border-purple-500/60"
                                        onClick={() => setSplitDialogPayment(payment)}
                                        title="In Teilbuchungen (z.B. 2 Monate Miete oder Miete + Kaution) aufteilen"
                                      >
                                        <Split className="h-3.5 w-3.5" />
                                        <span>Aufteilen</span>
                                      </Button>
                                      <EditPaymentDialog
                                        payment={payment}
                                        tenants={tenants}
                                        properties={properties}
                                        loans={loans}
                                        onUpdated={fetchPayments}
                                      />
                                    </>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                            {payment.isSplit && expandedSplitIds.has(payment.id) && (
                              <TableRow key={`${payment.id}-splits`} className="bg-purple-50/30 dark:bg-purple-950/20 border-b">
                                <TableCell colSpan={showPurpose ? 10 : 9} className="py-3 px-6">
                                  <div className="pl-4 border-l-2 border-purple-500/50 space-y-2">
                                    <div className="flex items-center justify-between">
                                      <span className="text-xs font-semibold text-purple-900 dark:text-purple-200 flex items-center gap-1.5">
                                        <Split className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" />
                                        Aufgeteilte Buchungen ({payment.splitPayments?.length || 0} Teilbuchungen) • Gesamt: {formatCurrency(payment.amount)}
                                      </span>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-6 text-[11px] text-purple-700 dark:text-purple-300 hover:underline p-0"
                                        onClick={() => setSplitDialogPayment(payment)}
                                      >
                                        Aufteilung anpassen →
                                      </Button>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                                      {payment.splitPayments?.map((sp, idx) => (
                                        <div key={sp.id || idx} className="p-2.5 rounded-lg bg-background/80 border text-xs space-y-1.5 shadow-xs">
                                          <div className="flex justify-between items-center">
                                            <span className="font-bold text-sm text-foreground">{formatCurrency(sp.amount)}</span>
                                            <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${CATEGORY_LABELS[sp.category]?.color || "bg-muted"}`}>
                                              {CATEGORY_LABELS[sp.category]?.label || sp.category}
                                            </span>
                                          </div>
                                          <div className="text-muted-foreground text-[11px] truncate">
                                            Mieter: <span className="text-foreground font-medium">{sp.tenant ? `${sp.tenant.firstName} ${sp.tenant.lastName}` : "–"}</span>
                                          </div>
                                          <div className="text-muted-foreground text-[11px] truncate">
                                            Wohnung: <span className="text-foreground">{sp.property?.name || sp.tenant?.property?.name || "–"}</span>
                                          </div>
                                          <div className="text-muted-foreground text-[11px] flex justify-between">
                                            <span>Abrechnungsmonat:</span>
                                            <span className="font-mono text-foreground font-medium">{sp.period || "–"}</span>
                                          </div>
                                          {sp.reference && (
                                            <div className="text-[10px] text-muted-foreground/80 truncate border-t pt-1 font-mono">
                                              {sp.reference}
                                            </div>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                </TableCell>
                              </TableRow>
                            )}
                            </Fragment>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Detaillierter Monatsverlauf je Mieter Dialog */}
      <TenantMonthlyHistoryDialog
        tenant={historyTenant}
        allPayments={allPayments}
        open={!!historyTenant}
        onOpenChange={(open) => !open && setHistoryTenant(null)}
      />

      {/* Split-Buchung Dialog */}
      {splitDialogPayment && (
        <SplitPaymentDialog
          payment={splitDialogPayment}
          tenants={tenants}
          properties={properties}
          open={!!splitDialogPayment}
          onOpenChange={(isOpen) => !isOpen && setSplitDialogPayment(null)}
          onUpdated={() => {
            fetchPayments();
            fetchTenants();
            fetchAccountBalance();
          }}
        />
      )}
    </div>
  );
}

export default function ZahlungenPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-muted-foreground animate-pulse">Lade Zahlungsströme...</div>}>
      <ZahlungenContent />
    </Suspense>
  );
}

