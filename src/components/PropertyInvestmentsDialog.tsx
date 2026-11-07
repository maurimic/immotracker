"use client";

import { useEffect, useState, useMemo } from "react";
import {
  Wrench, Calendar, Plus, Trash2, AlertCircle, CheckCircle2,
  Building2, ArrowRight, Info, ShieldAlert, Sparkles, Hammer,
  Check, AlertTriangle, Clock, Coins, Percent
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency, formatDate } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

export interface PropertyInvestment {
  id: string;
  propertyId?: string;
  title: string;
  description?: string | null;
  amount: number;
  amountNet?: number | null;
  date: string;
  craftsman?: string | null;
  category: string;
  isCapitalized: boolean;
  relevantFor15Percent: boolean;
  createdAt?: string;
  updatedAt?: string;
  property?: {
    id: string;
    name: string;
    address: string;
    purchasePrice?: number | null;
    purchasedAt?: string | null;
    possessionAt?: string | null;
    buildingSharePercent?: number | null;
  };
}

export interface PropertyInvestmentsDialogProps {
  property: {
    id: string;
    name: string;
    address?: string;
    purchasePrice?: number | null;
    purchasedAt?: string | null;
    possessionAt?: string | null;
    buildingSharePercent?: number | null;
    investments?: PropertyInvestment[];
  };
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onRefresh?: () => void;
}

export const INVESTMENT_CATEGORIES: Record<
  string,
  { label: string; icon: string; badge: string }
> = {
  HEIZUNG: {
    label: "Heizung & Therme",
    icon: "🔥",
    badge: "bg-orange-500/10 text-orange-700 dark:text-orange-300 border-orange-500/30",
  },
  BAD: {
    label: "Badsanierung",
    icon: "🛁",
    badge: "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30",
  },
  FENSTER: {
    label: "Fenster & Türen",
    icon: "🪟",
    badge: "bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 border-cyan-500/30",
  },
  BODEN: {
    label: "Böden & Fliesen",
    icon: "🪵",
    badge: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30",
  },
  ELEKTRIK: {
    label: "Elektrik & Installation",
    icon: "⚡",
    badge: "bg-yellow-500/10 text-yellow-700 dark:text-yellow-300 border-yellow-500/30",
  },
  DACH: {
    label: "Dach & Fassade",
    icon: "🏠",
    badge: "bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/30",
  },
  SANIERUNG: {
    label: "Komplett-/Teilsanierung",
    icon: "🔨",
    badge: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
  },
  SONSTIGES: {
    label: "Sonstige Investition",
    icon: "📦",
    badge: "bg-muted text-muted-foreground border-border",
  },
};

export function PropertyInvestmentsDialog({
  property,
  trigger,
  open: controlledOpen,
  onOpenChange: setControlledOpen,
  onRefresh,
}: PropertyInvestmentsDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = isControlled ? setControlledOpen || (() => {}) : setInternalOpen;

  const [investments, setInvestments] = useState<PropertyInvestment[]>(
    property.investments || []
  );
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);

  // Form State
  const today = new Date().toISOString().split("T")[0];
  const [form, setForm] = useState({
    title: "",
    category: "SANIERUNG",
    amount: "",
    amountNet: "",
    date: today,
    craftsman: "",
    description: "",
    isCapitalized: true,
    relevantFor15Percent: true,
  });

  // Fetch investments when dialog opens
  useEffect(() => {
    if (open) {
      fetchInvestments();
    }
  }, [open, property.id]);

  const fetchInvestments = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/investments?propertyId=${property.id}`);
      if (res.ok) {
        const data = await res.json();
        setInvestments(data);
      }
    } catch (e) {
      console.error("Fehler beim Laden der Investitionen", e);
    } finally {
      setLoading(false);
    }
  };

  // Auto-calculate Netto from Brutto (Standard 19% USt)
  const handleGrossChange = (val: string) => {
    const gross = parseFloat(val);
    if (!isNaN(gross) && gross > 0) {
      const net = Math.round((gross / 1.19) * 100) / 100;
      setForm((prev) => ({
        ...prev,
        amount: val,
        amountNet: net.toString(),
      }));
    } else {
      setForm((prev) => ({
        ...prev,
        amount: val,
        amountNet: "",
      }));
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title || !form.amount) {
      toast({
        title: "Pflichtfelder fehlen",
        description: "Bitte Bezeichnung und Betrag angeben.",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/investments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          propertyId: property.id,
          title: form.title,
          category: form.category,
          amount: parseFloat(form.amount),
          amountNet: form.amountNet ? parseFloat(form.amountNet) : undefined,
          date: form.date,
          craftsman: form.craftsman || null,
          description: form.description || null,
          isCapitalized: form.isCapitalized,
          relevantFor15Percent: form.relevantFor15Percent,
        }),
      });

      if (res.ok) {
        toast({
          title: "Investition erfasst!",
          description: `"${form.title}" wurde erfolgreich gespeichert.`,
        });
        setForm({
          title: "",
          category: "SANIERUNG",
          amount: "",
          amountNet: "",
          date: today,
          craftsman: "",
          description: "",
          isCapitalized: true,
          relevantFor15Percent: true,
        });
        setShowAddForm(false);
        fetchInvestments();
        if (onRefresh) onRefresh();
      } else {
        const err = await res.json();
        toast({
          title: "Fehler beim Speichern",
          description: err.error || "Investition konnte nicht angelegt werden.",
          variant: "destructive",
        });
      }
    } catch (e: any) {
      toast({
        title: "Netzwerkfehler",
        description: e?.message || "Fehler beim Speichern",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, title: string) => {
    setDeletingId(id);
    try {
      const res = await fetch(`/api/investments/${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        toast({
          title: "Investition gelöscht",
          description: `"${title}" wurde entfernt.`,
        });
        fetchInvestments();
        if (onRefresh) onRefresh();
      } else {
        toast({
          title: "Fehler beim Löschen",
          variant: "destructive",
        });
      }
    } catch (e) {
      toast({
        title: "Fehler beim Löschen",
        variant: "destructive",
      });
    } finally {
      setDeletingId(null);
    }
  };

  // ─── 15%-Grenzen Berechnung (§ 6 Abs. 1 Nr. 1a EStG) ────────────────────────
  const monitoring = useMemo(() => {
    const purchasePrice = property.purchasePrice || 0;
    const sharePercent = property.buildingSharePercent ?? 80;
    const buildingValue = purchasePrice * (sharePercent / 100);
    const limit15 = buildingValue * 0.15;

    const acqDate = property.possessionAt || property.purchasedAt;
    let deadlineEnd: Date | null = null;
    let isExpired = false;
    let daysRemaining = 0;
    let monthsRemaining = 0;

    const now = new Date();
    if (acqDate) {
      deadlineEnd = new Date(acqDate);
      deadlineEnd.setFullYear(deadlineEnd.getFullYear() + 3);
      isExpired = now > deadlineEnd;
      daysRemaining = Math.max(
        0,
        Math.ceil((deadlineEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      );
      monthsRemaining = Math.max(0, Math.ceil(daysRemaining / 30.4));
    }

    // Investitionen im 3-Jahres-Zeitraum, die für die 15%-Grenze zählen
    const relevantInvestments = investments.filter((inv) => {
      if (!inv.relevantFor15Percent) return false;
      if (!acqDate || !deadlineEnd) return true;
      const d = new Date(inv.date);
      return d >= new Date(acqDate) && d <= deadlineEnd;
    });

    const totalSpentNet = relevantInvestments.reduce((sum, inv) => {
      const net =
        inv.amountNet != null
          ? inv.amountNet
          : Math.round((inv.amount / 1.19) * 100) / 100;
      return sum + net;
    }, 0);

    const totalSpentGross = relevantInvestments.reduce(
      (sum, inv) => sum + inv.amount,
      0
    );

    const remainingBuffer = limit15 - totalSpentNet;
    const usedPercent = limit15 > 0 ? (totalSpentNet / limit15) * 100 : 0;

    // Total capitalized across all time for asset valuation
    const totalCapitalized = investments
      .filter((i) => i.isCapitalized)
      .reduce((sum, i) => sum + i.amount, 0);

    let status: "OK" | "WARNING" | "EXCEEDED" | "EXPIRED" = "OK";
    if (isExpired) status = "EXPIRED";
    else if (totalSpentNet > limit15 && limit15 > 0) status = "EXCEEDED";
    else if (usedPercent >= 80 && limit15 > 0) status = "WARNING";

    return {
      purchasePrice,
      sharePercent,
      buildingValue,
      limit15,
      acqDate,
      deadlineEnd,
      isExpired,
      daysRemaining,
      monthsRemaining,
      totalSpentNet,
      totalSpentGross,
      remainingBuffer,
      usedPercent,
      totalCapitalized,
      status,
      count: relevantInvestments.length,
    };
  }, [property, investments]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
                <Hammer className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-lg">
                  Investitionen & Sanierungen: {property.name}
                </DialogTitle>
                <DialogDescription className="text-xs">
                  Erfassen Sie Renovierungen, Bäder, Heizung & prüfen Sie die 15%-Grenze (§ 6 EStG)
                </DialogDescription>
              </div>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 pt-1">
          {/* ─── 15%-Grenzen Monitor Card ────────────────────────────────────── */}
          <div className="rounded-xl border border-border/70 bg-gradient-to-br from-card to-secondary/30 p-4 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/50 pb-2.5">
              <div className="flex items-center gap-2">
                <ShieldAlert
                  className={`h-5 w-5 ${
                    monitoring.status === "EXCEEDED"
                      ? "text-rose-500"
                      : monitoring.status === "WARNING"
                      ? "text-amber-500"
                      : monitoring.status === "EXPIRED"
                      ? "text-muted-foreground"
                      : "text-emerald-500"
                  }`}
                />
                <div>
                  <h4 className="font-semibold text-sm text-foreground flex items-center gap-2">
                    15%-Grenzen Monitor (§ 6 Abs. 1 Nr. 1a EStG)
                    {monitoring.status === "EXPIRED" && (
                      <Badge variant="outline" className="text-[10px] bg-muted/60 text-muted-foreground">
                        3-Jahres-Frist beendet (Sicher)
                      </Badge>
                    )}
                    {monitoring.status === "EXCEEDED" && (
                      <Badge variant="destructive" className="text-[10px]">
                        15% Limit überschritten!
                      </Badge>
                    )}
                    {monitoring.status === "WARNING" && (
                      <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30">
                        Achtung: &gt; 80% verbraucht
                      </Badge>
                    )}
                    {monitoring.status === "OK" && monitoring.acqDate && (
                      <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30">
                        Im sicheren Bereich
                      </Badge>
                    )}
                  </h4>
                  <p className="text-[11px] text-muted-foreground">
                    Anschaffungsnahe Herstellungskosten (max. 15% des Netto-Gebäudewerts innerhalb von 3 Jahren)
                  </p>
                </div>
              </div>

              {monitoring.deadlineEnd && (
                <div className="text-right text-xs">
                  <span className="text-muted-foreground block text-[11px]">3-Jahres-Frist bis:</span>
                  <span className="font-mono font-semibold text-foreground">
                    {formatDate(monitoring.deadlineEnd)}
                  </span>
                  {!monitoring.isExpired ? (
                    <span className="block text-[10px] text-primary">
                      noch ca. {monitoring.monthsRemaining} Monate ({monitoring.daysRemaining} Tage)
                    </span>
                  ) : (
                    <span className="block text-[10px] text-muted-foreground">
                      Frist abgelaufen
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* 4 KPIs: Gebäudewert, 15%-Budget, Bisher investiert, Verbleibender Puffer */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div className="bg-secondary/40 p-2.5 rounded-lg border border-border/40">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium block">
                  Gebäudewert ({monitoring.sharePercent}%)
                </span>
                <span className="text-sm font-bold font-mono text-foreground mt-0.5 block">
                  {monitoring.purchasePrice > 0 ? formatCurrency(monitoring.buildingValue) : "Kein Kaufpreis"}
                </span>
                <span className="text-[10px] text-muted-foreground">
                  Bodenanteil: {100 - monitoring.sharePercent}%
                </span>
              </div>

              <div className="bg-secondary/40 p-2.5 rounded-lg border border-border/40">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium block">
                  15%-Budget (Netto)
                </span>
                <span className="text-sm font-bold font-mono text-primary mt-0.5 block">
                  {monitoring.purchasePrice > 0 ? formatCurrency(monitoring.limit15) : "–"}
                </span>
                <span className="text-[10px] text-muted-foreground">Max. Sofortabzug</span>
              </div>

              <div className="bg-secondary/40 p-2.5 rounded-lg border border-border/40">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium block">
                  Bisher investiert (Netto)
                </span>
                <span
                  className={`text-sm font-bold font-mono mt-0.5 block ${
                    monitoring.status === "EXCEEDED"
                      ? "text-rose-500"
                      : monitoring.status === "WARNING"
                      ? "text-amber-500"
                      : "text-foreground"
                  }`}
                >
                  {formatCurrency(monitoring.totalSpentNet)}
                </span>
                <span className="text-[10px] text-muted-foreground">
                  {monitoring.count} relevante Rechnung{monitoring.count === 1 ? "" : "en"}
                </span>
              </div>

              <div
                className={`p-2.5 rounded-lg border ${
                  monitoring.remainingBuffer < 0
                    ? "bg-rose-500/10 border-rose-500/20"
                    : monitoring.remainingBuffer < monitoring.limit15 * 0.2
                    ? "bg-amber-500/10 border-amber-500/20"
                    : "bg-emerald-500/10 border-emerald-500/20"
                }`}
              >
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium block">
                  Verbleibender Puffer
                </span>
                <span
                  className={`text-sm font-bold font-mono mt-0.5 block ${
                    monitoring.remainingBuffer < 0
                      ? "text-rose-600 dark:text-rose-400"
                      : monitoring.remainingBuffer < monitoring.limit15 * 0.2
                      ? "text-amber-600 dark:text-amber-400"
                      : "text-emerald-600 dark:text-emerald-400"
                  }`}
                >
                  {monitoring.purchasePrice > 0 ? formatCurrency(monitoring.remainingBuffer) : "–"}
                </span>
                <span className="text-[10px] text-muted-foreground">
                  {monitoring.limit15 > 0 ? `${monitoring.usedPercent.toFixed(1)}% ausgeschöpft` : "–"}
                </span>
              </div>
            </div>

            {/* Auslastungsbalken */}
            {monitoring.limit15 > 0 && (
              <div className="space-y-1 pt-1">
                <div className="flex justify-between text-[11px] text-muted-foreground">
                  <span>Auslastung des 15%-Budgets:</span>
                  <span className="font-mono font-semibold text-foreground">
                    {monitoring.usedPercent.toFixed(1)}%
                  </span>
                </div>
                <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-500 ${
                      monitoring.status === "EXCEEDED"
                        ? "bg-rose-500"
                        : monitoring.status === "WARNING"
                        ? "bg-amber-500"
                        : "bg-emerald-500"
                    }`}
                    style={{ width: `${Math.min(100, monitoring.usedPercent)}%` }}
                  />
                </div>
              </div>
            )}

            {/* Warnmeldung falls überschritten */}
            {monitoring.status === "EXCEEDED" && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-lg text-xs text-rose-600 dark:text-rose-300 flex items-start gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <div>
                  <strong>Achtung (§ 6 Abs. 1 Nr. 1a EStG Aktivierungsgefahr):</strong> Die 15%-Grenze wurde um{" "}
                  <strong className="font-mono">{formatCurrency(Math.abs(monitoring.remainingBuffer))}</strong> überschritten!
                  Sämtliche Sanierungskosten dieser 3 Jahre können nach Ansicht des Finanzamts nicht mehr sofort als Erhaltungsaufwand (Werbungskosten) abgezogen werden, sondern müssen aktiviert und linear über 50 Jahre abgeschrieben werden.
                </div>
              </div>
            )}
          </div>

          {/* ─── Investition erfassen Formular (aufklappbar) ─────────────────── */}
          <div className="border border-border rounded-xl p-3 bg-card space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-foreground flex items-center gap-1.5">
                <Hammer className="h-3.5 w-3.5 text-primary" />
                Alle erfassten Investitionen ({investments.length})
              </h4>
              <Button
                size="sm"
                variant={showAddForm ? "secondary" : "default"}
                className="gap-1.5 h-7 text-xs"
                onClick={() => setShowAddForm(!showAddForm)}
              >
                {showAddForm ? "Formular schließen" : <><Plus className="h-3.5 w-3.5" /> Investition erfassen</>}
              </Button>
            </div>

            {showAddForm && (
              <form onSubmit={handleCreate} className="space-y-3 p-3 bg-secondary/30 rounded-xl border border-border/60 animate-fade-in text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Bezeichnung / Maßnahme *</Label>
                    <Input
                      placeholder="z.B. Neues Badezimmer, Brennwerttherme"
                      value={form.title}
                      onChange={(e) => setForm({ ...form, title: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Kategorie</Label>
                    <Select
                      value={form.category}
                      onValueChange={(v) => setForm({ ...form, category: v })}
                    >
                      <SelectTrigger className="h-9 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(INVESTMENT_CATEGORIES).map(([catKey, cat]) => (
                          <SelectItem key={catKey} value={catKey} className="text-xs">
                            <span className="mr-1.5">{cat.icon}</span> {cat.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Rechnungsbetrag Brutto (€) *</Label>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="z.B. 11900.00"
                      value={form.amount}
                      onChange={(e) => handleGrossChange(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">
                      Rechnungsbetrag Netto (€) <span className="text-[10px] text-muted-foreground">(15%-Basis)</span>
                    </Label>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="z.B. 10000.00"
                      value={form.amountNet}
                      onChange={(e) => setForm({ ...form, amountNet: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Rechnungsdatum *</Label>
                    <Input
                      type="date"
                      value={form.date}
                      onChange={(e) => setForm({ ...form, date: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Handwerker / Fachbetrieb</Label>
                    <Input
                      placeholder="z.B. Sanitär Meier GmbH"
                      value={form.craftsman}
                      onChange={(e) => setForm({ ...form, craftsman: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Notizen / Beschreibung</Label>
                    <Input
                      placeholder="z.B. Erneuerung aller Zuleitungen & Fliesen"
                      value={form.description}
                      onChange={(e) => setForm({ ...form, description: e.target.value })}
                    />
                  </div>
                </div>

                {/* Checkboxen für Vermögen & 15%-Grenze */}
                <div className="pt-2 border-t border-border/50 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className="flex items-start gap-2 cursor-pointer p-2 rounded-lg bg-background border border-border/60 hover:bg-secondary/40 transition-colors">
                    <input
                      type="checkbox"
                      checked={form.isCapitalized}
                      onChange={(e) => setForm({ ...form, isCapitalized: e.target.checked })}
                      className="mt-0.5 h-4 w-4 rounded border-input text-primary cursor-pointer"
                    />
                    <div>
                      <span className="font-semibold text-foreground text-xs block">
                        Wertsteigernd / Vermögen
                      </span>
                      <span className="text-[10px] text-muted-foreground block">
                        Erhöht den Sachwert der Immobilie in der Vermögensbilanz & Portfolioübersicht
                      </span>
                    </div>
                  </label>

                  <label className="flex items-start gap-2 cursor-pointer p-2 rounded-lg bg-background border border-border/60 hover:bg-secondary/40 transition-colors">
                    <input
                      type="checkbox"
                      checked={form.relevantFor15Percent}
                      onChange={(e) => setForm({ ...form, relevantFor15Percent: e.target.checked })}
                      className="mt-0.5 h-4 w-4 rounded border-input text-primary cursor-pointer"
                    />
                    <div>
                      <span className="font-semibold text-foreground text-xs block">
                        Zählt zur 15%-Grenze (§ 6 EStG)
                      </span>
                      <span className="text-[10px] text-muted-foreground block">
                        Wird im 3-Jahres-Monitor auf das Netto-Budget angerechnet
                      </span>
                    </div>
                  </label>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowAddForm(false)}
                  >
                    Abbrechen
                  </Button>
                  <Button type="submit" size="sm" disabled={saving}>
                    {saving ? "Wird gespeichert..." : "Investition speichern"}
                  </Button>
                </div>
              </form>
            )}

            {/* ─── Liste der Investitionen ────────────────────────────────────── */}
            {loading ? (
              <div className="text-center py-6 text-muted-foreground text-xs">
                Lade Investitionen...
              </div>
            ) : investments.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground border border-dashed rounded-lg space-y-2">
                <p className="text-xs">Bisher keine Investitionen oder Sanierungen für diese Wohnung erfasst.</p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowAddForm(true)}
                  className="gap-1 text-xs"
                >
                  <Plus className="h-3 w-3" /> Erste Investition anlegen
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-secondary/40 text-[11px]">
                      <TableHead>Datum</TableHead>
                      <TableHead>Maßnahme & Kategorie</TableHead>
                      <TableHead>Handwerker</TableHead>
                      <TableHead className="text-right">Betrag (Brutto / Netto)</TableHead>
                      <TableHead className="text-center">Eigenschaften</TableHead>
                      <TableHead className="w-12 text-center"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {investments.map((inv) => {
                      const catInfo =
                        INVESTMENT_CATEGORIES[inv.category] ||
                        INVESTMENT_CATEGORIES.SONSTIGES;
                      const net =
                        inv.amountNet != null
                          ? inv.amountNet
                          : Math.round((inv.amount / 1.19) * 100) / 100;

                      return (
                        <TableRow key={inv.id} className="text-xs">
                          <TableCell className="font-mono text-muted-foreground whitespace-nowrap">
                            {formatDate(inv.date)}
                          </TableCell>
                          <TableCell>
                            <div className="font-semibold text-foreground flex items-center gap-1.5">
                              <span>{catInfo.icon}</span>
                              <span>{inv.title}</span>
                            </div>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <Badge
                                variant="outline"
                                className={`text-[9px] px-1.5 py-0 h-4 ${catInfo.badge}`}
                              >
                                {catInfo.label}
                              </Badge>
                              {inv.description && (
                                <span className="text-[10px] text-muted-foreground truncate max-w-[200px]" title={inv.description}>
                                  {inv.description}
                                </span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {inv.craftsman || "–"}
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            <span className="font-bold text-foreground block">
                              {formatCurrency(inv.amount)}
                            </span>
                            <span className="text-[10px] text-muted-foreground block">
                              Netto: {formatCurrency(net)}
                            </span>
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="flex items-center justify-center gap-1 flex-wrap">
                              {inv.isCapitalized && (
                                <Badge variant="secondary" className="text-[9px] px-1.5 py-0 h-4 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30">
                                  Wertsteigernd
                                </Badge>
                              )}
                              {inv.relevantFor15Percent && (
                                <Badge variant="secondary" className="text-[9px] px-1.5 py-0 h-4 bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30">
                                  15%-relevant
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 w-7 p-0 text-muted-foreground hover:text-rose-500"
                              onClick={() => handleDelete(inv.id, inv.title)}
                              disabled={deletingId === inv.id}
                              title="Investition löschen"
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
        </div>
      </DialogContent>
    </Dialog>
  );
}
