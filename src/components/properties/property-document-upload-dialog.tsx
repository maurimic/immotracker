"use client";

import { useState } from "react";
import { Upload } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogTrigger
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { Property } from "./types";

export function PropertyDocumentUploadDialog({
  property,
  onRefresh,
}: {
  property: Property;
  onRefresh: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState("");
  const [type, setType] = useState("LEASE");
  const [uploading, setUploading] = useState(false);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      toast({ title: "Bitte Datei auswählen", variant: "destructive" });
      return;
    }
    setUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("propertyId", property.id);
    fd.append("name", name || file.name);
    fd.append("type", type);

    try {
      const res = await fetch("/api/documents", {
        method: "POST",
        body: fd,
      });
      if (!res.ok) throw new Error("Upload fehlgeschlagen");
      toast({ title: "Dokument hochgeladen", description: `${name || file.name} wurde gespeichert.` });
      setOpen(false);
      setFile(null);
      setName("");
      onRefresh();
    } catch {
      toast({ title: "Fehler beim Upload", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="h-6 px-1.5 text-[11px] gap-1 text-primary hover:text-primary">
          <Upload className="h-3 w-3" /> Hochladen
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Dokument für {property.name} hochladen</DialogTitle>
          <DialogDescription>
            Laden Sie Mietverträge, Übergabeprotokolle, Grundrisse oder Rechnungen hoch (PDF, PNG, JPG).
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleUpload} className="space-y-4 pt-2">
          <div className="space-y-1">
            <Label className="text-xs">Dokumententyp *</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="LEASE">📜 Mietvertrag</SelectItem>
                <SelectItem value="PROTOCOL">📋 Übergabeprotokoll</SelectItem>
                <SelectItem value="FLOORPLAN">📐 Grundriss / Skizze</SelectItem>
                <SelectItem value="INVOICE">🧾 Handwerkerrechnung / Beleg</SelectItem>
                <SelectItem value="OTHER">📄 Sonstiges Dokument</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Bezeichnung (optional)</Label>
            <Input
              placeholder="z.B. Mietvertrag 2026 unterschrieben"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Datei auswählen *</Label>
            <Input
              type="file"
              accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) {
                  setFile(f);
                  if (!name) setName(f.name.replace(/\.[^/.]+$/, ""));
                }
              }}
              required
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" type="button" onClick={() => setOpen(false)}>Abbrechen</Button>
            <Button type="submit" disabled={uploading || !file}>
              {uploading ? "Wird hochgeladen..." : "Hochladen & Speichern"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
