/**
 * Shared guard for scheduled routes.
 *
 * Vercel Cron sends a bearer token on every scheduled invocation. These routes
 * spend money — model calls and email — so they must not be triggerable by
 * anyone who guesses the URL. Without CRON_SECRET set they refuse to run at
 * all rather than defaulting to open.
 */
export function authorizeCron(request: Request): { ok: true } | { ok: false; response: Response } {
  const secret = process.env.CRON_SECRET;

  if (!secret) {
    return {
      ok: false,
      response: Response.json(
        { error: "CRON_SECRET is not set, so scheduled routes are disabled." },
        { status: 503 },
      ),
    };
  }

  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return { ok: false, response: new Response("Unauthorized", { status: 401 }) };
  }

  return { ok: true };
}
