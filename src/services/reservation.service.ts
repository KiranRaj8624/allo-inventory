import { db } from "@/lib/db";
import { acquireLock, releaseLock, inventoryLockKey } from "@/lib/redis";
import { reservationRepository } from "@/repositories/reservation.repository";
import { idempotencyRepository } from "@/repositories/idempotency.repository";
import type { CreateReservationInput } from "@/validators";

function generateReservationNumber(): string {
  const suffix = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `RES-${Date.now()}-${suffix}`;
}

export const reservationService = {
  async create(input: CreateReservationInput, idempotencyKey?: string) {
    const { productId, warehouseId, quantity } = input;

    // Idempotency check — return cached response if key already seen
    if (idempotencyKey) {
      const existing = await idempotencyRepository.get(idempotencyKey);
      if (existing) return { cached: true, data: existing.response };
    }

    const lockKey = inventoryLockKey(productId, warehouseId);
    const lockValue = await acquireLock(lockKey);

    if (!lockValue) {
      throw { code: 429, message: "Resource is currently locked. Please retry." };
    }

    try {
      const result = await db.$transaction(async (tx) => {
        const inventory = await tx.inventory.findUnique({
          where: { productId_warehouseId: { productId, warehouseId } },
        });

        if (!inventory) {
          throw { code: 404, message: "Inventory record not found for this product/warehouse combination." };
        }

        const available = inventory.totalUnits - inventory.reservedUnits;
        if (available < quantity) {
          throw { code: 409, message: `Only ${available} unit(s) available. Requested ${quantity}.` };
        }

        await tx.inventory.update({
          where: { productId_warehouseId: { productId, warehouseId } },
          data: { reservedUnits: { increment: quantity } },
        });

        const reservation = await tx.reservation.create({
          data: {
            reservationNumber: generateReservationNumber(),
            productId,
            warehouseId,
            quantity,
            status: "PENDING",
            expiresAt: new Date(Date.now() + 10 * 60 * 1000),
          },
          include: {
            product: true,
            warehouse: true,
          },
        });

        await tx.reservationEvent.create({
          data: {
            reservationId: reservation.id,
            eventType: "RESERVATION_CREATED",
            metadata: {
              quantity,
              productSku: reservation.product.sku,
              warehouseName: reservation.warehouse.name,
            },
          },
        });

        return reservation;
      });

      const responseData = {
        id: result.id,
        reservationNumber: result.reservationNumber,
        productId: result.productId,
        warehouseId: result.warehouseId,
        quantity: result.quantity,
        status: result.status,
        expiresAt: result.expiresAt.toISOString(),
        createdAt: result.createdAt.toISOString(),
        product: result.product,
        warehouse: result.warehouse,
      };

      if (idempotencyKey) {
        const hash = idempotencyRepository.hashRequest(input);
        await idempotencyRepository.set(idempotencyKey, hash, responseData);
      }

      return { cached: false, data: responseData };
    } finally {
      await releaseLock(lockKey, lockValue);
    }
  },

  async confirm(id: string, idempotencyKey?: string) {
    if (idempotencyKey) {
      const existing = await idempotencyRepository.get(`confirm:${idempotencyKey}`);
      if (existing) return { cached: true, data: existing.response };
    }

    const reservation = await reservationRepository.findById(id);

    if (!reservation) throw { code: 404, message: "Reservation not found." };
    if (reservation.status === "CONFIRMED") return { cached: false, data: reservation };
    if (reservation.status === "EXPIRED" || new Date() > reservation.expiresAt) {
      throw { code: 410, message: "Reservation has expired and can no longer be confirmed." };
    }
    if (reservation.status === "RELEASED") {
      throw { code: 409, message: "Reservation has already been released." };
    }

    const updated = await db.reservation.update({
      where: { id },
      data: { status: "CONFIRMED", confirmedAt: new Date() },
      include: { product: true, warehouse: true, events: true },
    });

    await db.reservationEvent.create({
      data: {
        reservationId: id,
        eventType: "RESERVATION_CONFIRMED",
        metadata: { confirmedAt: updated.confirmedAt },
      },
    });

    if (idempotencyKey) {
      await idempotencyRepository.set(
        `confirm:${idempotencyKey}`,
        idempotencyRepository.hashRequest({ id }),
        updated
      );
    }

    return { cached: false, data: updated };
  },

  async release(id: string) {
    const reservation = await reservationRepository.findById(id);

    if (!reservation) throw { code: 404, message: "Reservation not found." };
    if (reservation.status === "RELEASED") return reservation;
    if (reservation.status === "CONFIRMED") {
      throw { code: 409, message: "Confirmed reservations cannot be released." };
    }

    return db.$transaction(async (tx) => {
      await tx.inventory.update({
        where: {
          productId_warehouseId: {
            productId: reservation.productId,
            warehouseId: reservation.warehouseId,
          },
        },
        data: { reservedUnits: { decrement: reservation.quantity } },
      });

      const updated = await tx.reservation.update({
        where: { id },
        data: { status: "RELEASED", releasedAt: new Date() },
        include: { product: true, warehouse: true, events: true },
      });

      await tx.reservationEvent.create({
        data: {
          reservationId: id,
          eventType: "RESERVATION_RELEASED",
          metadata: { reason: "user_cancelled", releasedAt: new Date() },
        },
      });

      return updated;
    });
  },

  async expireStale() {
    const expired = await reservationRepository.findExpired();

    const results = await Promise.allSettled(
      expired.map(async (res) => {
        await db.$transaction(async (tx) => {
          await tx.inventory.update({
            where: {
              productId_warehouseId: {
                productId: res.productId,
                warehouseId: res.warehouseId,
              },
            },
            data: { reservedUnits: { decrement: res.quantity } },
          });

          await tx.reservation.update({
            where: { id: res.id },
            data: { status: "EXPIRED", releasedAt: new Date() },
          });

          await tx.reservationEvent.create({
            data: {
              reservationId: res.id,
              eventType: "RESERVATION_EXPIRED",
              metadata: { expiredAt: new Date(), originalExpiry: res.expiresAt },
            },
          });
        });
        return res.id;
      })
    );

    return {
      total: expired.length,
      succeeded: results.filter((r) => r.status === "fulfilled").length,
      failed: results.filter((r) => r.status === "rejected").length,
    };
  },
};