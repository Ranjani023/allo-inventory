import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { releaseExpiredReservations } from "@/lib/expiry";
import { getIdempotentResponse, setIdempotentResponse } from "@/lib/redis";
import { CreateReservationSchema } from "@/lib/schemas";

const TTL_MINUTES = parseInt(process.env.RESERVATION_TTL_MINUTES ?? "10", 10);

export async function POST(req: NextRequest) {
  // --- Idempotency check ---
  const idempotencyKey = req.headers.get("idempotency-key");
  if (idempotencyKey) {
    const cached = await getIdempotentResponse(idempotencyKey);
    if (cached) {
      return NextResponse.json(cached.body, { status: cached.status });
    }
  }

  // --- Parse + validate body ---
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = CreateReservationSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { productId, warehouseId, qty } = parsed.data;

  // Lazy cleanup before we check stock
  await releaseExpiredReservations();

  try {
    const reservation = await prisma.$transaction(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      async (tx: any) => {
        // Lock the stock row — serializes concurrent reservations for the same SKU
        const stocks = await tx.$queryRaw`
          SELECT id, total, reserved
          FROM stock
          WHERE "productId" = ${productId}
            AND "warehouseId" = ${warehouseId}
          FOR UPDATE
        ` as Array<{ id: string; total: number; reserved: number }>;

        if (stocks.length === 0) {
          throw { code: "NOT_FOUND", message: "Stock record not found for that product/warehouse combination" };
        }

        const stock = stocks[0];
        const available = stock.total - stock.reserved;

        if (available < qty) {
          throw {
            code: "INSUFFICIENT_STOCK",
            message: `Only ${available} unit(s) available`,
            available,
          };
        }

        // Increment reserved inside the lock
        await tx.$executeRaw`
          UPDATE stock SET reserved = reserved + ${qty}
          WHERE id = ${stock.id}
        `;

        const expiresAt = new Date(Date.now() + TTL_MINUTES * 60 * 1000);
        const newReservation = await tx.reservation.create({
          data: {
            stockId: stock.id,
            qty,
            status: "PENDING",
            expiresAt,
            idempotencyKey: idempotencyKey ?? undefined,
          },
          include: {
            stock: {
              include: { product: true, warehouse: true },
            },
          },
        });

        return newReservation;
      },
      { isolationLevel: "Serializable" }
    );

    const responseBody = {
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

    if (idempotencyKey) {
      await setIdempotentResponse(idempotencyKey, { status: 201, body: responseBody });
    }

    return NextResponse.json(responseBody, { status: 201 });
  } catch (err: unknown) {
    const e = err as { code?: string; message?: string; available?: number };
    if (e?.code === "INSUFFICIENT_STOCK") {
      return NextResponse.json(
        { error: e.message, available: e.available },
        { status: 409 }
      );
    }
    if (e?.code === "NOT_FOUND") {
      return NextResponse.json({ error: e.message }, { status: 404 });
    }
    console.error("Reservation error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
