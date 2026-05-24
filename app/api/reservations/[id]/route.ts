import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function formatReservation(reservation: any) {
  return {
    id: reservation.id,
    qty: reservation.qty,
    status: reservation.status,
    expiresAt: reservation.expiresAt,
    product: {
      id: reservation.stock.product.id,
      name: reservation.stock.product.name,
      sku: reservation.stock.product.sku,
      price: reservation.stock.product.price,
    },
    warehouse: {
      id: reservation.stock.warehouse.id,
      name: reservation.stock.warehouse.name,
      location: reservation.stock.warehouse.location,
    },
  };
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const reservation = await prisma.reservation.findUnique({
    where: { id },
    include: {
      stock: {
        include: { product: true, warehouse: true },
      },
    },
  });

  if (!reservation) {
    return NextResponse.json({ error: "Reservation not found" }, { status: 404 });
  }

  // Lazy expire on read
  if (reservation.status === "PENDING" && reservation.expiresAt < new Date()) {
    await prisma.$transaction(async (tx) => {
      await tx.reservation.update({ where: { id }, data: { status: "RELEASED" } });
      await tx.stock.update({
        where: { id: reservation.stockId },
        data: { reserved: { decrement: reservation.qty } },
      });
    });
    return NextResponse.json({ ...formatReservation(reservation), status: "RELEASED" });
  }

  return NextResponse.json(formatReservation(reservation));
}
