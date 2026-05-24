import { PrismaClient, ReservationStatus } from "@prisma/client";
import { subDays, subHours, addMinutes } from "date-fns";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...");

  await prisma.reservationEvent.deleteMany();
  await prisma.reservation.deleteMany();
  await prisma.inventory.deleteMany();
  await prisma.product.deleteMany();
  await prisma.warehouse.deleteMany();
  await prisma.idempotencyKey.deleteMany();

  const warehouses = await prisma.warehouse.createManyAndReturn({
    data: [
      { name: "Mumbai Central", location: "Mumbai, Maharashtra" },
      { name: "Delhi North Hub", location: "Delhi, NCR" },
      { name: "Bangalore Tech Park", location: "Bangalore, Karnataka" },
      { name: "Chennai Port", location: "Chennai, Tamil Nadu" },
      { name: "Hyderabad Logistics", location: "Hyderabad, Telangana" },
    ],
  });

  const products = await prisma.product.createManyAndReturn({
    data: [
      {
        name: "Sony WH-1000XM5 Headphones",
        sku: "SONY-WH1000XM5-BLK",
        description:
          "Industry-leading noise cancelling wireless headphones with 30hr battery life.",
        imageUrl: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400",
      },
      {
        name: "Apple MacBook Air M2",
        sku: "APPLE-MBA-M2-256",
        description:
          "Supercharged by M2 chip. 13.6-inch Liquid Retina display, 8GB RAM, 256GB SSD.",
        imageUrl: "https://images.unsplash.com/photo-1541807084-5c52b6b3adef?w=400",
      },
      {
        name: "Samsung Galaxy S24 Ultra",
        sku: "SAMSUNG-S24U-TIT",
        description:
          "200MP camera, built-in S Pen, 5000mAh battery, Titanium build.",
        imageUrl: "https://images.unsplash.com/photo-1610945415295-d9bbf067e59c?w=400",
      },
      {
        name: "Nike Air Max 270",
        sku: "NIKE-AM270-WHT-10",
        description:
          "Max Air heel unit for all-day comfort. Breathable mesh upper.",
        imageUrl: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400",
      },
      {
        name: "Dyson V15 Detect",
        sku: "DYSON-V15-DETECT",
        description:
          "Laser detects invisible dust. HEPA filtration captures 99.99% of particles.",
        imageUrl: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400",
      },
      {
        name: "iPad Pro 12.9 M2",
        sku: "APPLE-IPADPRO-M2-128",
        description:
          "M2 chip, Liquid Retina XDR display, Thunderbolt connectivity.",
        imageUrl: "https://images.unsplash.com/photo-1542751110-97427bbecf20?w=400",
      },
      {
        name: "LG OLED C3 55\"",
        sku: "LG-OLED-C3-55",
        description:
          "Self-lit OLED pixels, α9 AI Processor Gen6, Dolby Vision & Atmos.",
        imageUrl: "https://images.unsplash.com/photo-1593359677879-a4bb92f829d1?w=400",
      },
      {
        name: "Kindle Paperwhite 11th Gen",
        sku: "AMAZON-KPW-11-BLK",
        description:
          "6.8\" display with adjustable warm light, 10 weeks battery, waterproof.",
        imageUrl: "https://images.unsplash.com/photo-1592496431122-2349e0fbc666?w=400",
      },
      {
        name: "Instant Pot Duo 7-in-1",
        sku: "INSTPOT-DUO-7IN1-6QT",
        description:
          "Pressure cooker, slow cooker, rice cooker, steamer, sauté, yogurt maker & warmer.",
        imageUrl: "https://images.unsplash.com/photo-1585515320310-259814833e62?w=400",
      },
      {
        name: "GoPro Hero 12 Black",
        sku: "GOPRO-H12-BLK",
        description:
          "5.3K60 video, HyperSmooth 6.0 stabilization, 27MP photos, waterproof to 10m.",
        imageUrl: "https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=400",
      },
    ],
  });

  const inventoryData = [];
  for (const product of products) {
    for (const warehouse of warehouses) {
      const totalUnits = Math.floor(Math.random() * 50) + 5;
      inventoryData.push({
        productId: product.id,
        warehouseId: warehouse.id,
        totalUnits,
        reservedUnits: 0,
      });
    }
  }
  await prisma.inventory.createMany({ data: inventoryData });

  const statuses: ReservationStatus[] = [
    "CONFIRMED",
    "CONFIRMED",
    "CONFIRMED",
    "RELEASED",
    "EXPIRED",
    "CONFIRMED",
    "RELEASED",
  ];

  for (let i = 0; i < 40; i++) {
    const product = products[Math.floor(Math.random() * products.length)];
    const warehouse = warehouses[Math.floor(Math.random() * warehouses.length)];
    const status = statuses[Math.floor(Math.random() * statuses.length)];
    const quantity = Math.floor(Math.random() * 3) + 1;
    const daysAgo = Math.floor(Math.random() * 14);
    const createdAt = subDays(new Date(), daysAgo);

    const reservation = await prisma.reservation.create({
      data: {
        reservationNumber: `RES-${Date.now()}-${i}`,
        productId: product.id,
        warehouseId: warehouse.id,
        quantity,
        status,
        expiresAt: addMinutes(createdAt, 10),
        confirmedAt: status === "CONFIRMED" ? addMinutes(createdAt, 5) : null,
        releasedAt:
          status === "RELEASED" || status === "EXPIRED"
            ? addMinutes(createdAt, 10)
            : null,
        createdAt,
        updatedAt: createdAt,
      },
    });

    await prisma.reservationEvent.createMany({
      data: [
        {
          reservationId: reservation.id,
          eventType: "RESERVATION_CREATED",
          metadata: { quantity, productSku: product.sku },
          createdAt,
        },
        ...(status === "CONFIRMED"
          ? [
              {
                reservationId: reservation.id,
                eventType: "RESERVATION_CONFIRMED",
                metadata: { confirmedAt: addMinutes(createdAt, 5) },
                createdAt: addMinutes(createdAt, 5),
              },
            ]
          : []),
        ...(status === "RELEASED"
          ? [
              {
                reservationId: reservation.id,
                eventType: "RESERVATION_RELEASED",
                metadata: { reason: "user_cancelled" },
                createdAt: addMinutes(createdAt, 3),
              },
            ]
          : []),
        ...(status === "EXPIRED"
          ? [
              {
                reservationId: reservation.id,
                eventType: "RESERVATION_EXPIRED",
                metadata: { expiredAt: addMinutes(createdAt, 10) },
                createdAt: addMinutes(createdAt, 10),
              },
            ]
          : []),
      ],
    });
  }

  console.log(
    `✅ Seeded: ${warehouses.length} warehouses, ${products.length} products, ${inventoryData.length} inventory records, 40 historical reservations`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
