"use client";

import { useState } from "react";
import { UserPlus, Calendar, CreditCard, Users } from "lucide-react";
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

export function AddTenantDialog({
  property,
  onRefresh,
}: {
  property: Property;
  onRefresh: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const today = new Date().toISOString().split("T")[0];

  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    iban: "",
    coldRent: "",
    utilities: "",
    deposit: "",
    depositPaid: false,
    moveInDate: "",
    contractStart: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const res = await fetch("/api/tenants", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        propertyId: property.id,
        ...form,
        coldRent: parseFloat(form.coldRent || "0"),
        utilities: parseFloat(form.utilities || "0"),
        deposit: parseFloat(form.deposit || "0"),
      }),
    });
    setSaving(false);
    if (res.ok) {
      toast({ title: `Mieter für ${property.name} erfolgreich angelegt!` });
      setOpen(false);
      onRefresh();
    } else {
      const err = await res.json();
      toast({
        title: "Fehler beim Anlegen des Mieters",
        description: err.error || "Bitte Eingaben prüfen",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="w-full gap-1.5 shadow-sm">
          <UserPlus className="h-4 w-4" /> Mieter anlegen / einziehen lassen
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Neuer Mieter für {property.name}
          </DialogTitle>
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

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">E-Mail</Label>
              <Input
                type="email"
                placeholder="max@beispiel.de"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Telefon</Label>
              <Input
                placeholder="+49 170 1234567"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">IBAN (für automatischen Buchungsabgleich)</Label>
            <Input
              className="font-mono text-xs uppercase"
              placeholder="DE89 3704 0044 0532 0130 00"
              value={form.iban}
              onChange={(e) => setForm({ ...form, iban: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Soll-Kaltmiete (€/Monat) *</Label>
              <Input
                type="number"
                step="0.01"
                placeholder="750.00"
                value={form.coldRent}
                onChange={(e) => {
                  const val = e.target.value;
                  const num = parseFloat(val);
                  setForm({
                    ...form,
                    coldRent: val,
                    deposit: !form.deposit && !isNaN(num) ? (num * 3).toFixed(2) : form.deposit,
                  });
                }}
                required
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">NK-Vorauszahlung (€/Monat) *</Label>
              <Input
                type="number"
                step="0.01"
                placeholder="150.00"
                value={form.utilities}
                onChange={(e) => setForm({ ...form, utilities: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 items-center">
            <div className="space-y-1">
              <Label className="text-xs">Mietkaution (€)</Label>
              <Input
                type="number"
                step="0.01"
                placeholder="2250.00"
                value={form.deposit}
                onChange={(e) => setForm({ ...form, deposit: e.target.value })}
              />
            </div>
            <div className="flex items-center gap-2 pt-5">
              <input
                type="checkbox"
                id={`add-dep-paid-${property.id}`}
                checked={form.depositPaid}
                onChange={(e) => setForm({ ...form, depositPaid: e.target.checked })}
                className="rounded border-input text-primary h-4 w-4"
              />
              <label htmlFor={`add-dep-paid-${property.id}`} className="text-xs font-medium cursor-pointer">
                Kaution vollständig bezahlt
              </label>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Mietbeginn / Einzug *</Label>
              <DateInput
                value={form.moveInDate}
                onChange={(e) => setForm({ ...form, moveInDate: e.target.value })}
                required
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Vertragsbeginn *</Label>
              <DateInput
                value={form.contractStart}
                onChange={(e) => setForm({ ...form, contractStart: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3">
            <Button variant="outline" type="button" onClick={() => setOpen(false)}>
              Abbrechen
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Wird gespeichert..." : "Mieter anlegen"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
