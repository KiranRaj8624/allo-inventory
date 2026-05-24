import { NextRequest, NextResponse } from "next/server";
import { reservationRepository } from "@/repositories/reservation.repository";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const reservation = await reservationRepository.findById(params.id);
    if (!reservation) {
      return NextResponse.json({ error: "Reservation not found" }, { status: 404 });
    }

    const serialized = {
      ...reservation,
      expiresAt: reservation.expiresAt.toISOString(),
      createdAt: reservation.createdAt.toISOString(),
      updatedAt: reservation.updatedAt.toISOString(),
      confirmedAt: reservation.confirmedAt?.toISOString() ?? null,
      releasedAt: reservation.releasedAt?.toISOString() ?? null,
      product: {
        ...reservation.product,
        createdAt: reservation.product.createdAt.toISOString(),
        updatedAt: reservation.product.updatedAt.toISOString(),
        inventory: reservation.product.inventory.map((inv) => ({
          ...inv,
          availableUnits: inv.totalUnits - inv.reservedUnits,
          createdAt: inv.createdAt.toISOString(),
          updatedAt: inv.updatedAt.toISOString(),
          warehouse: {
            ...inv.warehouse,
            createdAt: inv.warehouse.createdAt.toISOString(),
          },
        })),
      },
      warehouse: {
        ...reservation.warehouse,
        createdAt: reservation.warehouse.createdAt.toISOString(),
      },
      events: reservation.events.map((e) => ({
        ...e,
        createdAt: e.createdAt.toISOString(),
      })),
    };

    return NextResponse.json(serialized);
  } catch (e) {
    console.error("[GET /api/reservations/:id]", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
