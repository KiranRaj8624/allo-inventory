import { NextRequest, NextResponse } from "next/server";
import { reservationService } from "@/services/reservation.service";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const idempotencyKey = req.headers.get("Idempotency-Key") ?? undefined;
    const { cached, data } = await reservationService.confirm(params.id, idempotencyKey);

    const serialized = {
      ...data,
      expiresAt: data instanceof Object && "expiresAt" in data
        ? (data.expiresAt instanceof Date ? data.expiresAt.toISOString() : data.expiresAt)
        : undefined,
      createdAt: data instanceof Object && "createdAt" in data
        ? (data.createdAt instanceof Date ? data.createdAt.toISOString() : data.createdAt)
        : undefined,
      updatedAt: data instanceof Object && "updatedAt" in data
        ? (data.updatedAt instanceof Date ? data.updatedAt.toISOString() : data.updatedAt)
        : undefined,
      confirmedAt: data instanceof Object && "confirmedAt" in data
        ? ((data.confirmedAt instanceof Date ? data.confirmedAt.toISOString() : data.confirmedAt) ?? null)
        : null,
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
