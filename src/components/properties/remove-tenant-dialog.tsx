"use client";

import { useState } from "react";
import { UserMinus, AlertTriangle, Calendar, Archive, Trash2 } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogTrigger, DialogFooter
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { DateInput } from "@/components/ui/date-input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { Tenant } from "./types";

export function RemoveTenantDialog({
  tenant,
  propertyName,
  onRefresh,
  trigger,
}: {
  tenant: Tenant;
  propertyName: string;
  onRefresh: () => void;
  trigger?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [moveOutDate, setMoveOutDate] = useState(
    tenant.moveOutDate ? tenant.moveOutDate.split("T")[0] : new Date().toISOString().split("T")[0]
  );
  const [confirmHardDelete, setConfirmHardDelete] = useState(false);

  const isFormer = tenant.isCurrent === false;

  const handleArchive = async () => {
    setLoading(true);
    const res = await fetch(
      `/api/tenants/${tenant.id}?action=archive&moveOutDate=${encodeURIComponent(moveOutDate)}`,
      { method: "DELETE" }
    );
    setLoading(false);
    if (res.ok) {
      toast({
        title: `Auszug erfasst: ${tenant.firstName} ${tenant.lastName}`,
        description: `Wohnung '${propertyName}' ist nun als Leerstand markiert. Mieter wurde als Vormieter archiviert.`,
      });
      setOpen(false);
      onRefresh();
    } else {
      toast({ title: "Fehler beim Erfassen des Auszugs", variant: "destructive" });
    }
  };

  const handleHardDelete = async () => {
    setLoading(true);
    const res = await fetch(`/api/tenants/${tenant.id}`, {
      method: "DELETE",
    });
    setLoading(false);
    if (res.ok) {
      toast({
        title: `Mieter ${tenant.firstName} ${tenant.lastName} wurde gelöscht`,
      });
      setOpen(false);
      onRefresh();
    } else {
      toast({ title: "Fehler beim Löschen des Mieters", variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs text-muted-foreground hover:text-destructive hover:border-destructive/40 gap-1"
            title="Mietverhältnis beenden / Mieter entfernen"
          >
            <UserMinus className="h-3 w-3" /> Auszug / Entfernen
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isFormer ? (
              <>
                <Trash2 className="h-5 w-5 text-destructive" />
                <span>Vormieter löschen</span>
              </>
            ) : (
              <>
                <UserMinus className="h-5 w-5 text-amber-500" />
                <span>Mietverhältnis beenden / Auszug</span>
              </>
            )}
          </DialogTitle>
          <DialogDescription className="text-xs">
            {tenant.firstName} {tenant.lastName} – {propertyName}
          </DialogDescription>
        </DialogHeader>

        {isFormer ? (
          <div className="space-y-3 py-2 text-sm text-muted-foreground">
            <p>
              Möchten Sie den Vormieter <strong className="text-foreground">{tenant.firstName} {tenant.lastName}</strong> unwiderruflich aus der Datenbank entfernen?
            </p>
            <p className="text-xs bg-destructive/10 text-destructive p-3 rounded-lg border border-destructive/20">
              ⚠️ Zugeordnete historische Bankzahlungen bleiben erhalten, werden jedoch vom Mieter entkoppelt.
            </p>
            <DialogFooter className="gap-2 sm:gap-0 pt-2">
              <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>
                Abbrechen
              </Button>
              <Button variant="destructive" onClick={handleHardDelete} disabled={loading}>
                {loading ? "Wird gelöscht..." : "Vormieter endgültig löschen"}
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4 py-2">
            {/* Option 1: Archivieren als Vormieter (Empfohlen) */}
            <div className="border border-border/80 bg-secondary/30 rounded-xl p-3.5 space-y-3">
              <div className="flex items-center gap-2">
                <Archive className="h-4 w-4 text-primary shrink-0" />
                <span className="font-semibold text-xs text-foreground">
                  Als Vormieter archivieren (Auszug)
                </span>
                <Badge variant="outline" className="text-[10px] text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/30 px-1 py-0 ml-auto">
                  Empfohlen
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Die Wohnung wird wieder als <strong>Leerstand</strong> geführt. Der Mieter bleibt mit allen Bankbuchungen in der <strong>Mieter-Historie</strong> dieser Wohnung erhalten.
              </p>
              <div className="space-y-1">
                <Label className="text-xs font-medium">Auszugsdatum / Mietvertragsende</Label>
                <DateInput
                  value={moveOutDate}
                  onChange={(e) => setMoveOutDate(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
              <Button
                className="w-full h-8 text-xs gap-1.5 shadow-sm"
                onClick={handleArchive}
                disabled={loading}
              >
                <Archive className="h-3.5 w-3.5" />
                {loading ? "Wird archiviert..." : "Auszug bestätigen & als Vormieter archivieren"}
              </Button>
            </div>

            {/* Option 2: Hard Delete */}
            <div className="pt-1">
              {!confirmHardDelete ? (
                <button
                  type="button"
                  onClick={() => setConfirmHardDelete(true)}
                  className="text-xs text-muted-foreground hover:text-destructive underline flex items-center gap-1 transition-colors"
                >
                  <Trash2 className="h-3 w-3" /> Mieter unwiderruflich löschen (z.B. bei Fehleingabe)...
                </button>
              ) : (
                <div className="border border-destructive/30 bg-destructive/5 rounded-xl p-3 space-y-2 text-xs">
                  <p className="font-semibold text-destructive flex items-center gap-1">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    Mieter komplett aus der Datenbank löschen?
                  </p>
                  <p className="text-muted-foreground">
                    Verwenden Sie dies nur, wenn der Mieter irrtümlich angelegt wurde.
                  </p>
                  <div className="flex gap-2 justify-end pt-1">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => setConfirmHardDelete(false)}
                    >
                      Abbrechen
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={handleHardDelete}
                      disabled={loading}
                    >
                      {loading ? "Wird gelöscht..." : "Endgültig löschen"}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
