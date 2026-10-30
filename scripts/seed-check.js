/**
 * Seed-Check Script: Läuft beim Container-Start.
 * Wenn die DB leer ist (kein Property), wird der Seed ausgeführt.
 */

const { execSync } = require("child_process");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  try {
    const count = await prisma.property.count();
    if (count === 0) {
      console.log("🌱 Datenbank ist leer – starte Seed...");
      execSync("node scripts/seed.js", { stdio: "inherit" });
    } else {
      console.log(`✅ Datenbank enthält ${count} Wohnungen – kein Seed nötig.`);
    }
  } catch (err) {
    console.error("Seed-Check Fehler:", err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
