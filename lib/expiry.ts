// eslint-disable-next-line @typescript-eslint/no-require-imports
const { PrismaClient } = require("@prisma/client");

// Use the shared prisma instance
import { prisma } from "./prisma";

/**
 * Lazy expiry cleanup: releases all PENDING reservations past their expiresAt.
 * Called at the start of read/write handlers that need fresh available counts.
 * In production, complement with a Vercel Cron job hitting /api/cron/expire.
 */
export async function releaseExpiredReservations() {
  const now = new Date();

  // Find expired pending reservations
  const expired = await prisma.reservation.findMany({
    where: { status: "PENDING", expiresAt: { lt: now } },
    select: { id: true, stockId: true, qty: true },
  });

  if (expired.length === 0) return;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await prisma.$transaction(async (tx: any) => {
    for (const r of expired) {
      await tx.stock.update({
        where: { id: r.stockId },
        data: { reserved: { decrement: r.qty } },
      });
    }
    await tx.reservation.updateMany({
      where: { id: { in: expired.map((r: { id: string }) => r.id) } },
      data: { status: "RELEASED" },
    });
  });
}
