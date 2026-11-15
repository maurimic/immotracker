"use client";

import { useEffect, useRef, useState } from "react";
import { useTheme } from "next-themes";
import {
  Building2, MapPin, Maximize2, Minimize2, ZoomIn, ZoomOut,
  Navigation, Euro, User, ArrowUpRight, Layers, Eye, CheckCircle
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import { getCoordinatesForProperty } from "@/lib/geocoding";
import "leaflet/dist/leaflet.css";

// Interface für Immobilien auf der Karte
export interface MapProperty {
  id: string;
  name: string;
  address: string;
  floor?: string | null;
  unitNumber?: string | null;
  sqm: number;
  rooms?: number | null;
  purchasePrice?: number | null;
  hausgeld?: number | null;
  maintenanceReserve?: number | null;
  latitude?: number | null;
  longitude?: number | null;
  unitDetails?: any;
  tenant?: {
    firstName: string;
    lastName: string;
    coldRent: number;
    utilities: number;
  } | null;
}

interface BuildingCluster {
  address: string;
  city: string;
  coords: [number, number];
  properties: MapProperty[];
}

export default function InteractivePropertyMap({
  properties,
  onSelectProperty,
}: {
  properties: MapProperty[];
  onSelectProperty?: (propId: string) => void;
}) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const { theme } = useTheme();

  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [mapType, setMapType] = useState<"standard" | "satellite">("standard");
  const [fullscreen, setFullscreen] = useState(false);

  // Gebäude clustern (z.B. Siemensstraße 28 EG + 2.OG an derselben Adresse)
  const buildingClusters: BuildingCluster[] = [];
  const addressMap = new Map<string, MapProperty[]>();

  for (const p of properties) {
    // Normalisiere Adresse (ohne Etage/Zusatz)
    const normalized = p.address
      .replace(/(\b(eg|1\.og|2\.og|3\.og|dg|erdgeschoss|obergeschoss)\b)/gi, "")
      .replace(/\s+/g, " ")
      .trim();

    const existing = addressMap.get(normalized) || [];
    existing.push(p);
    addressMap.set(normalized, existing);
  }

  addressMap.forEach((props, normAddr) => {
    // Erste Property für Koordinaten heranziehen
    const rep = props[0];
    const coords = getCoordinatesForProperty(rep.address, rep.latitude, rep.longitude);
    
    // Stadt extrahieren
    const cityMatch = normAddr.match(/\d{5}\s+([A-Za-zäöüÄÖÜß]+)/);
    const city = cityMatch ? cityMatch[1] : "NRW";

    buildingClusters.push({
      address: normAddr,
      city,
      coords,
      properties: props,
    });
  });

  // Leaflet-Initialisierung
  useEffect(() => {
    let isMounted = true;

    async function initMap() {
      if (!mapContainerRef.current || mapInstanceRef.current) return;

      const L = (await import("leaflet")).default;

      // Leaflet Default Icon Bug fix
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      });

      // Startkoordinaten (Zentrum Ruhrgebiet)
      const centerCoords: [number, number] = [51.48, 7.30];

      const map = L.map(mapContainerRef.current, {
        center: centerCoords,
        zoom: 11,
        zoomControl: false, // Eigene Zoom-Buttons
      });

      mapInstanceRef.current = map;

      // Tile Layer hinzufügen
      const isDark = theme === "dark";
      const tileUrl = isDark
        ? "https://{s}.basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}{r}.png"
        : "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png";

      L.tileLayer(tileUrl, {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        maxZoom: 19,
      }).addTo(map);

      // Marker für jedes Gebäude erstellen
      const allBounds: [number, number][] = [];

      buildingClusters.forEach((cluster) => {
        allBounds.push(cluster.coords);
        const unitCount = cluster.properties.length;
        const totalColdRent = cluster.properties.reduce((s, p) => s + (p.tenant?.coldRent || 0), 0);

        // Benutzerdefiniertes HTML-Icon (Tailwind-gestylt)
        const customIcon = L.divIcon({
          className: "custom-property-pin",
          html: `
            <div class="relative group cursor-pointer">
              <div class="flex items-center gap-1.5 bg-primary text-primary-foreground font-semibold px-2.5 py-1 rounded-full shadow-lg border-2 border-background transform hover:scale-110 transition-transform duration-200">
                <span class="text-xs">🏢</span>
                <span class="text-xs font-bold font-mono">${formatCurrency(totalColdRent)}</span>
                ${unitCount > 1 ? `<span class="bg-amber-400 text-amber-950 text-[10px] px-1 rounded-full font-black">${unitCount}</span>` : ""}
              </div>
              <div class="w-2.5 h-2.5 bg-primary rotate-45 mx-auto -mt-1 border-r-2 border-b-2 border-background"></div>
            </div>
          `,
          iconSize: [110, 36],
          iconAnchor: [55, 36],
          popupAnchor: [0, -36],
        });

        // Popup-HTML mit Wohnungsdetails
        const unitsHtml = cluster.properties.map((p) => {
          const tenant = p.tenant ? `${p.tenant.firstName} ${p.tenant.lastName}` : "Leerstand";
          const warmRent = (p.tenant?.coldRent || 0) + (p.tenant?.utilities || 0);
          const unitBadge = p.unitNumber || p.floor || "WE";

          return `
            <div class="p-2.5 border rounded-md bg-muted/30 mb-2 last:mb-0 text-xs">
              <div class="flex justify-between items-center mb-1">
                <strong class="text-sm font-semibold text-foreground">${p.name}</strong>
                <span class="bg-secondary text-secondary-foreground px-1.5 py-0.5 rounded text-[10px] font-mono">${unitBadge}</span>
              </div>
              <div class="text-muted-foreground text-[11px] mb-1.5">
                👤 Mieter: <span class="font-medium text-foreground">${tenant}</span> · 📐 ${p.sqm} m²
              </div>
              <div class="flex justify-between items-center pt-1 border-t border-border/50 text-[11px]">
                <span class="text-muted-foreground">Kaltmiete:</span>
                <strong class="font-mono">${formatCurrency(p.tenant?.coldRent || 0)}</strong>
              </div>
              <div class="flex justify-between items-center text-[11px]">
                <span class="text-muted-foreground">Warmmiete:</span>
                <strong class="font-mono text-primary">${formatCurrency(warmRent)}</strong>
              </div>
            </div>
          `;
        }).join("");

        const popupContent = `
          <div style="font-family: inherit; min-width: 260px; max-width: 300px; padding: 2px;">
            <div style="font-size: 13px; font-weight: 700; margin-bottom: 2px;">📍 ${cluster.address}</div>
            <div style="font-size: 11px; color: #64748b; margin-bottom: 8px;">Stadt: ${cluster.city} · ${unitCount} ${unitCount > 1 ? "Einheiten" : "Einheit"}</div>
            ${unitsHtml}
          </div>
        `;

        const marker = L.marker(cluster.coords, { icon: customIcon }).addTo(map);
        marker.bindPopup(popupContent, { maxWidth: 320 });

        marker.on("click", () => {
          if (cluster.properties[0]) {
            setSelectedPropertyId(cluster.properties[0].id);
          }
        });

        markersRef.current.push(marker);
      });

      // Karte auf alle Marker ausrichten
      if (allBounds.length > 0) {
        map.fitBounds(allBounds, { padding: [50, 50], maxZoom: 14 });
      }

      if (isMounted) {
        setMapReady(true);
      }
    }

    initMap();

    return () => {
      isMounted = false;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [theme]);

  // Bei Klick auf eine Immobilie in der Liste -> Karte dorthin fliegen
  const handleFlyToProperty = (property: MapProperty) => {
    setSelectedPropertyId(property.id);
    const coords = getCoordinatesForProperty(property.address, property.latitude, property.longitude);
    if (mapInstanceRef.current) {
      mapInstanceRef.current.flyTo(coords, 16, { duration: 1.2 });
      
      // Passenden Marker öffnen
      const targetMarker = markersRef.current.find((m) => {
        const mPos = m.getLatLng();
        return Math.abs(mPos.lat - coords[0]) < 0.001 && Math.abs(mPos.lng - coords[1]) < 0.001;
      });
      if (targetMarker) {
        targetMarker.openPopup();
      }
    }
  };

  // Zoom-Buttons
  const handleZoomIn = () => mapInstanceRef.current?.zoomIn();
  const handleZoomOut = () => mapInstanceRef.current?.zoomOut();
  const handleResetView = () => {
    if (mapInstanceRef.current && buildingClusters.length > 0) {
      const allBounds = buildingClusters.map((c) => c.coords);
      mapInstanceRef.current.fitBounds(allBounds, { padding: [50, 50], maxZoom: 14 });
    }
  };

  // Gesamtkennzahlen für Karte
  const totalUnits = properties.length;
  const totalSqm = properties.reduce((s, p) => s + (p.sqm || 0), 0);
  const totalColdRent = properties.reduce((s, p) => s + (p.tenant?.coldRent || 0), 0);
  const totalWarmRent = properties.reduce(
    (s, p) => s + (p.tenant?.coldRent || 0) + (p.tenant?.utilities || 0),
    0
  );

  return (
    <div className={`space-y-4 ${fullscreen ? "fixed inset-0 z-50 bg-background p-4 flex flex-col" : ""}`}>
      {/* KPI & Toolbar Leiste */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-card border rounded-lg p-3 shadow-sm">
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <div className="flex items-center gap-1.5 font-semibold text-foreground">
            <Building2 className="h-4 w-4 text-primary" />
            <span>{buildingClusters.length} Standorte</span>
            <span className="text-muted-foreground font-normal">({totalUnits} Wohneinheiten)</span>
          </div>
          <span className="text-muted-foreground hidden sm:inline">·</span>
          <div>
            <span className="text-muted-foreground">Fläche:</span>{" "}
            <strong className="font-mono">{totalSqm.toFixed(1)} m²</strong>
          </div>
          <span className="text-muted-foreground hidden sm:inline">·</span>
          <div>
            <span className="text-muted-foreground">Kaltmiete gesamt:</span>{" "}
            <strong className="font-mono text-emerald-600 dark:text-emerald-400">
              {formatCurrency(totalColdRent)}
            </strong>
          </div>
          <span className="text-muted-foreground hidden sm:inline">·</span>
          <div>
            <span className="text-muted-foreground">Warmmiete:</span>{" "}
            <strong className="font-mono text-blue-600 dark:text-blue-400">
              {formatCurrency(totalWarmRent)}
            </strong>
          </div>
        </div>

        <div className="flex items-center gap-1.5 self-end sm:self-auto">
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs gap-1"
            onClick={handleResetView}
            title="Alle Standorte anzeigen"
          >
            <Navigation className="h-3.5 w-3.5 text-primary" />
            <span className="hidden sm:inline">Übersicht</span>
          </Button>

          <Button
            size="sm"
            variant="outline"
            className="h-8 w-8 p-0"
            onClick={handleZoomIn}
            title="Vergrößern"
          >
            <ZoomIn className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-8 w-8 p-0"
            onClick={handleZoomOut}
            title="Verkleinern"
          >
            <ZoomOut className="h-3.5 w-3.5" />
          </Button>

          <Button
            size="sm"
            variant="outline"
            className="h-8 w-8 p-0"
            onClick={() => setFullscreen(!fullscreen)}
            title={fullscreen ? "Vollbild beenden" : "Vollbild"}
          >
            {fullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
          </Button>
        </div>
      </div>

      {/* Hauptbereich: Karte & Immobilienliste */}
      <div className={`grid grid-cols-1 lg:grid-cols-12 gap-4 ${fullscreen ? "flex-1 min-h-0" : ""}`}>
        {/* Karten-Container */}
        <div className={`lg:col-span-8 rounded-lg border overflow-hidden relative shadow-sm ${fullscreen ? "h-full" : "h-[540px] sm:h-[620px]"}`}>
          <div ref={mapContainerRef} className="w-full h-full z-10" />

          {/* Fallback Ladeanzeige */}
          {!mapReady && (
            <div className="absolute inset-0 flex items-center justify-center bg-muted/60 backdrop-blur-xs z-20 text-xs text-muted-foreground">
              <Building2 className="h-6 w-6 animate-pulse text-primary mb-2" />
              <span>Interaktive Portfolio-Karte wird geladen...</span>
            </div>
          )}

          {/* Legende unten rechts */}
          <div className="absolute bottom-3 right-3 z-[400] bg-background/90 backdrop-blur-sm border rounded-md px-2.5 py-1.5 text-[11px] text-muted-foreground shadow-md flex items-center gap-2">
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>Kaltmiete / Monat</span>
            <span className="text-border">|</span>
            <span className="bg-amber-400 text-amber-950 text-[10px] font-black px-1 rounded-full">N</span>
            <span>Mehrere WEs</span>
          </div>
        </div>

        {/* Sidebar: Immobilien-Karten mit Klick-Fokus */}
        <div className={`lg:col-span-4 flex flex-col gap-2.5 overflow-y-auto ${fullscreen ? "h-full" : "max-h-[540px] sm:max-h-[620px]"} pr-1`}>
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">
            Immobilien auf der Karte ({properties.length})
          </div>

          {buildingClusters.map((cluster) => {
            const isSelected = cluster.properties.some((p) => p.id === selectedPropertyId);
            const clusterColdRent = cluster.properties.reduce((s, p) => s + (p.tenant?.coldRent || 0), 0);
            const clusterSqm = cluster.properties.reduce((s, p) => s + (p.sqm || 0), 0);

            return (
              <Card
                key={cluster.address}
                onClick={() => handleFlyToProperty(cluster.properties[0])}
                className={`cursor-pointer transition-all hover:border-primary/80 hover:shadow-md ${
                  isSelected ? "border-primary ring-2 ring-primary/20 shadow-md bg-muted/20" : ""
                }`}
              >
                <CardContent className="p-3.5 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-1.5 font-bold text-sm">
                        <MapPin className="h-3.5 w-3.5 text-primary shrink-0" />
                        <span>{cluster.city}</span>
                        {cluster.properties.length > 1 && (
                          <Badge variant="secondary" className="text-[10px] py-0 h-4">
                            {cluster.properties.length} Einheiten
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{cluster.address}</p>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="font-bold font-mono text-sm text-foreground">
                        {formatCurrency(clusterColdRent)}
                      </span>
                      <span className="block text-[10px] text-muted-foreground">Kalt / Mon.</span>
                    </div>
                  </div>

                  {/* Einzelwohnungen in diesem Gebäude */}
                  <div className="space-y-1.5 pt-1 border-t border-border/50">
                    {cluster.properties.map((p) => {
                      const warm = (p.tenant?.coldRent || 0) + (p.tenant?.utilities || 0);
                      const tName = p.tenant ? `${p.tenant.firstName} ${p.tenant.lastName}` : "Leerstand";

                      return (
                        <div
                          key={p.id}
                          className="flex items-center justify-between text-xs bg-background/60 p-1.5 rounded border border-border/40"
                        >
                          <div className="min-w-0 pr-2">
                            <span className="font-semibold truncate block">{p.name}</span>
                            <span className="text-[11px] text-muted-foreground truncate block">
                              {tName} · {p.sqm} m²
                            </span>
                          </div>

                          <div className="text-right shrink-0 flex items-center gap-1.5">
                            <span className="font-mono font-medium">{formatCurrency(warm)}</span>
                            {onSelectProperty && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-6 w-6 p-0 text-muted-foreground hover:text-primary"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onSelectProperty(p.id);
                                }}
                                title="Akte öffnen"
                              >
                                <ArrowUpRight className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
