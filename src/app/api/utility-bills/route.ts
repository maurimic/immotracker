import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const bills = await prisma.utilityBill.findMany({
    include: { property: { select: { name: true } } },
    orderBy: { bookingDate: "desc" },
  });
  return NextResponse.json(bills);
}

export async function POST(request: Request) {
  const body = await request.json();
  const bill = await prisma.utilityBill.create({
    data: {
      propertyId: body.propertyId || null,
      bookingDate: new Date(body.bookingDate),
      amount: parseFloat(body.amount),
      vendor: body.vendor,
      category: body.category || "OTHER",
      isAllocatable: body.isAllocatable ?? true,
      period: body.period,
      description: body.description,
    },
    include: { property: { select: { name: true } } },
  });
  return NextResponse.json(bill, { status: 201 });
}
