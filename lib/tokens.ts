import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Signed, expiring, single-purpose links.
 *
 * Used for the Approve button in the digest email, which has to work from a
 * mail client without a login. The token names exactly one action and one
 * purpose, so a leaked link cannot be replayed against anything else, and it
 * expires on its own.
 *
 * Signed with AUTH_SECRET — the same secret that protects sessions, so there is
 * one thing to rotate rather than two.
 */

export type TokenPurpose = "approve-action";

type Payload = {
  purpose: TokenPurpose;
  /** What the link acts on. */
  subject: string;
  /** Who the link was issued to, so the audit record is honest. */
  actor: string;
  /** Expiry, epoch seconds. */
  exp: number;
};

function secret(): string {
  const value = process.env.AUTH_SECRET;
  if (!value) throw new Error("AUTH_SECRET is not set — cannot sign links.");
  return value;
}

function base64url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function fromBase64url(input: string): Buffer {
  return Buffer.from(input.replace(/-/g, "+").replace(/_/g, "/"), "base64");
}

function sign(body: string): string {
  return base64url(createHmac("sha256", secret()).update(body).digest());
}

export function createToken(
  payload: Omit<Payload, "exp">,
  { ttlDays = 30 }: { ttlDays?: number } = {},
): string {
  const full: Payload = {
    ...payload,
    exp: Math.floor(Date.now() / 1000) + ttlDays * 24 * 60 * 60,
  };

  const body = base64url(JSON.stringify(full));
  return `${body}.${sign(body)}`;
}

export type TokenResult =
  | { ok: true; payload: Payload }
  | { ok: false; reason: string };

export function verifyToken(token: string, purpose: TokenPurpose): TokenResult {
  const [body, signature] = token.split(".");
  if (!body || !signature) return { ok: false, reason: "That link is malformed." };

  const expected = sign(body);

  // Constant-time compare so a signature cannot be guessed byte by byte.
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return { ok: false, reason: "That link is not valid." };
  }

  let payload: Payload;
  try {
    payload = JSON.parse(fromBase64url(body).toString("utf8")) as Payload;
  } catch {
    return { ok: false, reason: "That link is malformed." };
  }

  if (payload.purpose !== purpose) {
    return { ok: false, reason: "That link is not valid for this page." };
  }

  if (payload.exp * 1000 < Date.now()) {
    return { ok: false, reason: "That link has expired. Open Ledger and approve it there." };
  }

  return { ok: true, payload };
}
