"use client";

import { useState, useMemo } from "react";
import {
  Calendar, Building2, CheckCircle2, AlertCircle, Clock, TrendingUp
} from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import { formatCurrency, formatDate } from "@/lib/utils";
import { getRentForPeriod } from "@/lib/rent-history";
import { RentAdjustmentDialog } from "@/components/RentAdjustmentDialog";
import { Payment, Tenant, STATUS_COLORS } from "./types";

export function TenantMonthlyHistoryDialog({
  tenant,
  allPayments,
  open,
  onOpenChange,
}: {
  tenant: Tenant | null;
  allPayments: Payment[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [selectedYear, setSelectedYear] = useState<string>("ALL");

  if (!tenant) return null;

  const sollPerMonth = (tenant.coldRent || 0) + (tenant.utilities || 0);

  // Alle Zahlungen dieses Mieters ermitteln
  const tenantPayments = allPayments.filter((p) => !p.isSplit && p.tenant?.id === tenant.id);

  // Abrechnungsmonat der Zahlung bestimmen (priorisiert p.period vor Buchungsdatum)
  const getPaymentPeriod = (p: Payment): string => {
    if (p.period && /^\d{4}-\d{2}$/.test(p.period)) {
      return p.period;
    }
    return p.bookingDate ? p.bookingDate.slice(0, 7) : "";
  };

  const moveInMonth = tenant.moveInDate ? tenant.moveInDate.slice(0, 7) : null;
  const moveOutMonth = tenant.moveOutDate ? tenant.moveOutDate.slice(0, 7) : null;

  // Eigentums- / Nutzen- & Lastenübergang der Wohnung:
  // Vor Besitzübergang (possessionAt) bzw. Notarvertrag (purchasedAt) standen uns die Mieten nicht zu.
  const propPossession = tenant.property?.possessionAt || tenant.property?.purchasedAt;
  const possessionMonth = propPossession ? propPossession.slice(0, 7) : null;

  // Der maßgebliche Beginn unserer Mietverwaltung ist das spätere Datum aus Einzug und Eigentums-/Nutzenübergang:
  let effectiveStartMonth: string | null = null;
  if (moveInMonth && possessionMonth) {
    effectiveStartMonth = moveInMonth > possessionMonth ? moveInMonth : possessionMonth;
  } else {
    effectiveStartMonth = moveInMonth || possessionMonth || null;
  }

  // Alle relevanten Monate ermitteln (aus Zahlungs-Perioden und aktuellem Monat)
  const monthKeysSet = new Set<string>();
  tenantPayments.forEach((p) => {
    const pMonth = getPaymentPeriod(p);
    if (pMonth) {
      // Weder vor Einzug noch vor Eigentums-/Nutzenübergang standen uns Mieten zu
      if (!effectiveStartMonth || pMonth >= effectiveStartMonth) {
        if (!moveOutMonth || pMonth <= moveOutMonth) {
          monthKeysSet.add(pMonth);
        }
      }
    }
  });

  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  if (!effectiveStartMonth || currentMonth >= effectiveStartMonth) {
    if (!moveOutMonth || currentMonth <= moveOutMonth) {
      monthKeysSet.add(currentMonth);
    }
  }

  // Falls effectiveStartMonth vorhanden, alle Monate zwischen effectiveStartMonth und aktuellem Monat lückenlos auffüllen
  if (effectiveStartMonth) {
    const endMonth = moveOutMonth && moveOutMonth < currentMonth ? moveOutMonth : currentMonth;
    if (effectiveStartMonth <= endMonth) {
      const [startYear, startM] = effectiveStartMonth.split("-").map(Number);
      const [endYear, endM] = endMonth.split("-").map(Number);

      let y = startYear;
      let m = startM;
      while (y < endYear || (y === endYear && m <= endM)) {
        const ym = `${y}-${String(m).padStart(2, "0")}`;
        monthKeysSet.add(ym);
        m++;
        if (m > 12) {
          m = 1;
          y++;
        }
      }
    }
  }

  const sortedMonths = Array.from(monthKeysSet).sort().reverse();

  // Verfügbare Jahre ermitteln
  const availableYears = Array.from(
    new Set(sortedMonths.map((m) => m.slice(0, 4)))
  ).sort().reverse();

  // Monatsdaten berechnen – Zuordnung nach getPaymentPeriod(p)
  const monthlyData = sortedMonths.map((m) => {
    const monthPayments = tenantPayments.filter((p) => getPaymentPeriod(p) === m);
    const rentPayments = monthPayments.filter((p) => p.category === "RENT");
    const utilityPayments = monthPayments.filter((p) => p.category === "UTILITY_IN");
    const otherPayments = monthPayments.filter((p) => p.category === "OTHER");

    const rentPaid = rentPayments.reduce((s, p) => s + p.amount, 0);
    const utilityPaid = utilityPayments.reduce((s, p) => s + p.amount, 0);
    const otherPaid = otherPayments.reduce((s, p) => s + p.amount, 0);
    const totalPaid = rentPaid + utilityPaid + otherPaid;

    // Historisch korrekte Soll-Miete für diesen Monat ermitteln
    const resolved = getRentForPeriod(tenant, m, tenant.property?.rentAdjustments);
    const soll = resolved.warmRent;

    const diff = rentPaid - soll;

    let status: "PAID" | "OVERPAID" | "PARTIAL" | "OVERDUE" | "PENDING";
    if (rentPaid === soll && rentPaid > 0) {
      status = "PAID";
    } else if (rentPaid > soll) {
      status = "OVERPAID";
    } else if (rentPaid > 0) {
      status = "PARTIAL";
    } else {
      const [yStr, mStr] = m.split("-");
      const dueDate = new Date(parseInt(yStr, 10), parseInt(mStr, 10) - 1, 4, 23, 59, 59);
      status = now > dueDate ? "OVERDUE" : "PENDING";
    }

    return {
      month: m,
      soll,
      rentPaid,
      utilityPaid,
      otherPaid,
      totalPaid,
      diff,
      status,
      rentPayments,
      utilityPayments,
      otherPayments,
      monthPayments,
      isAdjusted: resolved.isAdjusted,
      adjustmentNote: resolved.adjustmentNote,
    };
  });

  const filteredData =
    selectedYear === "ALL"
      ? monthlyData
      : monthlyData.filter((d) => d.month.startsWith(selectedYear));

  const totalRent = tenantPayments
    .filter((p) => p.category === "RENT")
    .reduce((s, p) => s + p.amount, 0);
  const totalUtility = tenantPayments
    .filter((p) => p.category === "UTILITY_IN")
    .reduce((s, p) => s + p.amount, 0);
  const totalAll = totalRent + totalUtility;
  const utilityCount = tenantPayments.filter((p) => p.category === "UTILITY_IN").length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl w-[95vw] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <DialogTitle className="text-xl flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              Monatliche Zahlungsaufstellung: {tenant.firstName} {tenant.lastName}
            </DialogTitle>
            <RentAdjustmentDialog
              selectedPropertyId={tenant.property?.id}
              trigger={
                <Button size="sm" variant="outline" className="gap-1.5 h-8 text-xs border-primary/40 hover:bg-primary/10">
                  <TrendingUp className="h-3.5 w-3.5 text-primary" />
                  Mietanpassung erfassen
                </Button>
              }
            />
          </div>
          <DialogDescription className="mt-1">
            {tenant.property?.name || "Wohnung"} ({tenant.property?.address}) • Aktuelle Soll-Warmmiete:{" "}
            <span className="font-semibold text-foreground">{formatCurrency(sollPerMonth)}</span>{" "}
            (Kaltmiete: {formatCurrency(tenant.coldRent || 0)} + NK-VZ: {formatCurrency(tenant.utilities || 0)})
            {possessionMonth && moveInMonth && moveInMonth < possessionMonth && (
              <span className="block mt-1 text-xs text-amber-700 dark:text-amber-400 font-medium">
                ℹ️ Hinweis: Mieter eingezogen am {formatDate(tenant.moveInDate || "")}. Nutzen- &amp; Lastenwechsel: {formatDate(tenant.property?.possessionAt || tenant.property?.purchasedAt || "")}. Die Aufstellung beginnt ab Eigentums-/Nutzenübergang ({possessionMonth.split("-").reverse().join(".")}), da frühere Mieten an den Voreigentümer gingen.
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* KPI Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card className="bg-muted/40 shadow-none border">
              <CardContent className="p-3">
                <span className="text-xs text-muted-foreground block">Reine Miete gezahlt</span>
                <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                  {formatCurrency(totalRent)}
                </p>
                <p className="text-[10px] text-muted-foreground">Monatliche Mietzahlungen</p>
              </CardContent>
            </Card>

            <Card className="bg-cyan-500/10 border-cyan-500/30 shadow-none">
              <CardContent className="p-3">
                <span className="text-xs text-cyan-800 dark:text-cyan-300 font-medium block">
                  NK-Nachzahlungen
                </span>
                <p className="text-lg font-bold text-cyan-700 dark:text-cyan-300">
                  {formatCurrency(totalUtility)}
                </p>
                <p className="text-[10px] text-cyan-600 dark:text-cyan-400">
                  {utilityCount} Nachzahlung{utilityCount === 1 ? "" : "en"} (separat von Miete)
                </p>
              </CardContent>
            </Card>

            <Card className="bg-muted/40 shadow-none border">
              <CardContent className="p-3">
                <span className="text-xs text-muted-foreground block">Gesamt vom Mieter</span>
                <p className="text-lg font-bold text-foreground">
                  {formatCurrency(totalAll)}
                </p>
                <p className="text-[10px] text-muted-foreground">Miete + Abrechnungen</p>
              </CardContent>
            </Card>

            <Card className="bg-muted/40 shadow-none border">
              <CardContent className="p-3">
                <span className="text-xs text-muted-foreground block">Mietstatus</span>
                <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                  {monthlyData.filter((d) => d.status === "PAID").length} / {monthlyData.length} bezahlt
                </p>
                <p className="text-[10px] text-muted-foreground">Alle erfassten Monate</p>
              </CardContent>
            </Card>
          </div>

          {/* Hinweis zur sauberen Trennung */}
          <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl text-xs space-y-1">
            <p className="font-semibold text-blue-900 dark:text-blue-300 flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              Saubere Trennung: Nebenkostenabrechnung wird nicht der Miete zugerechnet
            </p>
            <p className="text-muted-foreground">
              Überweisungen mit Verwendungszweck „Nebenkostenabrechnung“ oder „Nachzahlung“ werden separat als{" "}
              <strong className="text-foreground">NK-Nachzahlung</strong> geführt. Dadurch wird die monatliche Soll-Miete nicht künstlich überzahlt und bleibt übersichtlich.
            </p>
          </div>

          {/* Jahres-Filter */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-muted-foreground font-medium mr-1">Jahr:</span>
              <Button
                variant={selectedYear === "ALL" ? "default" : "outline"}
                size="sm"
                className="h-7 text-xs px-2.5"
                onClick={() => setSelectedYear("ALL")}
              >
                Alle Jahre ({monthlyData.length})
              </Button>
              {availableYears.map((yr) => (
                <Button
                  key={yr}
                  variant={selectedYear === yr ? "default" : "outline"}
                  size="sm"
                  className="h-7 text-xs px-2.5"
                  onClick={() => setSelectedYear(yr)}
                >
                  {yr}
                </Button>
              ))}
            </div>
            <span className="text-xs text-muted-foreground">
              {filteredData.length} Monate angezeigt
            </span>
          </div>

          {/* Monatliche Tabelle */}
          <div className="rounded-lg border overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/40">
                <TableRow>
                  <TableHead className="font-semibold text-xs whitespace-nowrap">Monat</TableHead>
                  <TableHead className="text-right font-semibold text-xs whitespace-nowrap">Soll-Warmmiete</TableHead>
                  <TableHead className="text-right font-semibold text-xs whitespace-nowrap">Gezahlte Miete</TableHead>
                  <TableHead className="text-right font-semibold text-xs whitespace-nowrap">NK-Nachzahlung</TableHead>
                  <TableHead className="text-right font-semibold text-xs whitespace-nowrap">Gesamt gezahlt</TableHead>
                  <TableHead className="text-right font-semibold text-xs whitespace-nowrap">Saldo Miete</TableHead>
                  <TableHead className="font-semibold text-xs whitespace-nowrap">Status</TableHead>
                  <TableHead className="font-semibold text-xs min-w-[200px]">Buchungsdetails (Bank)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredData.map((d) => {
                  const [y, mNum] = d.month.split("-");
                  const monthDate = new Date(parseInt(y, 10), parseInt(mNum, 10) - 1, 1);
                  const monthLabel = monthDate.toLocaleDateString("de-DE", {
                    month: "long",
                    year: "numeric",
                  });

                  return (
                    <TableRow key={d.month} className="hover:bg-muted/40 transition-colors">
                      <TableCell className="text-xs font-semibold whitespace-nowrap">
                        {monthLabel}
                      </TableCell>

                      <TableCell className="text-right text-xs">
                        <div className="font-semibold">{formatCurrency(d.soll)}</div>
                        {d.isAdjusted && (
                          <div className="text-[10px] text-blue-600 dark:text-blue-400 font-normal" title={d.adjustmentNote || ""}>
                            Historischer Soll
                          </div>
                        )}
                      </TableCell>

                      <TableCell className="text-right text-xs font-semibold">
                        <span className={d.rentPaid > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"}>
                          {formatCurrency(d.rentPaid)}
                        </span>
                      </TableCell>

                      <TableCell className="text-right text-xs">
                        {d.utilityPaid > 0 ? (
                          <Badge variant="outline" className="bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 border-cyan-500/30 text-[11px] font-semibold">
                            +{formatCurrency(d.utilityPaid)}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">–</span>
                        )}
                      </TableCell>

                      <TableCell className="text-right text-xs font-bold text-foreground">
                        {formatCurrency(d.totalPaid)}
                      </TableCell>

                      <TableCell className="text-right text-xs font-bold">
                        {d.diff === 0 ? (
                          <span className="text-emerald-600 dark:text-emerald-400">±0,00 €</span>
                        ) : d.diff > 0 ? (
                          <span className="text-amber-600 dark:text-amber-400">+{formatCurrency(d.diff)}</span>
                        ) : (
                          <span className="text-red-600 dark:text-red-400">{formatCurrency(d.diff)}</span>
                        )}
                      </TableCell>

                      <TableCell>
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                            STATUS_COLORS[d.status] || ""
                          }`}
                        >
                          {d.status === "PAID"
                            ? "● Vollständig"
                            : d.status === "OVERPAID"
                            ? "● Überzahlung"
                            : d.status === "PARTIAL"
                            ? "● Teilzahlung"
                            : d.status === "OVERDUE"
                            ? "● Rückstand"
                            : "● Offen"}
                        </span>
                      </TableCell>

                      <TableCell className="text-xs text-muted-foreground font-mono max-w-[280px]">
                        <div className="space-y-1">
                          {d.monthPayments.map((p) => (
                            <div key={p.id} className="truncate" title={`${formatDate(p.bookingDate)}: ${p.amount} € - ${p.reference || ''}`}>
                              <span className="font-semibold text-foreground">{formatDate(p.bookingDate)}:</span>{" "}
                              <span className={p.category === "UTILITY_IN" ? "text-cyan-600 dark:text-cyan-400 font-semibold" : "text-foreground"}>
                                {formatCurrency(p.amount)}
                              </span>{" "}
                              {p.category === "UTILITY_IN" && (
                                <span className="text-[10px] bg-cyan-100 dark:bg-cyan-900/40 text-cyan-800 dark:text-cyan-300 px-1 rounded mr-1">
                                  NK
                                </span>
                              )}
                              <span>({p.reference || "Kein Verwendungszweck"})</span>
                            </div>
                          ))}
                          {d.monthPayments.length === 0 && (
                            <span className="italic text-muted-foreground">Keine Buchung erfasst</span>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          <div className="flex justify-end pt-2">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Schließen
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Hauptkomponente ─────────────────────────────────────────────────────────