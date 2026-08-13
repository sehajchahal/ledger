import { and, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { competitors, runs, type Competitor } from "@/lib/db/schema";
import { computeShareOfVoice, loadRun, type ProbeRow, type Rate } from "@/lib/parse/metrics";

export type CompetitorRow = {
  competitor: Competitor;
  /** Answers in the latest run that named this competitor. */
  rate: Rate;
  /** Percentage of all entity mentions in the latest run. */
  share: number;
  /**
   * Prompts where this competitor was named and the brand was not named at all.
   * The most actionable number on the page: these are the questions being lost
   * outright rather than shared.
   */
  promptsWon: number;
};

/**
 * Competitor standings from the most recent completed run.
 *
 * Sorted by prompts won, descending — the column a user should act on, rather
 * than the column that flatters anyone.
 */
export async function listCompetitorRows(brandId: string): Promise<CompetitorRow[]> {
  const [rivals, latestRun] = await Promise.all([
    db.select().from(competitors).where(eq(competitors.brandId, brandId)),
    db
      .select({ id: runs.id })
      .from(runs)
      .where(and(eq(runs.brandId, brandId), eq(runs.status, "complete"), eq(runs.kind, "full")))
      .orderBy(desc(runs.startedAt))
      .limit(1),
  ]);

  const probeRows: ProbeRow[] = latestRun[0] ? await loadRun(latestRun[0].id) : [];
  const shares = computeShareOfVoice(probeRows);

  // Group probes by prompt so "won" can be decided per prompt rather than per probe.
  const byPrompt = new Map<string, ProbeRow[]>();
  for (const row of probeRows) {
    const existing = byPrompt.get(row.promptId);
    if (existing) existing.push(row);
    else byPrompt.set(row.promptId, [row]);
  }

  return rivals
    .map((competitor) => {
      const named = probeRows.filter((row) =>
        row.mentions.some((m) => m.entityName === competitor.name),
      ).length;

      let promptsWon = 0;
      for (const [, rowsForPrompt] of byPrompt) {
        const brandNamed = rowsForPrompt.some((row) => row.mentions.some((m) => m.isBrand));
        const competitorNamed = rowsForPrompt.some((row) =>
          row.mentions.some((m) => m.entityName === competitor.name),
        );
        if (competitorNamed && !brandNamed) promptsWon++;
      }

      return {
        competitor,
        rate: {
          hits: named,
          probes: probeRows.length,
          percent: probeRows.length === 0 ? 0 : Math.round((named / probeRows.length) * 100),
        },
        share: shares.find((s) => s.entityName === competitor.name)?.share ?? 0,
        promptsWon,
      };
    })
    .sort((a, b) => b.promptsWon - a.promptsWon || b.share - a.share);
}

/** Prompts where the brand is absent but at least one competitor is named. */
export async function promptsLost(brandId: string): Promise<number> {
  const rows = await listCompetitorRows(brandId);
  return rows.reduce((max, row) => Math.max(max, row.promptsWon), 0);
}
