import { Redis } from "@upstash/redis";
import { randomUUID } from "crypto";

export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

const LOCK_TTL_MS = 10_000;

// Lua script for safe lock release: only release if we own it
const RELEASE_LOCK_SCRIPT = `
  if redis.call("get", KEYS[1]) == ARGV[1] then
    return redis.call("del", KEYS[1])
  else
    return 0
  end
`;

export async function acquireLock(key: string): Promise<string | null> {
  const lockValue = randomUUID();
  // SET key value NX PX 10000 — atomic, only sets if key doesn't exist
  const result = await redis.set(key, lockValue, {
    nx: true,
    px: LOCK_TTL_MS,
  });
  return result === "OK" ? lockValue : null;
}

export async function releaseLock(
  key: string,
  lockValue: string
): Promise<void> {
  await redis.eval(RELEASE_LOCK_SCRIPT, [key], [lockValue]);
}

export function inventoryLockKey(
  productId: string,
  warehouseId: string
): string {
  return `inventory:${productId}:${warehouseId}`;
}
