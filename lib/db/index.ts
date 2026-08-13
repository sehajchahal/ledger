import "../env";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "DATABASE_URL is not set. Copy .env.example to .env.local and start Postgres with `npm run db:start`.",
  );
}

/**
 * One pooled client per process. Next dev reloads modules on every edit, so the
 * client is cached on globalThis to avoid opening a new pool per hot reload and
 * exhausting Postgres connections.
 */
const globalForDb = globalThis as unknown as {
  ledgerClient?: ReturnType<typeof postgres>;
};

const client =
  globalForDb.ledgerClient ??
  postgres(connectionString, {
    max: process.env.NODE_ENV === "production" ? 10 : 4,
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.ledgerClient = client;
}

export const db = drizzle(client, { schema });
export { client, schema };
