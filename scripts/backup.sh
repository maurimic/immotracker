#!/bin/sh
# Automatisches Backup-Script für Immotracker
# Wird vom backup-Container täglich ausgeführt

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="/backups/immotracker-backup-${TIMESTAMP}.zip"
DATA_DIR="/data"
UPLOADS_DIR="/app/public/uploads"

echo "[$(date)] Starte Backup..."

# ZIP erstellen
PARTS=""
[ -d "$DATA_DIR" ] && PARTS="$PARTS $DATA_DIR"
[ -d "$UPLOADS_DIR" ] && PARTS="$PARTS $UPLOADS_DIR"

if [ -n "$PARTS" ]; then
  zip -r "$BACKUP_FILE" $PARTS 2>&1
  SIZE=$(du -sh "$BACKUP_FILE" | cut -f1)
  echo "[$(date)] Backup erstellt: $BACKUP_FILE ($SIZE)"
else
  echo "[$(date)] Warnung: Keine Daten zum Sichern gefunden"
fi

# Alte Backups löschen (behalte letzte 30)
cd /backups && ls -t immotracker-backup-*.zip 2>/dev/null | tail -n +31 | xargs -r rm -f
echo "[$(date)] Backup abgeschlossen."
