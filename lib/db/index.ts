import "../env";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

/**
 * The database connection, created on first use rather than on import.
 *
 * This matters more than it looks. `next build` imports every route module to
 * collect its config, so anything that throws at module evaluation fails the
 * build — on a machine that has no reason to hold a database URL. Connecting
 * lazily keeps "can this code be imported" separate from "can it reach a
 * database", which is the difference between a build failing and a request
 * failing.
 */

type Db = PostgresJsDatabase<typeof schema>;

/**
 * Cached on globalThis, not in a module-scoped variable. Next reloads modules
 * on every edit in development, and serverless platforms reuse the process
 * across invocations; both would otherwise open a new pool each time and
 * exhaust the connection limit.
 */
const globals = globalThis as unknown as {
  ledgerClient?: postgres.Sql;
  ledgerDb?: Db;
};

function connect(): { client: postgres.Sql; db: Db } {
  if (globals.ledgerClient && globals.ledgerDb) {
    return { client: globals.ledgerClient, db: globals.ledgerDb };
  }

  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is not set. Locally: copy .env.example to .env.local and run `npm run db:start`. " +
        "On a hosted deployment: set DATABASE_URL in the project's environment variables.",
    );
  }

  // Connection poolers (Neon's -pooler endpoint, Supabase's 6543 port, any
  // PgBouncer in transaction mode) cannot hold prepared statements across
  // queries, and postgres.js uses them by default. Leaving this on produces
  // intermittent "prepared statement already exists" errors under load, which
  // are miserable to diagnose after the fact.
  const pooled = /-pooler\.|pgbouncer=true|:6543\//.test(connectionString);

  const client = postgres(connectionString, {
    // A serverless instance handles one request at a time, so a large pool per
    // instance buys nothing and multiplies against the platform's concurrency.
    max: process.env.VERCEL ? 1 : process.env.NODE_ENV === "production" ? 10 : 4,
    prepare: !pooled,
    idle_timeout: 20,
    connect_timeout: 10,
  });

  const db = drizzle(client, { schema });

  globals.ledgerClient = client;
  globals.ledgerDb = db;

  return { client, db };
}

/**
 * Proxied so every existing `db.select(...)` call site keeps working while the
 * real connection is deferred to the first property access.
 */
export const db = new Proxy({} as Db, {
  get(_target, property, receiver) {
    const instance = connect().db;
    const value = Reflect.get(instance, property, receiver);
    return typeof value === "function" ? value.bind(instance) : value;
  },
});

/**
 * The real Drizzle instance, not the proxy.
 *
 * Auth.js inspects the object it is handed to work out which dialect it is
 * talking to, and a proxy does not survive that check. Anything doing runtime
 * introspection needs this; ordinary queries should use `db`.
 */
export function getDb(): Db {
  return connect().db;
}

/** The raw postgres.js client, for the rare case something needs it directly. */
export function getClient(): postgres.Sql {
  return connect().client;
}

/**
 * Closes the pool if one was ever opened. Scripts call this to let the process
 * exit; it is a no-op when nothing connected, so a script that failed early
 * does not open a connection purely to close it.
 */
export async function closeDb(): Promise<void> {
  if (!globals.ledgerClient) return;

  const client = globals.ledgerClient;
  globals.ledgerClient = undefined;
  globals.ledgerDb = undefined;
  await client.end();
}

export { schema };
