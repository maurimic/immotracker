"use client";

import { useState } from "react";
import { AlertCircle, Clock, Printer, Copy, FileText, ExternalLink, Check } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogTrigger
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/utils";
import { MonthStatus } from "./types";

export function MahnungDialog({ status, period }: { status: MonthStatus; period: string }) {
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