/**
 * Lokales Import-Skript für eigene Rohdaten
 * Liest 'meine-rohdaten.json' ein und speichert sie 100% lokal in SQLite.
 * Keine Daten verlassen Ihren Rechner!
 *
 * Ausführen mit: npm run db:import
 */

const fs = require("fs");
const path = require("path");
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const filePath = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.join(__dirname, "..", "meine-rohdaten.json");

async function run() {
  console.log("🔒 Starte lokalen, datenschutzkonformen Daten-Import...");

  if (!fs.existsSync(filePath)) {
    console.error(`\n❌ Datei nicht gefunden: ${filePath}`);
    console.log(`\nSo funktioniert es:`);
    console.log(`1. Kopieren Sie die Vorlage 'meine-rohdaten.template.json' zu 'meine-rohdaten.json'`);
    console.log(`2. Tragen Sie dort Ihre echten Wohnungs-, Mieter- und Darlehensdaten lokal ein.`);
    console.log(`3. Starten Sie erneut: npm run db:import\n`);
    process.exit(1);
  }

  const raw = fs.readFileSync(filePath, "utf-8");
  let items;
  try {
    items = JSON.parse(raw);
  } catch (e) {
    console.error("❌ Ungültiges JSON-Format in meine-rohdaten.json:", e.message);
    process.exit(1);
  }

  if (!Array.isArray(items)) {
    console.error("❌ Die JSON-Datei muss ein Array [...] von Wohnungen sein.");
    process.exit(1);
  }

  console.log(`📦 Gefundene Einheiten in Datei: ${items.length}`);

  let createdProps = 0;
  let createdTenants = 0;
  let createdLoans = 0;

  for (const item of items) {
    if (!item.name || !item.address || !item.sqm) {
      console.warn(`⚠️ Überspringe Eintrag ohne Pflichtfelder (name, address, sqm):`, item);
      continue;
    }

    // Wohnung anlegen
    const property = await prisma.property.create({
      data: {
        name: item.name,
        address: item.address,
        sqm: parseFloat(item.sqm),
        floor: item.floor || null,
        rooms: item.rooms ? parseFloat(item.rooms) : null,
        purchasePrice: item.purchasePrice !== undefined && item.purchasePrice !== "" ? parseFloat(item.purchasePrice) : null,
        purchasedAt: item.purchasedAt ? new Date(item.purchasedAt) : null,
        possessionAt: item.possessionAt ? new Date(item.possessionAt) : null,
        ancillaryCosts: item.ancillaryCosts !== undefined && item.ancillaryCosts !== "" ? parseFloat(item.ancillaryCosts) : null,
      },
    });
    createdProps++;

    // Mieter anlegen (optional)
    if (item.tenant && (item.tenant.lastName || item.tenant.firstName)) {
      const t = item.tenant;
      await prisma.tenant.create({
        data: {
          propertyId: property.id,
          firstName: t.firstName || "Unbekannt",
          lastName: t.lastName || "Mieter",
          email: t.email || null,
          phone: t.phone || null,
          iban: t.iban || null,
          coldRent: parseFloat(t.coldRent || 0),
          utilities: parseFloat(t.utilities || 0),
          deposit: parseFloat(t.deposit || 0),
          depositPaid: Boolean(t.depositPaid ?? false),
          moveInDate: t.moveInDate ? new Date(t.moveInDate) : new Date(),
          contractStart: t.contractStart ? new Date(t.contractStart) : new Date(),
          moveOutDate: t.moveOutDate ? new Date(t.moveOutDate) : null,
        },
      });
      createdTenants++;
    }

    // Darlehen anlegen (optional)
    if (Array.isArray(item.loans)) {
      for (const l of item.loans) {
        if (!l.originalAmount || !l.interestRate || !l.monthlyPayment) continue;
        const orig = parseFloat(l.originalAmount);
        const rate = parseFloat(l.interestRate);
        const pay = parseFloat(l.monthlyPayment);
        const start = l.startDate ? new Date(l.startDate) : new Date();
        const end = l.fixedRateEnd ? new Date(l.fixedRateEnd) : new Date(new Date().setFullYear(new Date().getFullYear() + 10));

        let balance = l.currentBalance !== undefined && l.currentBalance !== ""
          ? parseFloat(l.currentBalance)
          : orig;

        await prisma.loan.create({
          data: {
            propertyId: property.id,
            label: l.label || "Darlehen",
            bank: l.bank || null,
            originalAmount: orig,
            currentBalance: balance,
            interestRate: rate,
            monthlyPayment: pay,
            startDate: start,
            fixedRateEnd: end,
          },
        });
        createdLoans++;
      }
    }
  }

  console.log(`\n🎉 Import erfolgreich abgeschlossen!`);
  console.log(`   - Wohnungen angelegt: ${createdProps}`);
  console.log(`   - Mieter angelegt:    ${createdTenants}`);
  console.log(`   - Darlehen angelegt:  ${createdLoans}`);
  console.log(`Alle Daten wurden ausschließlich in Ihrer lokalen SQLite-Datei gespeichert.\n`);
}

run()
  .catch((e) => {
    console.error("Fehler beim Import:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
