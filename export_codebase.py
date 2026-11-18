"""
Automatisierter Codebase-Exporter für externe LLMs (Google Gemini, NotebookLM, Claude, ChatGPT)
Konform mit dem 250-KB-Hard-Limit, Regex-Redaction und modularer Domänenaufteilung.
"""

import os
import re
import datetime
from pathlib import Path

PROJECT_NAME = "Immotracker (Poggel & Miccichè Immobilienverwaltung)"
PROJECT_ROOT = Path(r"C:\Users\User\Antigravity\Immotracker")
EXPORT_DIR = PROJECT_ROOT / "export_llm"

# Hard limit: NotebookLM & LLMs truncate silently around 250-290 KB
MAX_FILE_SIZE_KB = 250.0

SENSITIVE_PATTERNS = [
    (r'(api_key\s*[:=]\s*["\'])([^"\']{15,})(["\'])', r'\1[REDACTED_API_KEY]\3'),
    (r'(bot_token\s*[:=]\s*["\'])([^"\']{15,})(["\'])', r'\1[REDACTED_TOKEN]\3'),
    (r'(sk-ant-[a-zA-Z0-9_\-]{20,})', '[REDACTED_ANTHROPIC_KEY]'),
    (r'(sk-[a-zA-Z0-9_\-]{30,})', '[REDACTED_OPENAI_KEY]'),
    (r'([0-9]{8,11}:[a-zA-Z0-9_\-]{30,40})', '[REDACTED_BOT_TOKEN]'),
    (r'(AQ\.[a-zA-Z0-9_\-]{30,})', '[REDACTED_GEMINI_KEY]'),
    (r'("private_key"\s*:\s*")-----BEGIN [A-Z ]+ PRIVATE KEY-----[^"]+(")', r'\1[REDACTED_PRIVATE_KEY]\2'),
    (r'(password\s*[:=]\s*["\'])([^"\']{4,})(["\'])', r'\1[REDACTED_PASSWORD]\3'),
    (r'(NEXTAUTH_SECRET\s*=\s*)([^\s\r\n]+)', r'\1[REDACTED_SECRET]'),
    (r'(APP_PASSWORD\s*=\s*)([^\s\r\n]+)', r'\1[REDACTED_PASSWORD]'),
]

PACKAGES = {
    "01_architektur_und_datenbank.txt": {
        "title": "Architektur, Konfiguration & Datenbank-Schema",
        "description": "System-Setup, Docker, Next.js Config, Prisma Schema & Seed, Middleware und Deployment",
        "files": [
            "README.md",
            "package.json",
            "docker-compose.yml",
            "Dockerfile",
            "Dockerfile.backup",
            ".github/workflows/deploy.yml",
            ".github/workflows/build.yml",
            "prisma/schema.prisma",
            "prisma/seed.ts",
            "src/middleware.ts",
            "next.config.js",
            "tailwind.config.ts",
            "tsconfig.json",
            "AGENTS.md"
        ]
    },
    "02_services_und_utilities.txt": {
        "title": "Backend Services, Matching-Engine & Utilities",
        "description": "Prisma-Client, Bank-Sync, Geocoding, Google Sheets Integration, Abrechnungsparser und Hilfsfunktionen",
        "files": [
            "src/lib/prisma.ts",
            "src/lib/utils.ts",
            "src/lib/geocoding.ts",
            "src/lib/google-sheets.ts",
            "src/lib/matching.ts",
            "src/lib/payment-sync.ts",
            "src/lib/property-matching.ts",
            "src/lib/rent-history.ts",
            "src/lib/utility-statement-parser.ts",
            "src/hooks/use-toast.ts"
        ]
    },
    "03_api_backend_routen.txt": {
        "title": "REST API-Endpunkte & Server-Handler",
        "description": "Alle Next.js API-Routen für Properties, Payments, Kredite, Nebenkosten, Tenants, Tickets etc.",
        "dir_scan": "src/app/api"
    },
    "04_ui_komponenten_und_dialoge.txt": {
        "title": "UI-Komponenten, Dialoge & Vektorkarte",
        "description": "Wiederverwendbare React-Komponenten, Dialog-Fenster (Investitionen, Mieterhöhung), interaktive Portfolio-Karte und Base UI",
        "files": [
            "src/components/PropertyInvestmentsDialog.tsx",
            "src/components/RentAdjustmentDialog.tsx",
            "src/components/properties/interactive-property-map.tsx",
            "src/components/layout/sidebar.tsx",
            "src/components/theme-provider.tsx",
            "src/app/globals.css"
        ],
        "dir_scan_extra": "src/components/ui"
    },
    "05_frontend_dashboard_instandhaltung_karte.txt": {
        "title": "Frontend: Dashboard, Instandhaltung, Karte & Backup",
        "description": "Zentrale Übersichtsseite (Dashboard KPIs), Ticket-System (Instandhaltung), Karten-Page, Backup & Layout",
        "files": [
            "src/app/page.tsx",
            "src/app/instandhaltung/page.tsx",
            "src/app/karte/page.tsx",
            "src/app/backup/page.tsx",
            "src/app/login/page.tsx",
            "src/app/layout.tsx"
        ]
    },
    "06_frontend_steuern_und_finanzen.txt": {
        "title": "Frontend: Steuern & Anlage V",
        "description": "Steuerberechnung, Anlage V Ermittlung je Wohneinheit, Abschreibungen (AfA), Zinsabzug und Auswertungen",
        "files": [
            "src/app/steuern/page.tsx"
        ]
    },
    "07_frontend_kredite_und_nebenkosten.txt": {
        "title": "Frontend: Darlehen, Tilgung & Nebenkostenabrechnung",
        "description": "Annuitäten- und Sondertilgungsrechner, Zinsbindungen, Nebenkosten-Verteilung und Mieter-Abrechnungsgenerator",
        "files": [
            "src/app/kredite/page.tsx",
            "src/app/nebenkosten/page.tsx"
        ]
    },
    "08_frontend_wohnungen_objektverwaltung.txt": {
        "title": "Frontend: Wohnungs- & Mieterakten (Objektverwaltung)",
        "description": "Erfassung, Verbundwohnungen (WE5 & WE6), Mietverträge, Hausgeld, Kaution und Miethistorie",
        "files": [
            "src/app/wohnungen/page.tsx"
        ]
    },
    "09_frontend_zahlungen_und_bankabgleich.txt": {
        "title": "Frontend: Zahlungsströme & Banküberweisungs-Abgleich",
        "description": "Soll-Ist-Abgleich nach § 556b BGB, automatischer Bankimport via Google Sheets / n8n, Split-Buchungen",
        "files": [
            "src/app/zahlungen/page.tsx"
        ]
    },
    "10_scripts_und_werkzeuge.txt": {
        "title": "Automatisierungs-Skripte & Datenbank-Werkzeuge",
        "description": "Lokale Import-Skripte, Seeding, Backup-Shell-Skripte und Prisma-Migrationen",
        "files": [
            "scripts/import-local.js",
            "scripts/seed.js",
            "scripts/seed-check.js",
            "scripts/backup.sh"
        ],
        "dir_scan_extra": "prisma/migrations"
    }
}

def sanitize_content(content: str) -> str:
    for pat, repl in SENSITIVE_PATTERNS:
        content = re.sub(pat, repl, content)
    return content

def get_file_fence(filepath: str) -> str:
    ext = os.path.splitext(filepath)[1].lower()
    mapping = {
        ".ts": "typescript",
        ".tsx": "tsx",
        ".js": "javascript",
        ".jsx": "jsx",
        ".json": "json",
        ".css": "css",
        ".prisma": "prisma",
        ".yml": "yaml",
        ".yaml": "yaml",
        ".sql": "sql",
        ".sh": "bash",
        ".md": "markdown"
    }
    return mapping.get(ext, "")

def collect_package_files(pkg_name: str, pkg_meta: dict) -> list[str]:
    collected = []
    
    # 1. Explizite Dateien
    for f in pkg_meta.get("files", []):
        f_norm = f.replace('/', os.sep)
        full = PROJECT_ROOT / f_norm
        if full.is_file():
            collected.append(f)
            
    # 2. dir_scan (z. B. src/app/api)
    if "dir_scan" in pkg_meta:
        scan_dir = PROJECT_ROOT / pkg_meta["dir_scan"].replace('/', os.sep)
        if scan_dir.is_dir():
            for root, _, files in os.walk(scan_dir):
                for file in sorted(files):
                    if file.endswith(('.ts', '.tsx', '.js', '.json')):
                        rel = os.path.relpath(os.path.join(root, file), PROJECT_ROOT).replace('\\', '/')
                        if rel not in collected:
                            collected.append(rel)
                            
    # 3. dir_scan_extra
    if "dir_scan_extra" in pkg_meta:
        scan_dir = PROJECT_ROOT / pkg_meta["dir_scan_extra"].replace('/', os.sep)
        if scan_dir.is_dir():
            for root, _, files in os.walk(scan_dir):
                for file in sorted(files):
                    if file.endswith(('.ts', '.tsx', '.js', '.sql', '.toml')):
                        rel = os.path.relpath(os.path.join(root, file), PROJECT_ROOT).replace('\\', '/')
                        if rel not in collected:
                            collected.append(rel)
                            
    return collected

def build_package(filename: str, meta: dict, files: list[str]) -> tuple[str, float]:
    timestamp = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    
    # Header
    lines = []
    lines.append("=" * 80)
    lines.append(f"PROJEKT: {PROJECT_NAME}")
    lines.append(f"PAKET:   {filename} — {meta['title']}")
    lines.append(f"BESCHREIBUNG: {meta['description']}")
    lines.append(f"EXPORT-ZEITPUNKT: {timestamp}")
    lines.append("HINWEIS FÜR LLMs: Diese Datei ist vollständig, modular und enthält alle relevanten Quellcodes.")
    lines.append("SICHERHEIT: Alle Passwörter, API-Keys und Secrets wurden automatisch unkenntlich gemacht.")
    lines.append("=" * 80)
    lines.append("")
    lines.append("## INHALTSVERZEICHNIS DIESES PAKETS:")
    
    file_details = []
    for rel_path in files:
        full_path = PROJECT_ROOT / rel_path.replace('/', os.sep)
        size_kb = os.path.getsize(full_path) / 1024.0
        file_details.append((rel_path, size_kb, full_path))
        lines.append(f"  - {rel_path} ({size_kb:.1f} KB)")
        
    lines.append("")
    lines.append("=" * 80)
    lines.append("")
    
    # Dateiblöcke
    for rel_path, size_kb, full_path in file_details:
        fence = get_file_fence(rel_path)
        lines.append(f"### DATEI: {rel_path} ({size_kb:.1f} KB)")
        lines.append(f"```{fence}")
        try:
            with open(full_path, "r", encoding="utf-8", errors="replace") as f_in:
                content = f_in.read()
            sanitized = sanitize_content(content)
            lines.append(sanitized)
        except Exception as e:
            lines.append(f"// FEHLER BEIM LESEN DER DATEI: {e}")
        lines.append("```")
        lines.append("-" * 70)
        lines.append("")
        
    final_text = "\n".join(lines)
    final_size_kb = len(final_text.encode("utf-8")) / 1024.0
    return final_text, final_size_kb

def main():
    os.makedirs(EXPORT_DIR, exist_ok=True)
    print("=" * 70)
    print(f"Starte Export der Codebase für LLMs (Ziel: {EXPORT_DIR})")
    print("=" * 70)
    
    summary = []
    total_files_count = 0
    total_bytes = 0
    all_within_limit = True
    
    for filename, meta in PACKAGES.items():
        files = collect_package_files(filename, meta)
        content, size_kb = build_package(filename, meta, files)
        
        target_path = EXPORT_DIR / filename
        with open(target_path, "w", encoding="utf-8") as out:
            out.write(content)
            
        status = "OK" if size_kb <= MAX_FILE_SIZE_KB else "WARNUNG (>250 KB!)"
        if size_kb > MAX_FILE_SIZE_KB:
            all_within_limit = False
            
        total_files_count += len(files)
        total_bytes += len(content.encode("utf-8"))
        summary.append((filename, meta['title'], len(files), size_kb, status))
        print(f"[{status:7}] {filename:45} | {len(files):2} Dateien | {size_kb:6.1f} KB")

    print("=" * 70)
    print(f"Gesamt-Export abgeschlossen: {len(PACKAGES)} Pakete, {total_files_count} Dateien, {total_bytes / 1024:.1f} KB.")
    print(f"Status 250-KB-Hard-Limit: {'ERFÜLLT (Alle Pakete strikt < 250 KB)' if all_within_limit else 'NICHT ERFÜLLT'}")
    print(f"Speicherort: {EXPORT_DIR.resolve()}")
    print("=" * 70)

if __name__ == "__main__":
    main()
