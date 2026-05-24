import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const page = Number(req.nextUrl.searchParams.get("page") ?? 1);
    const limit = Number(req.nextUrl.searchParams.get("limit") ?? 20);
    const search = req.nextUrl.searchParams.get("search") ?? "";
    const eventType = req.nextUrl.searchParams.get("eventType") ?? "";

    const where = {
      ...(eventType ? { eventType } : {}),
      ...(search
        ? {
            OR: [
              { reservation: { reservationNumber: { contains: search, mode: "insensitive" as const } } },
              { reservation: { product: { name: { contains: search, mode: "insensitive" as const } } } },
              { reservation: { product: { sku: { contains: search, mode: "insensitive" as const } } } },
            ],
          }
        : {}),
    };

    const [events, total] = await Promise.all([
      db.reservationEvent.findMany({
        where,
        take: limit,
        skip: (page - 1) * limit,
        include: {
          reservation: {
            include: { product: true, warehouse: true },
          },
        },
        orderBy: { createdAt: "desc" },
      }),
      db.reservationEvent.count({ where }),
    ]);

    return NextResponse.json({
      events: events.map((e) => ({
        ...e,
        createdAt: e.createdAt.toISOString(),
        reservation: {
          ...e.reservation,
          expiresAt: e.reservation.expiresAt.toISOString(),
          createdAt: e.reservation.createdAt.toISOString(),
          updatedAt: e.reservation.updatedAt.toISOString(),
          confirmedAt: e.reservation.confirmedAt?.toISOString() ?? null,
          releasedAt: e.reservation.releasedAt?.toISOString() ?? null,
          product: {
            ...e.reservation.product,
            createdAt: e.reservation.product.createdAt.toISOString(),
            updatedAt: e.reservation.product.updatedAt.toISOString(),
          },
          warehouse: {
            ...e.reservation.warehouse,
            createdAt: e.reservation.warehouse.createdAt.toISOString(),
          },
        },
      })),
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
    });
  } catch (e) {
    console.error("[GET /api/admin/logs]", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
