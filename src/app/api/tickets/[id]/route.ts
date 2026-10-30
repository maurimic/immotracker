import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const { id } = await Promise.resolve(params);
    const body = await request.json();
    const ticket = await prisma.maintenanceTicket.update({
      where: { id },
      data: {
        status: body.status !== undefined ? body.status : undefined,
        cost: body.cost !== undefined ? (body.cost ? parseFloat(body.cost) : null) : undefined,
        craftsman: body.craftsman !== undefined ? body.craftsman : undefined,
        doneAt: body.status === "DONE"
          ? new Date()
          : body.status !== undefined && body.status !== "DONE"
          ? null
          : (body.doneAt ? new Date(body.doneAt) : undefined),
        title: body.title !== undefined ? body.title : undefined,
        description: body.description !== undefined ? body.description : undefined,
        priority: body.priority !== undefined ? body.priority : undefined,
      },
      include: { property: { select: { name: true } } },
    });
    return NextResponse.json(ticket);
  } catch (error: any) {
    console.error("Fehler beim Aktualisieren des Tickets:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  ctx: { params: { id: string } }
) {
  return PATCH(request, ctx);
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const { id } = await Promise.resolve(params);
    await prisma.maintenanceTicket.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Fehler beim Löschen des Tickets:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
