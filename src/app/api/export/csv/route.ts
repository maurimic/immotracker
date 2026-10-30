import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function escapeCsv(val: unknown): string {
  if (val === null || val === undefined) return "";
  const str = String(val).replace(/"/g, '""');
  if (str.includes(";") || str.includes("\n") || str.includes('"')) {
    return `"${str}"`;
  }
  return str;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type") || "properties";

  let csvContent = "";
  let filename = `immotracker_${type}_${new Date().toISOString().slice(0, 10)}.csv`;

  if (type === "properties") {
    const props = await prisma.property.findMany({
      include: { tenant: true },
      orderBy: { name: "asc" },
    });

    const headers = [
      "Wohnungs-ID", "Bezeichnung", "Adresse", "Wohnfläche (m²)", "Zimmer", "Etage",
      "Kaufpreis (€)", "Kaufnebenkosten (€)", "Kaufdatum", "Übergabedatum",
      "Mieter Vorname", "Mieter Nachname", "Mieter E-Mail", "Mieter Telefon", "Mieter IBAN",
      "Soll-Kaltmiete (€)", "NK-Vorauszahlung (€)", "Gesamtmiete (€)", "Kaution (€)",
      "Kaution bezahlt", "Einzugsdatum", "Vertragsbeginn"
    ];

    const rows = props.map((p) => [
      escapeCsv(p.id),
      escapeCsv(p.name),
      escapeCsv(p.address),
      escapeCsv(p.sqm),
      escapeCsv(p.rooms || ""),
      escapeCsv(p.floor || ""),
      escapeCsv(p.purchasePrice || ""),
      escapeCsv(p.ancillaryCosts || ""),
      escapeCsv(p.purchasedAt ? p.purchasedAt.toISOString().slice(0, 10) : ""),
      escapeCsv(p.possessionAt ? p.possessionAt.toISOString().slice(0, 10) : ""),
      escapeCsv(p.tenant?.firstName || ""),
      escapeCsv(p.tenant?.lastName || ""),
      escapeCsv(p.tenant?.email || ""),
      escapeCsv(p.tenant?.phone || ""),
      escapeCsv(p.tenant?.iban || ""),
      escapeCsv(p.tenant?.coldRent ?? ""),
      escapeCsv(p.tenant?.utilities ?? ""),
      escapeCsv(p.tenant ? (p.tenant.coldRent + p.tenant.utilities) : ""),
      escapeCsv(p.tenant?.deposit ?? ""),
      escapeCsv(p.tenant?.depositPaid ? "JA" : "NEIN"),
      escapeCsv(p.tenant?.moveInDate ? p.tenant.moveInDate.toISOString().slice(0, 10) : ""),
      escapeCsv(p.tenant?.contractStart ? p.tenant.contractStart.toISOString().slice(0, 10) : ""),
    ].join(";"));

    csvContent = [headers.join(";"), ...rows].join("\r\n");
  } else if (type === "payments") {
    const payments = await prisma.payment.findMany({
      include: { tenant: { include: { property: true } } },
      orderBy: { bookingDate: "desc" },
    });

    const headers = [
      "Buchungs-ID", "Buchungsdatum", "Betrag (€)", "Auftraggeber", "IBAN",
      "Verwendungszweck", "Kategorie", "Status", "Matching-Methode", "Zuordnung Mieter", "Wohnung", "Monatsperiode"
    ];

    const rows = payments.map((p) => [
      escapeCsv(p.id),
      escapeCsv(p.bookingDate.toISOString().slice(0, 10)),
      escapeCsv(p.amount),
      escapeCsv(p.payerName),
      escapeCsv(p.payerIban || ""),
      escapeCsv(p.reference || ""),
      escapeCsv(p.category),
      escapeCsv(p.status),
      escapeCsv(p.matchMethod || ""),
      escapeCsv(p.tenant ? `${p.tenant.firstName} ${p.tenant.lastName}` : "Nicht zugeordnet"),
      escapeCsv(p.tenant?.property?.name || ""),
      escapeCsv(p.period || ""),
    ].join(";"));

    csvContent = [headers.join(";"), ...rows].join("\r\n");
  } else if (type === "loans") {
    const loans = await prisma.loan.findMany({
      include: { property: true },
      orderBy: { label: "asc" },
    });

    const headers = [
      "Darlehens-ID", "Bezeichnung", "Bank", "Zugeordnete Wohnung",
      "Ursprünglicher Betrag (€)", "Aktuelle Restschuld (€)", "Sollzins (%)",
      "Monatliche Rate (€)", "Zinsbindungsende", "Startdatum"
    ];

    const rows = loans.map((l) => [
      escapeCsv(l.id),
      escapeCsv(l.label),
      escapeCsv(l.bank || ""),
      escapeCsv(l.property?.name || "Gesamtes Portfolio"),
      escapeCsv(l.originalAmount),
      escapeCsv(l.currentBalance),
      escapeCsv(l.interestRate),
      escapeCsv(l.monthlyPayment),
      escapeCsv(l.fixedRateEnd ? l.fixedRateEnd.toISOString().slice(0, 10) : ""),
      escapeCsv(l.startDate ? l.startDate.toISOString().slice(0, 10) : ""),
    ].join(";"));

    csvContent = [headers.join(";"), ...rows].join("\r\n");
  } else if (type === "tickets") {
    const tickets = await prisma.maintenanceTicket.findMany({
      include: { property: true },
      orderBy: { reportedAt: "desc" },
    });

    const headers = [
      "Ticket-ID", "Wohnung", "Titel", "Beschreibung", "Status", "Priorität",
      "Kosten (€)", "Handwerker", "Gemeldet am", "Erledigt am"
    ];

    const rows = tickets.map((t) => [
      escapeCsv(t.id),
      escapeCsv(t.property?.name || ""),
      escapeCsv(t.title),
      escapeCsv(t.description || ""),
      escapeCsv(t.status),
      escapeCsv(t.priority),
      escapeCsv(t.cost || ""),
      escapeCsv(t.craftsman || ""),
      escapeCsv(t.reportedAt.toISOString().slice(0, 10)),
      escapeCsv(t.doneAt ? t.doneAt.toISOString().slice(0, 10) : ""),
    ].join(";"));

    csvContent = [headers.join(";"), ...rows].join("\r\n");
  } else if (type === "meters") {
    const meters = await prisma.meterReading.findMany({
      include: { property: true },
      orderBy: { readingDate: "desc" },
    });

    const headers = ["ID", "Wohnung", "Zählertyp", "Ablesewert", "Einheit", "Ablesedatum", "Notiz"];

    const rows = meters.map((m) => [
      escapeCsv(m.id),
      escapeCsv(m.property?.name || ""),
      escapeCsv(m.type),
      escapeCsv(m.value),
      escapeCsv(m.unit),
      escapeCsv(m.readingDate.toISOString().slice(0, 10)),
      escapeCsv(m.notes || ""),
    ].join(";"));

    csvContent = [headers.join(";"), ...rows].join("\r\n");
  } else {
    return NextResponse.json({ error: "Ungültiger Exporttyp" }, { status: 400 });
  }

  // Prepend UTF-8 BOM so Excel opens German Umlauts seamlessly
  const bom = "\uFEFF";
  const output = bom + csvContent;

  return new NextResponse(output, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
