import { NextResponse } from "next/server";
import { productRepository } from "@/repositories/product.repository";

export async function GET() {
  try {
    const products = await productRepository.findAll();

    const data = products.map((p) => ({
      ...p,
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
      inventory: p.inventory.map((inv) => ({
        ...inv,
        createdAt: inv.createdAt.toISOString(),
        updatedAt: inv.updatedAt.toISOString(),
        availableUnits: inv.totalUnits - inv.reservedUnits,
        warehouse: {
          ...inv.warehouse,
          createdAt: inv.warehouse.createdAt.toISOString(),
        },
      })),
    }));

    return NextResponse.json(data);
  } catch (e) {
    console.error("[GET /api/products]", e);
    return NextResponse.json({ error: "Failed to fetch products" }, { status: 500 });
  }
}
