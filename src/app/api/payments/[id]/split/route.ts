import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * POST /api/payments/[id]/split
 * Teilt eine Bankbuchung in mehrere Teilbuchungen (Splits) auf.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const { id } = await Promise.resolve(params);
    const body = await request.json();
    const splits = body.splits as Array<{
      amount: number | string;
      category?: string;
      tenantId?: string | null;
      propertyId?: string | null;
      loanId?: string | null;
      period?: string | null;
      reference?: string | null;
    }>;

    if (!splits || !Array.isArray(splits) || splits.length < 2) {
      return NextResponse.json(
        { error: "Eine Buchung muss in mindestens zwei Teilbuchungen aufgeteilt werden." },
        { status: 400 }
      );
    }

    const parentPayment = await prisma.payment.findUnique({
      where: { id },
      include: { splitPayments: true },
    });

    if (!parentPayment) {
      return NextResponse.json({ error: "Buchung nicht gefunden." }, { status: 404 });
    }

    // Wenn es sich bereits um eine Teilbuchung handelt, verbiete das Verschachteln
    if (parentPayment.parentPaymentId) {
      return NextResponse.json(
        { error: "Eine Teilbuchung kann nicht weiter verschachtelt aufgeteilt werden." },
        { status: 400 }
      );
    }

    // Summe der Teilbeträge validieren (Toleranz 0.01 € für Rundungsdifferenzen)
    let totalSplit = 0;
    for (const s of splits) {
      const a = typeof s.amount === "number" ? s.amount : parseFloat(String(s.amount));
      if (isNaN(a) || a === 0) {
        return NextResponse.json(
          { error: "Alle Teilbeträge müssen gültige Zahlen ungleich 0 sein." },
          { status: 400 }
        );
      }
      totalSplit += a;
    }

    const diff = Math.abs(Math.round(totalSplit * 100) - Math.round(parentPayment.amount * 100)) / 100;
    if (diff > 0.02) {
      return NextResponse.json(
        {
          error: `Die Summe der Teilbuchungen (${totalSplit.toFixed(2)} €) muss genau dem Originalbetrag (${parentPayment.amount.toFixed(2)} €) entsprechen. Differenz: ${diff.toFixed(2)} €.`,
        },
        { status: 400 }
      );
    }

    // In einer Transaktion ausführen: alte Splits löschen, neue anlegen, Parent aktualisieren
    const result = await prisma.$transaction(async (tx) => {
      // 1. Ggf. vorhandene alte Teilbuchungen löschen
      await tx.payment.deleteMany({
        where: { parentPaymentId: parentPayment.id },
      });

      // 2. Neue Teilbuchungen erstellen
      const createdSplits = [];
      for (const s of splits) {
        const amt = typeof s.amount === "number" ? s.amount : parseFloat(String(s.amount));
        let propId = s.propertyId === "NONE" ? null : (s.propertyId || null);

        // Falls Mieter gewählt aber keine Wohnung explizit: aus Mieter ableiten
        if (s.tenantId && s.tenantId !== "NONE" && !propId) {
          const tenant = await tx.tenant.findUnique({
            where: { id: s.tenantId },
            select: { propertyId: true },
          });
          if (tenant?.propertyId) propId = tenant.propertyId;
        }

        // Periode bereinigen (Format MM.YYYY -> YYYY-MM)
        let periodVal = s.period ? String(s.period).trim() : null;
        if (periodVal) {
          const match = periodVal.match(/^(\d{1,2})[./-](\d{4})$/);
          if (match) {
            periodVal = `${match[2]}-${String(parseInt(match[1], 10)).padStart(2, "0")}`;
          }
        }

        const child = await tx.payment.create({
          data: {
            parentPaymentId: parentPayment.id,
            tenantId: s.tenantId === "NONE" ? null : (s.tenantId || null),
            propertyId: propId,
            loanId: s.loanId === "NONE" ? null : (s.loanId || null),
            bookingDate: parentPayment.bookingDate,
            amount: amt,
            payerName: parentPayment.payerName,
            payerIban: parentPayment.payerIban,
            reference: s.reference?.trim() || `Split aus: ${parentPayment.reference || parentPayment.payerName}`.slice(0, 200),
            matchMethod: "SPLIT",
            matchConfidence: 1.0,
            category: s.category || "RENT",
            status: "MATCHED",
            period: periodVal || parentPayment.period,
            sheetsRowId: null,
          },
          include: {
            tenant: { include: { property: true } },
            property: true,
            loan: true,
          },
        });
        createdSplits.push(child);
      }

      // 3. Parent-Buchung auf isSplit = true setzen
      const updatedParent = await tx.payment.update({
        where: { id: parentPayment.id },
        data: {
          isSplit: true,
          status: "SPLIT",
          matchMethod: "SPLIT",
        },
        include: {
          tenant: true,
          property: true,
          loan: true,
          splitPayments: {
            include: {
              tenant: { include: { property: true } },
              property: true,
              loan: true,
            },
          },
        },
      });

      return { updatedParent, createdSplits };
    });

    return NextResponse.json({
      success: true,
      parent: result.updatedParent,
      splits: result.createdSplits,
    });
  } catch (error: any) {
    console.error("[Split Payment Error]:", error);
    return NextResponse.json(
      { error: error?.message || "Fehler beim Aufteilen der Buchung" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/payments/[id]/split
 * Hebt die Aufteilung einer Buchung auf und stellt die Originalbuchung wieder her.
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const { id } = await Promise.resolve(params);

    const parentPayment = await prisma.payment.findUnique({
      where: { id },
      include: { splitPayments: true },
    });

    if (!parentPayment) {
      return NextResponse.json({ error: "Buchung nicht gefunden." }, { status: 404 });
    }

    if (!parentPayment.isSplit && parentPayment.splitPayments.length === 0) {
      return NextResponse.json(
        { error: "Diese Buchung ist nicht aufgeteilt." },
        { status: 400 }
      );
    }

    await prisma.$transaction(async (tx) => {
      // 1. Alle Teilbuchungen löschen
      await tx.payment.deleteMany({
        where: { parentPaymentId: parentPayment.id },
      });

      // 2. Parent-Buchung zurücksetzen
      await tx.payment.update({
        where: { id: parentPayment.id },
        data: {
          isSplit: false,
          status:
            parentPayment.tenantId || parentPayment.propertyId || parentPayment.loanId
              ? "MATCHED"
              : "MANUAL_REVIEW",
          matchMethod: parentPayment.matchMethod === "SPLIT" ? "MANUAL" : parentPayment.matchMethod,
        },
      });
    });

    return NextResponse.json({ success: true, message: "Aufteilung erfolgreich aufgehoben." });
  } catch (error: any) {
    console.error("[Unsplit Payment Error]:", error);
    return NextResponse.json(
      { error: error?.message || "Fehler beim Aufheben der Aufteilung" },
      { status: 500 }
    );
  }
}
