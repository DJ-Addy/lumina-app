import { getRedis } from "./redis.js";

const TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

function key(targetType: string, targetId: string): string {
  return `reports:${targetType}:${targetId}`;
}

/** Atomically bump the report counter for this target. Returns the new total. */
export async function incrementReportCounter(targetType: string, targetId: string): Promise<number> {
  const redis = getRedis();
  const k = key(targetType, targetId);
  const total = await redis.incr(k);
  if (total === 1) await redis.expire(k, TTL_SECONDS);
  return total;
}

export async function getReportCount(targetType: string, targetId: string): Promise<number> {
  const v = await getRedis().get(key(targetType, targetId));
  return v ? parseInt(v, 10) : 0;
}

export async function clearReportCounter(targetType: string, targetId: string): Promise<void> {
  await getRedis().del(key(targetType, targetId));
}
