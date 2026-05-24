import Redis from "ioredis";

const globalForRedis = globalThis as unknown as {
  redis: Redis | undefined;
};

function createRedisClient() {
  const redisUrl = process.env.REDIS_URL;

  if (!redisUrl) {
    console.warn(
      "REDIS_URL not set — distributed locking disabled. " +
        "This is fine for local dev but NOT safe for production concurrency."
    );
    return null;
  }

  const client = new Redis(redisUrl, {
    maxRetriesPerRequest: 3,
    lazyConnect: true,
  });

  client.on("error", (err) => {
    console.error("Redis error:", err.message);
  });

  return client;
}

export const redis = globalForRedis.redis ?? createRedisClient();

if (process.env.NODE_ENV !== "production") {
  (globalThis as unknown as { redis: Redis | null }).redis = redis;
}

// ── Distributed lock helpers ──────────────────────────────────────────────────

const LOCK_TTL_MS = 5_000; // 5 s max lock hold time
const LOCK_PREFIX = "allo:lock:";

/**
 * Acquire a Redis SET NX PX lock.
 * Returns the lock token (for release) or null if the lock is held.
 */
export async function acquireLock(key: string): Promise<string | null> {
  if (!redis) return "no-redis"; // fallback — single-process only
  const token = crypto.randomUUID();
  // ioredis: set(key, value, expiryMode, time, setMode)
  const result = await (redis as Redis).set(
    `${LOCK_PREFIX}${key}`,
    token,
    "PX",
    LOCK_TTL_MS,
    "NX"
  );
  return result === "OK" ? token : null;
}

/**
 * Release a Redis lock — only if we still own it (Lua CAS).
 */
export async function releaseLock(
  key: string,
  token: string
): Promise<boolean> {
  if (!redis || token === "no-redis") return true;
  const script = `
    if redis.call("GET", KEYS[1]) == ARGV[1] then
      return redis.call("DEL", KEYS[1])
    else
      return 0
    end
  `;
  const result = await redis.eval(
    script,
    1,
    `${LOCK_PREFIX}${key}`,
    token
  );
  return result === 1;
}

/**
 * Acquire a lock and run fn inside it, releasing on exit.
 * Retries up to `maxRetries` times with exponential back-off.
 */
export async function withLock<T>(
  key: string,
  fn: () => Promise<T>,
  maxRetries = 5
): Promise<T> {
  let attempt = 0;
  while (attempt < maxRetries) {
    const token = await acquireLock(key);
    if (token) {
      try {
        return await fn();
      } finally {
        await releaseLock(key, token);
      }
    }
    // Exponential back-off: 50ms, 100ms, 200ms, 400ms, 800ms
    await new Promise((r) => setTimeout(r, 50 * Math.pow(2, attempt)));
    attempt++;
  }
  throw new Error(`Could not acquire lock for "${key}" after ${maxRetries} attempts`);
}
