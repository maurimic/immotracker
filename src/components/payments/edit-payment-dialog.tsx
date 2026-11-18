"use client";

import { useState, useEffect } from "react";
import {
  AlertCircle, FileText, Calendar, Euro, User, Building2, Landmark, RefreshCw, Check
} from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogTrigger
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Payment, Tenant } from "./types";

export function EditPaymentDialog({
  payment,
  tenants,
  properties,
  loans,
  onUpdated,
}: {
  payment: Payment;
  tenants: Tenant[];
  properties: Array<{
    id: string;
    name: string;
    address: string;
    hausgeld?: number | null;
    maintenanceReserve?: number | null;
  }>;
  loans: Array<{ id: string; label: string; bank?: string | null; monthlyPayment: number; propertyId: string; property?: { name: string } }>;
  onUpdated: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [selectedTenantId, setSelectedTenantId] = useState(payment.tenant?.id || "NONE");
  const [selectedPropertyId, setSelectedPropertyId] = useState(
    payment.propertyId || payment.property?.id || payment.tenant?.property?.id || "NONE"
  );
  const [selectedLoanId, setSelectedLoanId] = useState(payment.loanId || payment.loan?.id || "NONE");
  const [selectedCategory, setSelectedCategory] = useState(payment.category || "RENT");
  const [selectedMethod, setSelectedMethod] = useState(payment.matchMethod || "MANUAL");
  const [selectedPeriod, setSelectedPeriod] = useState(
    payment.period || (payment.bookingDate ? payment.bookingDate.slice(0, 7) : "")
  );
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setSelectedTenantId(payment.tenant?.id || "NONE");
      setSelectedPropertyId(
        payment.propertyId || payment.property?.id || payment.tenant?.property?.id || "NONE"
      );
      setSelectedLoanId(payment.loanId || payment.loan?.id || "NONE");
      setSelectedCategory(payment.category || "RENT");
      setSelectedMethod(payment.matchMethod || "MANUAL");
      setSelectedPeriod(
        payment.period || (payment.bookingDate ? payment.bookingDate.slice(0, 7) : "")
      );
    }
  }, [open, payment]);

  const handleTenantChange = (tenantId: string) => {
    setSelectedTenantId(tenantId);
    if (tenantId !== "NONE") {
      const t = tenants.find((item) => item.id === tenantId);
      if (t?.property?.id) {
        setSelectedPropertyId(t.property.id);
      }
      if (selectedCategory !== "RENT" && selectedCategory !== "UTILITY_IN") {
        setSelectedCategory("RENT");
      }
    }
  };

  const handleLoanChange = (loanId: string) => {
    setSelectedLoanId(loanId);
    if (loanId !== "NONE") {
      setSelectedCategory("LOAN");
      const l = loans.find((item) => item.id === loanId);
      if (l?.propertyId) {
        setSelectedPropertyId(l.propertyId);
      }
    }
  };

  const handleSetNextMonth = () => {
    if (!selectedPeriod) return;
    const [y, m] = selectedPeriod.split("-").map(Number);
    const nextD = new Date(y, m, 1);
    setSelectedPeriod(`${nextD.getFullYear()}-${String(nextD.getMonth() + 1).padStart(2, "0")}`);
  };

  const handleSetBookingMonth = () => {
    if (payment.bookingDate) {
      setSelectedPeriod(payment.bookingDate.slice(0, 7));
    }
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      let cleanPeriod = selectedPeriod.trim();
      const dePeriodMatch = cleanPeriod.match(/^(\d{1,2})[./-](\d{4})$/);
      if (dePeriodMatch) {
        cleanPeriod = `${dePeriodMatch[2]}-${String(parseInt(dePeriodMatch[1], 10)).padStart(2, "0")}`;
      }

      const res = await fetch(`/api/payments/${payment.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId:
            selectedCategory === "REPAIR" ||
            selectedCategory === "HAUSGELD" ||
            selectedCategory === "LOAN" ||
            selectedTenantId === "NONE"
              ? null
              : selectedTenantId,
          propertyId: selectedPropertyId === "NONE" ? null : selectedPropertyId,
          loanId: selectedLoanId === "NONE" ? null : selectedLoanId,
          category: selectedCategory,
          matchMethod: selectedMethod,
          period: cleanPeriod || null,
          status:
            selectedTenantId !== "NONE" ||
            selectedPropertyId !== "NONE" ||
            selectedLoanId !== "NONE" ||
            selectedCategory === "OTHER"
              ? "MATCHED"
              : "MANUAL_REVIEW",
        }),
      });
      if (!res.ok) throw new Error("Fehler beim Speichern");
      toast({
        title: "Buchung aktualisiert",
        description: "Zuordnung, Kategorie und Abrechnungsmonat wurden erfolgreich gespeichert.",
      });
      setOpen(false);
      onUpdated();
    } catch {
      toast({
        title: "Fehler",
        description: "Änderungen konnten nicht gespeichert werden.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1 hover:bg-muted">
          <User className="h-3.5 w-3.5 text-primary" />
          <span>Ändern</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base flex items-center gap-2">
            <Building2 className="h-4 w-4 text-primary" />
            Buchung bearbeiten & zuordnen
          </DialogTitle>
          <DialogDescription className="text-xs">
            Passe Mieter, Immobilie, Darlehen, Abrechnungsmonat oder Buchungskategorie manuell an.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2 text-xs">
          {/* Bankbuchung Infobox */}
          <div className="text-xs bg-muted/40 p-3 rounded-xl space-y-1.5 border">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground font-medium">Datum & Betrag:</span>
              <div className="font-bold text-sm">
                <span className="text-muted-foreground mr-2 font-normal font-mono">{formatDate(payment.bookingDate)}</span>
                <span className={payment.amount >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}>
                  {payment.amount >= 0 ? "+" : ""}{formatCurrency(payment.amount)}
                </span>
              </div>
            </div>
            <div className="flex justify-between items-start">
              <span className="text-muted-foreground font-medium">Auftraggeber:</span>
              <span className="font-semibold text-right max-w-[180px] sm:max-w-[260px] truncate">{payment.payerName || "–"}</span>
            </div>
            {payment.payerIban && (
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground font-medium">IBAN:</span>
                <span className="font-mono text-[11px]">{payment.payerIban}</span>
              </div>
            )}
            <div className="pt-1 border-t text-muted-foreground">
              <span className="font-medium text-foreground">Verwendungszweck:</span>
              <p className="font-mono text-[11px] text-foreground/80 mt-0.5 break-words bg-background/50 p-1.5 rounded border">
                {payment.reference || "–"}
              </p>
            </div>
          </div>

          {/* 1. Kategorie */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Kategorie der Buchung</Label>
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder="Kategorie wählen..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="RENT">Miete (laufende monatliche Mietzahlung)</SelectItem>
                <SelectItem value="LOAN">Darlehen / Annuität (Zins & Tilgung)</SelectItem>
                <SelectItem value="HAUSGELD">Hausgeld (WEG / Hausverwaltung)</SelectItem>
                <SelectItem value="REPAIR">Baumaterial & Reparatur (Baumarkt / Handwerker)</SelectItem>
                <SelectItem value="UTILITY_IN">Nebenkosten-Abrechnung (Nachzahlung)</SelectItem>
                <SelectItem value="OTHER">Sonstiges / Kaution / Privat-Einlage</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* 2. Mieter & Wohnung auswählen */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Mieter auswählen (für Mietzahlungen)</Label>
            <Select value={selectedTenantId} onValueChange={handleTenantChange}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder="Mieter auswählen..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="NONE">-- Kein Mieter zugeordnet --</SelectItem>
                {tenants.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.firstName} {t.lastName} {t.isCurrent === false ? "(Vormieter)" : ""} ({t.property?.name || "Wohnung"})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 3. Immobilie / Wohnung */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Immobilie / Wohnung</Label>
            <Select value={selectedPropertyId} onValueChange={setSelectedPropertyId}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder="Immobilie wählen..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="NONE">-- Keine Immobilie direkt zugeordnet --</SelectItem>
                {properties.map((p) => {
                  const hg = (p.hausgeld || 0) + (p.maintenanceReserve || 0);
                  return (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} ({p.address}){hg > 0 ? ` • Hausgeld-Soll: ${formatCurrency(hg)}` : ""}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          {/* 4. Darlehen (relevant für Annuitäten) */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Darlehen / Kredit (relevant für Annuitäten)</Label>
            <Select value={selectedLoanId} onValueChange={handleLoanChange}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder="Darlehen auswählen..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="NONE">-- Kein Darlehen zugeordnet --</SelectItem>
                {loans.map((l) => (
                  <SelectItem key={l.id} value={l.id}>
                    {l.bank || l.label} • Rate: {formatCurrency(l.monthlyPayment)} ({l.property?.name || "Wohnung"})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 5. Abrechnungsmonat / Periode */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold">Abrechnungsmonat (Periode)</Label>
              <div className="flex gap-1.5 text-[11px]">
                <button
                  type="button"
                  className="text-primary hover:underline"
                  onClick={handleSetBookingMonth}
                >
                  Buchungsmonat
                </button>
                <span>•</span>
                <button
                  type="button"
                  className="text-primary hover:underline"
                  onClick={handleSetNextMonth}
                >
                  +1 Folgemonat
                </button>
              </div>
            </div>
            <Input
              type="text"
              placeholder="z.B. 03.2026 oder 2026-03"
              value={selectedPeriod}
              onChange={(e) => setSelectedPeriod(e.target.value)}
              className="h-9 text-xs font-mono"
            />
            <p className="text-[10px] text-muted-foreground">
              Format: MM.YYYY (z.B. 03.2026) oder YYYY-MM (z.B. 2026-03 für März 2026). Wenn ein Mieter am 27.02. die Miete für März überweist, hier <strong>03.2026</strong> bzw. <strong>2026-03</strong> eintragen.
            </p>
          </div>

          {/* 6. Matching-Methode */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Matching-Status / Methode</Label>
            <Select value={selectedMethod} onValueChange={setSelectedMethod}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder="Methode wählen..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="MANUAL">Manuell (benutzerdefiniert bestätigt)</SelectItem>
                <SelectItem value="IBAN">IBAN-Matching</SelectItem>
                <SelectItem value="NAME">Namens-Matching</SelectItem>
                <SelectItem value="AI">KI-Zuordnung</SelectItem>
                <SelectItem value="UNMATCHED">Nicht zugeordnet</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Buttons */}
          <div className="flex justify-end gap-2 pt-3 border-t">
            <Button variant="outline" size="sm" onClick={() => setOpen(false)}>
              Abbrechen
            </Button>
            <Button size="sm" onClick={handleSave} disabled={loading} className="gap-1.5">
              {loading ? (
                <>
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  Speichere...
                </>
              ) : (
                <>
                  <Check className="h-3.5 w-3.5" />
                  Änderungen speichern
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Split-Buchungen Modal (Buchung aufteilen) ──────────────────────────────
interface SplitItemState {
  id: string;
  amount: string;
  category: string;
  tenantId: string;
  propertyId: string;
  period: string;
  reference: string;
}
