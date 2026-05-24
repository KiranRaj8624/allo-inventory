export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { reservationService } from "@/services/reservation.service";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const idempotencyKey = req.headers.get("Idempotency-Key") ?? undefined;
    const { cached, data } = await reservationService.confirm(params.id, idempotencyKey);

    const d = data as Record<string, unknown>;

    const serialized = {
      ...d,
      expiresAt: d.expiresAt instanceof Date ? d.expiresAt.toISOString() : (d.expiresAt ?? null),
      createdAt: d.createdAt instanceof Date ? d.createdAt.toISOString() : (d.createdAt ?? null),
      updatedAt: d.updatedAt instanceof Date ? d.updatedAt.toISOString() : (d.updatedAt ?? null),
      confirmedAt: d.confirmedAt instanceof Date ? d.confirmedAt.toISOString() : (d.confirmedAt ?? null),
      releasedAt: d.releasedAt instanceof Date ? d.releasedAt.toISOString() : (d.releasedAt ?? null),
    };

    return NextResponse.json(serialized, {
      headers: cached ? { "Idempotent-Replayed": "true" } : {},
    });
  } catch (err: unknown) {
    const e = err as { code?: number; message?: string };
    if (e?.code === 410) return NextResponse.json({ error: e.message }, { status: 410 });
    if (e?.code === 409) return NextResponse.json({ error: e.message }, { status: 409 });
    if (e?.code === 404) return NextResponse.json({ error: e.message }, { status: 404 });
    console.error("[POST /api/reservations/confirm]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
