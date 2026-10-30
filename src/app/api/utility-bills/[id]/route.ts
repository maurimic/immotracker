import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await prisma.utilityBill.delete({
      where: { id },
    });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const bill = await prisma.utilityBill.update({
      where: { id },
      data: {
        amount: body.amount !== undefined ? parseFloat(body.amount) : undefined,
        vendor: body.vendor !== undefined ? body.vendor : undefined,
        category: body.category !== undefined ? body.category : undefined,
        isAllocatable: body.isAllocatable !== undefined ? body.isAllocatable : undefined,
        period: body.period !== undefined ? body.period : undefined,
        description: body.description !== undefined ? body.description : undefined,
        propertyId: body.propertyId !== undefined ? (body.propertyId || null) : undefined,
        bookingDate: body.bookingDate ? new Date(body.bookingDate) : undefined,
      },
      include: { property: { select: { name: true } } },
    });
    return NextResponse.json(bill);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
