# Immotracker 🏠

**Selbst-gehostetes Immobilien-Verwaltungstool** für 5 Mietwohnungen.  
Entwickelt für den Betrieb auf einem eigenen Linux-Server via Docker & Docker Compose mit lokaler SQLite-Datenbank.

---

## 🚀 Quick-Start (Server Deployment)

```bash
# 1. Repository auf deinen Linux-Server klonen
git clone <dein-repo> immotracker
cd immotracker

# 2. Umgebungsvariablen anlegen
cp .env.example .env
nano .env   # Optional: API-Keys eintragen (z.B. Anthropic für KI-Fallback)

# 3. Mit Docker Compose starten
docker compose up -d

# 4. Web-App im Browser aufrufen
# → http://deine-server-ip:3000
```

> **Hinweis zur Ersteinrichtung:**  
> Beim ersten Start wird die SQLite-Datenbank automatisch initialisiert und mit den 5 Muster-Wohnungen, Mietern, Verträgen, Darlehen, Tilgungsplänen und Betriebskosten-Buchungen befüllt.

---

## 🗂️ Implementierte Module & Features

### Modul A: Stammdaten & Verträge
- **[1.1] Objekt- & Mieterakten:** Vollständige Verwaltung der 5 Wohnungen (Bezeichnung, qm, Zimmer, Etage, Mietername, E-Mail, Telefon, IBAN, Soll-Kaltmiete, Nebenkostenvorauszahlung, Kaution inkl. Zahlungsstatus, Mietverträge).
- **[1.2] Mietanpassungen & Fristenrechner:** Hinterlegung von Staffelmieten und Indexmieten inkl. automatischer Fristenüberwachung (Erinnerung 3 Monate vor Fälligkeit) sowie Prüfung der 15% / 20% Kappungsgrenze gem. § 558 Abs. 3 BGB.

### Modul B: Zahlungsströme & intelligenter Buchungsabgleich
- **[2.1] CSV-Bank-Import & Google Sheets:** Manueller CSV-Upload (Sparkasse, DKB, Volksbank, ING, Deutsche Bank, CAMT.053) sowie automatischer API-Sync mit Google Sheets.
- **[2.2] Soll/Ist-Vergleich:** Ampelsystem zum Monatsanfang (1.–5. Werktag): Vollständig bezahlt (grün), Teilzahlung (gelb), Überfällig/Offen (rot).
- **[2.3] Intelligentes Matching:** Regelbasierte Zuordnung über IBAN und Name mit KI-Fallback (Claude 3.5 Haiku) bei unklaren Verwendungszwecken.
- **[2.4] 1-Klick Mahnwesen:** Bei Zahlungsverzug automatische Berechnung der Verzugstage und 1-Klick-Generierung von Zahlungserinnerungen, 1. Mahnung und 2. Mahnung mit Kündigungsandrohung gem. § 543 BGB (Kopier- und Druckvorlage).

### Modul C: Darlehens- & Cashflow-Management
- **[3.1] Zins & Tilgung je Einheit:** Erfassung aller Annuitätendarlehen, Restschulden, Zinssätze, monatlichen Raten und Zinsbindungs-Ampel (rot < 12 Monate, gelb < 36 Monate, grün).
- **[3.2] Sondertilgungs-Tracker:** Visualisierung der 5% Sondertilgungskontingente pro Kalenderjahr und Zinsersparnis-Rechner.
- **[3.3] Echter Netto-Cashflow:** Monatliche Gegenüberstellung je Einheit & Gesamtportfolio: Kaltmiete ./. Darlehensrate ./. Instandhaltungsrücklage ./. nicht-umlagefähige Kosten = Reiner Cashflow.

### Modul D: Steuer-, Anlage V- & Instandhaltungs-Export
- **[4.1] Einnahmen-/Ausgaben-Erfassung:** Zuordnung aller Belege nach steuerlichen Kategorien (Schornsteinfeger, Handwerker § 35a EStG, Hausgeld, Verwaltung, Zinsen).
- **[4.2] Anlage V Jahresbericht:** Amtliche Zeilenzuordnung (Zeile 9–11 Mieteinnahmen, Zeile 13 Umlagen, Zeile 33 Zinsen, Zeile 39 Erhaltungsaufwand, Zeile 46 Betriebskosten) mit 1-Klick CSV- und druckfähigem PDF-Export.
- **[4.3] Instandhaltungs-Rücklagen-Tracker:** Virtuelles Rücklagenkonto mit Soll/Ist-Stand nach Petersscher Formel (1,20 €/m² pro Monat).

### Modul E: Dokumentenmanagement & Nebenkostenabrechnung
- **[5.1] Nebenkosten-Verteiler:** Jährliche Erfassung der Gesamtkosten (Heizung, Wasser, Müll, Versicherung, Allgemeinstrom) und Umlage nach Wohnflächenanteil (qm).
- **[5.2] 1-Klick Abrechnungs-Generator:** Erstellung rechtskonformer Einzelabrechnungen als druckfähiges PDF für den Mieter (Guthaben/Nachzahlungssaldo).
- **[5.3] Zählerstands-Erfassung:** Strom-, Wasser-, Gas- und Heizungszähler mit Zählernummer, Ablesedatum und Verbrauchsprotokoll.

### Modul F: Backup & Restore
- **[6.1] Automatisierte Backups:** Tägliches zeitgesteuertes ZIP-Backup der SQLite-Datenbank und hochgeladenen Dokumente via Backup-Container.
- **[6.2] 1-Klick Download im UI:** Sofortiger Download der Live-SQLite-Datei (`.db`) sowie Erstellung und Download von ZIP-Backups direkt aus dem Browser.

---

## ⚙️ Umgebungsvariablen (.env)

| Variable | Beschreibung | Standard |
|---|---|---|
| `PORT` | HTTP-Port | `3000` |
| `DATABASE_URL` | SQLite Datenbank-URL | `file:/data/immotracker.db` (Docker) |
| `ANTHROPIC_API_KEY` | Claude 3.5 Haiku API-Key für KI-Matching | *(optional)* |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | Service Account JSON für Google Sheets | *(optional)* |
| `GOOGLE_SPREADSHEET_ID` | Tabellenblatt-ID für Bankumsätze | *(optional)* |
| `GOOGLE_SHEET_NAME` | Name des Tabellenblatts | `Kontoumsätze` |
| `BACKUP_CRON` | Cron-Zeitplan für tägliche Sicherung | `0 2 * * *` (täglich 02:00 Uhr) |
| `NEXTAUTH_SECRET` | Geheimer Schlüssel für Session-Sicherheit | beliebig 32 Zeichen |

---

## 🛠️ Lokale Entwicklung

```bash
# 1. Abhängigkeiten installieren
npm install

# 2. SQLite-Schema synchronisieren
npx prisma db push

# 3. Beispieldaten (5 Wohnungen, Mieter, Darlehen, Zahlungen) importieren
npm run db:seed

# 4. Dev-Server starten
npm run dev
# → http://localhost:3000
```

---

## 📦 Docker Architektur

- **Container 1 (`immotracker-app`):** Next.js 14 Standalone Production Server mit integriertem Prisma SQLite Treiber, Healthcheck (`/api/health`) und Auto-Migration.
- **Container 2 (`immotracker-backup`):** Alpine Linux Daemon mit `dcron`, der täglich um 02:00 Uhr ein versioniertes ZIP-Archiv in das gemountete Volume `immo-backups` schreibt und alte Backups rotiert.
- **Volumes:**
  - `immo-data`: Persistiert `/data/immotracker.db`
  - `immo-uploads`: Persistiert hochgeladene Mietverträge und Belege
  - `immo-backups`: Persistiert die ZIP-Archive für einfachen Restore und Download

---

## 📄 Lizenz & Rechtlicher Hinweis

Entwickelt für die private Verwaltung von Mietimmobilien. Berechnungsgrundlagen nach deutschem Miet- und Steuerrecht (BGB, BetrKV, HeizkostenV, EStG).
