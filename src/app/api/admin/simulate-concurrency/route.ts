export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";

// Small delay helper
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Fire all requests at the exact same millisecond — only 1 wins the lock
async function runRaceTest(
  baseUrl: string,
  productId: string,
  warehouseId: string,
  concurrency: number
) {
  const requests = Array.from({ length: concurrency }, (_, i) =>
    fetch(`${baseUrl}/api/reservations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId, warehouseId, quantity: 1 }),
    }).then(async (res) => {
      const data = await res.json();
      return { index: i, status: res.status, data };
    })
  );
  return Promise.allSettled(requests);
}

// Fire requests in small batches with a tiny gap between each batch
// This simulates real customers arriving close together but not identically
async function runRealisticTest(
  baseUrl: string,
  productId: string,
  warehouseId: string,
  concurrency: number
) {
  const batchSize = 3;
  const delayBetweenBatches = 150; // ms — enough for Redis lock to release
  const allResults: PromiseSettledResult<{ index: number; status: number; data: any }>[] = [];
  let index = 0;

  while (index < concurrency) {
    const batch = Array.from(
      { length: Math.min(batchSize, concurrency - index) },
      (_, i) => {
        const reqIndex = index + i;
        return fetch(`${baseUrl}/api/reservations`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ productId, warehouseId, quantity: 1 }),
        }).then(async (res) => {
          const data = await res.json();
          return { index: reqIndex, status: res.status, data };
        });
      }
    );

    const batchResults = await Promise.allSettled(batch);
    allResults.push(...batchResults);
    index += batchSize;

    if (index < concurrency) await sleep(delayBetweenBatches);
  }

  return allResults;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      productId,
      warehouseId,
      concurrency = 10,
      mode = "race", // "race" | "realistic"
    } = body;

    if (!productId || !warehouseId) {
      return NextResponse.json(
        { error: "productId and warehouseId are required" },
        { status: 400 }
      );
    }

    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

    const startTime = Date.now();
    const rawResults =
      mode === "realistic"
        ? await runRealisticTest(baseUrl, productId, warehouseId, concurrency)
        : await runRaceTest(baseUrl, productId, warehouseId, concurrency);
    const elapsed = Date.now() - startTime;

    const settled = rawResults.map((r) =>
      r.status === "fulfilled"
        ? r.value
        : { index: -1, status: 500, data: { error: String((r as any).reason) } }
    );

    const successes = settled.filter((r) => r.status === 201 || r.status === 200);
    const failures = settled.filter((r) => r.status !== 201 && r.status !== 200);

    const statusBreakdown = settled.reduce<Record<number, number>>((acc, r) => {
      acc[r.status] = (acc[r.status] ?? 0) + 1;
      return acc;
    }, {});

    return NextResponse.json({
      totalRequests: concurrency,
      successCount: successes.length,
      failureCount: failures.length,
      elapsedMs: elapsed,
      mode,
      statusBreakdown,
      successfulReservations: successes.map((r) => ({
        reservationId: r.data?.id,
        reservationNumber: r.data?.reservationNumber,
      })),
      errors: failures.slice(0, 10).map((r) => ({
        status: r.status,
        message: r.data?.error,
      })),
    });
  } catch (e) {
    console.error("[POST /api/admin/simulate-concurrency]", e);
    return NextResponse.json({ error: "Simulation failed" }, { status: 500 });
  }
}
