import { runPublicCheck } from "@/lib/check/public-check";
import { clientIp, rateLimit } from "@/lib/ratelimit";

/**
 * The public check endpoint. No account, no email.
 *
 * Every request costs real model calls, so it is rate limited by IP. The limit
 * is generous enough that a curious visitor never notices it and tight enough
 * that the endpoint cannot be used as a free proxy for an answer engine.
 */

const LIMIT = 5;
const WINDOW_MS = 60 * 60 * 1000;

export async function POST(request: Request) {
  const limit = rateLimit(`check:${clientIp(request)}`, { limit: LIMIT, windowMs: WINDOW_MS });

  if (!limit.allowed) {
    return Response.json(
      {
        error: `That is ${LIMIT} checks this hour. Try again in ${Math.ceil(limit.retryAfter / 60)} minutes, or start a trial to run as many as you need.`,
      },
      { status: 429, headers: { "Retry-After": String(limit.retryAfter) } },
    );
  }

  let domain: unknown;
  try {
    ({ domain } = await request.json());
  } catch {
    return Response.json({ error: "Send a JSON body with a domain." }, { status: 400 });
  }

  if (typeof domain !== "string") {
    return Response.json({ error: "Send a domain to check." }, { status: 400 });
  }

  const result = await runPublicCheck(domain);

  if (!result) {
    return Response.json(
      { error: "That does not look like a domain. Try something like example.com." },
      { status: 400 },
    );
  }

  return Response.json(result, {
    headers: { "X-RateLimit-Remaining": String(limit.remaining) },
  });
}
