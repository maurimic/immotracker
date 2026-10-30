import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const tickets = await prisma.maintenanceTicket.findMany({
    include: { property: { select: { name: true } } },
    orderBy: [{ status: "asc" }, { priority: "desc" }, { reportedAt: "desc" }],
  });
  return NextResponse.json(tickets);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const ticket = await prisma.maintenanceTicket.create({
      data: {
        propertyId: body.propertyId,
        title: body.title,
        description: body.description,
        status: body.status || "REPORTED",
        priority: body.priority || "MEDIUM",
        cost: body.cost ? parseFloat(body.cost) : null,
        craftsman: body.craftsman,
      },
      include: { property: { select: { name: true } } },
    });
    return NextResponse.json(ticket, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const id = body.id;
    if (!id) {
      return NextResponse.json({ error: "Ticket ID erforderlich" }, { status: 400 });
    }

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

export async function PUT(request: Request) {
  return PATCH(request);
}

export async function DELETE(request: Request) {
  try {
    const url = new URL(request.url);
    const id = url.searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "Ticket ID erforderlich" }, { status: 400 });
    }
    await prisma.maintenanceTicket.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Fehler beim Löschen des Tickets:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
