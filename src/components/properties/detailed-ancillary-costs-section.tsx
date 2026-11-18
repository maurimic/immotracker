"use client";

import { useState } from "react";
import { Receipt, ChevronDown, ChevronUp, Calculator, Check } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { formatCurrency, parseGermanNumber, formatGermanPercent, formatGermanInput } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

export function DetailedAncillaryCostsSection({
  form,
  setForm,
}: {
  form: any;
  setForm: React.Dispatch<React.SetStateAction<any>>;
}) {
  const hasDetailedValues = Boolean(
    form.propertyTransferTax ||
    form.notaryCosts ||
    form.landRegisterCosts ||
    form.brokerCosts ||
    form.otherAncillaryCosts
  );

  const [expanded, setExpanded] = useState<boolean>(hasDetailedValues);

  const price = parseGermanNumber(form.purchasePrice) || 0;

  const pTax = parseGermanNumber(form.propertyTransferTax) || 0;
  const notary = parseGermanNumber(form.notaryCosts) || 0;
  const landReg = parseGermanNumber(form.landRegisterCosts) || 0;
  const broker = parseGermanNumber(form.brokerCosts) || 0;
  const other = parseGermanNumber(form.otherAncillaryCosts) || 0;
  const detailedSum = pTax + notary + landReg + broker + other;

  const currentTotal = parseGermanNumber(form.ancillaryCosts) || 0;

  const updateDetailedField = (field: string, value: string) => {
    setForm((prev: any) => {
      const next = { ...prev, [field]: value };
      const nextPTax = parseGermanNumber(field === "propertyTransferTax" ? value : next.propertyTransferTax);
      const nextNotary = parseGermanNumber(field === "notaryCosts" ? value : next.notaryCosts);
      const nextLandReg = parseGermanNumber(field === "landRegisterCosts" ? value : next.landRegisterCosts);
      const nextBroker = parseGermanNumber(field === "brokerCosts" ? value : next.brokerCosts);
      const nextOther = parseGermanNumber(field === "otherAncillaryCosts" ? value : next.otherAncillaryCosts);

      const newSum = nextPTax + nextNotary + nextLandReg + nextBroker + nextOther;
      if (newSum > 0 || (value === "" && nextPTax === 0 && nextNotary === 0 && nextLandReg === 0 && nextBroker === 0 && nextOther === 0)) {
        next.ancillaryCosts = newSum > 0 ? formatGermanInput(newSum) : "";
      }
      return next;
    });
  };

  const applyPercentToField = (field: string, pct: number) => {
    if (price <= 0) {
      toast({
        title: "Kaufpreis benötigt",
        description: "Bitte zuerst einen Kaufpreis eingeben, um den Prozentwert zu berechnen.",
        variant: "destructive",
      });
      return;
    }
    const val = Math.round(price * (pct / 100) * 100) / 100;
    updateDetailedField(field, formatGermanInput(val));
  };

  return (
    <div className="space-y-2 pt-2 border-t border-border/40">
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <Label className="text-xs font-semibold flex items-center gap-1.5">
            <Receipt className="h-3.5 w-3.5 text-primary" />
            Kaufnebenkosten (€)
          </Label>
          <p className="text-[10px] text-muted-foreground">
            Grunderwerbsteuer, Notar, Grundbuch, Makler
          </p>
        </div>
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="text-[11px] text-primary hover:underline flex items-center gap-1 font-medium bg-primary/10 hover:bg-primary/20 px-2 py-1 rounded transition-colors"
        >
          {expanded ? (
            <>
              <ChevronUp className="h-3 w-3" /> Details verbergen
            </>
          ) : (
            <>
              <ChevronDown className="h-3 w-3" /> Aufschlüsselung {detailedSum > 0 ? `(${formatCurrency(detailedSum)})` : "öffnen"}
            </>
          )}
        </button>
      </div>

      {/* Gesamtsumme Eingabefeld */}
      <div className="grid grid-cols-2 gap-3 items-center">
        <div className="space-y-1">
          <Input
            type="text"
            inputMode="decimal"
            placeholder="z.B. 23.500,00"
            value={form.ancillaryCosts}
            onChange={(e) => setForm((prev: any) => ({ ...prev, ancillaryCosts: e.target.value }))}
          />
        </div>
        <div className="text-[11px] text-muted-foreground leading-tight">
          {price > 0 && currentTotal > 0 ? (
            <span>
              = <strong className="text-foreground">{formatGermanPercent((currentTotal / price) * 100, 1)}</strong> des Kaufpreises
              <span className="block text-[10px] text-muted-foreground/80 mt-0.5">
                Gesamtinvestition: {formatCurrency(price + currentTotal)}
              </span>
            </span>
          ) : (
            <span className="text-muted-foreground/80">Summe aller Erwerbsnebenkosten</span>
          )}
        </div>
      </div>

      {/* Ausklappbare Detailaufteilung */}
      {expanded && (
        <div className="p-3 bg-secondary/30 rounded-xl space-y-3 border border-border/60 text-xs">
          <div className="flex items-center justify-between pb-1 border-b border-border/40">
            <span className="font-semibold text-foreground text-xs flex items-center gap-1.5">
              <Calculator className="h-3.5 w-3.5 text-primary" /> Aufteilung nach Kostenarten
            </span>
            <span className="text-[10px] text-muted-foreground font-mono">
              Summe: <strong className="text-foreground">{formatCurrency(detailedSum)}</strong>
            </span>
          </div>

          {/* 1. Grunderwerbsteuer */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-[11px] font-medium text-foreground">
                1. Grunderwerbsteuer (Finanzamt)
              </Label>
              {price > 0 && pTax > 0 && (
                <span className="text-[10px] text-muted-foreground font-mono">
                  {formatGermanPercent((pTax / price) * 100, 1)}
                </span>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <Input
                type="text"
                inputMode="decimal"
                placeholder="z.B. 13.200,00"
                className="h-8 text-xs font-mono"
                value={form.propertyTransferTax}
                onChange={(e) => updateDetailedField("propertyTransferTax", e.target.value)}
              />
              <div className="flex items-center gap-1 flex-wrap">
                <span className="text-[10px] text-muted-foreground mr-0.5">Presets:</span>
                {[
                  { label: "3,5% (BY)", val: 3.5 },
                  { label: "5,0% (BW)", val: 5.0 },
                  { label: "6,0% (HE/B)", val: 6.0 },
                  { label: "6,5% (NRW)", val: 6.5 },
                ].map((item) => (
                  <Button
                    key={item.label}
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-6 px-1.5 text-[10px] bg-background hover:bg-muted"
                    onClick={() => applyPercentToField("propertyTransferTax", item.val)}
                  >
                    {item.label}
                  </Button>
                ))}
              </div>
            </div>
          </div>

          {/* 2. Notarkosten */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-[11px] font-medium text-foreground">
                2. Notarkosten (Kaufvertragsbeurkundung)
              </Label>
              {price > 0 && notary > 0 && (
                <span className="text-[10px] text-muted-foreground font-mono">
                  {formatGermanPercent((notary / price) * 100, 2)}
                </span>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <Input
                type="text"
                inputMode="decimal"
                placeholder="z.B. 3.300,00"
                className="h-8 text-xs font-mono"
                value={form.notaryCosts}
                onChange={(e) => updateDetailedField("notaryCosts", e.target.value)}
              />
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-6 px-2 text-[10px] bg-background hover:bg-muted"
                  onClick={() => applyPercentToField("notaryCosts", 1.5)}
                >
                  ~1,5% Standard
                </Button>
                <span className="text-[10px] text-muted-foreground">Kaufvertragsbeurkundung</span>
              </div>
            </div>
          </div>

          {/* 3. Grundbuchamt */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-[11px] font-medium text-foreground">
                3. Grundbuchamt (Eigentumsumschreibung)
              </Label>
              {price > 0 && landReg > 0 && (
                <span className="text-[10px] text-muted-foreground font-mono">
                  {formatGermanPercent((landReg / price) * 100, 2)}
                </span>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <Input
                type="text"
                inputMode="decimal"
                placeholder="z.B. 1.100,00"
                className="h-8 text-xs font-mono"
                value={form.landRegisterCosts}
                onChange={(e) => updateDetailedField("landRegisterCosts", e.target.value)}
              />
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-6 px-2 text-[10px] bg-background hover:bg-muted"
                  onClick={() => applyPercentToField("landRegisterCosts", 0.5)}
                >
                  ~0,5% Standard
                </Button>
                <span className="text-[10px] text-muted-foreground">Auflassung & Eigentum</span>
              </div>
            </div>
          </div>

          {/* 4. Maklerprovision */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-[11px] font-medium text-foreground">
                4. Maklerprovision (Courtage)
              </Label>
              {price > 0 && broker > 0 && (
                <span className="text-[10px] text-muted-foreground font-mono">
                  {formatGermanPercent((broker / price) * 100, 2)}
                </span>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <Input
                type="text"
                inputMode="decimal"
                placeholder="z.B. 7.854,00"
                className="h-8 text-xs font-mono"
                value={form.brokerCosts}
                onChange={(e) => updateDetailedField("brokerCosts", e.target.value)}
              />
              <div className="flex items-center gap-1 flex-wrap">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-6 px-1.5 text-[10px] bg-background hover:bg-muted"
                  onClick={() => updateDetailedField("brokerCosts", "0")}
                >
                  0 € (Frei)
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-6 px-1.5 text-[10px] bg-background hover:bg-muted"
                  onClick={() => applyPercentToField("brokerCosts", 3.57)}
                >
                  3,57% (Hälfte)
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-6 px-1.5 text-[10px] bg-background hover:bg-muted"
                  onClick={() => applyPercentToField("brokerCosts", 7.14)}
                >
                  7,14% (Voll)
                </Button>
              </div>
            </div>
          </div>

          {/* 5. Sonstige Nebenkosten */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-[11px] font-medium text-foreground">
                5. Sonstige Nebenkosten
              </Label>
              <span className="text-[10px] text-muted-foreground">Gutachter, Bewertung, etc.</span>
            </div>
            <Input
              type="text"
              inputMode="decimal"
              placeholder="z.B. 500,00"
              className="h-8 text-xs font-mono"
              value={form.otherAncillaryCosts}
              onChange={(e) => updateDetailedField("otherAncillaryCosts", e.target.value)}
            />
          </div>

          {/* Status-Footer der Details */}
          <div className="pt-2 border-t border-border/40 flex items-center justify-between text-[11px]">
            <div className="text-muted-foreground">
              Einzelpositionen addiert: <strong className="text-foreground font-mono">{formatCurrency(detailedSum)}</strong>
            </div>
            {Math.abs(detailedSum - currentTotal) < 0.01 && detailedSum > 0 ? (
              <span className="text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                <Check className="h-3.5 w-3.5" /> Summe synchron
              </span>
            ) : detailedSum > 0 ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-[10px] text-primary"
                onClick={() => setForm((prev: any) => ({ ...prev, ancillaryCosts: formatGermanInput(detailedSum) }))}
              >
                Als Summe übernehmen
              </Button>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
