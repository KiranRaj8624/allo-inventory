import { db } from "@/lib/db";
import type { InventoryWithWarehouse } from "@/types";

export const inventoryRepository = {
  async findByProductAndWarehouse(productId: string, warehouseId: string) {
    return db.inventory.findUnique({
      where: { productId_warehouseId: { productId, warehouseId } },
      include: { warehouse: true },
    });
  },

  async findByProduct(productId: string): Promise<InventoryWithWarehouse[]> {
    const rows = await db.inventory.findMany({
      where: { productId },
      include: { warehouse: true },
    });
    return rows.map((r) => ({
      ...r,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
      warehouse: {
        ...r.warehouse,
        createdAt: r.warehouse.createdAt.toISOString(),
      },
      availableUnits: r.totalUnits - r.reservedUnits,
    }));
  },

  async getAllWithWarehouse() {
    return db.inventory.findMany({ include: { warehouse: true, product: true } });
  },

  async getWarehouseStats() {
    const rows = await db.inventory.groupBy({
      by: ["warehouseId"],
      _sum: { totalUnits: true, reservedUnits: true },
    });

    const warehouses = await db.warehouse.findMany();
    return rows.map((r) => {
      const wh = warehouses.find((w) => w.id === r.warehouseId)!;
      const total = r._sum.totalUnits ?? 0;
      const reserved = r._sum.reservedUnits ?? 0;
      return {
        warehouseId: r.warehouseId,
        warehouseName: wh.name,
        location: wh.location,
        totalUnits: total,
        reservedUnits: reserved,
        availableUnits: total - reserved,
        utilizationRate: total > 0 ? Math.round((reserved / total) * 100) : 0,
      };
    });
  },
};
