import Redis from "ioredis";

const globalForRedis = globalThis as unknown as {
  redis: Redis | undefined;
};

function createRedis() {
  const url = process.env.REDIS_URL;
  if (!url) {
    console.warn("REDIS_URL not set — idempotency disabled");
    return null;
  }
  const client = new Redis(url, { lazyConnect: true, maxRetriesPerRequest: 1 });
  client.on("error", (e) => console.error("Redis error:", e.message));
  return client;
}

export const redis = globalForRedis.redis ?? createRedis();
if (process.env.NODE_ENV !== "production") globalForRedis.redis = redis ?? undefined;

const IDEMPOTENCY_TTL = 60 * 60 * 24; // 24 hours

export async function getIdempotentResponse(key: string) {
  if (!redis) return null;
  try {
    const val = await redis.get(`idem:${key}`);
    return val ? JSON.parse(val) : null;
  } catch {
    return null;
  }
}

export async function setIdempotentResponse(key: string, response: unknown) {
  if (!redis) return;
  try {
    await redis.set(`idem:${key}`, JSON.stringify(response), "EX", IDEMPOTENCY_TTL);
  } catch {
    // non-fatal — idempotency degrades gracefully
  }
}
