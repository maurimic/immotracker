"use client";

import { useState } from "react";
import { AlertCircle, Calendar, Building2, Info, Check } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogTrigger
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDate } from "@/lib/utils";
import { MonthStatus } from "./types";

export function OverpaymentDialog({ status }: { status: MonthStatus }) {
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