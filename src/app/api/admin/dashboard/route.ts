import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { reservationRepository } from "@/repositories/reservation.repository";
import { inventoryRepository } from "@/repositories/inventory.repository";

export async function GET() {
  try {
    const [inventoryAgg, analytics, warehouseStats, recentActivity] =
      await Promise.all([
        db.inventory.aggregate({
          _sum: { totalUnits: true, reservedUnits: true },
        }),
        reservationRepository.getAnalytics(),
        inventoryRepository.getWarehouseStats(),
        reservationRepository.getRecentEvents(10),
      ]);

    const totalInventory = inventoryAgg._sum.totalUnits ?? 0;
    const reservedInventory = inventoryAgg._sum.reservedUnits ?? 0;

    return NextResponse.json({
      totalInventory,
      reservedInventory,
      availableInventory: totalInventory - reservedInventory,
      analytics,
      warehouseStats,
      recentActivity: recentActivity.map((e) => ({
        ...e,
        createdAt: e.createdAt.toISOString(),
        reservation: {
          ...e.reservation,
          expiresAt: e.reservation.expiresAt.toISOString(),
          createdAt: e.reservation.createdAt.toISOString(),
          updatedAt: e.reservation.updatedAt.toISOString(),
          confirmedAt: e.reservation.confirmedAt?.toISOString() ?? null,
          releasedAt: e.reservation.releasedAt?.toISOString() ?? null,
          product: {
            ...e.reservation.product,
            createdAt: e.reservation.product.createdAt.toISOString(),
            updatedAt: e.reservation.product.updatedAt.toISOString(),
          },
          warehouse: {
            ...e.reservation.warehouse,
            createdAt: e.reservation.warehouse.createdAt.toISOString(),
          },
        },
      })),
    });
  } catch (e) {
    console.error("[GET /api/admin/dashboard]", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
