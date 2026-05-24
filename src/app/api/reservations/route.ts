import { NextRequest, NextResponse } from "next/server";
import { reservationService } from "@/services/reservation.service";
import { createReservationSchema } from "@/validators";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = createReservationSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const idempotencyKey = req.headers.get("Idempotency-Key") ?? undefined;
    const { cached, data } = await reservationService.create(parsed.data, idempotencyKey);

    return NextResponse.json(data, {
      status: cached ? 200 : 201,
      headers: cached ? { "Idempotent-Replayed": "true" } : {},
    });
  } catch (err: unknown) {
    const e = err as { code?: number; message?: string };
    if (e?.code === 409) return NextResponse.json({ error: e.message }, { status: 409 });
    if (e?.code === 404) return NextResponse.json({ error: e.message }, { status: 404 });
    if (e?.code === 429) return NextResponse.json({ error: e.message }, { status: 429 });
    console.error("[POST /api/reservations]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
