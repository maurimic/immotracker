"use client";

import { useEffect, useState, useMemo, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
  RefreshCw, Plus, Check, AlertCircle, Clock,
  Bot, User, Hash, Euro, Calendar, Filter, Upload, FileText,
  Copy, Printer, Send, FileSpreadsheet, Eye, EyeOff, Building2,
  ExternalLink, Info, CheckCircle2, ArrowDownLeft, ArrowUpRight, Search,
  Scale, TrendingUp, Landmark, X, Smartphone
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
import { formatCurrency, formatDate, currentPeriod } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { getRentForPeriod } from "@/lib/rent-history";
import { RentAdjustmentDialog } from "@/components/RentAdjustmentDialog";

interface Tenant {
  id: string;
  firstName: string;
  lastName: string;
  coldRent: number;
  utilities: number;
  iban?: string | null;
  moveInDate?: string | null;
  moveOutDate?: string | null;
  property: {
    id: string;
    name: string;
    address: string;
    possessionAt?: string | null;
    purchasedAt?: string | null;
    rentAdjustments?: any[];
  };
}

interface Payment {
  id: string;
  bookingDate: string;
  amount: number;
  payerName: string;
  payerIban?: string | null;
  reference?: string | null;
  matchMethod?: string | null;
  matchConfidence?: number | null;
  category: string;
  status: string;
  period?: string | null;
  sheetsRowId?: string | null;
  propertyId?: string | null;
  property?: {
    id: string;
    name: string;
    address: string;
  } | null;
  loanId?: string | null;
  loan?: {
    id: string;
    label: string;
    bank?: string | null;
    monthlyPayment: number;
    property?: {
      id: string;
      name: string;
      address: string;
    } | null;
  } | null;
  tenant?: {
    id: string;
    firstName: string;
    lastName: string;
    coldRent?: number;
    utilities?: number;
    property?: {
      id: string;
      name: string;
      address: string;
      rentAdjustments?: any[];
    } | null;
  } | null;
}

interface MonthStatus {
  tenantId: string;
  tenantName: string;
  propertyName: string;
  propertyAddress: string;
  periodMonth?: string;
  soll: number;
  ist: number;
  utilityPaid: number;
  otherPaid: number;
  totalPaid: number;
  paymentDate?: string | null;
  reference?: string | null;
  utilityReference?: string | null;
  status: "PAID" | "OVERPAID" | "PARTIAL" | "OVERDUE" | "PENDING";
  daysOverdue: number;
  tenant: Tenant;
  isAdjusted?: boolean;
  adjustmentNote?: string | null;
}

const METHOD_CONFIG = {
  IBAN: { label: "IBAN", icon: Hash, color: "success" },
  NAME: { label: "Name", icon: User, color: "secondary" },
  AI: { label: "KI", icon: Bot, color: "warning" },
  MANUAL: { label: "Manuell", icon: User, color: "secondary" },
  UNMATCHED: { label: "Unbekannt", icon: AlertCircle, color: "destructive" },
} as const;

const CATEGORY_LABELS: Record<string, { label: string; color: string }> = {
  RENT: { label: "Miete", color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300" },
  UTILITY_IN: { label: "Nebenkosten-Abrechnung", color: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300" },
  LOAN: { label: "Darlehen / Annuität", color: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300" },
  HAUSGELD: { label: "Hausgeld", color: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300" },
  REPAIR: { label: "Baumaterial & Reparatur", color: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300" },
  MAINTENANCE: { label: "Baumaterial & Reparatur", color: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300" },
  OTHER: { label: "Sonstiges/Transfer", color: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300" },
};

const STATUS_COLORS: Record<string, string> = {
  PAID: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 border border-green-200 dark:border-green-800",
  OVERPAID: "bg-amber-100 text-amber-900 dark:bg-amber-900/30 dark:text-amber-300 border border-amber-300 dark:border-amber-700",
  PARTIAL: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400 border border-yellow-200 dark:border-yellow-800",
  OVERDUE: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 border border-red-200 dark:border-red-800",
  PENDING: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400 border border-gray-200 dark:border-gray-700",
  MATCHED: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  MANUAL_REVIEW: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
};

// ─── Google Sheets Verbindungs-Modal & Sync ─────────────────────────────────
function GoogleSheetsDialog({ onSyncComplete }: { onSyncComplete: () => void }) {
  const [open, setOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [status, setStatus] = useState<any>(null);
  const [loadingStatus, setLoadingStatus] = useState(false);

  const fetchStatus = async () => {
    setLoadingStatus(true);
    try {
      const res = await fetch("/api/payments/sync");
      const data = await res.json();
      setStatus(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingStatus(false);
    }
  };

  useEffect(() => {
    if (open) {
      fetchStatus();
    }
  }, [open]);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await fetch("/api/payments/sync", { method: "POST" });
      const data = await res.json();
      setSyncing(false);
      if (res.ok) {
        toast({
          title: "Google Sheets synchronisiert",
          description: `${data.imported} neu importiert, ${data.skipped} bereits vorhanden, ${data.matched} zugeordnet.`,
        });
        onSyncComplete();
        fetchStatus();
      } else {
        toast({ title: "Fehler beim Sync", description: data.error, variant: "destructive" });
      }
    } catch {
      setSyncing(false);
      toast({ title: "Verbindungsfehler", description: "Sync fehlgeschlagen", variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <div className="inline-flex items-center gap-1">
        <Button
          size="sm"
          variant="outline"
          onClick={handleSync}
          disabled={syncing}
          className="gap-1.5 border-emerald-500/40 hover:bg-emerald-500/10 hover:border-emerald-500 transition-colors"
        >
          <FileSpreadsheet className={`h-4 w-4 text-emerald-500 ${syncing ? "animate-spin" : ""}`} />
          <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          {syncing ? "Synchronisiere..." : "Google Sheets Sync"}
        </Button>
        <DialogTrigger asChild>
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            title="Google Sheets Verbindungsinformationen"
          >
            <Info className="h-4 w-4" />
          </Button>
        </DialogTrigger>
      </div>

      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-emerald-500" />
            Google Sheets Bankanbindung
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2 text-sm">
          <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4" /> Verbunden & Lesezugriff aktiv
              </span>
              <Badge variant="outline" className="border-emerald-500/50 text-emerald-600 dark:text-emerald-400 text-xs">
                Live API v4
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Automatischer Bankabgleich über dedizierten Google Service Account mit Schreibschutz.
            </p>
          </div>

          <div className="space-y-2.5 bg-muted/40 p-3.5 rounded-xl text-xs font-mono">
            <div>
              <span className="text-muted-foreground font-sans font-medium block">Service-Account E-Mail:</span>
              <span className="select-all font-semibold text-foreground">
                immobiliendashboard@n8n-self-host-458810.iam.gserviceaccount.com
              </span>
            </div>
            <div>
              <span className="text-muted-foreground font-sans font-medium block">Google Sheets ID:</span>
              <span className="select-all text-foreground">1GslK8LFx_Day6hjEcQnEY_nmX06KuJwRRdqVr1ph8HU</span>
            </div>
            <div className="flex justify-between items-center">
              <div>
                <span className="text-muted-foreground font-sans font-medium block">Tabellenblatt:</span>
                <span className="font-semibold text-foreground">Kontobewegung</span>
              </div>
              {status?.rowCount !== undefined && (
                <div className="text-right">
                  <span className="text-muted-foreground font-sans font-medium block">Zeilen im Sheet:</span>
                  <Badge variant="secondary" className="font-mono text-xs">
                    {status.rowCount} Buchungen
                  </Badge>
                </div>
              )}
            </div>
          </div>

          <div className="text-xs text-muted-foreground space-y-1">
            <p className="font-medium font-sans text-foreground">Gelesene Spaltenstruktur:</p>
            <div className="grid grid-cols-2 gap-1 font-mono p-2 bg-muted/30 rounded-lg">
              <span>• Referenz</span>
              <span>• Datum</span>
              <span>• Betrag</span>
              <span>• Währung</span>
              <span>• Verwendungszweck</span>
              <span>• Zahlungspartner</span>
              <span className="col-span-2">• Umsatzart</span>
            </div>
          </div>

          <div className="flex justify-between items-center pt-2">
            <a
              href="https://docs.google.com/spreadsheets/d/1GslK8LFx_Day6hjEcQnEY_nmX06KuJwRRdqVr1ph8HU"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-primary hover:underline inline-flex items-center gap-1"
            >
              In Google Sheets öffnen <ExternalLink className="h-3 w-3" />
            </a>

            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setOpen(false)}>
                Schließen
              </Button>
              <Button size="sm" onClick={handleSync} disabled={syncing} className="gap-1.5">
                <RefreshCw className={`h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`} />
                Jetzt synchronisieren
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Re-Match Button ────────────────────────────────────────────────────────
function RematchButton({ onRematchComplete }: { onRematchComplete: () => void }) {
  const [rematching, setRematching] = useState(false);

  const handleRematch = async () => {
    setRematching(true);
    try {
      const res = await fetch("/api/payments/rematch", { method: "POST" });
      const data = await res.json();
      setRematching(false);
      if (res.ok) {
        toast({
          title: "Zuordnungen erfolgreich aktualisiert",
          description: `${data.reassigned} Zahlungen korrigiert/neu zugeordnet (${data.totalChecked} geprüft).`,
        });
        onRematchComplete();
      } else {
        toast({
          title: "Fehler beim Re-Match",
          description: data.error || "Konnte Zuordnungen nicht abgleichen",
          variant: "destructive",
        });
      }
    } catch {
      setRematching(false);
      toast({ title: "Verbindungsfehler", description: "Re-Match fehlgeschlagen", variant: "destructive" });
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleRematch}
      disabled={rematching}
      className="gap-1.5 shadow-sm hover:border-primary/50"
      title="Gleicht alle Bankbuchungen erneut gegen die aktuellen Mieter & Wohnungen ab (z.B. nach Neuanlage von Mietern im selben Haus)"
    >
      <RefreshCw className={`h-3.5 w-3.5 ${rematching ? "animate-spin text-primary" : "text-muted-foreground"}`} />
      <span>{rematching ? "Gleiche ab..." : "Zuordnungen neu abgleichen"}</span>
    </Button>
  );
}

// ─── n8n Comdirect Bank-Sync Buttons (Maurizio & Steven) mit Auto-Sync ──────
function N8nBankSyncButtons({ onSyncComplete }: { onSyncComplete?: () => void }) {
  const [loadingAccount, setLoadingAccount] = useState<"maurizio" | "steven" | null>(null);
  const [autoSyncCountdown, setAutoSyncCountdown] = useState<number | null>(null);
  const [isSyncingSheet, setIsSyncingSheet] = useState(false);
  const [activeAccount, setActiveAccount] = useState<"maurizio" | "steven" | null>(null);

  const executeGoogleSheetsSync = async (account: "maurizio" | "steven" | null) => {
    setIsSyncingSheet(true);
    const accountName = account === "maurizio" ? "Maurizio" : account === "steven" ? "Steven" : "Comdirect";
    try {
      const res = await fetch("/api/payments/sync", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        if (data.imported > 0) {
          toast({
            title: `Bankbuchungen aktualisiert (${accountName})`,
            description: `${data.imported} neue Buchung(en) aus Google Sheets eingelesen (${data.matched} automatisch zugeordnet).`,
          });
        } else {
          toast({
            title: `Google Sheet geprüft (${accountName})`,
            description: "Es lagen noch keine neuen Zeilen vor. Falls die TAN verzögert freigegeben wurde, einfach auf 'Google Sheets Sync' klicken.",
          });
        }
        if (onSyncComplete) onSyncComplete();
      } else {
        toast({
          title: "Hinweis zum Sheet-Abgleich",
          description: data.error || "Google Sheet konnte nicht automatisch gelesen werden.",
          variant: "destructive",
        });
      }
    } catch {
      toast({
        title: "Verbindungsfehler",
        description: "Google Sheet Sync konnte nicht abgeschlossen werden.",
        variant: "destructive",
      });
    } finally {
      setIsSyncingSheet(false);
      setAutoSyncCountdown(null);
      setActiveAccount(null);
    }
  };

  useEffect(() => {
    if (autoSyncCountdown === null) return;
    if (autoSyncCountdown > 0) {
      const timer = setTimeout(() => {
        setAutoSyncCountdown((prev) => (prev !== null ? prev - 1 : null));
      }, 1000);
      return () => clearTimeout(timer);
    }
    // Countdown abgelaufen (0): Vollautomatischer Import aus Google Sheets nach 10s!
    executeGoogleSheetsSync(activeAccount);
  }, [autoSyncCountdown, activeAccount]);

  const triggerSync = async (account: "maurizio" | "steven") => {
    // Wenn dieser Account gerade im Countdown läuft, Sofort-Sync auslösen:
    if (activeAccount === account && autoSyncCountdown !== null) {
      executeGoogleSheetsSync(account);
      return;
    }

    setLoadingAccount(account);
    const name = account === "maurizio" ? "Maurizio" : "Steven";
    try {
      const res = await fetch("/api/bank-sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ account }),
      });
      const data = await res.json();
      if (data.success) {
        toast({
          title: `Comdirect-Abruf gestartet (${name})`,
          description: "Bitte Push-TAN auf dem Smartphone freigeben! Google Sheet wird in 10s automatisch eingelesen.",
        });
        setActiveAccount(account);
        setAutoSyncCountdown(10);
      } else {
        toast({
          title: `Fehler beim Starten (${name})`,
          description: data.error || "Konnte den n8n-Workflow nicht anstoßen.",
          variant: "destructive",
        });
      }
    } catch {
      toast({
        title: "Verbindungsfehler",
        description: `Konnte den Workflow für ${name} nicht anstoßen.`,
        variant: "destructive",
      });
    } finally {
      setLoadingAccount(null);
    }
  };

  return (
    <div className="inline-flex items-center gap-1 p-0.5 rounded-lg border border-border/60 bg-muted/20 shrink-0">
      {/* Button Maurizio - Feste Breite w-36 verhindert jegliches Verschieben benachbarter Buttons */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => triggerSync("maurizio")}
        disabled={loadingAccount === "steven" || (activeAccount === "steven" && autoSyncCountdown !== null)}
        className={`h-8 w-36 px-2 gap-1.5 text-xs font-medium transition-colors ${
          activeAccount === "maurizio" && autoSyncCountdown !== null
            ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/25 border border-emerald-500/30"
            : "hover:bg-amber-500/10 hover:text-amber-700 dark:hover:text-amber-400 text-foreground"
        }`}
        title={
          activeAccount === "maurizio" && autoSyncCountdown !== null
            ? "TAN bereits freigegeben? Klicken für Sofort-Sync!"
            : "Startet n8n-Workflow für Maurizio (Push-TAN in der Comdirect-App freigeben)"
        }
      >
        {activeAccount === "maurizio" && autoSyncCountdown !== null ? (
          <>
            <RefreshCw className="h-3.5 w-3.5 animate-spin text-emerald-500 shrink-0" />
            <span className="truncate font-semibold">{isSyncingSheet ? "Lese Sheet..." : `Sync in ${autoSyncCountdown}s ⚡`}</span>
          </>
        ) : (
          <>
            <Smartphone className={`h-3.5 w-3.5 shrink-0 ${loadingAccount === "maurizio" ? "animate-spin text-amber-500" : "text-amber-600 dark:text-amber-400"}`} />
            <span className="truncate">{loadingAccount === "maurizio" ? "Startet..." : "Comdirect Maurizio"}</span>
          </>
        )}
      </Button>

      <span className="h-4 w-[1px] bg-border/80" />

      {/* Button Steven - Feste Breite w-36 verhindert jegliches Verschieben benachbarter Buttons */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => triggerSync("steven")}
        disabled={loadingAccount === "maurizio" || (activeAccount === "maurizio" && autoSyncCountdown !== null)}
        className={`h-8 w-36 px-2 gap-1.5 text-xs font-medium transition-colors ${
          activeAccount === "steven" && autoSyncCountdown !== null
            ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/25 border border-emerald-500/30"
            : "hover:bg-indigo-500/10 hover:text-indigo-700 dark:hover:text-indigo-400 text-foreground"
        }`}
        title={
          activeAccount === "steven" && autoSyncCountdown !== null
            ? "TAN bereits freigegeben? Klicken für Sofort-Sync!"
            : "Startet n8n-Workflow für Steven (Push-TAN in der Comdirect-App freigeben)"
        }
      >
        {activeAccount === "steven" && autoSyncCountdown !== null ? (
          <>
            <RefreshCw className="h-3.5 w-3.5 animate-spin text-emerald-500 shrink-0" />
            <span className="truncate font-semibold">{isSyncingSheet ? "Lese Sheet..." : `Sync in ${autoSyncCountdown}s ⚡`}</span>
          </>
        ) : (
          <>
            <Smartphone className={`h-3.5 w-3.5 shrink-0 ${loadingAccount === "steven" ? "animate-spin text-indigo-500" : "text-indigo-600 dark:text-indigo-400"}`} />
            <span className="truncate">{loadingAccount === "steven" ? "Startet..." : "Comdirect Steven"}</span>
          </>
        )}
      </Button>
    </div>
  );
}

// ─── Überzahlung Prüfen Modal ───────────────────────────────────────────────
function OverpaymentDialog({ status }: { status: MonthStatus }) {
  const [open, setOpen] = useState(false);
  const surplus = status.ist - status.soll;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs gap-1.5 border-amber-500/40 text-amber-700 dark:text-amber-400 hover:bg-amber-500/10 hover:border-amber-500 shadow-sm"
        >
          <AlertCircle className="h-3.5 w-3.5 text-amber-500" />
          Überzahlung prüfen
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
            <AlertCircle className="h-5 w-5 text-amber-500" />
            Überzahlung überprüfen: {status.tenantName}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2 text-sm">
          <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl space-y-1.5 text-xs">
            <p className="font-semibold text-amber-800 dark:text-amber-300">
              Mieteingang übersteigt die Soll-Warmmiete um +{formatCurrency(surplus)}!
            </p>
            <p className="text-muted-foreground">
              Der Mieter hat mehr überwiesen als vertraglich vereinbart. Bitte überprüfen Sie, woraus sich dieser Betrag zusammensetzt.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-2 p-3 bg-muted/40 rounded-xl text-xs">
            <div>
              <span className="text-muted-foreground">Soll-Warmmiete:</span>
              <p className="font-semibold text-foreground">{formatCurrency(status.soll)}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Tatsächlich gezahlt:</span>
              <p className="font-semibold text-foreground">{formatCurrency(status.ist)}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Überzahlung:</span>
              <p className="font-bold text-amber-600 dark:text-amber-400">+{formatCurrency(surplus)}</p>
            </div>
          </div>

          <div className="space-y-1.5 bg-muted/20 p-3 rounded-xl text-xs">
            <div><span className="font-semibold text-foreground">Wohnung:</span> {status.propertyName}</div>
            {status.propertyAddress && (
              <div className="text-muted-foreground">{status.propertyAddress}</div>
            )}
            <div><span className="font-semibold text-foreground">Eingangsdatum:</span> {status.paymentDate ? formatDate(status.paymentDate) : "–"}</div>
            {status.reference && (
              <div className="mt-2 pt-2 border-t border-border/50">
                <span className="font-semibold text-foreground block mb-0.5">Verwendungszweck (Bank):</span>
                <p className="font-mono text-[11px] text-muted-foreground bg-background p-2 rounded border break-all">
                  {status.reference}
                </p>
              </div>
            )}
          </div>

          <div className="space-y-1.5 text-xs text-muted-foreground">
            <p className="font-semibold text-foreground">Mögliche Ursachen & Prüfungsschritte:</p>
            <ul className="list-disc pl-4 space-y-1">
              <li><strong>Kaution oder Nebenkostennachzahlung:</strong> Beinhaltet die Überweisung eine Kautionsrate oder Nebenkosten?</li>
              <li><strong>Doppelzahlung:</strong> Hat der Mieter versehentlich für zwei Monate überwiesen?</li>
              <li><strong>Mietanpassung:</strong> Wurde eine Mieterhöhung überwiesen, die im System noch nicht angepasst ist?</li>
            </ul>
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

// ─── CSV-Upload Dialog ───────────────────────────────────────────────────────
function CsvUploadDialog({ onUploaded }: { onUploaded: () => void }) {
  const [open, setOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [csvText, setCsvText] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    setCsvText(text);
  };

  const submitCsv = async () => {
    if (!csvText.trim()) {
      toast({ title: "Keine Daten", description: "Bitte CSV-Datei auswählen oder Text einfügen", variant: "destructive" });
      return;
    }

    setUploading(true);
    try {
      const res = await fetch("/api/payments/csv-upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csvText }),
      });
      const data = await res.json();
      setUploading(false);

      if (res.ok) {
        toast({
          title: "CSV-Import erfolgreich",
          description: `${data.importedCount} Buchungen importiert (${data.matchedCount} automatisch zugeordnet).`,
        });
        setOpen(false);
        setCsvText("");
        onUploaded();
      } else {
        toast({ title: "Fehler beim Import", description: data.error, variant: "destructive" });
      }
    } catch {
      setUploading(false);
      toast({ title: "Verbindungsfehler", description: "Konnte CSV nicht importieren.", variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Upload className="h-4 w-4" />
          CSV importieren
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5 text-primary" />
            Bank-Kontoauszug importieren (CSV)
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <p className="text-sm text-muted-foreground">
            Unterstützt Sparkasse, DKB, Volksbank, ING, Deutsche Bank und Standard-Bank-CSVs.
          </p>

          <div
            className="border-2 border-dashed border-input rounded-xl p-6 text-center hover:bg-muted/50 transition-colors cursor-pointer"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm font-medium">Klicken zum Auswählen einer CSV-Datei</p>
            <p className="text-xs text-muted-foreground mt-1">.csv (max. 10 MB)</p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={handleFileUpload}
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Oder CSV-Text direkt einfügen:</Label>
            <Textarea
              placeholder="Buchungstag;Name;Verwendungszweck;Betrag;IBAN&#10;03.10.2026;Anna Müller;Miete Oktober;1030.00;DE89..."
              className="font-mono text-xs h-32"
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setOpen(false)}>Abbrechen</Button>
            <Button onClick={submitCsv} disabled={uploading}>
              {uploading ? (
                <><RefreshCw className="h-4 w-4 animate-spin mr-2" /> Importiere...</>
              ) : (
                "Jetzt importieren & abgleichen"
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Mahnwesen & Zahlungserinnerung Modal ─────────────────────────────────────
function MahnungDialog({ status, period }: { status: MonthStatus; period: string }) {
  const [open, setOpen] = useState(false);
  const [level, setLevel] = useState<"STUFE_1" | "STUFE_2" | "STUFE_3">("STUFE_1");
  const overdueAmount = Math.max(0, status.soll - status.ist);

  const getDueDate = (days: number) => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
  };

  const periodName =
    period && period !== "ALL"
      ? new Date(`${period}-01`).toLocaleDateString("de-DE", { month: "long", year: "numeric" })
      : "aktuellen Monat";

  const letterTemplates = {
    STUFE_1: {
      title: "Freundliche Zahlungserinnerung",
      subject: `Zahlungserinnerung: Mietzahlung für ${periodName} – ${status.propertyName}`,
      body: `Sehr geehrte(r) ${status.tenantName},

bei Durchsicht unserer Zahlungseingänge für den Monat ${periodName} haben wir festgestellt, dass die Miete für Ihre Wohnung (${status.propertyName}, ${status.propertyAddress}) bisher nicht oder nur unvollständig eingegangen ist.

Vereinbarte Gesamtmiete: ${formatCurrency(status.soll)}
Bisher eingegangen:      ${formatCurrency(status.ist)}
-----------------------------------------------
Noch offener Betrag:     ${formatCurrency(overdueAmount)}

Verzugsdauer: ca. ${status.daysOverdue} Tage

Sicherlich handelt es sich hierbei nur um ein Versehen. Wir bitten Sie höflich, den offenen Betrag bis spätestens zum ${getDueDate(7)} auf das bekannte Mietkonto zu überweisen.

Sollte sich Ihre Zahlung mit diesem Schreiben überschnitten haben, betrachten Sie diese Erinnerung bitte als gegenstandslos.

Mit freundlichen Grüßen,
Ihre Hausverwaltung / Vermieter`,
    },
    STUFE_2: {
      title: "1. Mahnung (Fristsetzung)",
      subject: `1. Mahnung: Ausstehende Mietzahlung für ${periodName} – ${status.propertyName}`,
      body: `Sehr geehrte(r) ${status.tenantName},

trotz unserer Zahlungserinnerung konnten wir bis heute keinen vollständigen Eingang der Miete für den Monat ${periodName} feststellen.

Wohnung:             ${status.propertyName} (${status.propertyAddress})
Rückstand:           ${formatCurrency(overdueAmount)}
Verzugsdauer:        ${status.daysOverdue} Tage

Wir fordern Sie hiermit auf, den offenen Betrag in Höhe von ${formatCurrency(overdueAmount)} bis spätestens zum:

>>> ${getDueDate(7)} <<<

auf das im Mietvertrag angegebene Konto zu überweisen. Nach Ablauf dieser Frist behalten wir uns vor, Verzugszinsen sowie Mahngebühren geltend zu machen.

Mit freundlichen Grüßen,
Ihre Hausverwaltung / Vermieter`,
    },
    STUFE_3: {
      title: "2. Mahnung / Kündigungsandrohung (§ 543 BGB)",
      subject: `LETZTE MAHNUNG / KÜNDIGUNGSANDROHUNG: Mietrückstand ${periodName} – ${status.propertyName}`,
      body: `Sehr geehrte(r) ${status.tenantName},

trotz mehrfacher Aufforderung befindet sich die Mietzahlung für ${status.propertyName} weiterhin im Zahlungsverzug.

Offener Gesamtbetrag: ${formatCurrency(overdueAmount)}
Tage im Verzug:       ${status.daysOverdue} Tage

Wir setzen Ihnen hiermit eine letzte Frist zur Begleichung des Rückstands bis zum:

>>> ${getDueDate(5)} <<<

auf das angegebene Konto.

Wir weisen ausdrücklich darauf hin, dass gem. § 543 Abs. 2 Nr. 3 BGB bei fortgesetztem Zahlungsverzug oder zwei aufeinanderfolgenden unvollständigen Mietzahlungen das Mietverhältnis fristlos gekündigt werden kann.

Sollte bis zum Fristablauf kein Zahlungseingang vorliegen, werden wir unverzüglich rechtliche Schritte einleiten.

Mit freundlichen Grüßen,
Ihre Hausverwaltung / Vermieter`,
    },
  };

  const currentTemplate = letterTemplates[level];

  const copyToClipboard = () => {
    navigator.clipboard.writeText(`${currentTemplate.subject}\n\n${currentTemplate.body}`);
    toast({ title: "Kopiert!", description: "Mahnschreiben in die Zwischenablage kopiert." });
  };

  const printLetter = () => {
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`
      <html>
        <head>
          <title>${currentTemplate.title}</title>
          <style>
            body { font-family: sans-serif; padding: 40px; line-height: 1.6; color: #111; }
            h2 { font-size: 18px; border-bottom: 2px solid #333; padding-bottom: 8px; margin-bottom: 24px; }
            pre { white-space: pre-wrap; font-family: inherit; font-size: 14px; }
          </style>
        </head>
        <body>
          <h2>${currentTemplate.title}</h2>
          <pre>${currentTemplate.body}</pre>
          <script>window.print();</script>
        </body>
      </html>
    `);
    win.document.close();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="destructive" size="sm" className="h-7 text-xs gap-1.5 shadow-sm">
          <FileText className="h-3.5 w-3.5" />
          Mahnung / Erinnerung
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-destructive" />
              Mahnwesen: {status.tenantName}
            </span>
            <Badge variant="outline" className="text-xs">
              {status.daysOverdue} Tage Verzug
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Details */}
          <div className="grid grid-cols-3 gap-3 p-3 bg-secondary/50 rounded-xl text-xs">
            <div>
              <span className="text-muted-foreground">Wohnung:</span>
              <p className="font-semibold text-sm">{status.propertyName}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Soll-Miete:</span>
              <p className="font-semibold text-sm">{formatCurrency(status.soll)}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Offener Betrag:</span>
              <p className="font-bold text-sm text-destructive">{formatCurrency(overdueAmount)}</p>
            </div>
          </div>

          {/* Stufen-Auswahl */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Mahnstufe wählen:</Label>
            <div className="grid grid-cols-3 gap-2">
              <Button
                variant={level === "STUFE_1" ? "default" : "outline"}
                size="sm"
                className="text-xs"
                onClick={() => setLevel("STUFE_1")}
              >
                1. Zahlungserinnerung
              </Button>
              <Button
                variant={level === "STUFE_2" ? "default" : "outline"}
                size="sm"
                className="text-xs"
                onClick={() => setLevel("STUFE_2")}
              >
                2. Erste Mahnung
              </Button>
              <Button
                variant={level === "STUFE_3" ? "destructive" : "outline"}
                size="sm"
                className="text-xs"
                onClick={() => setLevel("STUFE_3")}
              >
                3. Letzte Mahnung (§ 543)
              </Button>
            </div>
          </div>

          {/* Betreff */}
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Betreff:</Label>
            <Input value={currentTemplate.subject} readOnly className="font-semibold text-xs bg-muted/30" />
          </div>

          {/* Brieftext */}
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Schreiben-Vorschau:</Label>
            <Textarea
              value={currentTemplate.body}
              readOnly
              className="font-mono text-xs h-64 bg-muted/20 leading-relaxed"
            />
          </div>

          {/* Aktionen */}
          <div className="flex justify-between items-center pt-2">
            <span className="text-xs text-muted-foreground">Berechnet nach Fälligkeit zum 3. Werktag</span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={copyToClipboard} className="gap-1.5">
                <Copy className="h-4 w-4" /> Text kopieren
              </Button>
              <Button variant="default" size="sm" onClick={printLetter} className="gap-1.5">
                <Printer className="h-4 w-4" /> Drucken / PDF
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Buchung manuell bearbeiten & zuordnen Modal ──────────────────────────────
function EditPaymentDialog({
  payment,
  tenants,
  properties,
  loans,
  onUpdated,
}: {
  payment: Payment;
  tenants: Tenant[];
  properties: Array<{ id: string; name: string; address: string }>;
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
          period: selectedPeriod.trim() || null,
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
              <span className="font-semibold text-right max-w-[260px] truncate">{payment.payerName || "–"}</span>
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
                    {t.firstName} {t.lastName} ({t.property?.name || "Wohnung"})
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
                {properties.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name} ({p.address})
                  </SelectItem>
                ))}
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
              placeholder="z.B. 2026-03"
              value={selectedPeriod}
              onChange={(e) => setSelectedPeriod(e.target.value)}
              className="h-9 text-xs font-mono"
            />
            <p className="text-[10px] text-muted-foreground">
              Format: YYYY-MM (z.B. 2026-03 für März 2026). Wenn ein Mieter am 27.02. die Miete für März überweist, hier <strong>2026-03</strong> eintragen.
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

// ─── Detaillierter Monatsverlauf je Mieter Modal ────────────────────────────
function TenantMonthlyHistoryDialog({
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
  const tenantPayments = allPayments.filter((p) => p.tenant?.id === tenant.id);

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
function ZahlungenContent() {
  const searchParams = useSearchParams();
  const initialSearch = searchParams.get("search") || "";
  const initialPeriod = searchParams.get("period") || "2026-10";
  const initialTab = searchParams.get("tab") || "status";

  const [allPayments, setAllPayments] = useState<Payment[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [properties, setProperties] = useState<Array<{ id: string; name: string; address: string }>>([]);
  const [loans, setLoans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<string>(initialPeriod); // Standardmäßig auf den aktiven Monat
  const [activeTab, setActiveTab] = useState<string>(initialTab);
  const [showPurpose, setShowPurpose] = useState<boolean>(true); // Bonus: Verwendungszweck ein-/ausblenden
  const [searchQuery, setSearchQuery] = useState(initialSearch);
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [historyTenant, setHistoryTenant] = useState<Tenant | null>(null);

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

  useEffect(() => {
    fetchTenants();
    fetchPayments();
    fetchPropertiesAndLoans();
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
      // Monatsfilter (nach abrechnungsrelevantem Monat)
      if (period !== "ALL") {
        const pPeriod =
          p.period && /^\d{4}-\d{2}$/.test(p.period)
            ? p.period
            : p.bookingDate.slice(0, 7);
        if (pPeriod !== period) return false;
      }

      // Kategorie-Filter
      if (categoryFilter !== "ALL") {
        if (categoryFilter === "REPAIR") {
          if (p.category !== "REPAIR" && p.category !== "MAINTENANCE") return false;
        } else if (p.category !== categoryFilter) {
          return false;
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
        return payerMatch || refMatch || tenantMatch || propMatch || loanMatch || catMatch;
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
      return true;
    });

    return activeTenants.map((t) => {
      const tenantPayments = allPayments.filter((p) => {
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
  const totalIn = useMemo(() => {
    return displayedPayments
      .filter((p) => p.amount > 0)
      .reduce((s, p) => s + p.amount, 0);
  }, [displayedPayments]);

  const totalOut = useMemo(() => {
    return displayedPayments
      .filter((p) => p.amount < 0)
      .reduce((s, p) => s + p.amount, 0);
  }, [displayedPayments]);

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
    <div className="p-6 space-y-6 animate-fade-in">
      {/* Header mit Titel & Aktionen */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight">Zahlungsströme & Bankabgleich</h1>
            <Badge variant="outline" className="border-emerald-500/40 text-emerald-600 dark:text-emerald-400 text-xs gap-1 py-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Google Sheets Live
            </Badge>
          </div>
          <p className="text-muted-foreground text-sm mt-0.5">
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
            <SelectTrigger className="w-44 h-9">
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
          <N8nBankSyncButtons onSyncComplete={() => { fetchPayments(); fetchTenants(); }} />

          {/* Zuordnungen neu abgleichen (Re-Match) */}
          <RematchButton onRematchComplete={() => { fetchPayments(); fetchTenants(); }} />

          {/* Google Sheets Sync & Status */}
          <GoogleSheetsDialog onSyncComplete={fetchPayments} />

          {/* Optionaler manueller CSV Import */}
          <CsvUploadDialog onUploaded={fetchPayments} />
        </div>
      </div>

      {/* KPI Cards: Geldeingänge, Geldausgänge, Balance, Buchungen, Handlungsbedarf */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {/* 1. Geldeingänge */}
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
        <div className="flex flex-wrap items-center justify-between gap-3">
          <TabsList className="grid grid-cols-2 w-[480px] max-w-full h-10 p-1">
            <TabsTrigger value="status" className="px-3 text-xs sm:text-sm font-medium whitespace-nowrap">
              Mieteingangsstatus ({displayedMonthStatus.length})
            </TabsTrigger>
            <TabsTrigger value="buchungen" className="px-3 text-xs sm:text-sm font-medium whitespace-nowrap">
              Bankumsätze ({displayedPayments.length})
            </TabsTrigger>
          </TabsList>

          {/* Universelle Suche & Filter für beide Tabs (Mieteingangsstatus & Bankumsätze) */}
          <div className="flex items-center gap-2">
            <div className="relative w-56 md:w-80">
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
                    <SelectTrigger className="w-44 h-8 text-xs">
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

                          const propName =
                            tenant?.property?.name ||
                            payment.property?.name ||
                            payment.loan?.property?.name ||
                            matchedLoan?.property?.name;

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
                          }

                          return (
                            <TableRow key={payment.id} className="hover:bg-muted/50 transition-colors">
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
                                    {resolvedRent?.isAdjusted && (
                                      <div className="text-[10px] text-blue-600 dark:text-blue-400 font-normal" title={resolvedRent.adjustmentNote || ""}>
                                        Historischer Soll
                                      </div>
                                    )}
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
                                  <span className="text-indigo-700 dark:text-indigo-300 italic text-[11px]">Hausgeld</span>
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
                                    +{formatCurrency(payment.amount)} (NK)
                                  </span>
                                ) : (
                                  <span className="text-muted-foreground">–</span>
                                )}
                              </TableCell>

                              {/* 8. Kategorie & Matching */}
                              <TableCell>
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
                              </TableCell>

                              {/* 9. Mieter / Zuordnung */}
                              <TableCell className="text-sm">
                                {tenant ? (
                                  <span className="font-medium text-foreground">
                                    {tenant.firstName} {tenant.lastName}
                                  </span>
                                ) : payment.loan || matchedLoan ? (
                                  <div className="flex items-center gap-1 font-medium text-purple-700 dark:text-purple-300 text-xs">
                                    <Landmark className="h-3 w-3 shrink-0" />
                                    <span>{(payment.loan || matchedLoan)?.bank || (payment.loan || matchedLoan)?.label}</span>
                                  </div>
                                ) : payment.property ? (
                                  <div className="flex items-center gap-1 font-medium text-muted-foreground text-xs">
                                    <Building2 className="h-3 w-3 shrink-0" />
                                    <span>{payment.property.name}</span>
                                  </div>
                                ) : (
                                  <span className="text-muted-foreground text-xs italic">
                                    Nicht zugeordnet
                                  </span>
                                )}
                              </TableCell>

                              {/* 10. Aktion */}
                              <TableCell className="text-right">
                                <EditPaymentDialog
                                  payment={payment}
                                  tenants={tenants}
                                  properties={properties}
                                  loans={loans}
                                  onUpdated={fetchPayments}
                                />
                              </TableCell>
                            </TableRow>
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
