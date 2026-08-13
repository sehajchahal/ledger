import { and, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { prompts, runs } from "@/lib/db/schema";
import { computePromptMentionRate, computeShareOfVoice, loadRun } from "@/lib/parse/metrics";

/**
 * What changed between the two most recent full runs.
 *
 * This is what the agent acts on and what the digest reports. It looks for two
 * things worth waking someone up for: a prompt where the brand was present and
 * now is not, and a prompt where a competitor took a position the brand held.
 *
 * Ordinary noise — a rate moving 3/3 to 2/3 — is reported but not escalated.
 */

export type Change = {
  promptId: string;
  promptText: string;
  before: number;
  after: number;
  /** Signed change in mention rate, as a fraction. */
  delta: number;
  /** The brand held this prompt and no longer does. */
  lost: boolean;
  /** Competitors that appear now and did not before, on a prompt the brand lost. */
  takenBy: string[];
};

export type ChangeReport = {
  brandId: string;
  latestRunId: string | null;
  previousRunId: string | null;
  visibilityBefore: number;
  visibilityAfter: number;
  /** Change in whole percentage points. */
  visibilityDelta: number;
  changes: Change[];
  /** Prompts the brand lost outright, worst first. */
  losses: Change[];
};

function rateOf(hits: number, probes: number): number {
  return probes === 0 ? 0 : hits / probes;
}

export async function detectChanges(brandId: string): Promise<ChangeReport> {
  const recent = await db
    .select({ id: runs.id })
    .from(runs)
    .where(
      and(eq(runs.brandId, brandId), eq(runs.status, "complete"), eq(runs.kind, "full")),
    )
    .orderBy(desc(runs.startedAt))
    .limit(2);

  const [latest, previous] = recent;

  const empty: ChangeReport = {
    brandId,
    latestRunId: latest?.id ?? null,
    previousRunId: previous?.id ?? null,
    visibilityBefore: 0,
    visibilityAfter: 0,
    visibilityDelta: 0,
    changes: [],
    losses: [],
  };

  if (!latest || !previous) return empty;

  const [afterRows, beforeRows, promptRows] = await Promise.all([
    loadRun(latest.id),
    loadRun(previous.id),
    db.select().from(prompts).where(eq(prompts.brandId, brandId)),
  ]);

  const beforeShare = computeShareOfVoice(beforeRows);
  const afterShare = computeShareOfVoice(afterRows);

  const changes: Change[] = [];

  for (const prompt of promptRows) {
    const before = computePromptMentionRate(beforeRows, prompt.id);
    const after = computePromptMentionRate(afterRows, prompt.id);

    // A prompt that was not asked in one of the runs has no comparison to make.
    if (before.probes === 0 || after.probes === 0) continue;

    const beforeRate = rateOf(before.hits, before.probes);
    const afterRate = rateOf(after.hits, after.probes);
    if (beforeRate === afterRate) continue;

    const lost = before.hits > 0 && after.hits === 0;

    // Who is in the answer now that was not before, on a prompt we just lost.
    const takenBy = lost
      ? [
          ...new Set(
            afterRows
              .filter((row) => row.promptId === prompt.id)
              .flatMap((row) => row.mentions.filter((m) => !m.isBrand).map((m) => m.entityName)),
          ),
        ].filter(
          (name) =>
            !beforeRows
              .filter((row) => row.promptId === prompt.id)
              .some((row) => row.mentions.some((m) => m.entityName === name)),
        )
      : [];

    changes.push({
      promptId: prompt.id,
      promptText: prompt.text,
      before: beforeRate,
      after: afterRate,
      delta: afterRate - beforeRate,
      lost,
      takenBy,
    });
  }

  changes.sort((a, b) => a.delta - b.delta);

  const visibilityBefore = beforeShare.length
    ? Math.round((beforeRows.filter((r) => r.mentions.some((m) => m.isBrand)).length / beforeRows.length) * 100)
    : 0;
  const visibilityAfter = afterShare.length
    ? Math.round((afterRows.filter((r) => r.mentions.some((m) => m.isBrand)).length / afterRows.length) * 100)
    : 0;

  return {
    brandId,
    latestRunId: latest.id,
    previousRunId: previous.id,
    visibilityBefore,
    visibilityAfter,
    visibilityDelta: visibilityAfter - visibilityBefore,
    changes,
    losses: changes.filter((change) => change.lost),
  };
}

/** One plain sentence per change, for the digest. */
export function describeChange(change: Change): string {
  const before = Math.round(change.before * 100);
  const after = Math.round(change.after * 100);

  if (change.lost) {
    const who =
      change.takenBy.length > 0
        ? ` ${change.takenBy.slice(0, 2).join(" and ")} ${change.takenBy.length === 1 ? "is" : "are"} named instead.`
        : "";
    return `You are no longer named for "${change.promptText}".${who}`;
  }

  if (change.delta > 0) {
    return `You went from ${before}% to ${after}% on "${change.promptText}".`;
  }

  return `You slipped from ${before}% to ${after}% on "${change.promptText}".`;
}
