import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const tenant = await prisma.tenant.findUnique({
    where: { id: params.id },
    include: { property: { select: { name: true } } },
  });
  if (!tenant) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
  return NextResponse.json(tenant);
}

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const tenant = await prisma.tenant.update({
      where: { id: params.id },
      data: {
        firstName: body.firstName,
        lastName: body.lastName,
        email: body.email !== undefined ? body.email : undefined,
        phone: body.phone !== undefined ? body.phone : undefined,
        iban: body.iban !== undefined ? body.iban : undefined,
        coldRent: body.coldRent !== undefined ? parseFloat(body.coldRent) : undefined,
        utilities: body.utilities !== undefined ? parseFloat(body.utilities) : undefined,
        deposit: body.deposit !== undefined ? parseFloat(body.deposit) : undefined,
        depositPaid: body.depositPaid !== undefined ? Boolean(body.depositPaid) : undefined,
        moveInDate: body.moveInDate ? new Date(body.moveInDate) : undefined,
        contractStart: body.contractStart ? new Date(body.contractStart) : undefined,
        moveOutDate: body.moveOutDate ? new Date(body.moveOutDate) : null,
      },
      include: { property: { select: { name: true } } },
    });
    return NextResponse.json(tenant);
  } catch (error: any) {
    console.error("Fehler beim Aktualisieren des Mieters:", error);
    return NextResponse.json(
      { error: error?.message || "Fehler beim Aktualisieren des Mieters" },
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
    const tenantId = params.id;
    // Unlink payments so transaction history remains intact without foreign key block
    await prisma.payment.updateMany({
      where: { tenantId },
      data: { tenantId: null },
    });

    await prisma.tenant.delete({
      where: { id: tenantId },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Fehler beim Löschen des Mieters:", error);
    return NextResponse.json(
      { error: error?.message || "Fehler beim Löschen des Mieters" },
      { status: 500 }
    );
  }
}
