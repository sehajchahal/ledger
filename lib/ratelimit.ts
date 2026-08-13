import { sql } from "drizzle-orm";
import { db } from "@/lib/db";

/**
 * Fixed-window rate limiting, keyed by client IP, counted in Postgres.
 *
 * An in-process counter cannot limit anything on a platform that may route each
 * request to a fresh instance — the window resets constantly and the limit is
 * decorative. The database is already a dependency and is consistent across
 * instances, which is the only property this needs.
 *
 * The whole thing is one statement so there is no read-then-write race between
 * concurrent requests from the same address.
 */

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  /** Seconds until the window resets. */
  retryAfter: number;
};

export async function rateLimit(
  key: string,
  { limit, windowMs }: { limit: number; windowMs: number },
): Promise<RateLimitResult> {
  const seconds = Math.ceil(windowMs / 1000);

  try {
    // Insert the bucket, or bump it — resetting first if the window has passed.
    // `count` comes back post-increment, so it is the number of requests made
    // in the current window including this one.
    const rows = await db.execute<{ count: number; reset_at: Date | string }>(sql`
      insert into rate_limits (key, count, reset_at)
      values (${key}, 1, now() + ${`${seconds} seconds`}::interval)
      on conflict (key) do update set
        count = case
          when rate_limits.reset_at <= now() then 1
          else rate_limits.count + 1
        end,
        reset_at = case
          when rate_limits.reset_at <= now() then now() + ${`${seconds} seconds`}::interval
          else rate_limits.reset_at
        end
      returning count, reset_at
    `);

    const row = [...rows][0];
    if (!row) return { allowed: true, remaining: limit - 1, retryAfter: 0 };

    const resetAt = row.reset_at instanceof Date ? row.reset_at : new Date(row.reset_at);
    const retryAfter = Math.max(1, Math.ceil((resetAt.getTime() - Date.now()) / 1000));

    if (row.count > limit) return { allowed: false, remaining: 0, retryAfter };

    return { allowed: true, remaining: limit - row.count, retryAfter: 0 };
  } catch (error) {
    // A limiter that fails closed would take the public check down with the
    // database. Allow the request and say so — this is a spend control, not an
    // authorisation check.
    console.error("rate limit check failed, allowing request", error);
    return { allowed: true, remaining: 0, retryAfter: 0 };
  }
}

/** Drops expired buckets. Called from the cron worker so the table stays small. */
export async function pruneRateLimits(): Promise<number> {
  const rows = await db.execute<{ n: number }>(sql`
    with deleted as (delete from rate_limits where reset_at <= now() returning 1)
    select count(*)::int as n from deleted
  `);
  return [...rows][0]?.n ?? 0;
}

/** Best-effort client IP from proxy headers, falling back to a shared bucket. */
export function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return request.headers.get("x-real-ip") ?? "unknown";
}
