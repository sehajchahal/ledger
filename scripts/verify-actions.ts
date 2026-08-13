import "../lib/env";
import { closeDb } from "../lib/db";
import { runDueVerifications } from "../lib/actions/verify";

/**
 * Runs every verification whose 14-day window has elapsed.
 *
 *   npm run verify
 *
 * Intended to run on a schedule. Safe to run repeatedly: a verification is only
 * picked up while `checked_at` is null, and a failed re-check leaves the row due
 * rather than recording a delta it could not measure.
 */
async function main() {
  const outcomes = await runDueVerifications();

  if (outcomes.length === 0) {
    console.log("nothing due");
    return;
  }

  for (const outcome of outcomes) {
    const points = Math.round(outcome.delta * 100);
    const sign = points > 0 ? "+" : "";
    console.log(
      `${sign}${points}pt  ${Math.round(outcome.before * 100)}% → ${Math.round(outcome.after * 100)}%  ${outcome.promptText}`,
    );
  }

  console.log(`\n${outcomes.length} verified`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => closeDb());
