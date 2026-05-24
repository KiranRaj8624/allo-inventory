import { NextRequest, NextResponse } from "next/server";
import { reservationService } from "@/services/reservation.service";

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const data = await reservationService.release(params.id);

    const serialized = {
      ...data,
      expiresAt: data.expiresAt instanceof Date ? data.expiresAt.toISOString() : data.expiresAt,
      createdAt: data.createdAt instanceof Date ? data.createdAt.toISOString() : data.createdAt,
      updatedAt: data.updatedAt instanceof Date ? data.updatedAt.toISOString() : data.updatedAt,
      releasedAt: data.releasedAt instanceof Date ? data.releasedAt.toISOString() : (data.releasedAt ?? null),
      confirmedAt: data.confirmedAt instanceof Date ? data.confirmedAt.toISOString() : (data.confirmedAt ?? null),
    };

    return NextResponse.json(serialized);
  } catch (err: unknown) {
    const e = err as { code?: number; message?: string };
    if (e?.code === 409) return NextResponse.json({ error: e.message }, { status: 409 });
    if (e?.code === 404) return NextResponse.json({ error: e.message }, { status: 404 });
    console.error("[POST /api/reservations/release]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
