import { db } from "@/lib/db";
import { ReservationStatus } from "@prisma/client";

export const reservationRepository = {
  async findById(id: string) {
    return db.reservation.findUnique({
      where: { id },
      include: {
        product: {
          include: { inventory: { include: { warehouse: true } } },
        },
        warehouse: true,
        events: { orderBy: { createdAt: "desc" } },
      },
    });
  },

  async findExpired() {
    return db.reservation.findMany({
      where: {
        status: "PENDING",
        expiresAt: { lt: new Date() },
      },
    });
  },

  async findAll(limit = 50, offset = 0) {
    return db.reservation.findMany({
      take: limit,
      skip: offset,
      include: {
        product: true,
        warehouse: true,
        events: { orderBy: { createdAt: "desc" }, take: 1 },
      },
      orderBy: { createdAt: "desc" },
    });
  },

  async countAll() {
    return db.reservation.count();
  },

  async getAnalytics() {
    const [total, confirmed, released, expired, pending] = await Promise.all([
      db.reservation.count(),
      db.reservation.count({ where: { status: "CONFIRMED" } }),
      db.reservation.count({ where: { status: "RELEASED" } }),
      db.reservation.count({ where: { status: "EXPIRED" } }),
      db.reservation.count({ where: { status: "PENDING" } }),
    ]);

    return {
      totalReservations: total,
      confirmedReservations: confirmed,
      releasedReservations: released,
      expiredReservations: expired,
      pendingReservations: pending,
      confirmationRate: total > 0 ? Math.round((confirmed / total) * 100) : 0,
      expiryRate: total > 0 ? Math.round((expired / total) * 100) : 0,
      cancellationRate: total > 0 ? Math.round((released / total) * 100) : 0,
    };
  },

  async getDailyTrend(days = 7) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const reservations = await db.reservation.findMany({
      where: { createdAt: { gte: startDate } },
      select: { createdAt: true, status: true },
      orderBy: { createdAt: "asc" },
    });

    const byDay: Record<string, { date: string; total: number; confirmed: number; expired: number; released: number }> = {};

    for (let i = 0; i < days; i++) {
      const d = new Date();
      d.setDate(d.getDate() - (days - 1 - i));
      const key = d.toISOString().split("T")[0];
      byDay[key] = { date: key, total: 0, confirmed: 0, expired: 0, released: 0 };
    }

    for (const r of reservations) {
      const key = r.createdAt.toISOString().split("T")[0];
      if (byDay[key]) {
        byDay[key].total++;
        if (r.status === "CONFIRMED") byDay[key].confirmed++;
        if (r.status === "EXPIRED") byDay[key].expired++;
        if (r.status === "RELEASED") byDay[key].released++;
      }
    }

    return Object.values(byDay);
  },

  async getRecentEvents(limit = 20) {
    return db.reservationEvent.findMany({
      take: limit,
      include: {
        reservation: { include: { product: true, warehouse: true } },
      },
      orderBy: { createdAt: "desc" },
    });
  },
};
