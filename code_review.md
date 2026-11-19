# Code-Review Immotracker (19.11.2026 20:48)


## Paket: 05_frontend_dashboard_instandhaltung_karte.txt
Hier ist das Architektur- und Code-Review für Paket 05:

---

### 1. Kritische Bugs, Logikfehler & Hänger (Stuck States)

* **`src/app/page.tsx` – Crash bei API-Fehlern & falsche Ladeanzeige**
  * **Problem:** `fetchData()` prüft `res.ok` nicht. Gibt `/api/dashboard` z. B. 401/500 (`{ error: "..." }`) zurück, wird das Fehlerobjekt in `data` gespeichert und `data.redFixedRates.length` wirft einen `TypeError` (White Screen). Zudem zeigt die Kontostand-Karte dauerhaft `"Wird geladen..."`, wenn `data.accountBalance === null` ist, obwohl das Laden längst beendet ist.
  * **Lösung:** `if (!res.ok) throw new Error(...)` ergänzen + Fehler-State rendern. Bei `accountBalance === null` `"Kein Kontostand erfasst"` anzeigen.

* **`src/app/instandhaltung/page.tsx` – Fehlende Pflichtfeld-Prüfung & endlose Lade-Buttons**
  * **Problem:** `AddTicketDialog` und `AddMeterDialog` nutzen Shadcn `<Select>` ohne Validierung von `form.propertyId`. Ein Submit ohne Wohnungsauswahl schickt `propertyId: ""` an Prisma (Foreign-Key-Fehler 500). Da `try/catch/finally` und ein `else`-Zweig für `!res.ok` fehlen, schlägt das Speichern lautlos fehl oder der Button bleibt bei Netzwerkfehlern dauerhaft auf `"Speichern..."` hängen.
  * **Lösung:** Vor dem `fetch` prüfen (`if (!form.propertyId) return toast(...)`), Request in `try/catch/finally` kapseln und `cost`/`value` sauber als `number | null` serialisieren.

* **`src/app/instandhaltung/page.tsx` – Überschreiben von `doneAt` & React-Rendering-Bug (`0`)**
  * **Problem:** Beim Drag & Drop in dieselbe Spalte (`DONE` → `DONE`) feuert `moveTicket` trotzdem und überschreibt das historische `doneAt`-Datum mit `new Date()`. Außerdem rendert `{ticket.cost && ...}` bei `ticket.cost === 0` eine nackte `0` ins JSX, und `EditTicketDialog` synchronisiert seinen `form`-State nicht, wenn sich `ticket`-Props ändern.
  * **Lösung:** In `onDrop` abbrechen, wenn `ticket.status === col.key`. Bedingung auf `ticket.cost != null && ticket.cost > 0` ändern. State im `EditTicketDialog` beim Öffnen (`onOpenChange`) zurücksetzen.

* **`src/app/instandhaltung/page.tsx` – Fiktive Zahlen im Rücklagen-Tab**
  * **Problem:** `initialStock = annualTarget * 2.8` ist ein hartcodierter Fantasiewert. Zudem zieht `propTickets` die Kosten **aller** Tickets (auch `REPORTED`) ab, während die KPI-Karte oben nur `status === "DONE"` summiert.
  * **Lösung:** Tatsächlichen Rücklagen-Startbestand/Kaufdatum am `Property`-Modell in Prisma speichern und Status-Filter (`DONE`) vereinheitlichen.

* **`src/app/karte/page.tsx` – Hartcodierte Bestandsdaten statt DB-Werte**
  * **Problem:** Die Standort-Karten (Essen, Unna, Schwerte mit m² und Warmmieten) sind komplett im JSX hartcodiert. Mieterwechsel oder Mieterhöhungen werden dort nie sichtbar, während die oben berechneten Variablen (`totalSqm`, `totalColdRent`, `totalWarmRent`) ungenutzt bleiben.
  * **Lösung:** Standorte dynamisch per `properties.reduce(...)` gruppiert nach Stadt/PLZ rendern.

---

### 2. Unnötige API-Aufrufe & Performance-Treiber

* **`src/app/instandhaltung/page.tsx` – Dreifacher Full-Refetch bei jeder Einzelaktion**
  * **Problem:** Jedes Verschieben einer Kanban-Karte, Löschen oder Anlegen ruft `fetchData()` auf und lädt jedes Mal **alle drei** Endpunkte (`/api/tickets`, `/api/meters`, `/api/properties`) komplett neu. `/api/properties` ändert sich hier nie, `/api/meters` nicht bei Ticket-Aktionen. Zudem wirkt Drag & Drop ohne Optimistic Update träge.
  * **Lösung:** `fetchTickets()` und `fetchMeters()` trennen; `properties` nur einmal beim Mount laden (oder per Server Component übergeben). Beim Kanban-Drop `setTickets` optimistisch aktualisieren und nur bei `!res.ok` zurückrollen.

* **`src/app/page.tsx` – Doppeltes Cache-Busting**
  * **Problem:** `/api/dashboard?t=${Date.now()}` kombiniert mit `cache: "no-store"` umgeht jegliches Browser-/Next-Deduplicating und erzeugt unnötige Query-Strings.
  * **Lösung:** `cache: "no-store"` (bzw. Server Component mit `revalidatePath`) reicht in Next.js App Router völlig aus; `?t=...` sowie den ungenutzten `refresh`/`refreshing`-Code entfernen.

---

### 3. Sicherheitslücken & SQLite-Datenbank-Probleme

* **`src/app/login/page.tsx` – Kritische DOM-XSS & Open-Redirect-Lücke**
  * **Problem:** `const from = searchParams.get("from") || "/"` wird ungeprüft an `window.location.href = from` übergeben. Ein Link wie `/login?from=javascript:alert(document.cookie)` führt nach dem Login **XSS** aus; `/login?from=https://phishing.tld` ermöglicht **Open Redirects**.
  * **Lösung:** Ziel-URL strikt validieren und `router.replace` nutzen:
    ```ts
    const rawFrom = searchParams.get("from") || "/";
    const safeFrom = rawFrom.startsWith("/") && !rawFrom.startsWith("//") ? rawFrom : "/";
    router.replace(safeFrom);
    router.refresh();
    ```

* **`src/app/backup/page.tsx` – Akute SQLite-Korruptionsgefahr bei Live-Download & Restore (WAL-Mode)**
  * **Problem:**
    1. **Download (`/api/backup/database`):** Ein direktes Streamen der Datei `immotracker.db` im laufenden Betrieb ignoriert ungeschriebene Transaktionen in `immotracker.db-wal` → das heruntergeladene Backup ist inkonsistent oder korrupt.
    2. **Restore (`/api/backup/restore`):** Wird die `.db`-Datei überschrieben, während Prisma offene Connections hält und alte `-wal`/`-shm`-Dateien im Verzeichnis liegen, korrumpiert SQLite die Datenbank sofort (`SQLITE_CORRUPT`). Zudem prüft das Frontend nur die Dateiendung (`accept=".db"`).
  * **Lösung (Backend-seitig zwingend absichern):**
    * **Backup:** Immer `await prisma.$executeRawUnsafe("VACUUM INTO '/tmp/backup.db'")` nutzen und diese Kopie ausliefern.
    * **Restore:** Upload-Header prüfen (`SQLite format 3\0` + `PRAGMA integrity_check` in temporärer DB), dann `await prisma.$disconnect()`, alte `.db-wal` und `.db-shm` zwingend löschen, Datei atomar per `fs.rename` ersetzen.

---

### 4. Weitere Verbesserungsmöglichkeiten (Next.js & Architektur)

* **`src/app/layout.tsx` – `<Sidebar />` umschließt auch `/login`**
  * **Problem:** `RootLayout` rendert `<Sidebar />` global für alle Routen. Auf `/login` führt das entweder zu sichtbarer Navigation für nicht eingeloggte Nutzer oder erfordert Client-Workarounds via `usePathname()`.
  * **Lösung:** Next.js Route Groups einsetzen: `src/app/(auth)/login/page.tsx` (ohne Sidebar) und `src/app/(dashboard)/layout.tsx` (mit Sidebar).

* **Alle Pages (`"use client"` + `useEffect`-Fetching)**
  * **Problem:** Alle Seiten sind reine Client Components, die erst nach JS-Hydration per `useEffect` + `fetch` Daten laden (Request-Wasserfall, Lade-Spinner bei jedem Seitenwechsel).
  * **Lösung:** Daten direkt in async **Server Components** via Prisma/Service-Layer laden und nur interaktive Inseln (Kanban-Board, Dialoge, Charts, Leaflet-Map) als Client Components auslagern.

* **`src/app/instandhaltung/page.tsx` – Native `confirm()`-Dialoge & `any`-Typen**
  * **Problem:** `window.confirm()` blockiert den Main-Thread und bricht das UI-Design; in `page.tsx` (`fifteenPercentWarnings?: any[]`) und `karte/page.tsx` (`properties: any[]`) geht Typsicherheit verloren.
  * **Lösung:** Shadcn `AlertDialog` statt `confirm()` verwenden und gemeinsame Prisma-Typen (`Prisma.PropertyGetPayload<...>`) aus `@prisma/client` importieren.
