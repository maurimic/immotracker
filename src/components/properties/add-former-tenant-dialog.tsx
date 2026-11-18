"use client";

import { useState } from "react";
import { History, Calendar } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogTrigger
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { DateInput } from "@/components/ui/date-input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { Property } from "./types";

export function AddFormerTenantDialog({
  property,
  onRefresh,
  trigger,
}: {
  property: Property;
  onRefresh: () => void;
  trigger?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    iban: "",
    coldRent: "",
    utilities: "",
    deposit: "",
    depositPaid: true,
    moveInDate: "",
    moveOutDate: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const res = await fetch("/api/tenants", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        propertyId: property.id,
        isCurrent: false,
        ...form,
        coldRent: parseFloat(form.coldRent || "0"),
        utilities: parseFloat(form.utilities || "0"),
        deposit: parseFloat(form.deposit || "0"),
        contractStart: form.moveInDate || null,
        moveInDate: form.moveInDate || null,
        moveOutDate: form.moveOutDate || null,
      }),
    });
    setSaving(false);
    if (res.ok) {
      toast({ title: `Vormieter für ${property.name} erfolgreich angelegt!` });
      setOpen(false);
      onRefresh();
    } else {
      const err = await res.json();
      toast({
        title: "Fehler beim Anlegen des Vormieters",
        description: err.error || "Bitte Eingaben prüfen",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button size="sm" variant="outline" className="h-7 text-xs gap-1 border-dashed text-muted-foreground hover:text-foreground">
            <History className="h-3 w-3 text-amber-500" /> + Vormieter erfassen
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-5 w-5 text-amber-500" />
            Vormieter erfassen für {property.name}
          </DialogTitle>
          <DialogDescription className="text-xs">
            Erfassen Sie einen ehemaligen Mieter, um historische Mietzahlungen und Bankbuchungen automatisch zuzuordnen und auszuwerten.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Vorname *</Label>
              <Input
                placeholder="Max"
                value={form.firstName}
                onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                required
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Nachname *</Label>
              <Input
                placeholder="Mustermann"
                value={form.lastName}
                onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex justify-between items-center">
              <Label className="text-xs">IBAN (für automatische Überweisungs-Zuordnung)</Label>
              <span className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold">Sehr empfohlen</span>
            </div>
            <Input
              className="font-mono text-xs uppercase"
              placeholder="DE89 3704 0044 0532 0130 00"
              value={form.iban}
              onChange={(e) => setForm({ ...form, iban: e.target.value })}
            />
            <p className="text-[11px] text-muted-foreground">
              Wird genutzt, um historische Bankbuchungen automatisch mit diesem Vormieter und dieser Wohnung zu verknüpfen.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Damalige Kaltmiete (€/Monat) *</Label>
              <Input
                type="number"
                step="0.01"
                placeholder="650.00"
                value={form.coldRent}
                onChange={(e) => setForm({ ...form, coldRent: e.target.value })}
                required
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">NK-Vorauszahlung (€/Monat) *</Label>
              <Input
                type="number"
                step="0.01"
                placeholder="130.00"
                value={form.utilities}
                onChange={(e) => setForm({ ...form, utilities: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Mietbeginn / Einzug</Label>
              <DateInput
                value={form.moveInDate}
                onChange={(e) => setForm({ ...form, moveInDate: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Mietende / Auszug</Label>
              <DateInput
                value={form.moveOutDate}
                onChange={(e) => setForm({ ...form, moveOutDate: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">E-Mail (optional)</Label>
              <Input
                type="email"
                placeholder="max@beispiel.de"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Telefon (optional)</Label>
              <Input
                placeholder="+49 170 1234567"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3">
            <Button variant="outline" type="button" onClick={() => setOpen(false)}>
              Abbrechen
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Wird gespeichert..." : "Vormieter anlegen"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
