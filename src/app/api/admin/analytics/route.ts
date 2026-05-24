import { NextRequest, NextResponse } from "next/server";
import { reservationRepository } from "@/repositories/reservation.repository";
import { inventoryRepository } from "@/repositories/inventory.repository";

export async function GET(req: NextRequest) {
  try {
    const days = Number(req.nextUrl.searchParams.get("days") ?? 7);
    const [summary, trend, warehouseStats] = await Promise.all([
      reservationRepository.getAnalytics(),
      reservationRepository.getDailyTrend(days),
      inventoryRepository.getWarehouseStats(),
    ]);

    return NextResponse.json({ summary, trend, warehouseStats });
  } catch (e) {
    console.error("[GET /api/admin/analytics]", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
