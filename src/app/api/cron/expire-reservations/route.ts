export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { reservationService } from "@/services/reservation.service";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (
    process.env.CRON_SECRET &&
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await reservationService.expireStale();
    console.log(`[cron] Expired ${result.succeeded}/${result.total} reservations`);
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    console.error("[cron/expire-reservations]", e);
    return NextResponse.json({ error: "Cron failed" }, { status: 500 });
  }
}
