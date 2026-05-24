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
      name: "Ember Ceramic Mug",
      sku: "MUG-EMBER-12",
      description: "Temperature-controlled smart mug. Keeps your drink at the perfect temp for hours.",
      price: 149.99,
      imageUrl: null,
    },
    {
      id: "prod-002",
      name: "Aesop Resurrection Hand Wash",
      sku: "AESOP-HW-500",
      description: "Parsley seed-scented, botanically infused. 500ml.",
      price: 42.0,
      imageUrl: null,
    },
    {
      id: "prod-003",
      name: "Ridge Wallet (Carbon Fibre)",
      sku: "RIDGE-CF-001",
      description: "Minimalist RFID-blocking wallet. Carbon fibre finish.",
      price: 95.0,
      imageUrl: null,
    },
    {
      id: "prod-004",
      name: "Anker 100W USB-C Hub",
      sku: "ANKER-USB-100",
      description: "7-in-1 hub with 4K HDMI, 100W PD, and USB 3.2 ports.",
      price: 79.99,
      imageUrl: null,
    },
    {
      id: "prod-005",
      name: "Limited Edition Air Jordan 1",
      sku: "AJ1-RETRO-LTD",
      description: "Chicago colourway. Very limited stock — don't sleep on it.",
      price: 399.0,
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
    { productId: "prod-001", warehouseId: "wh-london",     total: 40, reserved: 0 },
    { productId: "prod-001", warehouseId: "wh-manchester",  total: 25, reserved: 0 },
    { productId: "prod-002", warehouseId: "wh-london",     total: 100, reserved: 0 },
    { productId: "prod-002", warehouseId: "wh-glasgow",    total: 60,  reserved: 0 },
    { productId: "prod-003", warehouseId: "wh-manchester",  total: 15,  reserved: 0 },
    { productId: "prod-003", warehouseId: "wh-glasgow",    total: 8,   reserved: 0 },
    { productId: "prod-004", warehouseId: "wh-london",     total: 50,  reserved: 0 },
    { productId: "prod-004", warehouseId: "wh-manchester",  total: 30,  reserved: 0 },
    { productId: "prod-004", warehouseId: "wh-glasgow",    total: 20,  reserved: 0 },
    // Air Jordan deliberately scarce to demo race condition protection
    { productId: "prod-005", warehouseId: "wh-london",     total: 2,   reserved: 0 },
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
