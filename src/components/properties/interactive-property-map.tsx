"use client";

import { useEffect, useRef, useState } from "react";
import { useTheme } from "next-themes";
import {
  Building2, MapPin, Maximize2, Minimize2, ZoomIn, ZoomOut,
  Navigation, Euro, ArrowUpRight, Layers, CheckCircle, ExternalLink
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatCurrency } from "@/lib/utils";
import { getCoordinatesForProperty } from "@/lib/geocoding";
import "maplibre-gl/dist/maplibre-gl.css";

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
  coords: [number, number]; // [lat, lng]
  properties: MapProperty[];
}

// OpenFreeMap Vektor-Styles (100% kostenlos, ohne API-Key)
const OPENFREEMAP_STYLES = {
  liberty: {
    name: "Liberty (Standard)",
    url: "https://tiles.openfreemap.org/styles/liberty",
  },
  positron: {
    name: "Positron (Hell & Minimal)",
    url: "https://tiles.openfreemap.org/styles/positron",
  },
  bright: {
    name: "Bright (Kontrast)",
    url: "https://tiles.openfreemap.org/styles/bright",
  },
  dark: {
    name: "Dark Mode",
    url: "https://tiles.openfreemap.org/styles/dark",
  },
} as const;

type MapStyleKey = keyof typeof OPENFREEMAP_STYLES;

export default function InteractivePropertyMap({
  properties,
  onSelectProperty,
}: {
  properties: MapProperty[];
  onSelectProperty?: (propId: string) => void;
}) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<Array<{ marker: any; popup: any; cluster: BuildingCluster }>>([]);
  const { theme, resolvedTheme } = useTheme();

  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [selectedStyle, setSelectedStyle] = useState<MapStyleKey | "auto">("auto");
  const [fullscreen, setFullscreen] = useState(false);

  // Bestimme den aktiven Style anhand Theme oder Benutzerwahl
  const isDark = (resolvedTheme || theme) === "dark";
  const activeStyleKey: MapStyleKey =
    selectedStyle === "auto" ? (isDark ? "dark" : "liberty") : selectedStyle;
  const activeStyleUrl = OPENFREEMAP_STYLES[activeStyleKey].url;

  // Gebäude clustern (z.B. Siemensstraße 28 EG + 2.OG an derselben Adresse)
  const buildingClusters: BuildingCluster[] = [];
  const addressMap = new Map<string, MapProperty[]>();

  for (const p of properties) {
    const normalized = p.address
      .replace(/(\b(eg|1\.og|2\.og|3\.og|4\.og|5\.og|dg|erdgeschoss|obergeschoss|links|rechts)\b)/gi, "")
      .replace(/,\s*,/g, ",")
      .replace(/\s+,/g, ",")
      .replace(/,\s*$/, "")
      .replace(/\s+/g, " ")
      .trim();

    const existing = addressMap.get(normalized) || [];
    existing.push(p);
    addressMap.set(normalized, existing);
  }

  addressMap.forEach((props, normAddr) => {
    const rep = props[0];
    const coords = getCoordinatesForProperty(rep.address, rep.latitude, rep.longitude);
    const cityMatch = normAddr.match(/\d{5}\s+([A-Za-zäöüÄÖÜß]+)/);
    const city = cityMatch ? cityMatch[1] : "NRW";

    buildingClusters.push({
      address: normAddr,
      city,
      coords,
      properties: props,
    });
  });

  // MapLibre GL initialisieren
  useEffect(() => {
    let isMounted = true;
    let map: any = null;

    async function initMap() {
      if (!mapContainerRef.current) return;

      const maplibregl = await import("maplibre-gl");

      // Wenn bereits eine Instanz existiert, entfernen
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        markersRef.current = [];
      }

      // Initiales Zentrum Ruhrgebiet (Lng, Lat!)
      const defaultCenter: [number, number] = [7.30, 51.48];

      map = new maplibregl.Map({
        container: mapContainerRef.current,
        style: activeStyleUrl,
        center: defaultCenter,
        zoom: 10.5,
        attributionControl: false, // Eigene Attribution mit OpenFreeMap & OSM
      });

      mapInstanceRef.current = map;

      // Attribution Control hinzufügen (OpenFreeMap & OpenStreetMap)
      const attribution = new maplibregl.AttributionControl({
        customAttribution:
          '<a href="https://openfreemap.org" target="_blank" rel="noopener noreferrer" class="font-medium hover:underline">OpenFreeMap</a> &bull; <a href="https://www.openmaptiles.org/" target="_blank" rel="noopener noreferrer" class="hover:underline">&copy; OpenMapTiles</a> &bull; Data from <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer" class="hover:underline">OpenStreetMap</a>',
        compact: true,
      });
      map.addControl(attribution, "bottom-left");

      map.on("load", () => {
        if (!isMounted) return;

        // Bounds für alle Cluster berechnen (LngLatBounds erwartet [lng, lat])
        const bounds = new maplibregl.LngLatBounds();
        let hasBounds = false;

        buildingClusters.forEach((cluster) => {
          const lngLat: [number, number] = [cluster.coords[1], cluster.coords[0]];
          bounds.extend(lngLat);
          hasBounds = true;

          const unitCount = cluster.properties.length;
          const totalColdRent = cluster.properties.reduce((s, p) => s + (p.tenant?.coldRent || 0), 0);

          // Benutzerdefiniertes HTML-Element für Marker
          const markerEl = document.createElement("div");
          markerEl.className = "custom-property-pin cursor-pointer group";
          markerEl.innerHTML = `
            <div style="position: relative; display: flex; flex-direction: column; align-items: center; filter: drop-shadow(0 4px 6px rgba(0,0,0,0.25)); transition: transform 0.2s ease;">
              <div style="
                display: flex;
                align-items: center;
                gap: 5px;
                background-color: #2563eb;
                color: #ffffff;
                font-family: inherit;
                font-size: 12px;
                font-weight: 700;
                padding: 4px 10px;
                border-radius: 9999px;
                border: 2px solid #ffffff;
                white-space: nowrap;
                box-shadow: 0 2px 8px rgba(0,0,0,0.18);
              ">
                <span style="font-size: 13px;">🏢</span>
                <span style="font-family: monospace;">${formatCurrency(totalColdRent)}</span>
                ${
                  unitCount > 1
                    ? `<span style="background-color: #fbbf24; color: #451a03; font-size: 10px; padding: 1px 6px; border-radius: 9999px; font-weight: 900; margin-left: 2px;">${unitCount}</span>`
                    : ""
                }
              </div>
              <div style="
                width: 10px;
                height: 10px;
                background-color: #2563eb;
                transform: rotate(45deg);
                margin-top: -5px;
                border-right: 2px solid #ffffff;
                border-bottom: 2px solid #ffffff;
              "></div>
            </div>
          `;

          // Hover-Effekt
          markerEl.addEventListener("mouseenter", () => {
            const inner = markerEl.firstElementChild as HTMLElement;
            if (inner) inner.style.transform = "scale(1.12)";
          });
          markerEl.addEventListener("mouseleave", () => {
            const inner = markerEl.firstElementChild as HTMLElement;
            if (inner) inner.style.transform = "scale(1)";
          });

          // Popup HTML generieren
          const unitsHtml = cluster.properties
            .map((p) => {
              const tenant = p.tenant ? `${p.tenant.firstName} ${p.tenant.lastName}` : "Leerstand";
              const warmRent = (p.tenant?.coldRent || 0) + (p.tenant?.utilities || 0);
              const unitBadge = p.unitNumber || p.floor || "WE";

              return `
                <div style="
                  padding: 8px 10px;
                  border: 1px solid rgba(148, 163, 184, 0.25);
                  border-radius: 6px;
                  background: rgba(148, 163, 184, 0.08);
                  margin-bottom: 6px;
                  font-size: 12px;
                ">
                  <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                    <strong style="font-size: 12px; font-weight: 600;">${p.name}</strong>
                    <span style="
                      background: rgba(148, 163, 184, 0.2);
                      padding: 1px 6px;
                      border-radius: 4px;
                      font-size: 10px;
                      font-family: monospace;
                    ">${unitBadge}</span>
                  </div>
                  <div style="color: #64748b; font-size: 11px; margin-bottom: 4px;">
                    👤 Mieter: <strong style="color: inherit;">${tenant}</strong> · 📐 ${p.sqm} m²
                  </div>
                  <div style="display: flex; justify-content: space-between; font-size: 11px; border-top: 1px dashed rgba(148, 163, 184, 0.2); padding-top: 4px;">
                    <span style="color: #64748b;">Kaltmiete:</span>
                    <strong style="font-family: monospace;">${formatCurrency(p.tenant?.coldRent || 0)}</strong>
                  </div>
                  <div style="display: flex; justify-content: space-between; font-size: 11px; margin-top: 2px;">
                    <span style="color: #64748b;">Warmmiete:</span>
                    <strong style="font-family: monospace; color: #2563eb;">${formatCurrency(warmRent)}</strong>
                  </div>
                </div>
              `;
            })
            .join("");

          const popupContent = `
            <div style="font-family: inherit; min-width: 260px; max-width: 310px; padding: 4px;">
              <div style="font-size: 13px; font-weight: 700; margin-bottom: 2px; color: #1e293b;">📍 ${cluster.address}</div>
              <div style="font-size: 11px; color: #64748b; margin-bottom: 8px;">
                Stadt: ${cluster.city} · ${unitCount} ${unitCount > 1 ? "Wohneinheiten" : "Wohneinheit"}
              </div>
              <div style="max-height: 260px; overflow-y: auto; padding-right: 2px;">
                ${unitsHtml}
              </div>
            </div>
          `;

          const popup = new maplibregl.Popup({
            offset: 24,
            closeButton: true,
            closeOnClick: false,
            maxWidth: "340px",
          }).setHTML(popupContent);

          const marker = new maplibregl.Marker({
            element: markerEl,
            anchor: "bottom",
          })
            .setLngLat(lngLat)
            .setPopup(popup)
            .addTo(map);

          markerEl.addEventListener("click", () => {
            if (cluster.properties[0]) {
              setSelectedPropertyId(cluster.properties[0].id);
            }
          });

          markersRef.current.push({ marker, popup, cluster });
        });

        // Fit Bounds
        if (hasBounds) {
          map.fitBounds(bounds, {
            padding: { top: 60, bottom: 60, left: 60, right: 60 },
            maxZoom: 13.5,
            duration: 800,
          });
        }

        setMapReady(true);
      });
    }

    initMap();

    return () => {
      isMounted = false;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        markersRef.current = [];
      }
    };
  }, [activeStyleUrl]);

  // Vollbild resize handling
  useEffect(() => {
    if (mapInstanceRef.current) {
      setTimeout(() => {
        mapInstanceRef.current.resize();
      }, 150);
    }
  }, [fullscreen]);

  // Bei Klick auf eine Immobilie in der Liste -> Karte dorthin fliegen
  const handleFlyToProperty = (property: MapProperty) => {
    setSelectedPropertyId(property.id);
    const coords = getCoordinatesForProperty(property.address, property.latitude, property.longitude);
    const lngLat: [number, number] = [coords[1], coords[0]];

    if (mapInstanceRef.current) {
      mapInstanceRef.current.flyTo({
        center: lngLat,
        zoom: 16,
        duration: 1200,
        essential: true,
      });

      // Passenden Marker öffnen
      const found = markersRef.current.find((item) => {
        const mPos = item.marker.getLngLat();
        return (
          Math.abs(mPos.lng - lngLat[0]) < 0.001 &&
          Math.abs(mPos.lat - lngLat[1]) < 0.001
        );
      });

      if (found) {
        // Schließe andere Popups und öffne dieses
        markersRef.current.forEach((m) => m.popup.remove());
        found.popup.addTo(mapInstanceRef.current);
      }
    }
  };

  // Zoom-Buttons
  const handleZoomIn = () => mapInstanceRef.current?.zoomIn();
  const handleZoomOut = () => mapInstanceRef.current?.zoomOut();
  const handleResetView = async () => {
    if (mapInstanceRef.current && buildingClusters.length > 0) {
      const maplibregl = await import("maplibre-gl");
      const bounds = new maplibregl.LngLatBounds();
      buildingClusters.forEach((c) => {
        bounds.extend([c.coords[1], c.coords[0]]);
      });
      mapInstanceRef.current.fitBounds(bounds, {
        padding: { top: 60, bottom: 60, left: 60, right: 60 },
        maxZoom: 13.5,
        duration: 800,
      });
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

        <div className="flex items-center gap-1.5 self-end sm:self-auto flex-wrap">
          {/* Style Selector mit Radix UI für perfekten Dark/Light-Mode */}
          <Select
            value={selectedStyle}
            onValueChange={(val) => setSelectedStyle(val as any)}
          >
            <SelectTrigger
              className="h-8 text-xs bg-muted/50 border gap-1.5 px-2.5 w-[140px] font-medium"
              title="Kartenstil auswählen (OpenFreeMap)"
            >
              <Layers className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <SelectValue placeholder="Kartenstil" />
            </SelectTrigger>
            <SelectContent align="end" className="text-xs">
              <SelectItem value="auto" className="cursor-pointer">
                Auto ({isDark ? "Dark" : "Liberty"})
              </SelectItem>
              <SelectItem value="liberty" className="cursor-pointer">
                Liberty (Farbe)
              </SelectItem>
              <SelectItem value="positron" className="cursor-pointer">
                Positron (Hell/Minimal)
              </SelectItem>
              <SelectItem value="bright" className="cursor-pointer">
                Bright
              </SelectItem>
              <SelectItem value="dark" className="cursor-pointer">
                Dark Mode
              </SelectItem>
            </SelectContent>
          </Select>

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
            <div className="absolute inset-0 flex items-center justify-center bg-muted/60 backdrop-blur-xs z-20 text-xs text-muted-foreground flex-col gap-2">
              <Building2 className="h-6 w-6 animate-pulse text-primary" />
              <span>Interaktive Portfolio-Karte wird geladen (OpenFreeMap)...</span>
            </div>
          )}

          {/* Legende & OpenFreeMap Badge unten rechts */}
          <div className="absolute bottom-3 right-3 z-[30] bg-background/95 backdrop-blur-sm border rounded-md px-2.5 py-1.5 text-[11px] text-muted-foreground shadow-md flex items-center gap-2">
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>Kaltmiete / Mon.</span>
            <span className="text-border">|</span>
            <span className="bg-amber-400 text-amber-950 text-[10px] font-black px-1 rounded-full">N</span>
            <span>Mehrere WEs</span>
            <span className="text-border">|</span>
            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">100% Free OpenFreeMap</span>
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