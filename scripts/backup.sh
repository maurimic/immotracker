#!/bin/sh
# Automatisches Backup-Script für Immotracker
# Wird vom backup-Container täglich ausgeführt

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="${BACKUP_DIR:-/backups}"
BACKUP_FILE="${BACKUP_DIR}/immotracker-backup-${TIMESTAMP}.zip"
DATA_DIR="/data"
UPLOADS_DIR="/app/public/uploads"

echo "[$(date)] Starte Backup..."

mkdir -p "$BACKUP_DIR"

# Temporäres Verzeichnis für konsistente Snapshot-Dateien erstellen
TMP_DIR=$(mktemp -d /tmp/immotracker_backup_XXXXXX)
cleanup() {
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT INT TERM

mkdir -p "$TMP_DIR/data"

# Konsistente SQLite-Kopie mit .backup erstellen (verhindert unvollständige WAL-Zustände)
DB_FILE="$DATA_DIR/immotracker.db"
if [ -f "$DB_FILE" ]; then
  echo "[$(date)] Erstelle konsistente SQLite-Kopie mit 'sqlite3 .backup'..."
  if sqlite3 "$DB_FILE" ".backup '$TMP_DIR/data/immotracker.db'"; then
    echo "[$(date)] Konsistente SQLite-Kopie erfolgreich erstellt."
  else
    echo "[$(date)] Warnung: sqlite3 .backup fehlgeschlagen, erstelle Fallback-Kopie..."
    cp "$DB_FILE" "$TMP_DIR/data/immotracker.db"
  fi
elif [ -d "$DATA_DIR" ]; then
  for db in "$DATA_DIR"/*.db; do
    if [ -f "$db" ]; then
      base=$(basename "$db")
      echo "[$(date)] Erstelle konsistente SQLite-Kopie für $base mit sqlite3 .backup..."
      sqlite3 "$db" ".backup '$TMP_DIR/data/$base'" || cp "$db" "$TMP_DIR/data/$base"
    fi
  done
fi

# ZIP erstellen mit der konsistenten temporären Datenbankkopie und Uploads
if [ -d "$TMP_DIR/data" ] && [ "$(ls -A "$TMP_DIR/data" 2>/dev/null)" ]; then
  if [ -d "$UPLOADS_DIR" ]; then
    (cd "$TMP_DIR" && zip -r "$BACKUP_FILE" data "$UPLOADS_DIR" 2>&1)
  else
    (cd "$TMP_DIR" && zip -r "$BACKUP_FILE" data 2>&1)
  fi
  SIZE=$(du -sh "$BACKUP_FILE" 2>/dev/null | cut -f1)
  echo "[$(date)] Backup erstellt: $BACKUP_FILE ($SIZE)"
else
  echo "[$(date)] Warnung: Keine Daten zum Sichern gefunden"
fi

# Alte Backups löschen (behalte letzte 30)
if [ -d "$BACKUP_DIR" ]; then
  cd "$BACKUP_DIR" && ls -t immotracker-backup-*.zip 2>/dev/null | tail -n +31 | xargs -r rm -f
fi
echo "[$(date)] Backup abgeschlossen."
