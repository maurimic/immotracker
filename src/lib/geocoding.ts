/**
 * Geocoding-Hilfsfunktionen für die interaktive Immobilienkarte
 */

export interface GeoLocation {
  lat: number;
  lng: number;
}

// Bekannte Adressen der Immobilien mit hochpräzisen Koordinaten
const KNOWN_ADDRESS_COORDINATES: Array<{
  pattern: RegExp;
  coords: GeoLocation;
}> = [
  // Siemensstraße 28, 45143 Essen
  {
    pattern: /siemens.*28.*essen|45143/i,
    coords: { lat: 51.4608, lng: 6.9855 },
  },
  // Bockumweg 17a, 59425 Unna
  {
    pattern: /bockumweg.*17|59425/i,
    coords: { lat: 51.5452, lng: 7.6895 },
  },
  // Alter Dortmunder Weg 4, 58239 Schwerte
  {
    pattern: /alter dortmunder weg|58239/i,
    coords: { lat: 51.4428, lng: 7.5647 },
  },
];

// Stadt-Zentren für Fallbacks (Ruhrgebiet & NRW)
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
};

/**
 * Ermittelt Längen- und Breitengrad für eine Immobilie
 */
export function getCoordinatesForProperty(
  address?: string | null,
  lat?: number | null,
  lng?: number | null
): [number, number] {
  // 1. Wenn explizite Koordinaten in DB vorhanden sind:
  if (lat && lng && !isNaN(lat) && !isNaN(lng)) {
    return [lat, lng];
  }

  const raw = (address || "").trim().toLowerCase();

  // 2. Bekannte Adressen matchen
  for (const item of KNOWN_ADDRESS_COORDINATES) {
    if (item.pattern.test(raw)) {
      return [item.coords.lat, item.coords.lng];
    }
  }

  // 3. Stadt-Fallback
  for (const [city, coords] of Object.entries(CITY_CENTROIDS)) {
    if (raw.includes(city)) {
      return [coords.lat, coords.lng];
    }
  }

  // 4. Default: Zentrum NRW / Ruhrgebiet (Dortmund/Essen Region)
  return [51.48, 7.30];
}
