"use client";

import { useEffect, useState, useMemo } from "react";
import {
  TrendingUp, Calendar, Plus, Trash2, AlertCircle, CheckCircle2,
  Building2, Users, ArrowRight, Info, ShieldCheck, Scale
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, formatDate } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

export interface RentAdjustmentDialogProps {
  properties?: Array<{
    id: string;
    name: string;
    address?: string;
    tenant?: {
      firstName: string;
      lastName: string;
      coldRent: number;
      utilities: number;
    } | null;
  }>;
  selectedPropertyId?: string;
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onRefresh?: () => void;
}

const TYPE_LABELS: Record<string, { label: string; badge: string }> = {
  NEBENKOSTEN: { label: "Anpassung Nebenkostenvorauszahlung", badge: "bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 border-cyan-500/30" },
  SPIEGEL: { label: "Mietspiegelanpassung (§ 558 BGB)", badge: "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30" },
  STAFFEL: { label: "Staffelmiete (§ 557a BGB)", badge: "bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/30" },
  INDEX: { label: "Indexmiete (§ 557b BGB)", badge: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30" },
  MODERNISIERUNG: { label: "Modernisierungsumlage (§ 559 BGB)", badge: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30" },
  SONSTIGES: { label: "Sonstige Vereinbarung", badge: "bg-muted text-muted-foreground" },
};

export function RentAdjustmentDialog({
  properties: initialProperties,
  selectedPropertyId: defaultPropertyId,
  trigger,
  open: controlledOpen,
  onOpenChange: setControlledOpen,
  onRefresh,
}: RentAdjustmentDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = isControlled ? (setControlledOpen || (() => {})) : setInternalOpen;

  const [properties, setProperties] = useState(initialProperties || []);
  const [propertyId, setPropertyId] = useState<string>(defaultPropertyId || "");
  const [adjustments, setAdjustments] = useState<any[]>([]);
  const [loadingAdjustments, setLoadingAdjustments] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Form State
  const [form, setForm] = useState({
    effectiveDate: "",
    type: "NEBENKOSTEN",
    previousColdRent: "",
    previousUtilities: "",
    newColdRent: "",
    newUtilities: "",
    notes: "",
  });

  // Fetch properties if not provided
  useEffect(() => {
    if (open && (!properties || properties.length === 0)) {
      fetch("/api/properties")
        .then((res) => res.json())
        .then((data) => {
          if (Array.isArray(data)) {
            setProperties(data);
            if (!propertyId && data.length > 0) {
              setPropertyId(defaultPropertyId || data[0].id);
            }
          }
        })
        .catch(console.error);
    }
  }, [open]);

  useEffect(() => {
    if (defaultPropertyId) {
      setPropertyId(defaultPropertyId);
    } else if (!propertyId && properties && properties.length > 0) {
      setPropertyId(properties[0].id);
    }
  }, [defaultPropertyId, properties]);

  const selectedProperty = useMemo(() => {
    return properties?.find((p) => p.id === propertyId);
  }, [properties, propertyId]);

  // Load adjustments for current property
  const fetchAdjustments = async (propId: string) => {
    if (!propId) return;
    setLoadingAdjustments(true);
    try {
      const res = await fetch(`/api/rent-adjustments?propertyId=${propId}`);
      if (res.ok) {
        const data = await res.json();
        setAdjustments(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingAdjustments(false);
    }
  };

  useEffect(() => {
    if (open && propertyId) {
      fetchAdjustments(propertyId);
    }
  }, [open, propertyId]);

  // When selectedProperty changes, initialize form with sensible defaults
  useEffect(() => {
    if (selectedProperty?.tenant) {
      const curCold = selectedProperty.tenant.coldRent?.toString() || "";
      const curUtil = selectedProperty.tenant.utilities?.toString() || "";
      setForm((prev) => ({
        ...prev,
        previousColdRent: prev.previousColdRent || curCold,
        previousUtilities: prev.previousUtilities || curUtil,
        newColdRent: prev.newColdRent || curCold,
        newUtilities: prev.newUtilities || curUtil,
      }));
    }
  }, [selectedProperty]);

  // Calculations
  const prevColdNum = parseFloat(form.previousColdRent) || 0;
  const prevUtilNum = parseFloat(form.previousUtilities) || 0;
  const prevWarm = prevColdNum + prevUtilNum;

  const newColdNum = parseFloat(form.newColdRent) || 0;
  const newUtilNum = parseFloat(form.newUtilities) || 0;
  const newWarm = newColdNum + newUtilNum;

  const diffWarm = newWarm - prevWarm;
  const diffCold = newColdNum - prevColdNum;
  const diffUtil = newUtilNum - prevUtilNum;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!propertyId) {
      toast({ title: "Fehler", description: "Bitte eine Wohnung auswählen.", variant: "destructive" });
      return;
    }
    if (!form.effectiveDate) {
      toast({ title: "Fehler", description: "Bitte ein Wirksamkeitsdatum angeben.", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/rent-adjustments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          propertyId,
          effectiveDate: form.effectiveDate,
          type: form.type,
          previousColdRent: form.previousColdRent !== "" ? parseFloat(form.previousColdRent) : null,
          previousUtilities: form.previousUtilities !== "" ? parseFloat(form.previousUtilities) : null,
          newColdRent: form.newColdRent !== "" ? parseFloat(form.newColdRent) : null,
          newUtilities: form.newUtilities !== "" ? parseFloat(form.newUtilities) : null,
          notes: form.notes,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Fehler beim Speichern");
      }

      toast({
        title: "Mietanpassung gespeichert",
        description: `Warmmiete: ${formatCurrency(prevWarm)} → ${formatCurrency(newWarm)} ab ${formatDate(form.effectiveDate)}. Frühere Zahlungen werden historisch korrekt bewertet!`,
      });

      // Reset form fields
      setForm((prev) => ({
        ...prev,
        notes: "",
      }));

      fetchAdjustments(propertyId);
      if (onRefresh) onRefresh();
    } catch (err: any) {
      toast({
        title: "Fehler",
        description: err.message || "Mietanpassung konnte nicht gespeichert werden.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Mietanpassung wirklich löschen?")) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/rent-adjustments/${id}`, { method: "DELETE" });
      if (res.ok) {
        toast({ title: "Mietanpassung gelöscht" });
        fetchAdjustments(propertyId);
        if (onRefresh) onRefresh();
      } else {
        toast({ title: "Fehler beim Löschen", variant: "destructive" });
      }
    } catch {
      toast({ title: "Verbindungsfehler", variant: "destructive" });
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Mietanpassung erfassen & Historie verwalten
          </DialogTitle>
          <DialogDescription>
            Dokumentieren Sie Mieterhöhungen und Nebenkostenanpassungen mit Wirksamkeitsdatum.
            Frühere Zahlungen vor dem Stichtag werden automatisch mit der damaligen Soll-Miete abgeglichen!
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 pt-2">
          {/* Objektauswahl */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Wohnung auswählen *</Label>
            <Select value={propertyId} onValueChange={(val) => {
              setPropertyId(val);
              fetchAdjustments(val);
            }}>
              <SelectTrigger>
                <SelectValue placeholder="Wohnung wählen..." />
              </SelectTrigger>
              <SelectContent>
                {properties?.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name} {p.tenant ? `(Mieter: ${p.tenant.firstName} ${p.tenant.lastName})` : "(Leerstand)"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedProperty?.tenant && (
            <div className="p-3 bg-secondary/40 rounded-xl border border-border/50 flex items-center justify-between text-xs">
              <div>
                <span className="text-muted-foreground block">Aktueller Mieter:</span>
                <span className="font-semibold text-foreground text-sm">
                  {selectedProperty.tenant.firstName} {selectedProperty.tenant.lastName}
                </span>
              </div>
              <div className="text-right">
                <span className="text-muted-foreground block">Derzeitige Gesamtmiete:</span>
                <span className="font-bold text-foreground text-sm">
                  {formatCurrency(selectedProperty.tenant.coldRent + selectedProperty.tenant.utilities)}
                </span>
                <span className="text-[10px] text-muted-foreground block">
                  (Kalt: {formatCurrency(selectedProperty.tenant.coldRent)} + NK: {formatCurrency(selectedProperty.tenant.utilities)})
                </span>
              </div>
            </div>
          )}

          {/* Eingabeformular */}
          <form onSubmit={handleSubmit} className="space-y-4 border rounded-xl p-4 bg-muted/20">
            <div className="flex items-center justify-between border-b pb-2">
              <h4 className="text-sm font-semibold flex items-center gap-1.5 text-foreground">
                <Plus className="h-4 w-4 text-primary" /> Neue Anpassung eintragen
              </h4>
              <Badge variant="outline" className="text-xs font-normal">
                § 558 / § 556 BGB
              </Badge>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-medium">Wirksam ab (Stichtag) *</Label>
                <Input
                  type="date"
                  value={form.effectiveDate}
                  onChange={(e) => setForm({ ...form, effectiveDate: e.target.value })}
                  required
                />
                <p className="text-[10px] text-muted-foreground">Erster Monat, in dem die neue Miete gilt</p>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-medium">Art der Anpassung *</Label>
                <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                  <SelectTrigger className="text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NEBENKOSTEN">💧 Nebenkostenvorauszahlung angepasst</SelectItem>
                    <SelectItem value="SPIEGEL">📈 Mietspiegelanpassung (§ 558 BGB)</SelectItem>
                    <SelectItem value="STAFFEL">🪜 Staffelmiete (§ 557a BGB)</SelectItem>
                    <SelectItem value="INDEX">📊 Indexmiete (§ 557b BGB)</SelectItem>
                    <SelectItem value="MODERNISIERUNG">🔨 Modernisierungsumlage (§ 559 BGB)</SelectItem>
                    <SelectItem value="SONSTIGES">📄 Sonstige Anpassung</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Gegenüberstellung Vorher vs. Nachher */}
            <div className="grid grid-cols-2 gap-4 p-3 bg-background rounded-lg border">
              {/* Vorher */}
              <div className="space-y-2">
                <span className="text-xs font-semibold text-muted-foreground block border-b pb-1">
                  Vorherige Werte (vor Erhöhung)
                </span>
                <div className="space-y-1.5">
                  <Label className="text-[11px] text-muted-foreground">Kaltmiete (€)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="631.00"
                    value={form.previousColdRent}
                    onChange={(e) => setForm({ ...form, previousColdRent: e.target.value })}
                    className="h-8 text-xs font-mono"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[11px] text-muted-foreground">NK-Vorauszahlung (€)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="500.00"
                    value={form.previousUtilities}
                    onChange={(e) => setForm({ ...form, previousUtilities: e.target.value })}
                    className="h-8 text-xs font-mono"
                  />
                </div>
                <div className="pt-1 text-right">
                  <span className="text-[11px] text-muted-foreground">Warm bisher: </span>
                  <span className="text-xs font-bold font-mono">{formatCurrency(prevWarm)}</span>
                </div>
              </div>

              {/* Nachher */}
              <div className="space-y-2">
                <span className="text-xs font-semibold text-primary block border-b pb-1">
                  Neue Werte (ab Stichtag)
                </span>
                <div className="space-y-1.5">
                  <Label className="text-[11px] text-muted-foreground">Neue Kaltmiete (€)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="631.00"
                    value={form.newColdRent}
                    onChange={(e) => setForm({ ...form, newColdRent: e.target.value })}
                    className="h-8 text-xs font-mono"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[11px] text-muted-foreground">Neue NK-Vorauszahlung (€)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="600.00"
                    value={form.newUtilities}
                    onChange={(e) => setForm({ ...form, newUtilities: e.target.value })}
                    className="h-8 text-xs font-mono"
                  />
                </div>
                <div className="pt-1 text-right">
                  <span className="text-[11px] text-muted-foreground">Warm neu: </span>
                  <span className="text-xs font-bold font-mono text-primary">{formatCurrency(newWarm)}</span>
                </div>
              </div>
            </div>

            {/* Dynamische Zusammenfassung der Anpassung */}
            {(newWarm > 0 || prevWarm > 0) && (
              <div className="p-2.5 rounded-lg bg-primary/5 border border-primary/20 text-xs flex items-center justify-between">
                <div className="space-y-0.5">
                  <span className="font-semibold text-foreground flex items-center gap-1.5">
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                    Differenz: {diffWarm >= 0 ? `+${formatCurrency(diffWarm)}` : formatCurrency(diffWarm)} pro Monat
                  </span>
                  <p className="text-[11px] text-muted-foreground">
                    {diffCold !== 0 && (
                      <span className="mr-2">Kalt: {diffCold > 0 ? `+${formatCurrency(diffCold)}` : formatCurrency(diffCold)}</span>
                    )}
                    {diffUtil !== 0 && (
                      <span>NK: {diffUtil > 0 ? `+${formatCurrency(diffUtil)}` : formatCurrency(diffUtil)}</span>
                    )}
                    {diffCold === 0 && diffUtil === 0 && "Keine Betragsänderung"}
                  </p>
                </div>
                <div className="text-right">
                  <Badge variant={diffWarm >= 0 ? "default" : "secondary"} className="font-mono text-xs">
                    {prevWarm > 0 && diffWarm !== 0 ? `${((diffWarm / prevWarm) * 100).toFixed(1)}%` : "0.0%"}
                  </Badge>
                </div>
              </div>
            )}

            <div className="space-y-1">
              <Label className="text-xs font-medium">Begründung / Notizen</Label>
              <Input
                placeholder="z.B. Erhöhung der Nebenkostenvorauszahlung nach Abrechnung 2024"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                className="text-xs"
              />
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <Button type="submit" size="sm" disabled={saving} className="gap-1.5">
                <TrendingUp className="h-3.5 w-3.5" />
                {saving ? "Speichere..." : "Anpassung speichern"}
              </Button>
            </div>
          </form>

          {/* Liste der bisherigen Mietanpassungen */}
          <div className="space-y-2">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5" /> Bisherige Anpassungen ({adjustments.length})
            </h4>

            {loadingAdjustments ? (
              <div className="text-center py-4 text-xs text-muted-foreground">Lade Anpassungen...</div>
            ) : adjustments.length === 0 ? (
              <div className="text-center py-6 border border-dashed rounded-xl text-xs text-muted-foreground">
                Bisher sind für diese Wohnung keine historischen Mietanpassungen hinterlegt.
              </div>
            ) : (
              <div className="rounded-lg border overflow-hidden">
                <Table>
                  <TableHeader className="bg-muted/40">
                    <TableRow>
                      <TableHead className="text-xs font-semibold">Wirksam ab</TableHead>
                      <TableHead className="text-xs font-semibold">Typ</TableHead>
                      <TableHead className="text-xs font-semibold">Warmmiete Entwicklung</TableHead>
                      <TableHead className="text-xs font-semibold">Details</TableHead>
                      <TableHead className="text-xs font-semibold">Notiz</TableHead>
                      <TableHead className="text-right text-xs font-semibold">Aktion</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {adjustments.map((adj) => {
                      const prevW = (adj.previousColdRent || 0) + (adj.previousUtilities || 0);
                      const newW = (adj.newColdRent || 0) + (adj.newUtilities || 0);
                      const diffW = newW - prevW;
                      const typeConf = TYPE_LABELS[adj.type] || TYPE_LABELS.SONSTIGES;

                      return (
                        <TableRow key={adj.id} className="hover:bg-muted/30">
                          <TableCell className="text-xs font-semibold font-mono whitespace-nowrap">
                            {formatDate(adj.effectiveDate)}
                          </TableCell>
                          <TableCell>
                            <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold border ${typeConf.badge}`}>
                              {typeConf.label.split("(")[0].trim()}
                            </span>
                          </TableCell>
                          <TableCell className="text-xs">
                            <div className="flex items-center gap-1 font-mono">
                              {prevW > 0 ? <span>{formatCurrency(prevW)}</span> : <span className="text-muted-foreground">–</span>}
                              <ArrowRight className="h-3 w-3 text-muted-foreground" />
                              <span className="font-bold text-primary">{formatCurrency(newW)}</span>
                              {prevW > 0 && diffW !== 0 && (
                                <span className={diffW > 0 ? "text-emerald-600 dark:text-emerald-400 text-[10px] font-bold" : "text-rose-500 text-[10px]"}>
                                  ({diffW > 0 ? `+${formatCurrency(diffW)}` : formatCurrency(diffW)})
                                </span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-[11px] text-muted-foreground">
                            <div>Kalt: {adj.previousColdRent ? formatCurrency(adj.previousColdRent) : "–"} → {adj.newColdRent ? formatCurrency(adj.newColdRent) : "–"}</div>
                            <div>NK: {adj.previousUtilities ? formatCurrency(adj.previousUtilities) : "–"} → {adj.newUtilities ? formatCurrency(adj.newUtilities) : "–"}</div>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground max-w-[180px] truncate" title={adj.notes || ""}>
                            {adj.notes || "–"}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                              onClick={() => handleDelete(adj.id)}
                              disabled={deletingId === adj.id}
                              title="Anpassung löschen"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>

          <div className="flex justify-end pt-2">
            <Button variant="outline" size="sm" onClick={() => setOpen(false)}>
              Schließen
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
