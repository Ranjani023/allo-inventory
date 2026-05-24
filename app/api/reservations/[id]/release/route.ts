import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await prisma.$transaction(async (tx: any) => {
      const reservations = await tx.$queryRaw`
        SELECT id, status, "stockId", qty
        FROM reservations
        WHERE id = ${id}
        FOR UPDATE
      ` as Array<{ id: string; status: string; stockId: string; qty: number }>;

      if (reservations.length === 0) {
        throw { code: "NOT_FOUND" };
      }

      const r = reservations[0];

      if (r.status !== "PENDING") {
        return { id: r.id, status: r.status };
      }

      await tx.$executeRaw`
        UPDATE reservations SET status = 'RELEASED'
        WHERE id = ${id}
      `;

      await tx.$executeRaw`
        UPDATE stock SET reserved = reserved - ${r.qty}
        WHERE id = ${r.stockId}
      `;

      return { id, status: "RELEASED" };
    });

    return NextResponse.json(result);
  } catch (err: unknown) {
    const e = err as { code?: string };
    if (e?.code === "NOT_FOUND") {
      return NextResponse.json({ error: "Reservation not found" }, { status: 404 });
    }
    console.error("Release error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
