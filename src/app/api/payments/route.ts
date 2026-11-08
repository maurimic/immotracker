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

  let propertyId = body.propertyId || null;
  if (body.tenantId && !propertyId) {
    const tenant = await prisma.tenant.findUnique({
      where: { id: body.tenantId },
      select: { propertyId: true },
    });
    if (tenant?.propertyId) {
      propertyId = tenant.propertyId;
    }
  }

  let periodVal = body.period ? String(body.period).trim() : null;
  if (periodVal) {
    const match = periodVal.match(/^(\d{1,2})[./-](\d{4})$/);
    if (match) {
      periodVal = `${match[2]}-${String(parseInt(match[1], 10)).padStart(2, "0")}`;
    }
  }

  const payment = await prisma.payment.create({
    data: {
      tenantId: body.tenantId || null,
      propertyId,
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
      period: periodVal,
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
