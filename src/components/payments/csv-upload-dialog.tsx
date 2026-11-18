"use client";

import { useState, useRef } from "react";
import { Upload, FileText, CheckCircle2, AlertCircle, RefreshCw } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogTrigger
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";

export function CsvUploadDialog({ onUploaded }: { onUploaded: () => void }) {
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