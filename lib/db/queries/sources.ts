import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { answers, brands, runs } from "@/lib/db/schema";
import { computeCitedDomains, type CitedDomain } from "@/lib/parse/metrics";

export type SourcesReport = {
  domains: CitedDomain[];
  /** Answers the ranking is drawn from. */
  answerCount: number;
  runCount: number;
  ownDomain: string;
  /** True when the brand's own site was cited at least once. */
  ownDomainCited: boolean;
};

/**
 * Cited domains across every stored answer for a brand.
 *
 * Deliberately not scoped to the latest run: which third-party pages the models
 * trust is a slow-moving fact, and one run is a small sample to rank on.
 */
export async function getSourcesReport(brandId: string): Promise<SourcesReport> {
  const [brand] = await db.select().from(brands).where(eq(brands.id, brandId)).limit(1);
  if (!brand) throw new Error(`no brand with id ${brandId}`);

  const rows = await db
    .select({ answerId: answers.id, runId: answers.runId, citations: answers.citations })
    .from(answers)
    .innerJoin(runs, eq(runs.id, answers.runId))
    .where(and(eq(runs.brandId, brandId), eq(runs.status, "complete"), eq(runs.kind, "full")));

  const domains = computeCitedDomains(
    rows.map((row) => ({
      answerId: row.answerId,
      promptId: "",
      probeIndex: 0,
      citations: row.citations ?? [],
      mentions: [],
    })),
    brand.domain,
  );

  return {
    domains,
    answerCount: rows.length,
    runCount: new Set(rows.map((row) => row.runId)).size,
    ownDomain: brand.domain,
    ownDomainCited: domains.some((domain) => domain.isOwnDomain),
  };
}
