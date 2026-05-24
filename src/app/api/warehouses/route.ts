import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  try {
    const warehouses = await db.warehouse.findMany({ orderBy: { name: "asc" } });
    return NextResponse.json(
      warehouses.map((w) => ({ ...w, createdAt: w.createdAt.toISOString() }))
    );
  } catch (e) {
    console.error("[GET /api/warehouses]", e);
    return NextResponse.json({ error: "Failed to fetch warehouses" }, { status: 500 });
  }
}
