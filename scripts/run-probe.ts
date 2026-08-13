import "../lib/env";
import { PROBE_ENGINES } from "../config/models";
import { activeProbeEngine } from "../lib/ai/router";
import { closeDb } from "../lib/db";
import { runProbe } from "../lib/probe/run";

/**
 * Standalone probe runner.
 *
 *   npm run probe -- <brand-id>
 *
 * The logic lives in lib/probe/run.ts so the same code path serves this script,
 * the "Run checks now" button, and the verification job. There is exactly one
 * implementation of what a run means.
 */

async function main() {
  const brandId = process.argv[2];
  if (!brandId) {
    console.error("usage: npm run probe -- <brand-id> [--all-engines]");
    process.exitCode = 1;
    return;
  }

  // Asking every engine costs one run per engine, so it is opt-in.
  const allEngines = process.argv.includes("--all-engines");

  const engine = activeProbeEngine();
  console.log(`engine  ${engine.label}`);
  if (engine.isFixture) {
    console.log(
      "        no API key set — answers are generated locally and are not a measurement",
    );
  }

  const startedAt = Date.now();
  if (allEngines) {
    console.log(`engines ${PROBE_ENGINES.map((e) => `${e.provider}/${e.model}`).join(", ")}`);
  }

  const result = await runProbe(brandId, {
    engines: allEngines ? PROBE_ENGINES : undefined,
    onProgress: (done, total) => {
      if (done % 10 === 0 || done === total) console.log(`  ${done}/${total} probes`);
    },
  });

  const seconds = ((Date.now() - startedAt) / 1000).toFixed(1);
  console.log(`\nrun     ${result.runId}  ${result.status}  in ${seconds}s`);
  console.log(`stored  ${result.stored} answers`);
  if (result.failed > 0) console.log(`failed  ${result.failed} probes (nothing stored)`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => closeDb());
