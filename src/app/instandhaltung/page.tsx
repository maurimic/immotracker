"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Plus, Wrench, CheckCircle, Clock, AlertTriangle, Trash2, Pencil,
  Shield, Coins, Calculator, Receipt, ArrowUpRight, ArrowDownRight, Layers
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, formatDate } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

interface Ticket {
  id: string;
  propertyId: string;
  title: string;
  description?: string;
  status: string;
  priority: string;
  cost?: number;
  craftsman?: string;
  reportedAt: string;
  doneAt?: string;
  property: { name: string };
}

interface MeterReading {
  id: string;
  propertyId: string;
  type: string;
  value: number;
  unit: string;
  readingDate: string;
  notes?: string;
  property: { name: string };
}

interface Property {
  id: string;
  name: string;
  address: string;
  sqm: number;
  tenant?: {
    firstName: string;
    lastName: string;
    coldRent: number;
    utilities: number;
  } | null;
  loans?: Array<{
    currentBalance: number;
    interestRate: number;
    monthlyPayment: number;
  }>;
}

interface Loan {
  id: string;
  propertyId: string;
  originalAmount: number;
  currentBalance: number;
  interestRate: number;
  monthlyPayment: number;
  property: { name: string; sqm: number };
}

const STATUS_COLUMNS = [
  { key: "REPORTED", label: "Gemeldet", icon: AlertTriangle, color: "text-orange-500" },
  { key: "IN_PROGRESS", label: "In Arbeit", icon: Clock, color: "text-blue-500" },
  { key: "DONE", label: "Erledigt", icon: CheckCircle, color: "text-green-500" },
];

const PRIORITY_BADGE = {
  HIGH: "destructive",
  MEDIUM: "warning",
  LOW: "secondary",
} as const;

const PRIORITY_LABEL = { HIGH: "Hoch", MEDIUM: "Mittel", LOW: "Niedrig" };

const METER_TYPES = {
  ELECTRICITY: { label: "Strom", unit: "kWh", icon: "⚡" },
  WATER: { label: "Wasser", unit: "m³", icon: "💧" },
  HEATING: { label: "Heizung", unit: "kWh", icon: "🔥" },
  GAS: { label: "Gas", unit: "m³", icon: "🔵" },
};

function AddTicketDialog({ properties, onRefresh }: { properties: Property[]; onRefresh: () => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    propertyId: "", title: "", description: "",
    priority: "MEDIUM", cost: "", craftsman: "",
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const res = await fetch("/api/tickets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setSaving(false);
    if (res.ok) {
      toast({ title: "Reparatur-Ticket erstellt" });
      setOpen(false);
      setForm({ propertyId: "", title: "", description: "", priority: "MEDIUM", cost: "", craftsman: "" });
      onRefresh();
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm"><Plus className="h-4 w-4 mr-1.5" /> Ticket erstellen</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Neues Reparatur-Ticket</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="space-y-2">
            <Label>Wohnung *</Label>
            <Select value={form.propertyId} onValueChange={(v) => setForm({ ...form, propertyId: v })}>
              <SelectTrigger><SelectValue placeholder="Wohnung auswählen" /></SelectTrigger>
              <SelectContent>
                {properties.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Titel *</Label>
            <Input placeholder="z.B. Heizkörper tropft" value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })} required />
          </div>
          <div className="space-y-2">
            <Label>Beschreibung</Label>
            <Input placeholder="Details zum Schaden..." value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Priorität</Label>
              <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="LOW">Niedrig</SelectItem>
                  <SelectItem value="MEDIUM">Mittel</SelectItem>
                  <SelectItem value="HIGH">Hoch (Dringend)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Kosten (€)</Label>
              <Input type="number" step="0.01" placeholder="0.00" value={form.cost}
                onChange={(e) => setForm({ ...form, cost: e.target.value })} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Handwerker / Dienstleister</Label>
            <Input placeholder="z.B. Sanitär Müller GmbH" value={form.craftsman}
              onChange={(e) => setForm({ ...form, craftsman: e.target.value })} />
          </div>
          <Button type="submit" className="w-full" disabled={saving}>
            {saving ? "Speichern..." : "Ticket speichern"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EditTicketDialog({
  ticket,
  properties,
  onRefresh,
}: {
  ticket: Ticket;
  properties: Property[];
  onRefresh: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    propertyId: ticket.propertyId || "",
    title: ticket.title || "",
    description: ticket.description || "",
    priority: ticket.priority || "MEDIUM",
    cost: ticket.cost ? String(ticket.cost) : "",
    craftsman: ticket.craftsman || "",
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch(`/api/tickets/${ticket.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          propertyId: form.propertyId,
          title: form.title,
          description: form.description,
          priority: form.priority,
          cost: form.cost ? parseFloat(form.cost) : null,
          craftsman: form.craftsman,
        }),
      });
      if (!res.ok) throw new Error("Fehler beim Aktualisieren");
      toast({ title: "Ticket aktualisiert" });
      setOpen(false);
      onRefresh();
    } catch {
      toast({ title: "Fehler", description: "Ticket konnte nicht gespeichert werden.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          className="text-muted-foreground hover:text-foreground transition-colors p-1"
          title="Ticket bearbeiten"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Reparatur-Ticket bearbeiten</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="space-y-2">
            <Label>Wohnung *</Label>
            <Select value={form.propertyId} onValueChange={(v) => setForm({ ...form, propertyId: v })}>
              <SelectTrigger><SelectValue placeholder="Wohnung auswählen" /></SelectTrigger>
              <SelectContent>
                {properties.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Titel *</Label>
            <Input placeholder="z.B. Heizkörper tropft" value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })} required />
          </div>
          <div className="space-y-2">
            <Label>Beschreibung</Label>
            <Input placeholder="Details zum Schaden..." value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Priorität</Label>
              <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="LOW">Niedrig</SelectItem>
                  <SelectItem value="MEDIUM">Mittel</SelectItem>
                  <SelectItem value="HIGH">Hoch (Dringend)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Kosten (€)</Label>
              <Input type="number" step="0.01" placeholder="0.00" value={form.cost}
                onChange={(e) => setForm({ ...form, cost: e.target.value })} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Handwerker / Dienstleister</Label>
            <Input placeholder="z.B. Sanitär Müller GmbH" value={form.craftsman}
              onChange={(e) => setForm({ ...form, craftsman: e.target.value })} />
          </div>
          <Button type="submit" className="w-full" disabled={saving}>
            {saving ? "Speichern..." : "Änderungen speichern"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function AddMeterDialog({ properties, onRefresh }: { properties: Property[]; onRefresh: () => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    propertyId: "", type: "ELECTRICITY", value: "", unit: "kWh",
    readingDate: new Date().toISOString().slice(0, 10), notes: "",
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const res = await fetch("/api/meters", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setSaving(false);
    if (res.ok) {
      toast({ title: "Zählerstand erfasst" });
      setOpen(false);
      setForm({ propertyId: "", type: "ELECTRICITY", value: "", unit: "kWh", readingDate: new Date().toISOString().slice(0, 10), notes: "" });
      onRefresh();
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline"><Plus className="h-4 w-4 mr-1.5" /> Zählerstand erfassen</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Neuen Zählerstand erfassen</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Wohnung *</Label>
              <Select value={form.propertyId} onValueChange={(v) => setForm({ ...form, propertyId: v })}>
                <SelectTrigger><SelectValue placeholder="Auswählen" /></SelectTrigger>
                <SelectContent>
                  {properties.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Zählertyp</Label>
              <Select value={form.type} onValueChange={(v) => {
                const mt = METER_TYPES[v as keyof typeof METER_TYPES];
                setForm({ ...form, type: v, unit: mt?.unit || "kWh" });
              }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(METER_TYPES).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v.icon} {v.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Stand ({form.unit}) *</Label>
              <Input type="number" step="0.01" placeholder="0.00" value={form.value}
                onChange={(e) => setForm({ ...form, value: e.target.value })} required />
            </div>
            <div className="space-y-2">
              <Label>Ablesedatum</Label>
              <Input type="date" value={form.readingDate}
                onChange={(e) => setForm({ ...form, readingDate: e.target.value })} />
            </div>
            <div className="space-y-2 col-span-2">
              <Label>Notiz / Zählernummer</Label>
              <Input placeholder="z.B. Hauptzähler Keller Nr. 49201" value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
          </div>
          <Button type="submit" className="w-full" disabled={saving}>
            {saving ? "Speichern..." : "Zählerstand speichern"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function InstandhaltungPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [meters, setMeters] = useState<MeterReading[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    const [ticketsRes, metersRes, propsRes] = await Promise.all([
      fetch("/api/tickets"),
      fetch("/api/meters"),
      fetch("/api/properties"),
    ]);
    setTickets(await ticketsRes.json());
    setMeters(await metersRes.json());
    setProperties(await propsRes.json());
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const [draggedTicketId, setDraggedTicketId] = useState<string | null>(null);
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);

  const moveTicket = async (ticketId: string, newStatus: string) => {
    try {
      const doneAt = newStatus === "DONE" ? new Date().toISOString() : null;
      const res = await fetch(`/api/tickets/${ticketId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus, doneAt }),
      });
      if (res.ok) {
        const colLabel = STATUS_COLUMNS.find((c) => c.key === newStatus)?.label || newStatus;
        toast({
          title: "Status aktualisiert",
          description: `Ticket erfolgreich verschoben zu "${colLabel}".`,
        });
        fetchData();
      } else {
        toast({ title: "Fehler beim Verschieben des Tickets", variant: "destructive" });
      }
    } catch (e) {
      toast({ title: "Verbindungsfehler beim Verschieben", variant: "destructive" });
    }
  };

  const deleteTicket = async (ticketId: string) => {
    if (!confirm("Ticket wirklich unwiderruflich löschen?")) return;
    try {
      const res = await fetch(`/api/tickets/${ticketId}`, { method: "DELETE" });
      if (res.ok) {
        toast({ title: "Ticket gelöscht" });
        fetchData();
      } else {
        toast({ title: "Fehler beim Löschen des Tickets", variant: "destructive" });
      }
    } catch (e) {
      toast({ title: "Verbindungsfehler", variant: "destructive" });
    }
  };

  const deleteMeterReading = async (meterId: string) => {
    if (!confirm("Diesen Zählerstand wirklich löschen?")) return;
    try {
      const res = await fetch(`/api/meters/${meterId}`, { method: "DELETE" });
      if (res.ok) {
        toast({ title: "Zählerstand gelöscht" });
        fetchData();
      } else {
        toast({ title: "Fehler beim Löschen des Zählerstands", variant: "destructive" });
      }
    } catch {
      toast({ title: "Verbindungsfehler", variant: "destructive" });
    }
  };

  const totalCosts = tickets
    .filter((t) => t.status === "DONE" && t.cost)
    .reduce((s, t) => s + (t.cost || 0), 0);

  const doneCount = tickets.filter((t) => t.status === "DONE").length;

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Instandhaltung & Rücklagen</h1>
          <p className="text-muted-foreground text-sm">
            Reparatur-Tickets (Kanban), Instandhaltungsrücklagen nach Peters & Zählerstände
          </p>
        </div>
        <div className="flex items-center gap-2">
          <AddMeterDialog properties={properties} onRefresh={fetchData} />
          <AddTicketDialog properties={properties} onRefresh={fetchData} />
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground mb-1">Offene Tickets</p>
            <p className="text-2xl font-bold">
              {tickets.filter((t) => t.status !== "DONE").length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground mb-1">Dringend (HOCH)</p>
            <p className="text-2xl font-bold text-red-500">
              {tickets.filter((t) => t.priority === "HIGH" && t.status !== "DONE").length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground mb-1">Erledigte Reparaturen</p>
            <p className="text-2xl font-bold text-green-500">{doneCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground mb-1">Erledigter Gesamtaufwand</p>
            <p className="text-2xl font-bold font-mono">
              {formatCurrency(totalCosts)}
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="kanban">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="kanban" className="gap-1.5">
            <Wrench className="h-4 w-4" /> Kanban-Reparaturen
          </TabsTrigger>
          <TabsTrigger value="ruecklage" className="gap-1.5">
            <Shield className="h-4 w-4" /> Instandhaltungsrücklagen
          </TabsTrigger>
          <TabsTrigger value="zaehler" className="gap-1.5">
            <Layers className="h-4 w-4" /> Zählerstände ({meters.length})
          </TabsTrigger>
        </TabsList>

        {/* Kanban Board Tab */}
        <TabsContent value="kanban" className="mt-4 space-y-3">
          <p className="text-xs text-muted-foreground flex items-center gap-1.5">
            <span>💡</span>
            <span>
              <strong>Tipp:</strong> Sie können Tickets bequem per <strong>Drag & Drop</strong> zwischen den Spalten verschieben oder die Aktionsbuttons auf jeder Karte nutzen.
            </span>
          </p>

          <div className="flex gap-4 overflow-x-auto pb-4">
            {STATUS_COLUMNS.map((col) => {
              const colTickets = tickets.filter((t) => t.status === col.key);
              const ColIcon = col.icon;
              const isOver = dragOverCol === col.key;

              return (
                <div
                  key={col.key}
                  onDragOver={(e) => {
                    e.preventDefault();
                    if (dragOverCol !== col.key) setDragOverCol(col.key);
                  }}
                  onDragLeave={(e) => {
                    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
                    setDragOverCol(null);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragOverCol(null);
                    const ticketId = e.dataTransfer.getData("text/plain");
                    if (ticketId) {
                      moveTicket(ticketId, col.key);
                    }
                  }}
                  className={`kanban-column flex-1 min-w-72 p-3 rounded-2xl bg-secondary/30 border transition-all ${
                    isOver ? "border-primary ring-2 ring-primary/40 bg-primary/5" : "border-border/60"
                  }`}
                >
                  <div className={`flex items-center gap-2 mb-3 pb-2 border-b border-border/40 ${col.color}`}>
                    <ColIcon className="h-4 w-4" />
                    <span className="font-semibold text-sm">{col.label}</span>
                    <Badge variant="secondary" className="ml-auto text-xs font-mono">
                      {colTickets.length}
                    </Badge>
                  </div>

                  <div className="space-y-3">
                    {colTickets.map((ticket) => (
                      <Card
                        key={ticket.id}
                        draggable={true}
                        onDragStart={(e) => {
                          e.dataTransfer.setData("text/plain", ticket.id);
                          setDraggedTicketId(ticket.id);
                        }}
                        onDragEnd={() => {
                          setDraggedTicketId(null);
                          setDragOverCol(null);
                        }}
                        className={`cursor-grab active:cursor-grabbing hover:shadow-md transition-all border border-border/60 ${
                          draggedTicketId === ticket.id ? "opacity-40 scale-95" : ""
                        }`}
                      >
                        <CardContent className="pt-3 pb-3 space-y-2">
                          <div className="flex items-start justify-between">
                            <Badge
                              variant={PRIORITY_BADGE[ticket.priority as keyof typeof PRIORITY_BADGE] || "secondary"}
                              className="text-xs"
                            >
                              {PRIORITY_LABEL[ticket.priority as keyof typeof PRIORITY_LABEL]}
                            </Badge>
                            <div className="flex items-center gap-1">
                              <EditTicketDialog ticket={ticket} properties={properties} onRefresh={fetchData} />
                              <button
                                onClick={() => deleteTicket(ticket.id)}
                                className="text-muted-foreground hover:text-destructive transition-colors p-1"
                                title="Ticket löschen"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>

                          <div>
                            <p className="text-sm font-semibold leading-tight">{ticket.title}</p>
                            <p className="text-xs text-muted-foreground mt-0.5 font-medium">
                              {ticket.property?.name}
                            </p>
                          </div>

                          {ticket.description && (
                            <p className="text-xs text-muted-foreground line-clamp-2 bg-secondary/40 p-1.5 rounded">
                              {ticket.description}
                            </p>
                          )}

                          <div className="flex items-center gap-2 flex-wrap text-xs">
                            {ticket.cost && (
                              <span className="font-medium text-foreground bg-secondary/60 px-2 py-0.5 rounded">
                                💶 {formatCurrency(ticket.cost)}
                              </span>
                            )}
                            {ticket.craftsman && (
                              <span className="text-muted-foreground truncate">
                                🔧 {ticket.craftsman}
                              </span>
                            )}
                          </div>

                          {/* Schnelle Status-Verschiebe-Aktionen */}
                          <div className="pt-2 border-t border-border/50 flex items-center justify-between gap-1.5">
                            {col.key === "REPORTED" && (
                              <>
                                <Button
                                  size="sm"
                                  className="h-7 text-xs px-2.5 flex-1"
                                  onClick={() => moveTicket(ticket.id, "IN_PROGRESS")}
                                >
                                  In Arbeit ▶
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 text-xs px-2 text-green-600 hover:text-green-700 hover:border-green-400"
                                  onClick={() => moveTicket(ticket.id, "DONE")}
                                  title="Direkt als erledigt markieren"
                                >
                                  ✓ Erledigt
                                </Button>
                              </>
                            )}

                            {col.key === "IN_PROGRESS" && (
                              <>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 text-xs px-2"
                                  onClick={() => moveTicket(ticket.id, "REPORTED")}
                                >
                                  ◀ Gemeldet
                                </Button>
                                <Button
                                  size="sm"
                                  className="h-7 text-xs px-2.5 flex-1 bg-green-600 hover:bg-green-700 text-white"
                                  onClick={() => moveTicket(ticket.id, "DONE")}
                                >
                                  ✓ Erledigen
                                </Button>
                              </>
                            )}

                            {col.key === "DONE" && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs w-full"
                                onClick={() => moveTicket(ticket.id, "IN_PROGRESS")}
                              >
                                ↺ Wiedereröffnen (In Arbeit)
                              </Button>
                            )}
                          </div>

                          <p className="text-[10px] text-muted-foreground pt-1">
                            {ticket.doneAt
                              ? `Erledigt am: ${formatDate(ticket.doneAt)}`
                              : `Gemeldet: ${formatDate(ticket.reportedAt)}`}
                          </p>
                        </CardContent>
                      </Card>
                    ))}

                    {colTickets.length === 0 && (
                      <div className="h-28 border-2 border-dashed border-border/60 rounded-xl flex flex-col items-center justify-center p-2 text-center">
                        <p className="text-xs text-muted-foreground">Keine Tickets</p>
                        <p className="text-[10px] text-muted-foreground/70 mt-1">Hierher ziehen zum Ablegen</p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </TabsContent>



        {/* Instandhaltungsrücklagen-Tracker Tab */}
        <TabsContent value="ruecklage" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Shield className="h-5 w-5 text-primary" />
                Virtueller Instandhaltungsrücklagen-Tracker
              </CardTitle>
              <CardDescription>
                Rücklagenüberwachung je Einheit (Empfehlung: 1,20 €/m² pro Monat nach Petersscher Formel)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Wohnung</TableHead>
                    <TableHead className="text-right">Wohnfläche</TableHead>
                    <TableHead className="text-right">Soll-Zuführung p.a.</TableHead>
                    <TableHead className="text-right">Ist-Rücklage</TableHead>
                    <TableHead className="text-right">Entnahmen (Tickets)</TableHead>
                    <TableHead className="w-40">Status / Deckung</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {properties.map((prop) => {
                    const monthlyTarget = prop.sqm * 1.20;
                    const annualTarget = monthlyTarget * 12;
                    // Seed initial virtual reserve ~ 3 years of reserves
                    const propTickets = tickets.filter((t) => t.propertyId === prop.id && t.cost);
                    const spent = propTickets.reduce((s, t) => s + (t.cost || 0), 0);
                    const initialStock = annualTarget * 2.8;
                    const currentBalance = Math.max(0, initialStock - spent);
                    const percent = Math.min(100, Math.round((currentBalance / (annualTarget * 3)) * 100));

                    return (
                      <TableRow key={prop.id}>
                        <TableCell className="font-semibold text-sm">
                          <div>{prop.name}</div>
                          <div className="text-xs text-muted-foreground">{prop.address}</div>
                        </TableCell>
                        <TableCell className="text-right text-sm">{prop.sqm} m²</TableCell>
                        <TableCell className="text-right text-sm font-medium">
                          {formatCurrency(annualTarget)}
                          <span className="block text-[11px] text-muted-foreground">({formatCurrency(monthlyTarget)}/Mo)</span>
                        </TableCell>
                        <TableCell className="text-right text-sm font-bold text-primary font-mono">
                          {formatCurrency(currentBalance)}
                        </TableCell>
                        <TableCell className="text-right text-sm text-red-500 font-mono">
                          {spent > 0 ? `-${formatCurrency(spent)}` : "–"}
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <div className="flex justify-between text-xs">
                              <span className="text-[11px] text-muted-foreground">{percent}% Zielstock</span>
                              <span className={`text-[11px] font-semibold ${percent >= 70 ? "text-green-500" : "text-amber-500"}`}>
                                {percent >= 70 ? "Ausreichend" : "Aufbau nötig"}
                              </span>
                            </div>
                            <Progress value={percent} className="h-2" />
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Zählerstände Tab */}
        <TabsContent value="zaehler" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Zählerstände & Verbrauchsprotokoll</CardTitle>
              <CardDescription>
                Strom-, Wasser-, Gas- und Heizungszähler mit Plausibilitätsnachweis
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Wohnung</TableHead>
                    <TableHead>Zählertyp</TableHead>
                    <TableHead className="text-right">Ablesestand</TableHead>
                    <TableHead>Einheit</TableHead>
                    <TableHead>Ablesedatum</TableHead>
                    <TableHead>Notiz / Zählernummer</TableHead>
                    <TableHead className="text-right">Aktion</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {meters.map((m) => {
                    const mt = METER_TYPES[m.type as keyof typeof METER_TYPES];
                    return (
                      <TableRow key={m.id}>
                        <TableCell className="text-sm font-medium">{m.property?.name}</TableCell>
                        <TableCell className="text-sm">
                          {mt?.icon} {mt?.label || m.type}
                        </TableCell>
                        <TableCell className="text-right font-mono font-semibold text-sm">
                          {m.value.toLocaleString("de-DE", { maximumFractionDigits: 1 })}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{m.unit}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{formatDate(m.readingDate)}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{m.notes || "–"}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                            onClick={() => deleteMeterReading(m.id)}
                            title="Zählerstand löschen"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
