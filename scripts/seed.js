/**
 * Seed-Script (JS-Version für Container-Start ohne ts-node)
 * Erstellt 5 Beispiel-Wohnungen mit vollständigen Daten für alle Module
 */

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Starte Seed-Script...");

  // ─── 5 Wohnungen erstellen ─────────────────────────────────────────────────
  const p = await Promise.all([
    prisma.property.create({ data: { name: "Wohnung 1 – Gartenstr.", address: "Gartenstraße 12, 3. OG links, 10115 Berlin", sqm: 68.5, floor: "3. OG", rooms: 2.5 } }),
    prisma.property.create({ data: { name: "Wohnung 2 – Gartenstr.", address: "Gartenstraße 12, 2. OG rechts, 10115 Berlin", sqm: 72.0, floor: "2. OG", rooms: 3.0 } }),
    prisma.property.create({ data: { name: "Wohnung 3 – Lindenweg", address: "Lindenweg 7, EG, 12345 Hamburg", sqm: 55.0, floor: "EG", rooms: 2.0 } }),
    prisma.property.create({ data: { name: "Wohnung 4 – Lindenweg", address: "Lindenweg 7, 1. OG, 12345 Hamburg", sqm: 89.0, floor: "1. OG", rooms: 4.0 } }),
    prisma.property.create({ data: { name: "Wohnung 5 – Am Park", address: "Am Stadtpark 3, DG, 80331 München", sqm: 110.0, floor: "DG", rooms: 4.5 } }),
  ]);

  console.log(`✅ ${p.length} Wohnungen erstellt`);

  // ─── Mieter ────────────────────────────────────────────────────────────────
  const tenants = await Promise.all([
    prisma.tenant.create({ data: { propertyId: p[0].id, firstName: "Anna", lastName: "Müller", email: "anna.mueller@example.com", phone: "030 12345678", iban: "DE89370400440532013000", coldRent: 850, utilities: 180, deposit: 2550, depositPaid: true, moveInDate: new Date("2022-03-01"), contractStart: new Date("2022-03-01") } }),
    prisma.tenant.create({ data: { propertyId: p[1].id, firstName: "Thomas", lastName: "Schmidt", email: "t.schmidt@example.com", phone: "030 87654321", iban: "DE21500105170123456789", coldRent: 920, utilities: 195, deposit: 2760, depositPaid: true, moveInDate: new Date("2021-07-01"), contractStart: new Date("2021-07-01") } }),
    prisma.tenant.create({ data: { propertyId: p[2].id, firstName: "Lisa", lastName: "Weber", email: "lisa.weber@example.com", phone: "040 11223344", iban: "DE75512108001245126199", coldRent: 680, utilities: 145, deposit: 2040, depositPaid: true, moveInDate: new Date("2023-01-15"), contractStart: new Date("2023-01-15") } }),
    prisma.tenant.create({ data: { propertyId: p[3].id, firstName: "Markus", lastName: "Becker", email: "m.becker@example.com", phone: "040 55667788", iban: "DE91100000000123456789", coldRent: 1150, utilities: 240, deposit: 3450, depositPaid: true, moveInDate: new Date("2020-09-01"), contractStart: new Date("2020-09-01") } }),
    prisma.tenant.create({ data: { propertyId: p[4].id, firstName: "Sarah", lastName: "Fischer", email: "sarah.fischer@example.com", phone: "089 99887766", iban: "DE56200400600029698200", coldRent: 1650, utilities: 310, deposit: 4950, depositPaid: true, moveInDate: new Date("2022-06-01"), contractStart: new Date("2022-06-01") } }),
  ]);

  console.log(`✅ ${tenants.length} Mieter erstellt`);

  // ─── Mietanpassungen ───────────────────────────────────────────────────────
  await prisma.rentAdjustment.createMany({ data: [
    { propertyId: p[0].id, type: "STAFFEL", effectiveDate: new Date("2024-03-01"), newColdRent: 890, notes: "Staffelmiete Jahr 2" },
    { propertyId: p[1].id, type: "SPIEGEL", effectiveDate: new Date("2024-07-01"), newColdRent: 960, notes: "Anpassung an Mietspiegel 2024", reminderDate: new Date("2024-06-01") },
    { propertyId: p[3].id, type: "STAFFEL", effectiveDate: new Date("2025-09-01"), newColdRent: 1200, notes: "Staffelmiete Stufe 2", reminderDate: new Date("2025-08-01") },
    { propertyId: p[4].id, type: "REMINDER", effectiveDate: new Date("2025-06-01"), reminderDate: new Date("2025-05-01"), notes: "Mietspiegel München 2025 prüfen" },
  ]});

  // ─── Darlehen ──────────────────────────────────────────────────────────────
  const loanData = [
    { propertyId: p[0].id, label: "Hauptdarlehen", bank: "Volksbank Berlin",   originalAmount: 180000, currentBalance: 142000, interestRate: 2.85, monthlyPayment: 820,  startDate: new Date("2018-04-01"), fixedRateEnd: new Date("2028-04-01") },
    { propertyId: p[1].id, label: "Hauptdarlehen", bank: "Sparkasse Berlin",   originalAmount: 210000, currentBalance: 176000, interestRate: 3.1,  monthlyPayment: 950,  startDate: new Date("2017-08-01"), fixedRateEnd: new Date("2027-08-01") },
    { propertyId: p[2].id, label: "Hauptdarlehen", bank: "ING Hamburg",        originalAmount: 145000, currentBalance: 118000, interestRate: 3.45, monthlyPayment: 710,  startDate: new Date("2019-02-01"), fixedRateEnd: new Date("2026-12-01") },
    { propertyId: p[3].id, label: "Hauptdarlehen", bank: "Commerzbank Hamburg",originalAmount: 280000, currentBalance: 241000, interestRate: 2.95, monthlyPayment: 1180, startDate: new Date("2016-10-01"), fixedRateEnd: new Date("2026-10-01") },
    { propertyId: p[4].id, label: "Hauptdarlehen", bank: "Deutsche Bank München",originalAmount:420000, currentBalance: 381000, interestRate: 2.65, monthlyPayment: 1680, startDate: new Date("2020-07-01"), fixedRateEnd: new Date("2030-07-01") },
    { propertyId: p[4].id, label: "KfW-Darlehen",  bank: "KfW",               originalAmount: 80000,  currentBalance: 68000,  interestRate: 1.45, monthlyPayment: 380,  startDate: new Date("2020-07-01"), fixedRateEnd: new Date("2030-07-01") },
  ];

  const loans = await Promise.all(loanData.map(d => prisma.loan.create({ data: d })));
  console.log(`✅ ${loans.length} Darlehen erstellt`);

  // ─── Tilgungsplan (letzte 12 Monate je Darlehen) ─────────────────────────
  const now = new Date();
  for (const loan of loans) {
    const monthlyRate = loan.interestRate / 100 / 12;
    let balance = loan.currentBalance;
    const rows = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const period = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const interestPart = balance * monthlyRate;
      const principalPart = Math.min(loan.monthlyPayment - interestPart, balance);
      const balanceBefore = balance;
      balance = Math.max(0, balance - principalPart);
      rows.push({ loanId: loan.id, period, balanceBefore, interestPart, principalPart, balanceAfter: balance });
    }
    await prisma.amortization.createMany({ data: rows });
  }
  console.log("✅ Tilgungspläne erstellt");

  // ─── Zahlungen (letzte 3 Monate) ─────────────────────────────────────────
  const months = ["2026-08", "2026-09", "2026-10"];
  const payments = [];
  for (const tenant of tenants) {
    for (const month of months) {
      const [year, mon] = month.split("-").map(Number);
      const amount = tenant.coldRent + tenant.utilities;
      payments.push({
        tenantId: tenant.id,
        bookingDate: new Date(year, mon - 1, 2),
        amount,
        payerName: `${tenant.lastName}, ${tenant.firstName}`,
        payerIban: tenant.iban,
        reference: `Miete ${month}`,
        matchMethod: "IBAN",
        matchConfidence: 1.0,
        category: "RENT",
        status: "MATCHED",
        period: month,
        sheetsRowId: `${tenant.id}-${month}`,
      });
    }
  }
  // Ein KI-gematchter und ein unbekannter Datensatz
  payments.push({ bookingDate: new Date("2026-10-02"), amount: 1030.0, payerName: "Müller A.", reference: "Miet Oktober", matchMethod: "AI", matchConfidence: 0.87, tenantId: tenants[0].id, category: "RENT", status: "MATCHED", period: "2026-10", sheetsRowId: "AI-001" });
  payments.push({ bookingDate: new Date("2026-10-03"), amount: 50.0,   payerName: "REWE Rückerstattung", reference: "Kaution", matchMethod: "UNMATCHED", category: "OTHER", status: "MANUAL_REVIEW", period: "2026-10", sheetsRowId: "UNKNOWN-001" });

  await prisma.payment.createMany({ data: payments });
  console.log(`✅ ${payments.length} Zahlungen erstellt`);

  // ─── Nebenkosten ──────────────────────────────────────────────────────────
  await prisma.utilityBill.createMany({ data: [
    { bookingDate: new Date("2026-01-15"), amount: 1240.0, vendor: "Berliner Stadtwerke", category: "HEATING", isAllocatable: true, period: "2025", description: "Fernwärme Jahresabr. Gartenstr." },
    { bookingDate: new Date("2026-02-20"), amount: 480.0,  vendor: "Berliner Wasserbetriebe", category: "WATER", isAllocatable: true, period: "2025", description: "Wasserpauschale Q1" },
    { bookingDate: new Date("2026-03-10"), amount: 890.0,  vendor: "Allianz Gebäudeversicherung", category: "INSURANCE", isAllocatable: false, period: "2025", description: "Gebäudeversicherung 2025" },
    { bookingDate: new Date("2026-04-05"), amount: 1560.0, vendor: "Heizkostenverteiler GmbH", category: "HEATING", isAllocatable: true, period: "2025", description: "Heizkosten Lindenweg Jahresabr." },
    { bookingDate: new Date("2026-01-20"), amount: 320.0,  vendor: "Hamburgische Wasserbetriebe", category: "WATER", isAllocatable: true, period: "2025", description: "Wasser Lindenweg" },
  ]});

  // ─── Wartungstickets ──────────────────────────────────────────────────────
  await prisma.maintenanceTicket.createMany({ data: [
    { propertyId: p[0].id, title: "Defekte Heizung Bad", description: "Heizkörper heizt nicht mehr", status: "IN_PROGRESS", priority: "HIGH", cost: 380, craftsman: "Sanitär Müller GmbH", reportedAt: new Date("2026-10-15") },
    { propertyId: p[1].id, title: "Türschloss erneuern", description: "Haustürschloss klemmt", status: "REPORTED", priority: "MEDIUM", cost: 120, reportedAt: new Date("2026-10-18") },
    { propertyId: p[2].id, title: "Wasserhahn Bad tropft", status: "DONE", priority: "LOW", cost: 85, craftsman: "Sanitär Hamburg", reportedAt: new Date("2026-09-20"), doneAt: new Date("2026-09-28") },
    { propertyId: p[3].id, title: "Fenstergriff defekt", status: "REPORTED", priority: "LOW", reportedAt: new Date("2026-10-20") },
    { propertyId: p[4].id, title: "Dachrinne verstopft", description: "Starkregen – Dachrinne läuft über", status: "IN_PROGRESS", priority: "HIGH", cost: 450, craftsman: "Dachdeckermeister Fischer", reportedAt: new Date("2026-10-12") },
  ]});

  // ─── Zählerlesungen ───────────────────────────────────────────────────────
  await prisma.meterReading.createMany({ data: [
    { propertyId: p[0].id, type: "ELECTRICITY", value: 4821.5, unit: "kWh", readingDate: new Date("2026-10-01") },
    { propertyId: p[0].id, type: "WATER",       value: 312.8,  unit: "m³",  readingDate: new Date("2026-10-01") },
    { propertyId: p[1].id, type: "ELECTRICITY", value: 5102.0, unit: "kWh", readingDate: new Date("2026-10-01") },
    { propertyId: p[1].id, type: "HEATING",     value: 1820.3, unit: "kWh", readingDate: new Date("2026-10-01") },
    { propertyId: p[2].id, type: "ELECTRICITY", value: 2940.0, unit: "kWh", readingDate: new Date("2026-10-01") },
    { propertyId: p[3].id, type: "ELECTRICITY", value: 6210.5, unit: "kWh", readingDate: new Date("2026-10-01") },
    { propertyId: p[3].id, type: "GAS",         value: 8820.0, unit: "m³",  readingDate: new Date("2026-10-01") },
    { propertyId: p[4].id, type: "ELECTRICITY", value: 9120.0, unit: "kWh", readingDate: new Date("2026-10-01") },
    { propertyId: p[4].id, type: "HEATING",     value: 4200.0, unit: "kWh", readingDate: new Date("2026-10-01") },
  ]});

  console.log("\n🎉 Seed abgeschlossen! Dashboard ist bereit.");
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
