import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const loan = await prisma.loan.findUnique({
    where: { id: params.id },
    include: {
      property: { select: { name: true, sqm: true } },
      amortizations: { orderBy: { period: "desc" }, take: 24 },
    },
  });
  if (!loan) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
  return NextResponse.json(loan);
}

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const loan = await prisma.loan.update({
      where: { id: params.id },
      data: {
        propertyId: body.propertyId || undefined,
        label: body.label,
        bank: body.bank !== undefined ? body.bank : undefined,
        originalAmount: body.originalAmount ? parseFloat(body.originalAmount) : undefined,
        currentBalance: body.currentBalance !== undefined ? parseFloat(body.currentBalance) : undefined,
        interestRate: body.interestRate ? parseFloat(body.interestRate) : undefined,
        monthlyPayment: body.monthlyPayment ? parseFloat(body.monthlyPayment) : undefined,
        startDate: body.startDate ? new Date(body.startDate) : undefined,
        fixedRateEnd: body.fixedRateEnd ? new Date(body.fixedRateEnd) : undefined,
      },
      include: { property: { select: { name: true, sqm: true } } },
    });
    return NextResponse.json(loan);
  } catch (error: any) {
    console.error("Fehler beim Aktualisieren des Darlehens:", error);
    return NextResponse.json(
      { error: error?.message || "Fehler beim Aktualisieren des Darlehens" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: Request,
  ctx: { params: { id: string } }
) {
  return PUT(request, ctx);
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const loanId = params.id;
    await prisma.$transaction(async (tx) => {
      await tx.amortization.deleteMany({ where: { loanId } });
      await tx.loan.delete({ where: { id: loanId } });
    });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Fehler beim Löschen des Darlehens:", error);
    return NextResponse.json(
      { error: error?.message || "Fehler beim Löschen des Darlehens" },
      { status: 500 }
    );
  }
}
