/**
 * Fixed-window rate limiting, keyed by client IP.
 *
 * In-memory on purpose: the public check is the only unauthenticated endpoint,
 * and a Map is enough for a single instance. It resets on deploy and does not
 * coordinate across instances — if this ever runs on more than one, move the
 * counter to the database or a shared store.
 */

type Window = { count: number; resetAt: number };

const windows = new Map<string, Window>();

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  /** Seconds until the window resets. */
  retryAfter: number;
};

export function rateLimit(
  key: string,
  { limit, windowMs }: { limit: number; windowMs: number },
): RateLimitResult {
  const now = Date.now();
  const existing = windows.get(key);

  if (!existing || now >= existing.resetAt) {
    windows.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1, retryAfter: 0 };
  }

  existing.count++;

  // Opportunistic cleanup so the map cannot grow without bound.
  if (windows.size > 5_000) {
    for (const [k, w] of windows) if (now >= w.resetAt) windows.delete(k);
  }

  if (existing.count > limit) {
    return {
      allowed: false,
      remaining: 0,
      retryAfter: Math.ceil((existing.resetAt - now) / 1000),
    };
  }

  return { allowed: true, remaining: limit - existing.count, retryAfter: 0 };
}

/** Best-effort client IP from proxy headers, falling back to a shared bucket. */
export function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return request.headers.get("x-real-ip") ?? "unknown";
}
