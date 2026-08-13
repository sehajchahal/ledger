import "../lib/env";
import { and, desc, eq } from "drizzle-orm";
import { client, db } from "../lib/db";
import { mentions, runs, answers } from "../lib/db/schema";
import { parseRun } from "../lib/parse/mentions";
import { citedDomains, shareOfVoice, visibilityScore } from "../lib/parse/metrics";
import { inArray } from "drizzle-orm";

async function main() {
  const runId = process.argv[2];
  const [run] = runId
    ? await db.select().from(runs).where(eq(runs.id, runId)).limit(1)
    // Only full runs. A verification re-check asks one prompt, so reporting a
      // "visibility" for it would be meaningless.
      : await db
          .select()
          .from(runs)
          .where(and(eq(runs.status, "complete"), eq(runs.kind, "full")))
          .orderBy(desc(runs.startedAt))
          .limit(1);
  if (!run) throw new Error("no completed run found");

  // Re-parsing is idempotent: clear this run's mentions first.
  const ids = await db.select({ id: answers.id }).from(answers).where(eq(answers.runId, run.id));
  if (ids.length) await db.delete(mentions).where(inArray(mentions.answerId, ids.map((r) => r.id)));

  const written = await parseRun(run.id, run.brandId);
  console.log(`run ${run.id}`);
  console.log(`mentions written: ${written}\n`);

  const vis = await visibilityScore(run.id);
  console.log(`visibility      ${vis.percent}%  (${vis.hits}/${vis.probes} probes)\n`);
  console.log("share of voice");
  for (const s of await shareOfVoice(run.id))
    console.log(`  ${s.isBrand ? "*" : " "} ${s.entityName.padEnd(26)} ${String(s.mentions).padStart(3)}  ${s.share}%`);
  console.log("\ntop cited domains");
  for (const d of (await citedDomains(run.id)).slice(0, 6))
    console.log(`  ${d.domain.padEnd(28)} ${String(d.count).padStart(3)}${d.isOwnDomain ? "  (own domain)" : ""}`);
}
main().catch((e) => { console.error(e); process.exitCode = 1; }).finally(() => client.end());
