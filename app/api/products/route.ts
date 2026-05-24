import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { releaseExpiredReservations } from "@/lib/expiry";

export async function GET() {
  await releaseExpiredReservations();

  const products = await prisma.product.findMany({
    include: {
      stock: {
        include: { warehouse: true },
      },
    },
    orderBy: { name: "asc" },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = products.map((p: any) => ({
    id: p.id,
    name: p.name,
    sku: p.sku,
    description: p.description,
    imageUrl: p.imageUrl,
    price: p.price,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    stock: p.stock.map((s: any) => ({
      warehouseId: s.warehouseId,
      warehouseName: s.warehouse.name,
      warehouseLocation: s.warehouse.location,
      total: s.total,
      reserved: s.reserved,
      available: s.total - s.reserved,
    })),
  }));

  return NextResponse.json(result);
}
