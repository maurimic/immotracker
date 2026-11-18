"use client";

import { useEffect, useState, Fragment } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import {
  Building2, Plus, Users, Euro, FileText, ChevronRight,
  Phone, Mail, Calendar, CreditCard, Edit, Trash2, X, TrendingUp,
  AlertCircle, ShieldCheck, Clock, Calculator, Upload, Check,
  UserPlus, UserMinus, AlertTriangle, Home, Coins, Percent, ArrowUpRight, ArrowRight, Info,
  Hammer, ShieldAlert, ChevronDown, ChevronUp, Receipt, History, Archive, Layers, MapPin, Map
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { DateInput } from "@/components/ui/date-input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  formatCurrency,
  formatDate,
  parseGermanNumber,
  formatGermanNumber,
  formatGermanPercent,
  formatGermanInput,
} from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { RentAdjustmentDialog } from "@/components/RentAdjustmentDialog";
import { PropertyInvestmentsDialog, PropertyInvestment } from "@/components/PropertyInvestmentsDialog";
import { parseUnitTokens } from "@/lib/property-matching";

const InteractivePropertyMap = dynamic(
  () => import("@/components/properties/interactive-property-map"),
  {
    ssr: false,
    loading: () => (
      <div className="h-[500px] w-full rounded-lg border border-dashed flex flex-col items-center justify-center bg-muted/20 text-muted-foreground gap-3">
        <Building2 className="h-8 w-8 animate-pulse text-primary" />
        <span className="text-sm font-medium">Interaktive Karte wird geladen...</span>
      </div>
    ),
  }
);

export type { Property, Tenant, RentAdjustment, SubUnitDetail } from "@/components/properties";
import {
  Property,
  Tenant,
  RentAdjustment,
  SubUnitDetail,
  parseJsonSafe,
  EditPropertyDialog,
  DeletePropertyDialog,
  AddTenantDialog,
  AddFormerTenantDialog,
  EditTenantDialog,
  RemoveTenantDialog,
  PropertyDocumentUploadDialog,
  AddPropertyDialog,
  PortfolioKaufwertInfoDialog,
} from "@/components/properties";

// ─── Wohnungskarte ───────────────────────────────────────────────────────────
function PropertyCard({ property, onRefresh }: { property: Property; onRefresh: () => void }) {
  const openTickets = property.tickets?.filter((t) => t.status !== "DONE").length ?? 0;
  const sqmRent = property.tenant && property.sqm > 0 ? (property.tenant.coldRent / property.sqm).toFixed(2) : "0.00";

  const deleteDocument = async (id: string) => {
    if (!confirm("Dokument wirklich löschen?")) return;
    try {
      const res = await fetch(`/api/documents/${id}`, { method: "DELETE" });
      if (res.ok) {
        toast({ title: "Dokument gelöscht" });
        onRefresh();
      } else {
        toast({ title: "Fehler beim Löschen des Dokuments", variant: "destructive" });
      }
    } catch {
      toast({ title: "Verbindungsfehler", variant: "destructive" });
    }
  };

  // Investitions- & Rendite-Kennzahlen
  const price = property.purchasePrice || 0;
  const ancillary = property.ancillaryCosts || 0;
  const totalInvestment = price + ancillary;
  const sqmPrice = price > 0 && property.sqm > 0 ? formatGermanNumber(price / property.sqm, 0) : null;
  const annualColdRent = property.tenant ? property.tenant.coldRent * 12 : 0;
  const grossYield = price > 0 && annualColdRent > 0 ? formatGermanPercent((annualColdRent / price) * 100, 2) : null;
  const multiplier = price > 0 && annualColdRent > 0 ? formatGermanNumber(price / annualColdRent, 1) : null;

  // Investitionen & Sanierungen Auswertung
  const totalInvestments = (property.investments || []).reduce((s, i) => s + i.amount, 0);
  const totalCapitalized = (property.investments || [])
    .filter((i) => i.isCapitalized)
    .reduce((s, i) => s + i.amount, 0);
  const totalAssetValue = price + totalCapitalized;

  // 15%-Grenzen Berechnung (§ 6 Abs. 1 Nr. 1a EStG)
  const buildingShare = property.buildingSharePercent ?? 80;
  const buildingVal = price * (buildingShare / 100);
  const limit15 = buildingVal * 0.15;
  const acqDate = property.possessionAt || property.purchasedAt;
  let deadlineEnd: Date | null = null;
  let isExpired = false;
  let monthsRemaining = 0;
  if (acqDate) {
    deadlineEnd = new Date(acqDate);
    deadlineEnd.setFullYear(deadlineEnd.getFullYear() + 3);
    const now = new Date();
    isExpired = now > deadlineEnd;
    monthsRemaining = Math.max(0, Math.ceil((deadlineEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24 * 30.4)));
  }

  const relevantInvestments = (property.investments || []).filter((inv) => {
    if (!inv.relevantFor15Percent) return false;
    if (!acqDate || !deadlineEnd) return true;
    const d = new Date(inv.date);
    return d >= new Date(acqDate) && d <= deadlineEnd;
  });

  const spentNet15 = relevantInvestments.reduce((sum, inv) => {
    return sum + (inv.amountNet != null ? inv.amountNet : Math.round((inv.amount / 1.19) * 100) / 100);
  }, 0);
  const buffer15 = limit15 - spentNet15;
  const used15Pct = limit15 > 0 ? (spentNet15 / limit15) * 100 : 0;
  const isExceeded15 = !isExpired && limit15 > 0 && spentNet15 > limit15;
  const isWarning15 = !isExpired && limit15 > 0 && !isExceeded15 && used15Pct >= 80;

  return (
    <Card className="hover:shadow-lg transition-all duration-300 flex flex-col justify-between">
      <CardContent className="pt-5 pb-5 space-y-4">
        {/* Header mit Titel, Adresse, m² & Aktions-Buttons */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white shadow-md flex-shrink-0">
              <Building2 className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h3 className="font-semibold text-sm leading-tight truncate">{property.name}</h3>
              <p className="text-xs text-muted-foreground mt-0.5 truncate">{property.address}</p>
              {(property.floor || property.unitNumber || property.rooms) && (
                <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground/80 mt-0.5">
                  {(property.floor || property.rooms) && (
                    <span className="truncate">
                      {[property.floor, property.rooms ? `${property.rooms} Zimmer` : null]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  )}
                  {property.unitNumber && (
                    <Badge variant="outline" className="text-[10px] h-4 px-1.5 py-0 font-mono text-primary border-primary/30 bg-primary/5">
                      {property.unitNumber}
                    </Badge>
                  )}
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <div className="text-right mr-1">
              <span className="text-xs font-semibold">{property.sqm} m²</span>
              <span className="block text-[11px] text-muted-foreground">{sqmRent} €/m²</span>
            </div>
            <EditPropertyDialog property={property} onRefresh={onRefresh} />
            <DeletePropertyDialog property={property} onRefresh={onRefresh} />
          </div>
        </div>

        {/* Kaufpreis & Investitions-Infoblock (falls hinterlegt) */}
        {price > 0 && (
          <div className="bg-secondary/40 rounded-xl p-2.5 text-xs space-y-1.5 border border-border/40">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground flex items-center gap-1">
                <Coins className="h-3 w-3 text-primary" /> Kaufpreis:
              </span>
              <span className="font-bold font-mono text-foreground">
                {formatCurrency(price)}
                {sqmPrice && <span className="text-[10px] text-muted-foreground font-normal ml-1">({sqmPrice} €/m²)</span>}
              </span>
            </div>
            {ancillary > 0 && (
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                  <span>+ Kaufnebenkosten:</span>
                  <span className="font-mono font-medium text-foreground">
                    {formatCurrency(ancillary)}{" "}
                    <span className="text-muted-foreground font-normal text-[10px]">
                      (Gesamt: {formatCurrency(totalInvestment)})
                    </span>
                  </span>
                </div>
                {(Boolean(property.propertyTransferTax || property.notaryCosts || property.landRegisterCosts || property.brokerCosts || property.otherAncillaryCosts)) && (
                  <div className="pl-2 border-l-2 border-primary/40 text-[10px] text-muted-foreground space-y-0.5 pt-0.5">
                    {property.propertyTransferTax ? (
                      <div className="flex justify-between">
                        <span>• Grunderwerbsteuer:</span>
                        <span className="font-mono text-foreground">{formatCurrency(property.propertyTransferTax)}</span>
                      </div>
                    ) : null}
                    {property.notaryCosts ? (
                      <div className="flex justify-between">
                        <span>• Notarkosten:</span>
                        <span className="font-mono text-foreground">{formatCurrency(property.notaryCosts)}</span>
                      </div>
                    ) : null}
                    {property.landRegisterCosts ? (
                      <div className="flex justify-between">
                        <span>• Grundbuchamt:</span>
                        <span className="font-mono text-foreground">{formatCurrency(property.landRegisterCosts)}</span>
                      </div>
                    ) : null}
                    {property.brokerCosts ? (
                      <div className="flex justify-between">
                        <span>• Maklerprovision:</span>
                        <span className="font-mono text-foreground">{formatCurrency(property.brokerCosts)}</span>
                      </div>
                    ) : null}
                    {property.otherAncillaryCosts ? (
                      <div className="flex justify-between">
                        <span>• Sonstige Nebenkosten:</span>
                        <span className="font-mono text-foreground">{formatCurrency(property.otherAncillaryCosts)}</span>
                      </div>
                    ) : null}
                  </div>
                )}
              </div>
            )}
            {grossYield && (
              <div className="flex items-center justify-between pt-1 border-t border-border/30">
                <span className="text-muted-foreground">Mietrendite (brutto):</span>
                <div className="flex items-center gap-1.5">
                  <Badge variant="success" className="text-[10px] h-4 px-1.5 font-mono">
                    {grossYield} p.a.
                  </Badge>
                  {multiplier && (
                    <Badge variant="secondary" className="text-[10px] h-4 px-1.5 font-mono">
                      {multiplier}x Faktor
                    </Badge>
                  )}
                </div>
              </div>
            )}
            {(property.purchasedAt || property.possessionAt) && (
              <div className="pt-1.5 border-t border-border/30 space-y-1 text-[11px]">
                {property.purchasedAt && (
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" /> Notarvertrag:
                    </span>
                    <span className="font-mono text-foreground">{formatDate(property.purchasedAt)}</span>
                  </div>
                )}
                {property.possessionAt && (
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span className="flex items-center gap-1" title="Nutzen- & Lastenwechsel: Ab diesem Stichtag gehen Mieteinnahmen, Hausgeld und Pflichten auf den Käufer über">
                      <Clock className="h-3 w-3 text-primary" /> Nutzen & Lasten:
                    </span>
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-foreground">{formatDate(property.possessionAt)}</span>
                      {new Date(property.possessionAt) > new Date() && (
                        <Badge variant="outline" className="text-[9px] h-4 px-1 py-0 text-amber-500 border-amber-500/30">
                          in Zukunft
                        </Badge>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Sanierungen & Gesamtwert */}
            {totalCapitalized > 0 && (
              <div className="pt-1.5 border-t border-border/30 space-y-1 text-[11px]">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                    <Hammer className="h-3 w-3" /> + Investitionen & Sanierung:
                  </span>
                  <span className="font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                    +{formatCurrency(totalCapitalized)}
                  </span>
                </div>
                <div className="flex items-center justify-between font-semibold">
                  <span className="text-foreground">Aktueller Sachwert:</span>
                  <span className="font-mono text-primary">{formatCurrency(totalAssetValue)}</span>
                </div>
              </div>
            )}

            {/* 15%-Grenzen Monitor Mini-Card */}
            {price > 0 && (
              <div
                className={`p-2 rounded-lg text-xs space-y-1.5 border mt-1 ${
                  isExceeded15
                    ? "bg-rose-500/10 border-rose-500/30 text-rose-700 dark:text-rose-300"
                    : isWarning15
                    ? "bg-amber-500/10 border-amber-500/30"
                    : isExpired
                    ? "bg-muted/40 border-border/40 text-muted-foreground"
                    : "bg-emerald-500/5 border-emerald-500/20"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold flex items-center gap-1">
                    <ShieldAlert className="h-3.5 w-3.5" />
                    15%-Grenze (§ 6 EStG):
                  </span>
                  {isExpired ? (
                    <Badge variant="outline" className="text-[9px] h-4 px-1 py-0 bg-muted/60 text-muted-foreground">
                      Frist beendet (Sicher)
                    </Badge>
                  ) : isExceeded15 ? (
                    <Badge variant="destructive" className="text-[9px] h-4 px-1 py-0 animate-pulse">
                      Überschritten!
                    </Badge>
                  ) : isWarning15 ? (
                    <Badge variant="outline" className="text-[9px] h-4 px-1 py-0 bg-amber-500/10 text-amber-600 border-amber-500/30">
                      &gt; 80% verbraucht
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-[9px] h-4 px-1 py-0 bg-emerald-500/10 text-emerald-600 border-emerald-500/30">
                      Puffer: {formatCurrency(buffer15)}
                    </Badge>
                  )}
                </div>
                <div className="flex justify-between items-center text-[10px] text-muted-foreground font-mono">
                  <span>Investiert: {formatCurrency(spentNet15)}</span>
                  <span>Budget: {formatCurrency(limit15)}</span>
                </div>
                {!isExpired && limit15 > 0 && (
                  <div className="h-1.5 w-full bg-secondary rounded-full overflow-hidden">
                    <div
                      className={`h-full ${
                        isExceeded15 ? "bg-rose-500" : isWarning15 ? "bg-amber-500" : "bg-emerald-500"
                      }`}
                      style={{ width: `${Math.min(100, used15Pct)}%` }}
                    />
                  </div>
                )}
                {acqDate && !isExpired && (
                  <p className="text-[10px] text-muted-foreground">
                    Fristende: {formatDate(deadlineEnd!)} (noch ca. {monthsRemaining} Mo.)
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Investitionen & Sanierungen Button */}
        <PropertyInvestmentsDialog
          property={property}
          onRefresh={onRefresh}
          trigger={
            <Button
              variant="outline"
              size="sm"
              className="w-full h-8 text-xs gap-1.5 border-primary/30 text-primary hover:bg-primary/10 shadow-sm"
              title="Investitionen & Sanierungen erfassen, 15%-Grenzen Monitor öffnen"
            >
              <Hammer className="h-3.5 w-3.5" />
              <span>Investitionen & Sanierungen</span>
              {property.investments && property.investments.length > 0 && (
                <Badge variant="secondary" className="text-[10px] h-4 px-1.5 py-0 ml-auto font-mono">
                  {property.investments.length}
                </Badge>
              )}
            </Button>
          }
        />

        {/* Laufende Bewirtschaftungskosten (WEG-Hausgeld & Rücklagen) */}
        <div className="bg-secondary/30 rounded-xl p-2.5 text-xs space-y-1.5 border border-border/40">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="flex items-center gap-1">
              <Coins className="h-3 w-3 text-indigo-500" /> Hausgeld (WEG):
            </span>
            <div className="flex items-center gap-1.5 font-mono">
              <span className="font-semibold text-foreground">
                {property.hausgeld != null && property.hausgeld > 0
                  ? `${formatCurrency(property.hausgeld)}/Mo`
                  : "–"}
              </span>
            </div>
          </div>
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="flex items-center gap-1">
              <ShieldCheck className="h-3 w-3 text-amber-500" /> Erhaltungsrücklage:
            </span>
            <div className="flex items-center gap-1.5 font-mono">
              <span className="font-semibold text-foreground">
                {property.maintenanceReserve != null && property.maintenanceReserve > 0
                  ? `${formatCurrency(property.maintenanceReserve)}/Mo`
                  : `${formatCurrency(property.sqm * 1.20)}/Mo`}
              </span>
              <Badge variant={property.maintenanceReserve != null && property.maintenanceReserve > 0 ? "secondary" : "outline"} className="text-[9px] h-4 px-1 py-0 font-sans">
                {property.maintenanceReserve != null && property.maintenanceReserve > 0 ? "Individuell" : "1,20 €/m²"}
              </Badge>
            </div>
          </div>
          {((property.hausgeld != null && property.hausgeld > 0) || (property.maintenanceReserve != null && property.maintenanceReserve > 0)) && (
            <div className="flex items-center justify-between pt-1 border-t border-border/40 text-xs">
              <span className="font-medium text-foreground">Gesamt-Soll an WEG:</span>
              <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">
                {formatCurrency((property.hausgeld || 0) + (property.maintenanceReserve || 0))}/Mo
              </span>
            </div>
          )}
          {property.nonRecoverableCosts != null && property.nonRecoverableCosts > 0 && (
            <div className="flex items-center justify-between text-[11px] text-muted-foreground/80 pt-0.5">
              <span>Nicht-umlagef. Kosten:</span>
              <span className="font-mono">{formatCurrency(property.nonRecoverableCosts)}/Mo</span>
            </div>
          )}
        </div>

        {/* Verbund-Aufteilung nach Wohneinheiten (z.B. WE 5 & WE 6) */}
        {(() => {
          const details = parseJsonSafe<Record<string, SubUnitDetail>>(property.unitDetails);
          if (!details) return null;
          const units = Object.values(details);
          if (units.length > 1) {
            return (
                <div className="rounded-xl border border-indigo-200/70 dark:border-indigo-800/70 bg-indigo-50/40 dark:bg-indigo-950/20 p-2.5 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-indigo-950 dark:text-indigo-200 flex items-center gap-1.5">
                      <Layers className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
                      Verbund-Aufteilung ({units.length} Einheiten)
                    </span>
                    <Badge variant="outline" className="text-[10px] bg-indigo-100/60 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300 border-indigo-300 dark:border-indigo-700">
                      Kombinierte Nutzung
                    </Badge>
                  </div>

                  <div className="grid grid-cols-1 gap-2">
                    {units.map((u) => (
                      <div key={u.key} className="rounded-lg bg-background/80 p-2.5 border border-border/60 space-y-1.5">
                        <div className="flex items-center justify-between font-semibold text-xs text-foreground border-b border-border/40 pb-1">
                          <span className="flex items-center gap-1.5">
                            <span className="px-1.5 py-0.5 rounded bg-indigo-100 dark:bg-indigo-900/40 text-indigo-800 dark:text-indigo-300 text-[10px] font-bold">
                              {u.unitNumber || u.key}
                            </span>
                            <span>{u.name || u.label || u.key}</span>
                          </span>
                          <span className="font-mono text-indigo-600 dark:text-indigo-400 font-semibold">{u.sqm} m²</span>
                        </div>

                        <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] text-muted-foreground pt-0.5">
                          <div className="space-y-0.5">
                            <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Kauf & Erwerb</div>
                            <div className="font-mono text-foreground font-medium">Kaufpreis: {formatCurrency(u.purchasePrice || 0)}</div>
                            <div className="text-[10px] text-muted-foreground">
                              + Nebenkosten: <span className="font-mono font-medium text-foreground">{u.ancillaryCosts ? formatCurrency(u.ancillaryCosts) : "–"}</span>
                            </div>
                            {u.ancillaryCosts ? (
                              <div className="text-[10px] text-amber-600 dark:text-amber-400 font-mono font-semibold">
                                Investition: {formatCurrency((u.purchasePrice || 0) + (u.ancillaryCosts || 0))}
                              </div>
                            ) : null}
                            {(Boolean(u.propertyTransferTax || u.notaryCosts || u.landRegisterCosts || u.brokerCosts || u.otherAncillaryCosts)) && (
                              <div className="pl-1.5 border-l border-primary/40 text-[9px] text-muted-foreground font-mono space-y-0.5 pt-0.5">
                                {u.propertyTransferTax ? <div>• GrESt: {formatCurrency(u.propertyTransferTax)}</div> : null}
                                {u.notaryCosts ? <div>• Notar: {formatCurrency(u.notaryCosts)}</div> : null}
                                {u.landRegisterCosts ? <div>• Grundbuch: {formatCurrency(u.landRegisterCosts)}</div> : null}
                                {u.brokerCosts ? <div>• Makler: {formatCurrency(u.brokerCosts)}</div> : null}
                                {u.otherAncillaryCosts ? <div>• Sonst.: {formatCurrency(u.otherAncillaryCosts)}</div> : null}
                              </div>
                            )}
                            <div className="text-[10px] text-muted-foreground pt-0.5">Notar: {u.purchasedAt ? formatDate(u.purchasedAt) : "–"}</div>
                          </div>
                          <div className="space-y-0.5">
                            <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Mietvertrag</div>
                            <div className="font-mono text-foreground font-medium">Kalt: {formatCurrency(u.coldRent || 0)}</div>
                            <div className="text-[10px] text-muted-foreground">
                              NK: {formatCurrency(u.utilities || 0)} {u.heating ? `(Hzg ${formatCurrency(u.heating)} + BK ${formatCurrency(u.operatingCosts || 0)})` : ""}
                            </div>
                            <div className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 font-mono">
                              Warm: {formatCurrency(u.warmRent || ((u.coldRent || 0) + (u.utilities || 0)))}
                            </div>
                          </div>
                        </div>

                        <div className="pt-1 border-t border-border/40 flex items-center justify-between text-[11px]">
                          <span className="text-muted-foreground">WEG-Hausgeld & Rücklage:</span>
                          <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">
                            {formatCurrency(u.totalWeg || ((u.hausgeld || 0) + (u.maintenanceReserve || 0)))}/Mo
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            }
          return null;
        })()}

        {/* Mieterbereich: Entweder Vermietet ODER Leerstand */}
        {property.tenant ? (
          <div className="space-y-3 border-t border-border/50 pt-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-sm font-semibold">
                  {property.tenant.firstName} {property.tenant.lastName}
                </span>
              </div>
              <Badge variant="success" className="text-xs">Vermietet</Badge>
            </div>

            {/* Kontakt & IBAN */}
            <div className="space-y-1 text-xs text-muted-foreground">
              {property.tenant.email && (
                <div className="flex items-center gap-1.5 truncate">
                  <Mail className="h-3 w-3 flex-shrink-0" />
                  <span className="truncate">{property.tenant.email}</span>
                </div>
              )}
              {property.tenant.phone && (
                <div className="flex items-center gap-1.5">
                  <Phone className="h-3 w-3 flex-shrink-0" />
                  <span>{property.tenant.phone}</span>
                </div>
              )}
              {property.tenant.iban && (
                <div className="flex items-center gap-1.5 font-mono text-[11px]">
                  <CreditCard className="h-3 w-3 flex-shrink-0" />
                  <span>{property.tenant.iban}</span>
                </div>
              )}
            </div>

            {/* Mieten-Tabelle */}
            <div className="grid grid-cols-3 gap-2 pt-1">
              <div className="bg-secondary/50 rounded-lg p-2 text-center">
                <p className="text-[11px] text-muted-foreground">Kaltmiete</p>
                <p className="text-sm font-bold mt-0.5">{formatCurrency(property.tenant.coldRent)}</p>
              </div>
              <div className="bg-secondary/50 rounded-lg p-2 text-center">
                <p className="text-[11px] text-muted-foreground">NK-VZ</p>
                <p className="text-sm font-bold mt-0.5">{formatCurrency(property.tenant.utilities)}</p>
              </div>
              <div className="bg-secondary/50 rounded-lg p-2 text-center">
                <p className="text-[11px] text-muted-foreground">Gesamtmiete</p>
                <p className="text-sm font-bold mt-0.5 text-primary">
                  {formatCurrency(property.tenant.coldRent + property.tenant.utilities)}
                </p>
              </div>
            </div>

            {/* Kaution Status */}
            <div className="flex items-center justify-between text-xs bg-muted/40 p-2 rounded-lg">
              <span className="text-muted-foreground">Mietkaution:</span>
              <div className="flex items-center gap-1">
                <span className="font-semibold">{formatCurrency(property.tenant.deposit)}</span>
                {property.tenant.depositPaid ? (
                  <Badge variant="success" className="text-[10px] h-4 px-1.5 gap-0.5">
                    <Check className="h-2.5 w-2.5" /> Bezahlt
                  </Badge>
                ) : (
                  <Badge variant="destructive" className="text-[10px] h-4 px-1.5">
                    Ausstehend
                  </Badge>
                )}
              </div>
            </div>

            {/* Fristen / Einzug */}
            <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
              <div className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                <span>Einzug: {formatDate(property.tenant.moveInDate)}</span>
              </div>
              {openTickets > 0 && (
                <Badge variant="destructive" className="text-[11px]">
                  {openTickets} offene Reparatur{openTickets > 1 ? "en" : ""}
                </Badge>
              )}
            </div>

            {/* Aktionen für Mieter */}
            <div className="flex items-center justify-between pt-2 border-t border-border/50 gap-2 flex-wrap">
              <div className="flex items-center gap-1.5">
                <EditTenantDialog tenant={property.tenant} onRefresh={onRefresh} />
                <RemoveTenantDialog
                  tenant={property.tenant}
                  propertyName={property.name}
                  onRefresh={onRefresh}
                />
              </div>
              <div className="flex items-center gap-1.5">
                <Link
                  href={`/zahlungen?search=${encodeURIComponent(property.tenant.lastName)}&period=ALL`}
                  className="h-7 px-2 text-xs gap-1 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 rounded-md inline-flex items-center transition-colors shadow-sm font-medium"
                  title={`Zahlungsströme & Soll-/Ist-Status für ${property.tenant.firstName} ${property.tenant.lastName} ansehen`}
                >
                  <CreditCard className="h-3 w-3" />
                  <span>Zahlungen</span>
                  <ArrowRight className="h-3 w-3 opacity-60" />
                </Link>
                <RentAdjustmentDialog
                  selectedPropertyId={property.id}
                  onRefresh={onRefresh}
                  trigger={
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs gap-1 border-primary/30 text-primary hover:bg-primary/10"
                      title="Mietanpassung (Kaltmiete / Nebenkosten) für diese Wohnung erfassen oder Historie einsehen"
                    >
                      <TrendingUp className="h-3 w-3" />
                      <span>Mietanpassung</span>
                      {property.rentAdjustments?.length > 0 && (
                        <Badge variant="secondary" className="text-[10px] h-4 px-1 py-0 ml-0.5">
                          {property.rentAdjustments.length}
                        </Badge>
                      )}
                    </Button>
                  }
                />
              </div>
            </div>
          </div>
        ) : (
          <div className="border-t border-border/50 pt-5 pb-2 text-center space-y-3">
            <div className="p-3 bg-secondary/30 rounded-xl border border-dashed border-border flex flex-col items-center">
              <Badge variant="outline" className="text-muted-foreground text-xs mb-1.5">
                Aktuell Leerstand
              </Badge>
              <p className="text-xs text-muted-foreground mb-3">
                Kein aktiver Mieter für diese Wohnung hinterlegt.
              </p>
              <AddTenantDialog property={property} onRefresh={onRefresh} />
            </div>
          </div>
        )}

        {/* Mieter-Historie / Vormieter Sektion */}
        {property.formerTenants && property.formerTenants.length > 0 ? (
          <div className="border-t border-border/50 pt-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold flex items-center gap-1.5 text-muted-foreground">
                <History className="h-3.5 w-3.5 text-amber-500" />
                Vormieter-Historie ({property.formerTenants.length})
              </span>
              <AddFormerTenantDialog property={property} onRefresh={onRefresh} />
            </div>

            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
              {property.formerTenants.map((ft) => (
                <div
                  key={ft.id}
                  className="bg-secondary/40 border border-border/60 rounded-lg p-2.5 text-xs space-y-1.5"
                >
                  <div className="flex items-center justify-between gap-1">
                    <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                      <span className="font-semibold text-foreground truncate">
                        {ft.firstName} {ft.lastName}
                      </span>
                      <Badge
                        variant="outline"
                        className="text-[10px] text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/30 px-1 py-0 h-4"
                      >
                        Vormieter
                      </Badge>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Link
                        href={`/zahlungen?search=${encodeURIComponent(ft.lastName)}&period=ALL`}
                        className="h-6 px-1.5 text-[11px] gap-1 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 rounded inline-flex items-center transition-colors font-medium shadow-xs"
                        title={`Bankbuchungen & Mieten für ${ft.firstName} ${ft.lastName} ansehen`}
                      >
                        <CreditCard className="h-3 w-3" />
                        <span>Zahlungen</span>
                      </Link>
                      <EditTenantDialog
                        tenant={ft}
                        onRefresh={onRefresh}
                        trigger={
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6 text-muted-foreground hover:text-foreground"
                            title="Vormieter bearbeiten"
                          >
                            <Edit className="h-3 w-3" />
                          </Button>
                        }
                      />
                      <RemoveTenantDialog
                        tenant={ft}
                        propertyName={property.name}
                        onRefresh={onRefresh}
                        trigger={
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6 text-muted-foreground hover:text-destructive"
                            title="Vormieter löschen"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        }
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-muted-foreground text-[11px]">
                    <span>
                      {ft.moveInDate ? formatDate(ft.moveInDate) : "–"} bis{" "}
                      {ft.moveOutDate ? formatDate(ft.moveOutDate) : "–"}
                    </span>
                    <span className="font-mono">
                      {formatCurrency(ft.coldRent + ft.utilities)} ({formatCurrency(ft.coldRent)} KM + {formatCurrency(ft.utilities)} NK)
                    </span>
                  </div>

                  {ft.iban && (
                    <div className="flex items-center gap-1 font-mono text-[10px] text-muted-foreground truncate">
                      <CreditCard className="h-2.5 w-2.5 shrink-0 text-muted-foreground" />
                      <span className="truncate" title={ft.iban}>{ft.iban}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="border-t border-border/40 pt-2 flex justify-end">
            <AddFormerTenantDialog property={property} onRefresh={onRefresh} />
          </div>
        )}

        {/* Dokumente (Mietverträge, Übergabeprotokolle, Grundrisse) */}
        <div className="pt-3 border-t border-border/50 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold flex items-center gap-1.5 text-muted-foreground">
              <FileText className="h-3.5 w-3.5 text-primary" />
              Dokumente & Verträge ({property.documents?.length || 0})
            </span>
            <PropertyDocumentUploadDialog property={property} onRefresh={onRefresh} />
          </div>

          {property.documents && property.documents.length > 0 ? (
            <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
              {property.documents.map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-center justify-between text-xs bg-muted/40 hover:bg-muted/70 px-2.5 py-1.5 rounded-lg border border-border/40 transition-colors"
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-sm">
                      {doc.type === "LEASE" ? "📜" : doc.type === "PROTOCOL" ? "📋" : doc.type === "FLOORPLAN" ? "📐" : "📄"}
                    </span>
                    <span className="truncate font-medium text-[11px]" title={doc.name}>
                      {doc.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <a
                      href={doc.filePath || doc.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1 hover:text-primary transition-colors text-muted-foreground"
                      title="Öffnen / Herunterladen"
                    >
                      <ArrowUpRight className="h-3.5 w-3.5" />
                    </a>
                    <button
                      onClick={() => deleteDocument(doc.id)}
                      className="p-1 text-muted-foreground hover:text-destructive transition-colors"
                      title="Dokument löschen"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[11px] text-muted-foreground/70 italic">
              Noch keine Mietverträge oder Dokumente hinterlegt.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}


// ─── Hauptseite Wohnungen ────────────────────────────────────────────────────
export default function WohnungenPage() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      const res = await fetch("/api/properties");
      if (res.ok) {
        setProperties(await res.json());
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

  const totalRent = properties.reduce(
    (s, p) => s + (p.tenant ? p.tenant.coldRent + p.tenant.utilities : 0),
    0
  );
  const totalColdRent = properties.reduce(
    (s, p) => s + (p.tenant ? p.tenant.coldRent : 0),
    0
  );
  const vacancies = properties.filter((p) => !p.tenant).length;
  const totalSqm = properties.reduce((s, p) => s + p.sqm, 0);

  // Portfolio-Kaufpreis und Gesamtrendite
  const totalPurchaseValue = properties.reduce((s, p) => s + (p.purchasePrice || 0), 0);
  const totalAncillaryCosts = properties.reduce((s, p) => s + (p.ancillaryCosts || 0), 0);
  const propertiesWithPrice = properties.filter((p) => p.purchasePrice && p.purchasePrice > 0);
  const portfolioYield = totalPurchaseValue > 0 && totalColdRent > 0
    ? formatGermanPercent((totalColdRent * 12 / totalPurchaseValue) * 100, 2)
    : null;

  // Alle Mietanpassungen für den Fristenrechner
  const allAdjustments = properties
    .flatMap((p) =>
      (p.rentAdjustments || []).map((ra) => ({
        ...ra,
        propertyName: p.name,
        currentColdRent: p.tenant?.coldRent || 0,
        sqm: p.sqm,
      }))
    )
    .sort(
      (a, b) =>
        new Date(a.effectiveDate).getTime() - new Date(b.effectiveDate).getTime()
    );

  return (
    <div className="p-3.5 sm:p-6 space-y-4 sm:space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">Objekt- & Mieterakten</h1>
          <p className="text-muted-foreground text-xs sm:text-sm">
            {properties.length} {properties.length === 1 ? "Wohnung" : "Wohnungen"} im Portfolio · Kaufpreise, Mietverträge & Renditen
          </p>
        </div>
        <div className="self-start sm:self-auto">
          <AddPropertyDialog onRefresh={fetchData} />
        </div>
      </div>

      {/* Zusammenfassung KPI */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground mb-1">Vermietungsquote</p>
            <p className="text-xl sm:text-2xl font-bold text-green-500">
              {properties.length > 0
                ? (((properties.length - vacancies) / properties.length) * 100).toFixed(0)
                : 0}
              %
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {properties.length - vacancies} von {properties.length} vermietet
              {vacancies > 0 && ` (${vacancies} Leerstand)`}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground mb-1">Kaltmiete gesamt / Monat</p>
            <p className="text-xl sm:text-2xl font-bold">{formatCurrency(totalColdRent)}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Warm: {formatCurrency(totalRent)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs text-muted-foreground">
                {totalPurchaseValue > 0 ? "Portfolio-Kaufwert" : "Gesamt-Wohnfläche"}
              </p>
              {totalPurchaseValue > 0 && (
                <PortfolioKaufwertInfoDialog
                  properties={properties}
                  totalPurchaseValue={totalPurchaseValue}
                  totalAncillaryCosts={totalAncillaryCosts}
                  totalColdRent={totalColdRent}
                  totalSqm={totalSqm}
                  portfolioYield={portfolioYield}
                />
              )}
            </div>
            <p className="text-xl sm:text-2xl font-bold text-primary">
              {totalPurchaseValue > 0 ? formatCurrency(totalPurchaseValue) : `${formatGermanNumber(totalSqm, 1)} m²`}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {portfolioYield
                ? `Ø Brutto-Rendite: ${portfolioYield} p.a.`
                : `Ø ${totalSqm > 0 ? formatGermanNumber(totalColdRent / totalSqm, 2) : "0,00"} €/m² Kalt`}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground mb-1">Geplante Mietanpassungen</p>
            <p className="text-xl sm:text-2xl font-bold text-blue-500">{allAdjustments.length}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Staffel- & Indexmieten</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="akten">
        <TabsList className="w-full sm:w-auto justify-start overflow-x-auto">
          <TabsTrigger value="akten" className="gap-1.5">
            <Building2 className="h-4 w-4" /> Wohnungs- & Mieterakten ({properties.length})
          </TabsTrigger>
          <TabsTrigger value="karte" className="gap-1.5">
            <MapPin className="h-4 w-4 text-primary" /> Portfolio-Karte
          </TabsTrigger>
          <TabsTrigger value="anpassungen" className="gap-1.5">
            <TrendingUp className="h-4 w-4" /> Mietanpassungen & Fristenrechner ({allAdjustments.length})
          </TabsTrigger>
        </TabsList>

        {/* Wohnungen Übersicht */}
        <TabsContent value="akten" className="mt-4">
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-64 skeleton rounded-xl" />
              ))}
            </div>
          ) : properties.length === 0 ? (
            <Card className="text-center py-12">
              <CardContent className="space-y-4">
                <Building2 className="h-12 w-12 text-muted-foreground mx-auto" />
                <div>
                  <h3 className="font-semibold text-lg">Noch keine Wohnungen vorhanden</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Legen Sie Ihre erste Mietwohnung an, um die Verwaltung zu starten.
                  </p>
                </div>
                <AddPropertyDialog onRefresh={fetchData} />
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {properties.map((property) => (
                <PropertyCard
                  key={property.id}
                  property={property}
                  onRefresh={fetchData}
                />
              ))}
            </div>
          )}
        </TabsContent>

        {/* Interaktive Portfolio-Karte Tab */}
        <TabsContent value="karte" className="mt-4">
          <InteractivePropertyMap properties={properties} />
        </TabsContent>

        {/* Mietanpassungen & Fristenrechner Tab */}
        <TabsContent value="anpassungen" className="mt-4 space-y-4">
          <Card>
            <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <Calculator className="h-5 w-5 text-primary" />
                  Mietanpassungen, Staffelmieten & Kappungsgrenzen-Rechner (§ 558 BGB)
                </CardTitle>
                <CardDescription>
                  Dokumentation aller Mieterhöhungen und Nebenkostenanpassungen mit automatischer historischer Bewertung
                </CardDescription>
              </div>
              <RentAdjustmentDialog
                properties={properties}
                onRefresh={fetchData}
                trigger={
                  <Button size="sm" className="gap-1.5 shrink-0">
                    <Plus className="h-4 w-4" /> Mietanpassung erfassen
                  </Button>
                }
              />
            </CardHeader>
            <CardContent>
              {allAdjustments.length === 0 ? (
                <div className="text-center py-8 text-sm text-muted-foreground">
                  Aktuell sind keine Mietanpassungen hinterlegt. Klicken Sie auf „Mietanpassung erfassen“, um eine Erhöhung einzutragen.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Wohnung</TableHead>
                      <TableHead>Typ</TableHead>
                      <TableHead>Wirksam ab</TableHead>
                      <TableHead>Warmmiete Entwicklung</TableHead>
                      <TableHead>Details (Kalt / NK)</TableHead>
                      <TableHead className="w-36">Kappungsgrenze (15%)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {allAdjustments.map((ra) => {
                      const prevCold = ra.previousColdRent ?? ra.currentColdRent;
                      const prevUtil = ra.previousUtilities ?? (ra as any).currentUtilities ?? 0;
                      const prevWarm = (prevCold || 0) + (prevUtil || 0);

                      const newCold = ra.newColdRent ?? prevCold;
                      const newUtil = ra.newUtilities ?? prevUtil;
                      const newWarm = (newCold || 0) + (newUtil || 0);
                      const diffWarm = newWarm - prevWarm;
                      const diffCold = (newCold || 0) - (prevCold || 0);
                      const pctCold = prevCold > 0 ? (diffCold / prevCold) * 100 : 0;
                      const withinCap = pctCold <= 15; // 15% Kappungsgrenze auf Kaltmiete

                      return (
                        <TableRow key={ra.id}>
                          <TableCell className="font-semibold text-sm">
                            <div>{ra.propertyName}</div>
                            {ra.notes && <div className="text-xs text-muted-foreground">{ra.notes}</div>}
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary" className="text-xs">
                              {ra.type === "NEBENKOSTEN" ? "Nebenkosten" :
                               ra.type === "STAFFEL" ? "Staffelmiete" :
                               ra.type === "SPIEGEL" ? "Mietspiegel" :
                               ra.type === "INDEX" ? "Indexmiete" :
                               ra.type === "MODERNISIERUNG" ? "Modernisierung" : "Sonstiges"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm font-medium whitespace-nowrap">
                            {formatDate(ra.effectiveDate)}
                          </TableCell>
                          <TableCell className="text-sm">
                            <div className="font-mono flex items-center gap-1 font-semibold">
                              <span>{formatCurrency(prevWarm)}</span>
                              <span className="text-muted-foreground">→</span>
                              <span className="text-primary font-bold">{formatCurrency(newWarm)}</span>
                              {diffWarm !== 0 && (
                                <span className={diffWarm > 0 ? "text-emerald-600 dark:text-emerald-400 text-xs font-bold" : "text-rose-500 text-xs"}>
                                  ({diffWarm > 0 ? `+${formatCurrency(diffWarm)}` : formatCurrency(diffWarm)})
                                </span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            <div>Kalt: {formatCurrency(prevCold || 0)} → {formatCurrency(newCold || 0)}</div>
                            <div>NK: {formatCurrency(prevUtil || 0)} → {formatCurrency(newUtil || 0)}</div>
                          </TableCell>
                          <TableCell>
                            {ra.type === "NEBENKOSTEN" ? (
                              <Badge variant="outline" className="text-[11px] text-cyan-600 border-cyan-500/30">
                                Keine Kaltmieterhöhung
                              </Badge>
                            ) : diffCold > 0 ? (
                              withinCap ? (
                                <Badge variant="success" className="text-[11px] gap-1">
                                  <Check className="h-3 w-3" /> Konform (≤ 15%)
                                </Badge>
                              ) : (
                                <Badge variant="destructive" className="text-[11px] gap-1">
                                  <AlertCircle className="h-3 w-3" /> Über 15%
                                </Badge>
                              )
                            ) : (
                              <span className="text-xs text-muted-foreground">Unverändert</span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}

              <div className="mt-4 p-4 rounded-xl bg-secondary/40 text-xs text-muted-foreground space-y-1">
                <p className="font-semibold text-foreground">💡 Gesetzliche Regelung gem. § 558 Abs. 3 BGB:</p>
                <p>
                  Die Miete darf sich innerhalb von 3 Jahren um nicht mehr als 20% (in Gemeinden mit angespanntem Wohnungsmarkt wie Berlin, Hamburg, München maximal 15% = Kappungsgrenze) erhöhen. Staffelmieten gem. § 557a BGB sind von der Kappungsgrenze ausgenommen, müssen jedoch mindestens 1 Jahr unverändert bleiben.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

