"use client";

import { useState } from "react";
import { Trash2, AlertTriangle } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogTrigger, DialogFooter
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { Property } from "./types";

export function DeletePropertyDialog({
  property,
  onRefresh,
}: {
  property: Property;
  onRefresh: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    setDeleting(true);
    const res = await fetch(`/api/properties/${property.id}`, {
      method: "DELETE",
    });
    setDeleting(false);
    if (res.ok) {
      toast({ title: `Wohnung '${property.name}' wurde gelöscht` });
      setOpen(false);
      onRefresh();
    } else {
      toast({ title: "Fehler beim Löschen der Wohnung", variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          size="sm"
          variant="ghost"
          className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
          title="Wohnung löschen"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Wohnung wirklich löschen?
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2 text-sm text-muted-foreground">
          <p>
            Sind Sie sicher, dass Sie die Wohnung <strong className="text-foreground">{property.name}</strong> ({property.address}) unwiderruflich löschen möchten?
          </p>
          {property.tenant && (
            <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-xs text-destructive">
              <strong>Achtung:</strong> Der aktive Mieter{" "}
              <strong>{property.tenant.firstName} {property.tenant.lastName}</strong> und alle zugehörigen Daten (Mietvertrag, Kredite, Instandhaltungstickets, Zählerstände) werden ebenfalls entfernt!
            </div>
          )}
          <p className="text-xs">Diese Aktion kann nicht rückgängig gemacht werden.</p>
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => setOpen(false)} disabled={deleting}>
            Abbrechen
          </Button>
          <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
            {deleting ? "Wird gelöscht..." : "Wohnung unwiderruflich löschen"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
