"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import {
  MapPin, Building2, Euro, ArrowRight, RefreshCw,
  Home, ExternalLink, Compass, ShieldCheck, Map
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils";

// Leaflet dynamisch ohne SSR laden
const InteractivePropertyMap = dynamic(
  () => import("@/components/properties/interactive-property-map"),
  {
    ssr: false,
    loading: () => (
      <div className="h-[600px] w-full rounded-lg border border-dashed flex flex-col items-center justify-center bg-muted/20 text-muted-foreground gap-3">
        <Map className="h-8 w-8 animate-pulse text-primary" />
        <span className="text-sm font-medium">Interaktive Karte wird initialisiert...</span>
      </div>
    ),
  }
);

export default function KartePage() {
  const [properties, setProperties] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchProperties = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/properties");
      if (res.ok) {
        const data = await res.json();
        setProperties(data);
      }
    } catch (err) {
      console.error("Fehler beim Laden der Immobilien für Karte:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProperties();
  }, []);

  const totalSqm = properties.reduce((s, p) => s + (p.sqm || 0), 0);
  const totalColdRent = properties.reduce((s, p) => s + (p.tenant?.coldRent || 0), 0);
  const totalWarmRent = properties.reduce(
    (s, p) => s + (p.tenant?.coldRent || 0) + (p.tenant?.utilities || 0),
    0
  );

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Kopfbereich */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
            <MapPin className="h-6 w-6 text-primary" />
            Interaktive Portfolio-Karte
          </h1>
          <p className="text-muted-foreground text-xs sm:text-sm">
            Geografische Übersicht aller Standorte, Liegenschaften und Wohneinheiten im Ruhrgebiet.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" asChild className="gap-1.5 h-9 text-xs">
            <Link href="/wohnungen">
              <Building2 className="h-4 w-4" />
              Wohnungs-Akten
            </Link>
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={fetchProperties}
            disabled={loading}
            className="h-9 w-9 p-0 text-muted-foreground"
            title="Aktualisieren"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {/* Hauptkarte */}
      <InteractivePropertyMap properties={properties} />

      {/* Regionale Standort-Übersicht */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
        {/* Essen */}
        <Card className="shadow-sm border-l-4 border-l-blue-500">
          <CardContent className="pt-4 pb-4 space-y-2">
            <div className="flex justify-between items-start">
              <div>
                <strong className="text-base font-bold flex items-center gap-1.5">
                  <MapPin className="h-4 w-4 text-blue-500" /> Essen
                </strong>
                <p className="text-xs text-muted-foreground mt-0.5">Siemensstraße 28, 45143 Essen</p>
              </div>
              <Badge variant="secondary" className="font-mono text-xs">
                2 Liegenschaften
              </Badge>
            </div>

            <div className="pt-2 border-t border-border/50 text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Einheiten:</span>
                <span className="font-semibold text-foreground">EG (WE1) & 2.OG (WE5 + WE6)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Wohnfläche:</span>
                <span className="font-mono font-medium text-foreground">138,00 m²</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Kaltmiete gesamt:</span>
                <strong className="font-mono text-emerald-600 dark:text-emerald-400">1.081,00 €</strong>
              </div>
              <div className="flex justify-between text-blue-600 dark:text-blue-400">
                <span className="font-medium">Warmmiete gesamt:</span>
                <strong className="font-mono">1.841,00 €</strong>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Unna */}
        <Card className="shadow-sm border-l-4 border-l-emerald-500">
          <CardContent className="pt-4 pb-4 space-y-2">
            <div className="flex justify-between items-start">
              <div>
                <strong className="text-base font-bold flex items-center gap-1.5">
                  <MapPin className="h-4 w-4 text-emerald-500" /> Unna
                </strong>
                <p className="text-xs text-muted-foreground mt-0.5">Bockumweg 17a, 59425 Unna</p>
              </div>
              <Badge variant="secondary" className="font-mono text-xs">
                1 Liegenschaft
              </Badge>
            </div>

            <div className="pt-2 border-t border-border/50 text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Einheiten:</span>
                <span className="font-semibold text-foreground">Whg. 1 (EG)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Wohnfläche:</span>
                <span className="font-mono font-medium text-foreground">50,00 m²</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Kaltmiete gesamt:</span>
                <strong className="font-mono text-emerald-600 dark:text-emerald-400">290,00 €</strong>
              </div>
              <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
                <span className="font-medium">Warmmiete gesamt:</span>
                <strong className="font-mono">493,70 €</strong>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Schwerte */}
        <Card className="shadow-sm border-l-4 border-l-purple-500">
          <CardContent className="pt-4 pb-4 space-y-2">
            <div className="flex justify-between items-start">
              <div>
                <strong className="text-base font-bold flex items-center gap-1.5">
                  <MapPin className="h-4 w-4 text-purple-500" /> Schwerte
                </strong>
                <p className="text-xs text-muted-foreground mt-0.5">Alter Dortmunder Weg 4, 58239 Schwerte</p>
              </div>
              <Badge variant="secondary" className="font-mono text-xs">
                1 Liegenschaft
              </Badge>
            </div>

            <div className="pt-2 border-t border-border/50 text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Einheiten:</span>
                <span className="font-semibold text-foreground">WE6 (DG)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Wohnfläche:</span>
                <span className="font-mono font-medium text-foreground">45,14 m²</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Kaltmiete gesamt:</span>
                <strong className="font-mono text-emerald-600 dark:text-emerald-400">350,00 €</strong>
              </div>
              <div className="flex justify-between text-purple-600 dark:text-purple-400">
                <span className="font-medium">Warmmiete gesamt:</span>
                <strong className="font-mono">405,00 €</strong>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
