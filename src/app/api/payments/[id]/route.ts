import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  const { id } = await Promise.resolve(params);
  const body = await request.json();

  const updateData: Record<string, unknown> = {};
  if (body.tenantId !== undefined) {
    updateData.tenantId = body.tenantId || null;
  }
  if (body.propertyId !== undefined) {
    updateData.propertyId = body.propertyId || null;
  }
  if (body.loanId !== undefined) {
    updateData.loanId = body.loanId || null;
  }
  if (body.matchMethod !== undefined) {
    updateData.matchMethod = body.matchMethod;
  }
  if (body.category !== undefined) {
    updateData.category = body.category;
  }
  if (body.period !== undefined) {
    updateData.period = body.period;
  }
  if (body.amount !== undefined) {
    updateData.amount = parseFloat(body.amount);
  }
  if (body.status !== undefined) {
    updateData.status = body.status;
  } else if (body.tenantId || body.propertyId || body.loanId) {
    updateData.status = "MATCHED";
  }

  const payment = await prisma.payment.update({
    where: { id },
    data: updateData,
    include: {
      tenant: {
        include: {
          property: true,
        },
      },
      property: true,
      loan: {
        include: {
          property: true,
        },
      },
    },
  });

  return NextResponse.json(payment);
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  const { id } = await Promise.resolve(params);
  await prisma.payment.delete({
    where: { id },
  });

  return NextResponse.json({ success: true });
}
