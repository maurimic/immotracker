"use client";

import { useState } from "react";
import { Edit, Calendar, CreditCard, History, Users } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogTrigger
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { DateInput } from "@/components/ui/date-input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { Tenant } from "./types";

export function EditTenantDialog({
  tenant,
  onRefresh,
  trigger,
}: {
  tenant: Tenant;
  onRefresh: () => void;
  trigger?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const isFormer = tenant.isCurrent === false;
  const [form, setForm] = useState({
    firstName: tenant.firstName,
    lastName: tenant.lastName,
    email: tenant.email || "",
    phone: tenant.phone || "",
    iban: tenant.iban || "",
    coldRent: tenant.coldRent.toString(),
    utilities: tenant.utilities.toString(),
    deposit: tenant.deposit.toString(),
    depositPaid: tenant.depositPaid,
    moveInDate: tenant.moveInDate ? tenant.moveInDate.split("T")[0] : "",
    contractStart: tenant.contractStart ? tenant.contractStart.split("T")[0] : "",
    moveOutDate: tenant.moveOutDate ? tenant.moveOutDate.split("T")[0] : "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const res = await fetch(`/api/tenants/${tenant.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        coldRent: parseFloat(form.coldRent),
        utilities: parseFloat(form.utilities),
        deposit: parseFloat(form.deposit),
        moveInDate: form.moveInDate || undefined,
        contractStart: form.contractStart || undefined,
        moveOutDate: form.moveOutDate || null,
      }),
    });
    setSaving(false);
    if (res.ok) {
      toast({ title: isFormer ? "Vormieterdaten erfolgreich aktualisiert" : "Mieterdaten erfolgreich aktualisiert" });
      setOpen(false);
      onRefresh();
    } else {
      toast({ title: "Fehler beim Speichern der Mieterdaten", variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button size="sm" variant="outline" className="h-7 text-xs gap-1">
            <Edit className="h-3 w-3" /> {isFormer ? "Vormieter bearbeiten" : "Mieter bearbeiten"}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isFormer ? (
              <>
                <History className="h-4 w-4 text-amber-500" />
                <span>Vormieterakte: {tenant.firstName} {tenant.lastName}</span>
              </>
            ) : (
              <>
                <Users className="h-4 w-4 text-primary" />
                <span>Mieterakte: {tenant.firstName} {tenant.lastName}</span>
              </>
            )}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3 pt-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Vorname</Label>
              <Input value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} required />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Nachname</Label>
              <Input value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} required />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">E-Mail</Label>
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Telefon</Label>
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">IBAN (für automatischen Buchungsabgleich)</Label>
            <Input className="font-mono text-xs uppercase" value={form.iban} onChange={(e) => setForm({ ...form, iban: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Soll-Kaltmiete (€)</Label>
              <Input type="number" step="0.01" value={form.coldRent} onChange={(e) => setForm({ ...form, coldRent: e.target.value })} required />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">NK-Vorauszahlung (€)</Label>
              <Input type="number" step="0.01" value={form.utilities} onChange={(e) => setForm({ ...form, utilities: e.target.value })} required />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 items-center">
            <div className="space-y-1">
              <Label className="text-xs">Kaution (€)</Label>
              <Input type="number" step="0.01" value={form.deposit} onChange={(e) => setForm({ ...form, deposit: e.target.value })} />
            </div>
            <div className="flex items-center gap-2 pt-4">
              <input
                type="checkbox"
                id={`edit-depositPaid-${tenant.id}`}
                checked={form.depositPaid}
                onChange={(e) => setForm({ ...form, depositPaid: e.target.checked })}
                className="rounded border-input text-primary h-4 w-4"
              />
              <label htmlFor={`edit-depositPaid-${tenant.id}`} className="text-xs font-medium cursor-pointer">
                Kaution bezahlt
              </label>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Einzugsdatum</Label>
              <DateInput value={form.moveInDate} onChange={(e) => setForm({ ...form, moveInDate: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Vertragsbeginn</Label>
              <DateInput value={form.contractStart} onChange={(e) => setForm({ ...form, contractStart: e.target.value })} />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Auszugsdatum (optional, bei Beendigung)</Label>
            <DateInput value={form.moveOutDate} onChange={(e) => setForm({ ...form, moveOutDate: e.target.value })} />
          </div>
          <div className="flex justify-end gap-2 pt-3">
            <Button variant="outline" type="button" onClick={() => setOpen(false)}>Abbrechen</Button>
            <Button type="submit" disabled={saving}>{saving ? "Speichern..." : "Speichern"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
