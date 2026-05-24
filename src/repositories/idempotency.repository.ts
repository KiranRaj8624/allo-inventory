import { db } from "@/lib/db";
import { createHash } from "crypto";

export const idempotencyRepository = {
  async get(key: string) {
    return db.idempotencyKey.findUnique({ where: { key } });
  },

  async set(key: string, requestHash: string, response: unknown) {
    return db.idempotencyKey.upsert({
      where: { key },
      create: { key, requestHash, response: response as object },
      update: { requestHash, response: response as object },
    });
  },

  hashRequest(body: unknown): string {
    return createHash("sha256").update(JSON.stringify(body)).digest("hex");
  },
};
