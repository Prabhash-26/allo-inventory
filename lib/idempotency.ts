import { NextRequest } from "next/server";
import { prisma } from "./prisma";

const IDEMPOTENCY_TTL_HOURS = 24;

/**
 * Check if a request with the given idempotency key has been seen before.
 * Returns the cached response body + status code, or null if it's a new key.
 */
export async function checkIdempotency(
  key: string,
  endpoint: string
): Promise<{ responseBody: string; statusCode: number } | null> {
  const record = await prisma.idempotencyRecord.findUnique({
    where: { key },
  });

  if (!record) return null;

  // If record has expired, delete and treat as new
  if (record.expiresAt < new Date()) {
    await prisma.idempotencyRecord.delete({ where: { key } });
    return null;
  }

  return { responseBody: record.responseBody, statusCode: record.statusCode };
}

/**
 * Store the response for this idempotency key.
 */
export async function storeIdempotency(
  key: string,
  endpoint: string,
  responseBody: string,
  statusCode: number
): Promise<void> {
  const expiresAt = new Date(
    Date.now() + IDEMPOTENCY_TTL_HOURS * 60 * 60 * 1000
  );

  await prisma.idempotencyRecord.upsert({
    where: { key },
    create: { key, endpoint, responseBody, statusCode, expiresAt },
    update: { responseBody, statusCode, expiresAt },
  });
}

/**
 * Extract and validate the Idempotency-Key header.
 */
export function getIdempotencyKey(req: NextRequest): string | null {
  const key = req.headers.get("Idempotency-Key");
  if (!key || key.length > 255) return null;
  return key;
}
