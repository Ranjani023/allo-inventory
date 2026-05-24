import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getIdempotentResponse, setIdempotentResponse } from "@/lib/redis";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const idempotencyKey = req.headers.get("idempotency-key");
  if (idempotencyKey) {
    const cached = await getIdempotentResponse(`confirm:${idempotencyKey}`);
    if (cached) {
      return NextResponse.json(cached.body, { status: cached.status });
    }
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await prisma.$transaction(async (tx: any) => {
      const reservations = await tx.$queryRaw`
        SELECT id, status, "expiresAt", "stockId", qty
        FROM reservations
        WHERE id = ${id}
        FOR UPDATE
      ` as Array<{ id: string; status: string; expiresAt: Date; stockId: string; qty: number }>;

      if (reservations.length === 0) {
        throw { code: "NOT_FOUND" };
      }

      const r = reservations[0];

      if (r.status === "CONFIRMED") {
        return { alreadyConfirmed: true, id: r.id, status: r.status };
      }

      if (r.status === "RELEASED" || new Date(r.expiresAt) < new Date()) {
        throw { code: "EXPIRED" };
      }

      await tx.$executeRaw`
        UPDATE reservations SET status = 'CONFIRMED'
        WHERE id = ${id}
      `;

      await tx.$executeRaw`
        UPDATE stock SET total = total - ${r.qty}, reserved = reserved - ${r.qty}
        WHERE id = ${r.stockId}
      `;

      return { id, status: "CONFIRMED" };
    });

    const responseBody = result;
    if (idempotencyKey) {
      await setIdempotentResponse(`confirm:${idempotencyKey}`, { status: 200, body: responseBody });
    }

    return NextResponse.json(responseBody);
  } catch (err: unknown) {
    const e = err as { code?: string };
    if (e?.code === "NOT_FOUND") {
      return NextResponse.json({ error: "Reservation not found" }, { status: 404 });
    }
    if (e?.code === "EXPIRED") {
      return NextResponse.json({ error: "Reservation has expired" }, { status: 410 });
    }
    console.error("Confirm error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
