/**
 * Geocoding-Hilfsfunktionen für die interaktive Immobilienkarte
 * Präzise Rooftop-Koordinaten & OpenStreetMap Nominatim Geocoding nach Immometrica-Standard
 */

export interface GeoLocation {
  lat: number;
  lng: number;
}

// Hochpräzise verifizierte Hausnummern-/Rooftop-Koordinaten (OpenStreetMap / Kataster)
const VERIFIED_ROOFTOP_COORDINATES: Array<{
  pattern: RegExp;
  coords: GeoLocation;
  name: string;
}> = [
  // Siemensstraße 28, 45143 Essen (Essen-Altendorf)
  // Unterstützt sowohl "Siemensstraße" als auch Tippfehler "Siemenstraße"
  {
    pattern: /siemen[s]?stra[ßs]e\s*28|45143/i,
    coords: { lat: 51.45978, lng: 6.97538 },
    name: "Siemensstraße 28, Essen",
  },
  // Bockumweg 17a, 59425 Unna (Unna-Königsborn)
  {
    pattern: /bockumweg\s*17|59425/i,
    coords: { lat: 51.54070, lng: 7.67984 },
    name: "Bockumweg 17a, Unna",
  },
  // Alter Dortmunder Weg 4, 58239 Schwerte (Schwerte Holzen-Rosen)
  {
    pattern: /alter\s+dortmunder\s+weg\s*4|58239/i,
    coords: { lat: 51.45089, lng: 7.56877 },
    name: "Alter Dortmunder Weg 4, Schwerte",
  },
];

// Stadt-Zentren für generelle Fallbacks (Ruhrgebiet & NRW)
const CITY_CENTROIDS: Record<string, GeoLocation> = {
  essen: { lat: 51.4556, lng: 7.0116 },
  unna: { lat: 51.5348, lng: 7.6891 },
  schwerte: { lat: 51.4439, lng: 7.5672 },
  dortmund: { lat: 51.5136, lng: 7.4653 },
  bochum: { lat: 51.4818, lng: 7.2162 },
  duisburg: { lat: 51.4344, lng: 6.7623 },
  gelsenkirchen: { lat: 51.5177, lng: 7.1007 },
  oberhausen: { lat: 51.4704, lng: 6.8514 },
  mülheim: { lat: 51.4272, lng: 6.8828 },
  hagen: { lat: 51.3671, lng: 7.4633 },
  düsseldorf: { lat: 51.2277, lng: 6.7735 },
  köln: { lat: 50.9375, lng: 6.9603 },
  hamm: { lat: 51.6780, lng: 7.8180 },
};

// Lokaler Geocoding-Cache im Browser
const geocodeMemoryCache = new Map<string, GeoLocation>();

/**
 * Ermittelt Längen- und Breitengrad für eine Immobilie synchron (für Rendering)
 */
export function getCoordinatesForProperty(
  address?: string | null,
  lat?: number | null,
  lng?: number | null
): [number, number] {
  // 1. Wenn explizite Koordinaten in DB vorhanden sind:
  if (lat && lng && !isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0) {
    return [lat, lng];
  }

  const raw = (address || "").trim().toLowerCase();

  // 2. Bekannte verifizierte Rooftop-Adressen matchen (höchste Priorität)
  for (const item of VERIFIED_ROOFTOP_COORDINATES) {
    if (item.pattern.test(raw)) {
      return [item.coords.lat, item.coords.lng];
    }
  }

  // 3. Im Memory-Cache nachsehen (z.B. nach async Nominatim Lookup)
  if (geocodeMemoryCache.has(raw)) {
    const cached = geocodeMemoryCache.get(raw)!;
    return [cached.lat, cached.lng];
  }

  // 4. Stadt-Fallback
  for (const [city, coords] of Object.entries(CITY_CENTROIDS)) {
    if (raw.includes(city)) {
      return [coords.lat, coords.lng];
    }
  }

  // 5. Default: Zentrum NRW / Ruhrgebiet (Dortmund/Essen Region)
  return [51.48, 7.30];
}

/**
 * Asynchroner OSM Nominatim Geocoder mit Caching (wie in Immometrica)
 */
export async function geocodeAddressAsync(address: string): Promise<GeoLocation | null> {
  const clean = address.trim();
  if (!clean) return null;

  const key = clean.toLowerCase();
  if (geocodeMemoryCache.has(key)) {
    return geocodeMemoryCache.get(key)!;
  }

  // Prüfe zuerst statische verifizierte Koordinaten
  for (const item of VERIFIED_ROOFTOP_COORDINATES) {
    if (item.pattern.test(key)) {
      geocodeMemoryCache.set(key, item.coords);
      return item.coords;
    }
  }

  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
      clean
    )}&format=json&countrycodes=de&limit=1`;
    const res = await fetch(url, {
      headers: { "User-Agent": "Immotracker-App/1.0" },
    });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        const la = parseFloat(data[0].lat);
        const ln = parseFloat(data[0].lon);
        if (!isNaN(la) && !isNaN(ln)) {
          const coords = { lat: Number(la.toFixed(5)), lng: Number(ln.toFixed(5)) };
          geocodeMemoryCache.set(key, coords);
          return coords;
        }
      }
    }
  } catch {
    // Stiller Fallback bei Netzwerkfehlern
  }

  return null;
}
