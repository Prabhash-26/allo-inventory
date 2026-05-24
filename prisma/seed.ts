import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database…");

  // Clean up
  await prisma.idempotencyRecord.deleteMany();
  await prisma.reservation.deleteMany();
  await prisma.stockLevel.deleteMany();
  await prisma.product.deleteMany();
  await prisma.warehouse.deleteMany();

  // Warehouses
  const [mumbai, delhi, bengaluru] = await Promise.all([
    prisma.warehouse.create({
      data: { name: "Mumbai Central", location: "Andheri East, Mumbai, MH" },
    }),
    prisma.warehouse.create({
      data: { name: "Delhi NCR", location: "Gurugram, Haryana" },
    }),
    prisma.warehouse.create({
      data: { name: "Bengaluru Hub", location: "Whitefield, Bengaluru, KA" },
    }),
  ]);

  console.log("✓ Created 3 warehouses");

  // Products
  const products = await Promise.all([
    prisma.product.create({
      data: {
        name: "Allo Pro Wireless Earbuds",
        sku: "ALLO-EAR-PRO-01",
        description: "Active noise cancellation, 30h battery, IPX5 waterproof",
      },
    }),
    prisma.product.create({
      data: {
        name: "Allo Smart Watch Series 3",
        sku: "ALLO-WATCH-S3-01",
        description: "Health tracking, GPS, 5-day battery life",
      },
    }),
    prisma.product.create({
      data: {
        name: "Allo Portable Charger 20000mAh",
        sku: "ALLO-CHRG-20K-01",
        description: "65W PD fast charging, 3 USB-C ports",
      },
    }),
    prisma.product.create({
      data: {
        name: "Allo Mechanical Keyboard TKL",
        sku: "ALLO-KB-TKL-01",
        description: "Hot-swap switches, per-key RGB, aluminum body",
      },
    }),
    prisma.product.create({
      data: {
        name: "Allo Gaming Mouse Pro",
        sku: "ALLO-MOUSE-G01",
        description: "26000 DPI sensor, 7 programmable buttons",
      },
    }),
    prisma.product.create({
      data: {
        name: "Allo USB-C Hub 7-in-1",
        sku: "ALLO-HUB-7IN1-01",
        description: "4K HDMI, 100W PD, 3×USB-A, SD card reader",
      },
    }),
  ]);

  console.log(`✓ Created ${products.length} products`);

  // Stock levels (product × warehouse combinations)
  const stockData = [
    // Earbuds
    { productId: products[0].id, warehouseId: mumbai.id, totalUnits: 50, reservedUnits: 3 },
    { productId: products[0].id, warehouseId: delhi.id, totalUnits: 30, reservedUnits: 0 },
    { productId: products[0].id, warehouseId: bengaluru.id, totalUnits: 20, reservedUnits: 2 },
    // Smart Watch
    { productId: products[1].id, warehouseId: mumbai.id, totalUnits: 15, reservedUnits: 1 },
    { productId: products[1].id, warehouseId: delhi.id, totalUnits: 8, reservedUnits: 0 },
    { productId: products[1].id, warehouseId: bengaluru.id, totalUnits: 3, reservedUnits: 2 }, // low stock
    // Charger
    { productId: products[2].id, warehouseId: mumbai.id, totalUnits: 100, reservedUnits: 5 },
    { productId: products[2].id, warehouseId: delhi.id, totalUnits: 0, reservedUnits: 0 },   // out of stock
    { productId: products[2].id, warehouseId: bengaluru.id, totalUnits: 60, reservedUnits: 0 },
    // Keyboard
    { productId: products[3].id, warehouseId: mumbai.id, totalUnits: 25, reservedUnits: 0 },
    { productId: products[3].id, warehouseId: bengaluru.id, totalUnits: 18, reservedUnits: 1 },
    // Mouse
    { productId: products[4].id, warehouseId: delhi.id, totalUnits: 40, reservedUnits: 2 },
    { productId: products[4].id, warehouseId: bengaluru.id, totalUnits: 22, reservedUnits: 0 },
    // Hub
    { productId: products[5].id, warehouseId: mumbai.id, totalUnits: 75, reservedUnits: 4 },
    { productId: products[5].id, warehouseId: delhi.id, totalUnits: 45, reservedUnits: 1 },
  ];

  await prisma.stockLevel.createMany({ data: stockData });

  console.log(`✓ Created ${stockData.length} stock level records`);
  console.log("🎉 Seed complete!");
}

main()
  .catch((e) => {
    console.error("Seed failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
