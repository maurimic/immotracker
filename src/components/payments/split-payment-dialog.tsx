"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Scissors, AlertCircle, Plus, Trash2, Split, Building2, User, CheckCircle2, Scale, Calendar
} from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { formatCurrency, formatDate, currentPeriod } from "@/lib/utils";
import {
  findBestMatchingProperty,
  extractAddressKeywords,
  type PropertyMatchInfo,
} from "@/lib/property-matching";
import { Payment, Tenant, SplitItemState, CATEGORY_LABELS } from "./types";

export function SplitPaymentDialog({
  payment,
  tenants,
  properties,
  open,
  onOpenChange,
  onUpdated,
}: {
  payment: Payment;
  tenants: Tenant[];
  properties: PropertyMatchInfo[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated: () => void;
}) {
  const [splits, setSplits] = useState<SplitItemState[]>([]);
  const [saving, setSaving] = useState(false);
  const [unsplitLoading, setUnsplitLoading] = useState(false);

  // Ermittelt alle Wohnungen desselben Mehrfamilienhauses (z.B. Siemensstraße 28 EG + 2.OG)
  const buildingProps = useMemo(() => {
    const combinedText = `${payment.payerName || ""} ${payment.reference || ""}`;
    const match = findBestMatchingProperty(combinedText, properties);
    if (match?.ambiguousBuildingProperties && match.ambiguousBuildingProperties.length > 1) {
      return match.ambiguousBuildingProperties;
    }
    const baseProp = match?.property || (payment.propertyId ? properties.find((p) => p.id === payment.propertyId) : null);
    if (baseProp) {
      const kBase = extractAddressKeywords(baseProp);
      const sameHouse = properties.filter((p) => {
        const kOther = extractAddressKeywords(p);
        return kBase.some((w) => kOther.includes(w));
      });
      if (sameHouse.length > 1) return sameHouse;
    }
    return [];
  }, [payment, properties]);

  const buildBuildingSplits = (mode: "SQM" | "EQUAL", targetProps: PropertyMatchInfo[]): SplitItemState[] => {
    const basePeriod =
      payment.period && /^\d{4}-\d{2}$/.test(payment.period)
        ? payment.period
        : payment.bookingDate
        ? payment.bookingDate.slice(0, 7)
        : currentPeriod();

    const totalCents = Math.round(payment.amount * 100);
    const hasSqm = targetProps.every((p) => (p.sqm || 0) > 0);
    const weights = targetProps.map((p) => (mode === "SQM" && hasSqm ? (p.sqm || 1) : 1));
    const totalWeight = weights.reduce((a, b) => a + b, 0) || 1;

    let allocatedCents = 0;
    const rawCents = weights.map((w, idx) => {
      if (idx === weights.length - 1) {
        return totalCents - allocatedCents;
      }
      const share = Math.round((totalCents * w) / totalWeight);
      allocatedCents += share;
      return share;
    });

    return targetProps.map((prop, idx) => {
      const unitHint = prop.unitNumber || prop.floor || prop.name;
      return {
        id: `bldg-split-${idx + 1}`,
        amount: (rawCents[idx] / 100).toFixed(2),
        category: payment.category || "HAUSGELD",
        tenantId: "NONE",
        propertyId: prop.id,
        period: basePeriod,
        reference: payment.reference
          ? `${payment.reference} (${unitHint})`
          : `${payment.payerName} (${unitHint})`,
      };
    });
  };

  // Initialisieren beim Öffnen
  useEffect(() => {
    if (!open) return;

    if (payment.isSplit && payment.splitPayments && payment.splitPayments.length > 0) {
      // Bestehende Splits laden
      setSplits(
        payment.splitPayments.map((sp) => ({
          id: sp.id || Math.random().toString(36).substring(2, 9),
          amount: String(sp.amount),
          category: sp.category || "RENT",
          tenantId: sp.tenant?.id || "NONE",
          propertyId: sp.propertyId || sp.property?.id || sp.tenant?.property?.id || "NONE",
          period: sp.period || (sp.bookingDate ? sp.bookingDate.slice(0, 7) : ""),
          reference: sp.reference || "",
        }))
      );
    } else if (buildingProps.length > 1 && payment.category !== "RENT") {
      // Sammelbuchung für mehrere Wohnungen im selben Haus -> direkt nach m² vorschlagen
      setSplits(buildBuildingSplits("SQM", buildingProps));
    } else {
      // Neue Aufteilung vorschlagen (Standard: 50 / 50 auf 2 Monate)
      const basePeriod =
        payment.period && /^\d{4}-\d{2}$/.test(payment.period)
          ? payment.period
          : payment.bookingDate
          ? payment.bookingDate.slice(0, 7)
          : currentPeriod();

      const [y, m] = basePeriod.split("-").map(Number);
      const nextDate = new Date(y, m, 1);
      const nextPeriod = `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, "0")}`;

      const half = Math.round((payment.amount / 2) * 100) / 100;
      const rest = Math.round((payment.amount - half) * 100) / 100;

      const initialTenantId = payment.tenant?.id || "NONE";
      const initialPropId =
        payment.propertyId || payment.property?.id || payment.tenant?.property?.id || "NONE";

      setSplits([
        {
          id: "split-1",
          amount: half.toFixed(2),
          category: payment.category || "RENT",
          tenantId: initialTenantId,
          propertyId: initialPropId,
          period: basePeriod,
          reference: payment.reference ? `Teil 1: ${payment.reference}` : "Miete Monat 1",
        },
        {
          id: "split-2",
          amount: rest.toFixed(2),
          category: payment.category || "RENT",
          tenantId: initialTenantId,
          propertyId: initialPropId,
          period: nextPeriod,
          reference: payment.reference ? `Teil 2: ${payment.reference}` : "Miete Folgemonat",
        },
      ]);
    }
  }, [open, payment]);

  // Berechnungen & Validierung
  const sumSplits = useMemo(() => {
    return splits.reduce((acc, s) => {
      const val = parseFloat(s.amount.replace(",", ".")) || 0;
      return acc + val;
    }, 0);
  }, [splits]);

  const diff = Math.round((payment.amount - sumSplits) * 100) / 100;
  const isBalanced = Math.abs(diff) < 0.01;
  const hasZeroOrInvalid = splits.some((s) => {
    const val = parseFloat(s.amount.replace(",", "."));
    return isNaN(val) || Math.abs(val) < 0.001;
  });
  const canSave = isBalanced && !hasZeroOrInvalid && splits.length >= 2;

  // Handler: Zeile hinzufügen
  const handleAddSplit = () => {
    const defaultPeriod =
      payment.period && /^\d{4}-\d{2}$/.test(payment.period)
        ? payment.period
        : payment.bookingDate
        ? payment.bookingDate.slice(0, 7)
        : currentPeriod();

    const lastSplit = splits[splits.length - 1];
    let nextP = defaultPeriod;
    if (lastSplit && lastSplit.period && /^\d{4}-\d{2}$/.test(lastSplit.period)) {
      const [y, m] = lastSplit.period.split("-").map(Number);
      const nd = new Date(y, m, 1);
      nextP = `${nd.getFullYear()}-${String(nd.getMonth() + 1).padStart(2, "0")}`;
    }

    setSplits((prev) => [
      ...prev,
      {
        id: Math.random().toString(36).substring(2, 9),
        amount: diff !== 0 ? diff.toFixed(2) : "0.00",
        category: lastSplit?.category || "RENT",
        tenantId: lastSplit?.tenantId || payment.tenant?.id || "NONE",
        propertyId: lastSplit?.propertyId || payment.propertyId || "NONE",
        period: nextP,
        reference: `Teil ${prev.length + 1}`,
      },
    ]);
  };

  // Handler: Zeile löschen
  const handleRemoveSplit = (idx: number) => {
    if (splits.length <= 2) {
      toast({
        title: "Mindestens 2 Teilbuchungen nötig",
        description: "Eine Aufteilung erfordert mindestens zwei Teilbeträge.",
        variant: "destructive",
      });
      return;
    }
    setSplits((prev) => prev.filter((_, i) => i !== idx));
  };

  // Handler: Feld ändern
  const handleUpdateSplit = (idx: number, field: keyof SplitItemState, val: string) => {
    setSplits((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: val };

      // Wenn Mieter geändert wird, Wohnung automatisch ableiten
      if (field === "tenantId" && val !== "NONE") {
        const t = tenants.find((item) => item.id === val);
        if (t?.property?.id) {
          next[idx].propertyId = t.property.id;
        }
      }

      return next;
    });
  };

  // Restbetrag in eine bestimmte Zeile füllen
  const handleFillRemainder = (idx: number) => {
    const currentVal = parseFloat(splits[idx].amount.replace(",", ".")) || 0;
    const newAmount = Math.round((currentVal + diff) * 100) / 100;
    handleUpdateSplit(idx, "amount", newAmount.toFixed(2));
  };

  // Preset: 2 Monate Miete (50 / 50)
  const applyPresetTwoMonths = () => {
    const basePeriod =
      payment.period && /^\d{4}-\d{2}$/.test(payment.period)
        ? payment.period
        : payment.bookingDate
        ? payment.bookingDate.slice(0, 7)
        : currentPeriod();

    const [y, m] = basePeriod.split("-").map(Number);
    const nextDate = new Date(y, m, 1);
    const nextPeriod = `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, "0")}`;

    const half = Math.round((payment.amount / 2) * 100) / 100;
    const rest = Math.round((payment.amount - half) * 100) / 100;

    const tId = splits[0]?.tenantId || payment.tenant?.id || "NONE";
    const pId = splits[0]?.propertyId || payment.propertyId || "NONE";

    setSplits([
      {
        id: "split-1",
        amount: half.toFixed(2),
        category: "RENT",
        tenantId: tId,
        propertyId: pId,
        period: basePeriod,
        reference: `Miete ${basePeriod}`,
      },
      {
        id: "split-2",
        amount: rest.toFixed(2),
        category: "RENT",
        tenantId: tId,
        propertyId: pId,
        period: nextPeriod,
        reference: `Miete ${nextPeriod}`,
      },
    ]);
  };

  // Preset: Miete + Kaution
  const applyPresetRentAndDeposit = () => {
    const tId = splits[0]?.tenantId || payment.tenant?.id;
    const matchedTenant = tenants.find((t) => t.id === tId);

    const basePeriod =
      payment.period && /^\d{4}-\d{2}$/.test(payment.period)
        ? payment.period
        : payment.bookingDate
        ? payment.bookingDate.slice(0, 7)
        : currentPeriod();

    const warmRent = matchedTenant ? (matchedTenant.coldRent || 0) + (matchedTenant.utilities || 0) : null;

    if (warmRent && warmRent > 0 && warmRent < Math.abs(payment.amount)) {
      const depositAmount = Math.round((payment.amount - warmRent) * 100) / 100;
      setSplits([
        {
          id: "split-1",
          amount: warmRent.toFixed(2),
          category: "RENT",
          tenantId: matchedTenant.id,
          propertyId: matchedTenant.property?.id || "NONE",
          period: basePeriod,
          reference: `Miete ${basePeriod}`,
        },
        {
          id: "split-2",
          amount: depositAmount.toFixed(2),
          category: "DEPOSIT",
          tenantId: matchedTenant.id,
          propertyId: matchedTenant.property?.id || "NONE",
          period: basePeriod,
          reference: "Mietkaution",
        },
      ]);
    } else {
      const half = Math.round((payment.amount / 2) * 100) / 100;
      const rest = Math.round((payment.amount - half) * 100) / 100;
      setSplits([
        {
          id: "split-1",
          amount: half.toFixed(2),
          category: "RENT",
          tenantId: tId || "NONE",
          propertyId: splits[0]?.propertyId || "NONE",
          period: basePeriod,
          reference: `Miete ${basePeriod}`,
        },
        {
          id: "split-2",
          amount: rest.toFixed(2),
          category: "DEPOSIT",
          tenantId: tId || "NONE",
          propertyId: splits[0]?.propertyId || "NONE",
          period: basePeriod,
          reference: "Mietkaution",
        },
      ]);
    }
  };

  // Speichern
  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      const payload = {
        splits: splits.map((s) => {
          let cleanPeriod = s.period?.trim() || "";
          const deMatch = cleanPeriod.match(/^(\d{1,2})[./-](\d{4})$/);
          if (deMatch) {
            cleanPeriod = `${deMatch[2]}-${String(parseInt(deMatch[1], 10)).padStart(2, "0")}`;
          }
          return {
            amount: parseFloat(s.amount.replace(",", ".")),
            category: s.category,
            tenantId: s.tenantId === "NONE" ? null : s.tenantId,
            propertyId: s.propertyId === "NONE" ? null : s.propertyId,
            period: cleanPeriod || null,
            reference: s.reference?.trim() || null,
          };
        }),
      };

      const res = await fetch(`/api/payments/${payment.id}/split`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Fehler beim Aufteilen der Buchung");

      toast({
        title: "Buchung aufgeteilt",
        description: `${splits.length} Teilbuchungen wurden erfolgreich angelegt und zugeordnet.`,
      });
      onUpdated();
      onOpenChange(false);
    } catch (err: any) {
      toast({
        title: "Fehler beim Aufteilen",
        description: err.message || "Buchung konnte nicht aufgeteilt werden.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  // Aufhebung (Unsplit)
  const handleUnsplit = async () => {
    if (!confirm("Möchtest du diese Split-Buchung wirklich aufheben? Die Teilbuchungen werden gelöscht und die Originalbuchung wiederhergestellt.")) {
      return;
    }
    setUnsplitLoading(true);
    try {
      const res = await fetch(`/api/payments/${payment.id}/split`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Fehler beim Aufheben");

      toast({
        title: "Aufteilung aufgehoben",
        description: "Die Originalbuchung wurde wiederhergestellt.",
      });
      onUpdated();
      onOpenChange(false);
    } catch (err: any) {
      toast({
        title: "Fehler",
        description: err.message || "Aufteilung konnte nicht aufgehoben werden.",
        variant: "destructive",
      });
    } finally {
      setUnsplitLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400">
              <Split className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold">
                {payment.isSplit ? "Split-Buchung bearbeiten" : "Bankbuchung aufteilen (Split-Buchung)"}
              </DialogTitle>
              <DialogDescription className="text-xs">
                Teile eine Überweisung auf mehrere Abrechnungsmonate, Mieter oder Kategorien auf (z. B. Miete für 2 Monate oder Miete + Kaution).
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2 text-xs">
          {/* Originalbuchung Übersicht */}
          <div className="bg-muted/40 p-3 rounded-xl border space-y-1.5 text-xs">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground font-medium">Original Bankbuchung:</span>
              <div className="font-bold text-sm">
                <span className="text-muted-foreground mr-2 font-normal font-mono">{formatDate(payment.bookingDate)}</span>
                <span className={payment.amount >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}>
                  {payment.amount >= 0 ? "+" : ""}{formatCurrency(payment.amount)}
                </span>
              </div>
            </div>
            <div className="flex justify-between items-start text-xs">
              <span className="text-muted-foreground">Auftraggeber / Payer:</span>
              <span className="font-semibold text-right max-w-[180px] sm:max-w-[320px] truncate">{payment.payerName || "–"}</span>
            </div>
            {payment.reference && (
              <div className="pt-1 border-t text-[11px] text-muted-foreground">
                <span className="font-medium text-foreground">Verwendungszweck: </span>
                <span className="font-mono text-foreground/80">{payment.reference}</span>
              </div>
            )}
          </div>

          {/* Preset Buttons */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <span className="text-xs font-semibold text-muted-foreground">Vorlagen:</span>
            {buildingProps.length > 1 && (
              <>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs gap-1.5 border-indigo-500/40 bg-indigo-500/5 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-500/15"
                  onClick={() => setSplits(buildBuildingSplits("SQM", buildingProps))}
                >
                  <Building2 className="h-3 w-3" />
                  <span>Alle {buildingProps.length} Einheiten im Haus (nach m²)</span>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs gap-1.5 border-dashed border-indigo-500/40 text-indigo-700 dark:text-indigo-300"
                  onClick={() => setSplits(buildBuildingSplits("EQUAL", buildingProps))}
                >
                  <Scale className="h-3 w-3" />
                  <span>Alle {buildingProps.length} Einheiten (gleichmäßig)</span>
                </Button>
              </>
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 text-xs gap-1.5 border-dashed"
              onClick={applyPresetTwoMonths}
            >
              <Calendar className="h-3 w-3 text-primary" />
              <span>2 Monate Miete (50% / 50%)</span>
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 text-xs gap-1.5 border-dashed"
              onClick={applyPresetRentAndDeposit}
            >
              <Building2 className="h-3 w-3 text-emerald-500" />
              <span>Miete + Kaution</span>
            </Button>
          </div>

          {/* Summe & Differenz Kontroll-Leiste */}
          <div
            className={`p-3 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-2 transition-colors ${
              isBalanced
                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-900 dark:text-emerald-200"
                : "bg-amber-500/10 border-amber-500/40 text-amber-900 dark:text-amber-200"
            }`}
          >
            <div className="flex items-center gap-2">
              {isBalanced ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              ) : (
                <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
              )}
              <span className="font-semibold text-xs">
                {isBalanced
                  ? "Aufteilung ausgeglichen: Alle Teilbeträge stimmen mit der Bankbuchung überein."
                  : `Differenz: ${diff > 0 ? "+" : ""}${formatCurrency(diff)} noch nicht zugewiesen.`}
              </span>
            </div>
            <div className="flex items-center gap-3 text-xs font-mono self-end sm:self-auto">
              <div>
                <span className="text-muted-foreground">Original: </span>
                <span className="font-bold">{formatCurrency(payment.amount)}</span>
              </div>
              <span>=</span>
              <div>
                <span className="text-muted-foreground">Teilsumme: </span>
                <span className="font-bold">{formatCurrency(sumSplits)}</span>
              </div>
            </div>
          </div>

          {/* Teilbuchungen Liste */}
          <div className="space-y-3">
            {splits.map((split, idx) => {
              return (
                <div
                  key={split.id || idx}
                  className="p-3 rounded-xl border bg-card space-y-3 shadow-xs hover:border-border/80 transition-all"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[11px] font-semibold bg-muted/40">
                        Teil #{idx + 1}
                      </Badge>
                      <span className="text-xs font-medium text-foreground">
                        {split.category === "RENT"
                          ? "Mietzahlung"
                          : split.category === "DEPOSIT"
                          ? "Kaution"
                          : CATEGORY_LABELS[split.category]?.label || split.category}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {Math.abs(diff) >= 0.01 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-6 text-[10px] px-1.5 text-primary hover:bg-primary/10"
                          onClick={() => handleFillRemainder(idx)}
                          title="Restdifferenz in diese Teilbuchung einrechnen"
                        >
                          Rest einfügen
                        </Button>
                      )}
                      {splits.length > 2 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                          onClick={() => handleRemoveSplit(idx)}
                          title="Diesen Teil löschen"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Eingabefelder für diesen Split */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                    {/* Betrag */}
                    <div className="space-y-1">
                      <Label className="text-[11px] font-medium">Betrag (€)</Label>
                      <Input
                        type="text"
                        value={split.amount}
                        onChange={(e) => handleUpdateSplit(idx, "amount", e.target.value)}
                        placeholder="0.00"
                        className="h-8 text-xs font-mono"
                      />
                    </div>

                    {/* Kategorie */}
                    <div className="space-y-1">
                      <Label className="text-[11px] font-medium">Kategorie</Label>
                      <Select
                        value={split.category}
                        onValueChange={(val) => handleUpdateSplit(idx, "category", val)}
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="RENT">Miete (Laufend)</SelectItem>
                          <SelectItem value="DEPOSIT">Kaution</SelectItem>
                          <SelectItem value="UTILITY_IN">Nebenkosten-Abrechnung</SelectItem>
                          <SelectItem value="LOAN">Darlehen / Annuität</SelectItem>
                          <SelectItem value="HAUSGELD">Hausgeld</SelectItem>
                          <SelectItem value="REPAIR">Baumaterial & Reparatur</SelectItem>
                          <SelectItem value="OTHER">Sonstiges / Privat</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Abrechnungsmonat (Periode) */}
                    <div className="space-y-1">
                      <Label className="text-[11px] font-medium">Abrechnungsmonat</Label>
                      <Input
                        type="text"
                        value={split.period}
                        onChange={(e) => handleUpdateSplit(idx, "period", e.target.value)}
                        placeholder="YYYY-MM (z.B. 2026-05)"
                        className="h-8 text-xs font-mono"
                      />
                    </div>

                    {/* Mieter */}
                    <div className="space-y-1">
                      <Label className="text-[11px] font-medium">Mieter zuordnen</Label>
                      <Select
                        value={split.tenantId}
                        onValueChange={(val) => handleUpdateSplit(idx, "tenantId", val)}
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue placeholder="Mieter auswählen..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="NONE">-- Kein Mieter --</SelectItem>
                          {tenants.map((t) => (
                            <SelectItem key={t.id} value={t.id}>
                              {t.firstName} {t.lastName} {t.isCurrent === false ? "(Vormieter)" : ""}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Wohnung */}
                    <div className="space-y-1">
                      <Label className="text-[11px] font-medium">Wohnung</Label>
                      <Select
                        value={split.propertyId}
                        onValueChange={(val) => handleUpdateSplit(idx, "propertyId", val)}
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue placeholder="Wohnung auswählen..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="NONE">-- Keine Wohnung --</SelectItem>
                          {properties.map((p) => (
                            <SelectItem key={p.id} value={p.id}>
                              {p.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Verwendungszweck / Notiz */}
                    <div className="space-y-1">
                      <Label className="text-[11px] font-medium">Notiz / Zweck</Label>
                      <Input
                        type="text"
                        value={split.reference}
                        onChange={(e) => handleUpdateSplit(idx, "reference", e.target.value)}
                        placeholder="z.B. Miete Mai 2026"
                        className="h-8 text-xs"
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Weiteren Teil hinzufügen Button */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleAddSplit}
            className="w-full h-8 text-xs gap-1.5 border-dashed"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Weiteren Teilbetrag hinzufügen</span>
          </Button>

          {/* Footer Aktionen */}
          <div className="flex flex-col-reverse sm:flex-row items-center justify-between gap-2 pt-2 border-t">
            <div>
              {payment.isSplit && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={unsplitLoading || saving}
                  onClick={handleUnsplit}
                  className="h-8 text-xs text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="h-3.5 w-3.5 mr-1" />
                  <span>Aufteilung aufheben</span>
                </Button>
              )}
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onOpenChange(false)}
                className="h-8 text-xs"
              >
                Abbrechen
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={!canSave || saving}
                onClick={handleSave}
                className="h-8 text-xs gap-1.5 bg-purple-600 hover:bg-purple-700 text-white"
              >
                <Split className="h-3.5 w-3.5" />
                <span>{saving ? "Speichere..." : "Aufteilung speichern"}</span>
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Detaillierter Monatsverlauf je Mieter Modal ────────────────────────────