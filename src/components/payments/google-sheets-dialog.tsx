"use client";

import { useState, useEffect } from "react";
import {
  FileSpreadsheet, RefreshCw, CheckCircle2, Smartphone, AlertCircle,
  Building2, ExternalLink, Info
} from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogTrigger
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { formatCurrency, formatRelativeDate } from "@/lib/utils";

export function GoogleSheetsDialog({
  onSyncComplete,
  currentBalance,
}: {
  onSyncComplete: (balance?: any) => void;
  currentBalance?: { amount: number; formattedDate: string } | null;
}) {
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
        const balAmount = data.accountBalance?.amount;
        const balDate = data.accountBalance?.formattedDate;
        const balStr = typeof balAmount === "number" ? formatCurrency(balAmount) : null;

        let title = "Google Sheets synchronisiert";
        let desc = "";

        if (data.balanceUpdated && balStr) {
          if (data.amountChanged) {
            title = "Kontostand & Saldo aktualisiert";
            desc = `Neuer Kontostand: ${balStr} (Stand: ${balDate}). `;
          } else {
            title = "Neuer Kontostand-Stand";
            desc = `Kontostand bestätigt: ${balStr} (Aktualisierter Stand: ${balDate}). `;
          }

          if (data.imported > 0) {
            desc += `${data.imported} neue Bankbuchung(en) importiert.`;
          } else {
            desc += `Keine neuen Bankumsätze (${data.skipped} Buchungen unverändert).`;
          }
        } else if (data.imported > 0) {
          title = "Neue Bankumsätze importiert";
          desc = `${data.imported} neue Buchung(en) importiert (${data.matched} zugeordnet). Kontostand: ${balStr || "–"} (Stand: ${balDate || "–"}).`;
        } else {
          title = "Google Sheets synchronisiert";
          desc = `Alles auf dem neuesten Stand (${balStr || "–"}, Stand: ${balDate || "–"}). Keine neuen Bankumsätze.`;
        }

        toast({
          title,
          description: desc,
        });
        onSyncComplete(data.accountBalance);
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
                {status?.serviceAccountEmail || "Aus Umgebungsvariable"}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground font-sans font-medium block">Google Sheets ID:</span>
              <span className="select-all text-foreground">
                {status?.spreadsheetId || "Aus Umgebungsvariable"}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <div>
                <span className="text-muted-foreground font-sans font-medium block">Umsätze (Tabellenblatt):</span>
                <span className="font-semibold text-foreground">{status?.sheetName || "Kontobewegung"}</span>
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
            <div className="flex justify-between items-center pt-2 border-t border-border/40">
              <div>
                <span className="text-muted-foreground font-sans font-medium block">Kontostand (Tabellenblatt):</span>
                <span className="font-semibold text-foreground">{status?.balanceSheetName || "Kontostand"}</span>
              </div>
              {(currentBalance || status?.latestBalance) && (
                <div className="text-right">
                  <span className="text-muted-foreground font-sans font-medium block">Aktueller Saldo:</span>
                  <span className="font-bold text-blue-600 dark:text-blue-400 font-sans">
                    {formatCurrency(currentBalance?.amount ?? status?.latestBalance?.amount ?? 0)}{" "}
                    <span className="text-[10px] text-muted-foreground font-normal">
                      (Stand: {currentBalance?.formattedDate ?? status?.latestBalance?.formattedDate})
                    </span>
                  </span>
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
            {status?.spreadsheetId ? (
              <a
                href={`https://docs.google.com/spreadsheets/d/${status.spreadsheetId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-primary hover:underline inline-flex items-center gap-1"
              >
                In Google Sheets öffnen <ExternalLink className="h-3 w-3" />
              </a>
            ) : <span />}

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
export function RematchButton({ onRematchComplete }: { onRematchComplete: () => void }) {
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
export function N8nBankSyncButtons({
  currentBalance,
  onSyncComplete,
}: {
  currentBalance?: { amount: number; date: string; formattedDate: string } | null;
  onSyncComplete?: (newBalance?: { amount: number; date: string; formattedDate: string } | null) => void;
}) {
  const [loadingAccount, setLoadingAccount] = useState<"maurizio" | "steven" | null>(null);
  const [autoSyncCountdown, setAutoSyncCountdown] = useState<number | null>(null);
  const [isSyncingSheet, setIsSyncingSheet] = useState(false);
  const [activeAccount, setActiveAccount] = useState<"maurizio" | "steven" | null>(null);

  const executeGoogleSheetsSync = async (account: "maurizio" | "steven" | null, retryCount = 0) => {
    setIsSyncingSheet(true);
    const accountName = account === "maurizio" ? "Maurizio" : account === "steven" ? "Steven" : "Comdirect";
    try {
      const res = await fetch("/api/payments/sync", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        const balAmount = data.accountBalance?.amount;
        const balDate = data.accountBalance?.formattedDate;
        const balStr = typeof balAmount === "number" ? formatCurrency(balAmount) : null;
        const relDate = balDate ? formatRelativeDate(data.accountBalance?.date || balDate) : null;
        const relDateSuffix = relDate ? ` (${relDate})` : "";

        // Prüfen, ob Kontostand oder Datum sich geändert haben
        const dateOrAmountChanged =
          Boolean(data.balanceUpdated) ||
          (balDate && currentBalance?.formattedDate && balDate !== currentBalance.formattedDate) ||
          (typeof balAmount === "number" && currentBalance?.amount !== undefined && balAmount !== currentBalance.amount);

        const todayStr = new Date().toLocaleDateString("de-DE", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
        });
        const isToday = balDate === todayStr;

        if (data.imported > 0) {
          toast({
            title: `Bankbuchungen aktualisiert (${accountName})`,
            description: `${data.imported} neue Buchung(en) aus Google Sheets eingelesen (${data.matched} zugeordnet). Kontostand: ${balStr || "–"} (Stand: ${balDate || "–"}${relDateSuffix}).`,
          });
          if (onSyncComplete) onSyncComplete(data.accountBalance);
          setIsSyncingSheet(false);
          setAutoSyncCountdown(null);
          setActiveAccount(null);
        } else if (dateOrAmountChanged) {
          // Neuer Kontostand / neues Datum im Google Sheet erkannt!
          toast({
            title: `Kontostand aktualisiert (${accountName})`,
            description: `Neuer Kontostand: ${balStr || "–"} (Stand: ${balDate || "–"}${relDateSuffix}). Keine neuen Bankumsätze.`,
          });
          if (onSyncComplete) onSyncComplete(data.accountBalance);
          setIsSyncingSheet(false);
          setAutoSyncCountdown(null);
          setActiveAccount(null);
        } else if (isToday) {
          // Kontostand ist bereits tagesaktuell!
          toast({
            title: `Google Sheet ist aktuell (${accountName})`,
            description: `Kontostand ist tagesaktuell: ${balStr || "–"} (Stand: ${balDate} (heute)). Keine neuen Bankumsätze (${data.skipped || 0} Buchungen synchron).`,
          });
          if (onSyncComplete) onSyncComplete(data.accountBalance);
          setIsSyncingSheet(false);
          setAutoSyncCountdown(null);
          setActiveAccount(null);
        } else if (retryCount < 2) {
          // n8n braucht nach Push-TAN oft 15-30s zum Schreiben ins Sheet.
          // Falls noch weder neue Zeile noch tagesaktueller Kontostand da ist: nach 10s erneut prüfen!
          toast({
            title: `Warte auf Google Sheet (${accountName})...`,
            description: "Noch kein neuer Stand im Sheet eingetroffen. Prüfe automatisch in wenigen Sekunden erneut...",
          });
          setTimeout(() => {
            executeGoogleSheetsSync(account, retryCount + 1);
          }, 10000);
          return;
        } else {
          toast({
            title: `Google Sheet geprüft (${accountName})`,
            description: `Aktueller Stand im Sheet: ${balStr || "–"} (Stand: ${balDate || "–"}${relDateSuffix}). Keine neueren Buchungen gefunden.`,
          });
          if (onSyncComplete) onSyncComplete(data.accountBalance);
          setIsSyncingSheet(false);
          setAutoSyncCountdown(null);
          setActiveAccount(null);
        }
      } else {
        toast({
          title: "Hinweis zum Sheet-Abgleich",
          description: data.error || "Google Sheet konnte nicht automatisch gelesen werden.",
          variant: "destructive",
        });
        setIsSyncingSheet(false);
        setAutoSyncCountdown(null);
        setActiveAccount(null);
      }
    } catch {
      toast({
        title: "Verbindungsfehler",
        description: "Google Sheet Sync konnte nicht abgeschlossen werden.",
        variant: "destructive",
      });
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
    <div className="flex sm:inline-flex w-full sm:w-auto items-center gap-1 p-0.5 rounded-lg border border-border/60 bg-muted/20">
      {/* Button Maurizio - Responsive: flex-1 auf Handy, feste Breite w-[168px] auf PC */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => triggerSync("maurizio")}
        disabled={loadingAccount === "steven" || (activeAccount === "steven" && autoSyncCountdown !== null)}
        className={`h-8 flex-1 sm:flex-initial sm:w-[168px] px-2 sm:px-2.5 gap-1.5 text-xs font-medium transition-colors ${
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
            <span className="whitespace-nowrap truncate font-semibold">{isSyncingSheet ? "Lese Sheet..." : `Sync in ${autoSyncCountdown}s ⚡`}</span>
          </>
        ) : (
          <>
            <Smartphone className={`h-3.5 w-3.5 shrink-0 ${loadingAccount === "maurizio" ? "animate-spin text-amber-500" : "text-amber-600 dark:text-amber-400"}`} />
            <span className="whitespace-nowrap truncate">{loadingAccount === "maurizio" ? "Startet..." : "Comdirect Maurizio"}</span>
          </>
        )}
      </Button>

      <span className="h-4 w-[1px] bg-border/80 shrink-0" />

      {/* Button Steven - Responsive: flex-1 auf Handy, feste Breite w-[168px] auf PC */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => triggerSync("steven")}
        disabled={loadingAccount === "maurizio" || (activeAccount === "maurizio" && autoSyncCountdown !== null)}
        className={`h-8 flex-1 sm:flex-initial sm:w-[168px] px-2 sm:px-2.5 gap-1.5 text-xs font-medium transition-colors ${
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
            <span className="whitespace-nowrap truncate font-semibold">{isSyncingSheet ? "Lese Sheet..." : `Sync in ${autoSyncCountdown}s ⚡`}</span>
          </>
        ) : (
          <>
            <Smartphone className={`h-3.5 w-3.5 shrink-0 ${loadingAccount === "steven" ? "animate-spin text-indigo-500" : "text-indigo-600 dark:text-indigo-400"}`} />
            <span className="whitespace-nowrap truncate">{loadingAccount === "steven" ? "Startet..." : "Comdirect Steven"}</span>
          </>
        )}
      </Button>
    </div>
  );
}

// ─── Überzahlung Prüfen Modal ───────────────────────────────────────────────