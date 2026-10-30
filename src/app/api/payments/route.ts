import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const period = searchParams.get("period");
  const propertyId = searchParams.get("propertyId");
  const status = searchParams.get("status");

  const where: Record<string, unknown> = {};
  if (period && period !== "ALL") where.period = period;
  if (propertyId) {
    where.OR = [
      { tenant: { is: { property: { is: { id: propertyId } } } } },
      { propertyId: propertyId },
      { loan: { is: { propertyId: propertyId } } },
    ];
  }
  if (status) where.status = status;

  const payments = await prisma.payment.findMany({
    where,
    include: {
      tenant: {
        include: {
          property: {
            include: {
              rentAdjustments: {
                orderBy: { effectiveDate: "asc" },
              },
            },
          },
        },
      },
      property: true,
      loan: {
        include: {
          property: true,
        },
      },
    },
    orderBy: { bookingDate: "desc" },
    take: 500,
  });

  return NextResponse.json(payments);
}

export async function POST(request: Request) {
  const body = await request.json();
  const payment = await prisma.payment.create({
    data: {
      tenantId: body.tenantId || null,
      propertyId: body.propertyId || null,
      loanId: body.loanId || null,
      bookingDate: new Date(body.bookingDate),
      amount: parseFloat(body.amount),
      payerName: body.payerName,
      payerIban: body.payerIban,
      reference: body.reference,
      matchMethod: body.matchMethod || "MANUAL",
      matchConfidence: body.matchConfidence,
      category: body.category || "RENT",
      status: body.status || "MATCHED",
      period: body.period,
      sheetsRowId: body.sheetsRowId,
    },
    include: {
      tenant: true,
      property: true,
      loan: { include: { property: true } },
    },
  });
  return NextResponse.json(payment, { status: 201 });
}
