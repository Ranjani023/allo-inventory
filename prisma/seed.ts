/* eslint-disable @typescript-eslint/no-require-imports */
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  const [london, manchester, glasgow] = await Promise.all([
    prisma.warehouse.upsert({
      where: { id: "wh-london" },
      update: {},
      create: { id: "wh-london", name: "London Central", location: "London, UK" },
    }),
    prisma.warehouse.upsert({
      where: { id: "wh-manchester" },
      update: {},
      create: { id: "wh-manchester", name: "Manchester North", location: "Manchester, UK" },
    }),
    prisma.warehouse.upsert({
      where: { id: "wh-glasgow" },
      update: {},
      create: { id: "wh-glasgow", name: "Glasgow Distribution", location: "Glasgow, UK" },
    }),
  ]);

  console.log("Warehouses seeded:", london.name, manchester.name, glasgow.name);

  const products = [
    {
      id: "prod-001",
      name: "Testosterone Test Kit",
      sku: "TEST-KIT-001",
      description: "At-home finger-prick blood test. Results in 48 hours with doctor review included.",
      price: 49.99,
      imageUrl: null,
    },
    {
      id: "prod-002",
      name: "Vitamin D + Zinc Supplements",
      sku: "SUPP-VDZ-60",
      description: "60-day supply. Clinically formulated to support testosterone levels and energy.",
      price: 29.99,
      imageUrl: null,
    },
    {
      id: "prod-003",
      name: "Online Doctor Consultation",
      sku: "CONSULT-30MIN",
      description: "30-minute private video consultation with a licensed men's health specialist.",
      price: 79.00,
      imageUrl: null,
    },
    {
      id: "prod-004",
      name: "ED Treatment Pack (3 Month)",
      sku: "ED-PACK-3M",
      description: "3-month prescribed treatment plan. Discreet packaging, delivered to your door.",
      price: 149.00,
      imageUrl: null,
    },
    {
      id: "prod-005",
      name: "Premium Health Monitoring Kit",
      sku: "MON-KIT-PRO",
      description: "Comprehensive at-home kit — testosterone, cortisol, vitamin D, thyroid. Very limited stock.",
      price: 199.00,
      imageUrl: null,
    },
  ];

  for (const p of products) {
    await prisma.product.upsert({
      where: { sku: p.sku },
      update: {},
      create: p,
    });
  }

  console.log("Products seeded:", products.length);

  const stockEntries = [
    { productId: "prod-001", warehouseId: "wh-london",      total: 40, reserved: 0 },
    { productId: "prod-001", warehouseId: "wh-manchester",  total: 25, reserved: 0 },
    { productId: "prod-002", warehouseId: "wh-london",      total: 100, reserved: 0 },
    { productId: "prod-002", warehouseId: "wh-glasgow",     total: 60,  reserved: 0 },
    { productId: "prod-003", warehouseId: "wh-manchester",  total: 15,  reserved: 0 },
    { productId: "prod-003", warehouseId: "wh-glasgow",     total: 8,   reserved: 0 },
    { productId: "prod-004", warehouseId: "wh-london",      total: 50,  reserved: 0 },
    { productId: "prod-004", warehouseId: "wh-manchester",  total: 30,  reserved: 0 },
    { productId: "prod-004", warehouseId: "wh-glasgow",     total: 20,  reserved: 0 },
    // Premium Kit deliberately scarce to demo race condition protection
    { productId: "prod-005", warehouseId: "wh-london",      total: 2,   reserved: 0 },
    { productId: "prod-005", warehouseId: "wh-manchester",  total: 1,   reserved: 0 },
  ];
  for (const s of stockEntries) {
    await prisma.stock.upsert({
      where: {
        productId_warehouseId: {
          productId: s.productId,
          warehouseId: s.warehouseId,
        },
      },
      update: { total: s.total, reserved: 0 },
      create: s,
    });
  }

  console.log("Stock seeded:", stockEntries.length, "entries");
  console.log("Done!");
}

main()
  .catch((e: Error) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
