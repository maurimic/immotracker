"use client";

import { useState, Fragment } from "react";
import {
  Coins, Info, Edit, Receipt, Building2, Calculator
} from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogTrigger
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table";
import {
  formatCurrency, formatGermanNumber, formatGermanPercent
} from "@/lib/utils";
import { Property, SubUnitDetail, parseJsonSafe } from "./types";

export function PortfolioKaufwertInfoDialog({
  properties,
  totalPurchaseValue,
  totalAncillaryCosts,
  totalColdRent,
  totalSqm,
  portfolioYield,
}: {
  properties: Property[];
  totalPurchaseValue: number;
  totalAncillaryCosts: number;
  totalColdRent: number;
  totalSqm: number;
  portfolioYield: string | null;
}) {
  const [open, setOpen] = useState(false);
  const totalInvestment = totalPurchaseValue + totalAncillaryCosts;
  const annualColdRent = totalColdRent * 12;
  const multiplier = annualColdRent > 0 && totalPurchaseValue > 0
    ? (totalPurchaseValue / annualColdRent).toFixed(1)
    : null;
  const avgSqmPrice = totalSqm > 0 && totalPurchaseValue > 0
    ? Math.round(totalPurchaseValue / totalSqm)
    : null;

  const totalTransferTax = properties.reduce((s, p) => s + (p.propertyTransferTax || 0), 0);
  const totalNotaryCosts = properties.reduce((s, p) => s + (p.notaryCosts || 0), 0);
  const totalLandRegCosts = properties.reduce((s, p) => s + (p.landRegisterCosts || 0), 0);
  const totalBrokerCosts = properties.reduce((s, p) => s + (p.brokerCosts || 0), 0);
  const totalOtherAncillary = properties.reduce((s, p) => s + (p.otherAncillaryCosts || 0), 0);
  const totalDetailedAncillary = totalTransferTax + totalNotaryCosts + totalLandRegCosts + totalBrokerCosts + totalOtherAncillary;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center justify-center h-4 w-4 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors focus:outline-none"
          title="Kaufwert- und Renditeberechnung ansehen"
        >
          <Info className="h-3.5 w-3.5" />
          <span className="sr-only">Berechnung ansehen</span>
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-primary/10 rounded-lg text-primary">
              <Calculator className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-xl">Berechnung Portfolio-Kaufwert & Rendite</DialogTitle>
              <DialogDescription>
                Detaillierte Aufschlüsselung der Anschaffungskosten und Formeln Ihres Bestands
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6 pt-2">
          {/* Kennzahlen-Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="p-3 rounded-lg border bg-card">
              <span className="text-[11px] text-muted-foreground block">Portfolio-Kaufwert</span>
              <span className="text-lg font-bold text-primary block mt-0.5">
                {formatCurrency(totalPurchaseValue)}
              </span>
              <span className="text-[10px] text-muted-foreground">Reine Kaufpreise</span>
            </div>

            <div className="p-3 rounded-lg border bg-card">
              <span className="text-[11px] text-muted-foreground block">Kaufnebenkosten</span>
              <span className="text-lg font-bold block mt-0.5">
                {formatCurrency(totalAncillaryCosts)}
              </span>
              <span className="text-[10px] text-muted-foreground">Notar, Grunderwerb etc.</span>
            </div>

            <div className="p-3 rounded-lg border bg-card">
              <span className="text-[11px] text-muted-foreground block">Gesamtinvestition</span>
              <span className="text-lg font-bold text-amber-600 dark:text-amber-400 block mt-0.5">
                {formatCurrency(totalInvestment)}
              </span>
              <span className="text-[10px] text-muted-foreground">Kaufpreis + Nebenkosten</span>
            </div>

            <div className="p-3 rounded-lg border bg-card">
              <span className="text-[11px] text-muted-foreground block">Ø Brutto-Mietrendite</span>
              <span className="text-lg font-bold text-green-600 dark:text-green-400 block mt-0.5">
                {portfolioYield ? `${portfolioYield}% p.a.` : "–"}
              </span>
              <span className="text-[10px] text-muted-foreground">
                {multiplier ? `Faktor ${multiplier}x` : "–"}
              </span>
            </div>
          </div>

          {/* Aufschlüsselung der Kaufnebenkosten im Portfolio */}
          {totalDetailedAncillary > 0 && (
            <div className="p-4 rounded-lg bg-secondary/30 border space-y-3">
              <div className="font-semibold text-foreground text-sm flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Receipt className="h-4 w-4 text-primary" />
                  Aufschlüsselung der Kaufnebenkosten im Portfolio
                </span>
                <span className="font-mono text-xs text-muted-foreground">
                  Erfasst: <strong className="text-foreground">{formatCurrency(totalDetailedAncillary)}</strong>
                  {totalAncillaryCosts > 0 && ` von ${formatCurrency(totalAncillaryCosts)}`}
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 text-xs">
                <div className="p-2.5 rounded-md bg-card border">
                  <span className="text-[10px] text-muted-foreground block">Grunderwerbsteuer</span>
                  <span className="font-mono font-semibold text-foreground block mt-0.5">
                    {formatCurrency(totalTransferTax)}
                  </span>
                  {totalPurchaseValue > 0 && totalTransferTax > 0 && (
                    <span className="text-[10px] text-muted-foreground font-mono">
                      {formatGermanPercent((totalTransferTax / totalPurchaseValue) * 100, 1)} v. Kaufwert
                    </span>
                  )}
                </div>
                <div className="p-2.5 rounded-md bg-card border">
                  <span className="text-[10px] text-muted-foreground block">Notarkosten</span>
                  <span className="font-mono font-semibold text-foreground block mt-0.5">
                    {formatCurrency(totalNotaryCosts)}
                  </span>
                  {totalPurchaseValue > 0 && totalNotaryCosts > 0 && (
                    <span className="text-[10px] text-muted-foreground font-mono">
                      {formatGermanPercent((totalNotaryCosts / totalPurchaseValue) * 100, 2)} v. Kaufwert
                    </span>
                  )}
                </div>
                <div className="p-2.5 rounded-md bg-card border">
                  <span className="text-[10px] text-muted-foreground block">Grundbuchamt</span>
                  <span className="font-mono font-semibold text-foreground block mt-0.5">
                    {formatCurrency(totalLandRegCosts)}
                  </span>
                  {totalPurchaseValue > 0 && totalLandRegCosts > 0 && (
                    <span className="text-[10px] text-muted-foreground font-mono">
                      {formatGermanPercent((totalLandRegCosts / totalPurchaseValue) * 100, 2)} v. Kaufwert
                    </span>
                  )}
                </div>
                <div className="p-2.5 rounded-md bg-card border">
                  <span className="text-[10px] text-muted-foreground block">Maklerprovision</span>
                  <span className="font-mono font-semibold text-foreground block mt-0.5">
                    {formatCurrency(totalBrokerCosts)}
                  </span>
                  {totalPurchaseValue > 0 && totalBrokerCosts > 0 && (
                    <span className="text-[10px] text-muted-foreground font-mono">
                      {formatGermanPercent((totalBrokerCosts / totalPurchaseValue) * 100, 2)} v. Kaufwert
                    </span>
                  )}
                </div>
                <div className="p-2.5 rounded-md bg-card border col-span-2 sm:col-span-1">
                  <span className="text-[10px] text-muted-foreground block">Sonstige Nebenkosten</span>
                  <span className="font-mono font-semibold text-foreground block mt-0.5">
                    {formatCurrency(totalOtherAncillary)}
                  </span>
                  <span className="text-[10px] text-muted-foreground">Gutachten etc.</span>
                </div>
              </div>
            </div>
          )}

          {/* Formel-Erklärung */}
          <div className="p-4 rounded-lg bg-muted/50 border space-y-2 text-xs">
            <div className="font-semibold text-foreground text-sm flex items-center gap-1.5">
              <Coins className="h-4 w-4 text-primary" />
              So werden die Werte berechnet:
            </div>
            <div className="grid md:grid-cols-2 gap-3 text-muted-foreground">
              <div>
                <strong className="text-foreground">Portfolio-Kaufwert:</strong>
                <p>Summe der in den Objektakten hinterlegten Kaufpreise aller {properties.length} Wohnungen.</p>
              </div>
              <div>
                <strong className="text-foreground">Gesamtinvestition:</strong>
                <p>Portfolio-Kaufwert ({formatCurrency(totalPurchaseValue)}) + Kaufnebenkosten ({formatCurrency(totalAncillaryCosts)}).</p>
              </div>
              <div>
                <strong className="text-foreground">Brutto-Mietrendite p.a.:</strong>
                <p>(Jahreskaltmiete {formatCurrency(annualColdRent)} ÷ Portfolio-Kaufwert) × 100.</p>
              </div>
              <div>
                <strong className="text-foreground">Mietmultiplikator (Faktor):</strong>
                <p>Portfolio-Kaufwert ÷ Jahreskaltmiete {multiplier ? `(= ${multiplier} Jahreskaltmieten)` : ""}.</p>
              </div>
              {avgSqmPrice && (
                <div className="md:col-span-2">
                  <strong className="text-foreground">Durchschnittlicher m²-Kaufpreis:</strong>
                  <p>Portfolio-Kaufwert ÷ {formatGermanNumber(totalSqm, 1)} m² Gesamtwohnfläche = ca. {avgSqmPrice.toLocaleString("de-DE")} €/m².</p>
                </div>
              )}
            </div>
          </div>

          {/* Einzelaufstellung je Einheit */}
          <div>
            <h4 className="text-sm font-semibold mb-2">Aufschlüsselung nach Einheiten</h4>
            <div className="rounded-md border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="text-xs">Wohnung</TableHead>
                    <TableHead className="text-xs text-right">Fläche</TableHead>
                    <TableHead className="text-xs text-right">Kaufpreis</TableHead>
                    <TableHead className="text-xs text-right">Nebenkosten</TableHead>
                    <TableHead className="text-xs text-right">Kaltmiete/Mo</TableHead>
                    <TableHead className="text-xs text-right">Brutto-Rendite</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {properties.map((p) => {
                    const price = p.purchasePrice || 0;
                    const anc = p.ancillaryCosts || 0;
                    const cold = p.tenant?.coldRent || 0;
                    const yld = price > 0 && cold > 0 ? formatGermanPercent((cold * 12 / price) * 100, 2) : null;

                    let subUnitsList: any[] = [];
                    const parsedUnits = parseJsonSafe<Record<string, any>>(p.unitDetails);
                    if (parsedUnits) {
                      const values = Object.values(parsedUnits);
                      if (values.length > 1) subUnitsList = values;
                    }

                    return (
                      <Fragment key={p.id}>
                        <TableRow className={subUnitsList.length > 1 ? "bg-muted/30" : ""}>
                          <TableCell className="font-medium text-xs">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span>{p.name}</span>
                              {subUnitsList.length > 1 && (
                                <Badge variant="outline" className="text-[9px] bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300 border-indigo-300">
                                  Verbund ({subUnitsList.length})
                                </Badge>
                              )}
                            </div>
                            <div className="text-[10px] text-muted-foreground">{p.address}</div>
                          </TableCell>
                          <TableCell className="text-xs text-right">{p.sqm} m²</TableCell>
                          <TableCell className="text-xs text-right font-medium">
                            {price > 0 ? (
                              formatCurrency(price)
                            ) : (
                              <span className="text-muted-foreground italic text-[11px]">Nicht hinterlegt</span>
                            )}
                          </TableCell>
                          <TableCell className="text-xs text-right">
                            {anc > 0 ? (
                              <div>
                                <span className="font-mono font-medium">{formatCurrency(anc)}</span>
                                {(p.propertyTransferTax || p.notaryCosts || p.landRegisterCosts || p.brokerCosts || p.otherAncillaryCosts) ? (
                                  <div className="text-[9px] text-muted-foreground space-y-0.5 mt-0.5 font-mono">
                                    {p.propertyTransferTax ? <div>GrESt: {formatCurrency(p.propertyTransferTax)}</div> : null}
                                    {p.notaryCosts ? <div>Notar: {formatCurrency(p.notaryCosts)}</div> : null}
                                    {p.landRegisterCosts ? <div>Grundbuch: {formatCurrency(p.landRegisterCosts)}</div> : null}
                                    {p.brokerCosts ? <div>Makler: {formatCurrency(p.brokerCosts)}</div> : null}
                                    {p.otherAncillaryCosts ? <div>Sonst.: {formatCurrency(p.otherAncillaryCosts)}</div> : null}
                                  </div>
                                ) : null}
                              </div>
                            ) : (
                              <span className="text-muted-foreground">–</span>
                            )}
                          </TableCell>
                          <TableCell className="text-xs text-right">
                            {cold > 0 ? formatCurrency(cold) : <span className="text-muted-foreground italic">Leerstand</span>}
                          </TableCell>
                          <TableCell className="text-xs text-right font-semibold">
                            {yld ? (
                              <span className="text-green-600 dark:text-green-400">{yld} p.a.</span>
                            ) : (
                              <span className="text-muted-foreground">–</span>
                            )}
                          </TableCell>
                        </TableRow>
                        {subUnitsList.length > 1 && subUnitsList.map((u) => {
                          const uPrice = u.purchasePrice || 0;
                          const uAnc = u.ancillaryCosts || 0;
                          const uCold = u.coldRent || 0;
                          const uYld = uPrice > 0 && uCold > 0 ? formatGermanPercent((uCold * 12 / uPrice) * 100, 2) : null;
                          return (
                            <TableRow key={`${p.id}-${u.key}`} className="bg-indigo-50/20 dark:bg-indigo-950/15 border-l-2 border-l-indigo-500 text-xs">
                              <TableCell className="font-medium pl-6 text-xs">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-indigo-600 dark:text-indigo-400 font-bold text-[10px] px-1 py-0.5 rounded bg-indigo-100 dark:bg-indigo-900/40">
                                    {u.unitNumber || u.key}
                                  </span>
                                  <span>{u.name || u.key}</span>
                                </div>
                                <div className="text-[10px] text-muted-foreground">{p.address}</div>
                              </TableCell>
                              <TableCell className="text-xs text-right font-mono">{u.sqm} m²</TableCell>
                              <TableCell className="text-xs text-right font-mono font-medium">
                                {uPrice > 0 ? formatCurrency(uPrice) : "–"}
                              </TableCell>
                              <TableCell className="text-xs text-right font-mono">
                                {uAnc > 0 ? (
                                  <div>
                                    <span className="font-mono font-medium">{formatCurrency(uAnc)}</span>
                                    {(u.propertyTransferTax || u.notaryCosts || u.landRegisterCosts || u.brokerCosts || u.otherAncillaryCosts) ? (
                                      <div className="text-[9px] text-muted-foreground space-y-0.5 mt-0.5 font-mono">
                                        {u.propertyTransferTax ? <div>GrESt: {formatCurrency(u.propertyTransferTax)}</div> : null}
                                        {u.notaryCosts ? <div>Notar: {formatCurrency(u.notaryCosts)}</div> : null}
                                        {u.landRegisterCosts ? <div>Grundbuch: {formatCurrency(u.landRegisterCosts)}</div> : null}
                                        {u.brokerCosts ? <div>Makler: {formatCurrency(u.brokerCosts)}</div> : null}
                                        {u.otherAncillaryCosts ? <div>Sonst.: {formatCurrency(u.otherAncillaryCosts)}</div> : null}
                                      </div>
                                    ) : null}
                                  </div>
                                ) : (
                                  <span className="text-muted-foreground">–</span>
                                )}
                              </TableCell>
                              <TableCell className="text-xs text-right font-mono">
                                {uCold > 0 ? formatCurrency(uCold) : "–"}
                              </TableCell>
                              <TableCell className="text-xs text-right font-semibold">
                                {uYld ? (
                                  <span className="text-green-600 dark:text-green-400">{uYld} p.a.</span>
                                ) : (
                                  <span className="text-muted-foreground">–</span>
                                )}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </Fragment>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </div>

          <div className="text-[11px] text-muted-foreground bg-blue-50/50 dark:bg-blue-950/20 p-2.5 rounded border border-blue-200/50 dark:border-blue-900/40">
            ℹ️ <strong>Tipp:</strong> Kaufpreise, Erwerbsdaten und Nebenkosten können jederzeit in der jeweiligen Wohnungsakte über das Stift-Symbol (<Edit className="h-3 w-3 inline mx-0.5" /> Bearbeiten) eingetragen und angepasst werden.
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
