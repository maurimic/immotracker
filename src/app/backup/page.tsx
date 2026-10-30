"use client";

import { useEffect, useState } from "react";
import {
  Download, HardDrive, RefreshCw, CheckCircle, Package, Archive,
  Upload, FileSpreadsheet, AlertTriangle, FileText
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatDate } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

interface Backup {
  name: string;
  size: number;
  created: string;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

function RestoreDatabaseDialog({ onRestored }: { onRestored: () => void }) {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [restoring, setRestoring] = useState(false);

  const handleRestore = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      toast({ title: "Bitte eine .db SQLite-Datei auswählen", variant: "destructive" });
      return;
    }

    setRestoring(true);
    const fd = new FormData();
    fd.append("file", file);

    try {
      const res = await fetch("/api/backup/restore", {
        method: "POST",
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Wiederherstellung fehlgeschlagen");

      toast({
        title: "Datenbank erfolgreich wiederhergestellt",
        description: data.message || "Ihre Daten wurden aus dem Backup importiert.",
      });
      setOpen(false);
      setFile(null);
      onRestored();
      // Reload page to reflect full new DB state across all caches
      setTimeout(() => window.location.reload(), 1000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unbekannter Fehler";
      toast({
        title: "Fehler beim Wiederherstellen",
        description: msg,
        variant: "destructive",
      });
    } finally {
      setRestoring(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2 border-red-500/30 text-red-500 hover:bg-red-500/10">
          <Upload className="h-4 w-4" />
          Datenbank wiederherstellen (.db)
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            SQLite-Datenbank wiederherstellen
          </DialogTitle>
          <DialogDescription>
            Laden Sie eine bestehende <code>.db</code>-Datei hoch, um den aktuellen Datenbestand zu überschreiben.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleRestore} className="space-y-4 pt-2">
          <div className="bg-destructive/10 border border-destructive/30 rounded-xl p-3 text-xs text-destructive space-y-1">
            <p className="font-semibold">⚠️ Wichtiger Hinweis:</p>
            <p>
              Alle aktuellen Daten werden durch das hochgeladene Backup ersetzt. Das System erstellt automatisch vor dem Überschreiben eine Sicherheitskopie der aktuellen Datenbank (.bak).
            </p>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">SQLite-Datei auswählen (.db) *</Label>
            <Input
              type="file"
              accept=".db,.sqlite,.sqlite3"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              required
            />
          </div>

          <DialogFooter className="gap-2 pt-2">
            <Button variant="outline" type="button" onClick={() => setOpen(false)} disabled={restoring}>
              Abbrechen
            </Button>
            <Button variant="destructive" type="submit" disabled={restoring || !file}>
              {restoring ? "Wird wiederhergestellt..." : "Backup jetzt einspielen"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function BackupPage() {
  const [backups, setBackups] = useState<Backup[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  const fetchBackups = async () => {
    const res = await fetch("/api/backup");
    const data = await res.json();
    setBackups(data.backups || []);
    setLoading(false);
  };

  useEffect(() => { fetchBackups(); }, []);

  const createBackup = async () => {
    setCreating(true);
    const res = await fetch("/api/backup", { method: "POST" });
    const data = await res.json();
    setCreating(false);
    if (res.ok) {
      toast({
        title: "Backup erstellt",
        description: `${data.file} (${formatBytes(data.size)})`,
      });
      fetchBackups();
    } else {
      toast({
        title: "Backup fehlgeschlagen",
        description: data.error,
        variant: "destructive",
      });
    }
  };

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Backup, Restore & Rohdaten-Export</h1>
          <p className="text-muted-foreground text-sm">
            100% offline & lokal: Vollständige Datensicherung, Excel-CSVs & Disaster-Recovery
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <RestoreDatabaseDialog onRestored={fetchBackups} />
          <a
            href="/api/backup/database"
            download="immotracker.db"
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-xl border border-input bg-background hover:bg-accent hover:text-accent-foreground shadow-sm transition-colors"
          >
            <HardDrive className="h-4 w-4 text-primary" />
            SQLite-Datei (.db) herunterladen
          </a>
        </div>
      </div>

      {/* CSV / Excel Rohdaten-Export Section */}
      <Card className="border-primary/20 bg-gradient-to-br from-card via-card to-primary/5">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-primary" />
            Tabellen- & Rohdaten-Export (CSV / Microsoft Excel)
          </CardTitle>
          <CardDescription>
            Exportiert strukturierte Rohdaten mit UTF-8-BOM und Semikolon-Trennung für deutsche Tabellenkalkulationen.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <a
              href="/api/export/csv?type=properties"
              download
              className="flex flex-col p-3 rounded-xl border border-border/60 bg-secondary/30 hover:bg-secondary/70 hover:border-primary/40 transition-all text-left group"
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-semibold text-sm group-hover:text-primary transition-colors">Wohnungen & Mieter</span>
                <Download className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
              </div>
              <p className="text-xs text-muted-foreground">Kaufpreise, qm, Mieten, Kautionen & IBAN</p>
            </a>

            <a
              href="/api/export/csv?type=payments"
              download
              className="flex flex-col p-3 rounded-xl border border-border/60 bg-secondary/30 hover:bg-secondary/70 hover:border-primary/40 transition-all text-left group"
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-semibold text-sm group-hover:text-primary transition-colors">Zahlungen & Umsätze</span>
                <Download className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
              </div>
              <p className="text-xs text-muted-foreground">Alle Bankbuchungen, Match-Status & Salden</p>
            </a>

            <a
              href="/api/export/csv?type=loans"
              download
              className="flex flex-col p-3 rounded-xl border border-border/60 bg-secondary/30 hover:bg-secondary/70 hover:border-primary/40 transition-all text-left group"
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-semibold text-sm group-hover:text-primary transition-colors">Darlehen & Kredite</span>
                <Download className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
              </div>
              <p className="text-xs text-muted-foreground">Restschulden, Zinsen, Raten & Zinsbindungsende</p>
            </a>

            <a
              href="/api/export/csv?type=tickets"
              download
              className="flex flex-col p-3 rounded-xl border border-border/60 bg-secondary/30 hover:bg-secondary/70 hover:border-primary/40 transition-all text-left group"
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-semibold text-sm group-hover:text-primary transition-colors">Instandhaltung</span>
                <Download className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
              </div>
              <p className="text-xs text-muted-foreground">Reparatur-Tickets, Kosten & Handwerker</p>
            </a>

            <a
              href="/api/export/csv?type=meters"
              download
              className="flex flex-col p-3 rounded-xl border border-border/60 bg-secondary/30 hover:bg-secondary/70 hover:border-primary/40 transition-all text-left group"
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-semibold text-sm group-hover:text-primary transition-colors">Zählerstände</span>
                <Download className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
              </div>
              <p className="text-xs text-muted-foreground">Strom-, Wasser-, Gas- & Heizungsprotokoll</p>
            </a>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Manueller Backup */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Archive className="h-4 w-4" />
              Manuelles Backup
            </CardTitle>
            <CardDescription>
              Erstellt ein ZIP-Archiv mit Datenbank und allen Uploads
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-secondary/50 rounded-xl p-4 space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span>SQLite Datenbank (/data/immotracker.db)</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span>Hochgeladene Dokumente (/app/public/uploads)</span>
              </div>
            </div>
            <Button className="w-full" onClick={createBackup} disabled={creating}>
              {creating ? (
                <><RefreshCw className="h-4 w-4 animate-spin mr-2" /> Erstelle Backup...</>
              ) : (
                <><Download className="h-4 w-4 mr-2" /> Jetzt Backup erstellen</>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Automatisches Backup */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <HardDrive className="h-4 w-4" />
              Automatisches Backup
            </CardTitle>
            <CardDescription>
              Tägliche automatische Sicherung per Cron-Job
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-secondary/50 rounded-xl p-4 space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span>Container: immotracker-backup</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span>Standard: täglich 02:00 Uhr</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span>Konfigurierbar via BACKUP_CRON .env</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span>Volume: immo-backups gemountet</span>
              </div>
            </div>
            <div className="bg-muted/50 rounded-lg p-3">
              <code className="text-xs font-mono">BACKUP_CRON=0 2 * * *</code>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Backup-Liste */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Vorhandene Backups</CardTitle>
              <CardDescription>Im /backups Volume gespeichert</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={fetchBackups}>
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              {[1, 2].map((i) => <div key={i} className="h-14 skeleton rounded-lg" />)}
            </div>
          ) : backups.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Package className="h-12 w-12 mx-auto mb-3 opacity-40" />
              <p className="text-sm">Noch keine Backups vorhanden.</p>
              <p className="text-xs mt-1">Erstelle das erste manuelle Backup oben.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {backups.map((backup) => (
                <div
                  key={backup.name}
                  className="flex items-center justify-between p-3 bg-secondary/30 rounded-lg hover:bg-secondary/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Archive className="h-4 w-4 text-blue-500 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium font-mono">{backup.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(backup.created, {
                          day: "2-digit",
                          month: "2-digit",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })} · {formatBytes(backup.size)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <a
                      href={`/api/backup/${encodeURIComponent(backup.name)}`}
                      download={backup.name}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                    >
                      <Download className="h-3.5 w-3.5" />
                      Download
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
