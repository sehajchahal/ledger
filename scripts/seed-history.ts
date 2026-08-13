import "../lib/env";
import { desc, eq } from "drizzle-orm";
import { client, db } from "../lib/db";
import { brands, runs } from "../lib/db/schema";
import { runProbe } from "../lib/probe/run";

/**
 * Builds a back-dated history of runs so the overview, the presence strips, and
 * the run-over-run delta have something real to render.
 *
 * The variance here is whatever the engine produced — no trend is imposed. If
 * the demo happens to show visibility going down, that is what it shows.
 *
 *   npm run seed:history [runs]
 */

const DEFAULT_RUNS = 14;

async function main() {
  const count = Number(process.argv[2] ?? DEFAULT_RUNS);
  const [brand] = await db.select().from(brands).orderBy(desc(brands.createdAt)).limit(1);
  if (!brand) throw new Error("no brand found — run `npm run seed` first");

  console.log(`building ${count} runs of history for ${brand.name}\n`);

  for (let i = count - 1; i >= 0; i--) {
    const result = await runProbe(brand.id);

    // Space the runs one day apart, ending yesterday, so "last checked" reads
    // sensibly and the strip has a real time axis.
    const when = new Date(Date.now() - (i + 1) * 24 * 60 * 60 * 1000);
    await db
      .update(runs)
      .set({ startedAt: when, completedAt: new Date(when.getTime() + 96_000) })
      .where(eq(runs.id, result.runId));

    console.log(
      `  ${when.toISOString().slice(0, 10)}  ${result.stored} answers  ${result.parsed} mentions`,
    );
  }

  console.log(`\ndone. ${count} runs.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => client.end());
