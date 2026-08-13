import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { answers, brands, mentions, runs } from "@/lib/db/schema";

/**
 * Metrics derived from stored answers and parsed mentions.
 *
 * The computation is pure: every `compute*` function below takes rows and
 * returns a number, with no I/O and no clock. The exported `visibilityScore`,
 * `promptMentionRate`, `shareOfVoice`, and `citedDomains` are thin loaders that
 * fetch a run and hand it to the pure function, which is what the tests target.
 *
 * Denominators are always the number of probes that actually returned an
 * answer, never the number that were attempted. A failed probe is missing data,
 * not a miss.
 */

export type ProbeRow = {
  answerId: string;
  promptId: string;
  probeIndex: number;
  citations: string[];
  mentions: { entityName: string; isBrand: boolean; charPosition: number }[];
};

export type Rate = {
  /** Probes where the brand appeared. */
  hits: number;
  /** Probes that returned an answer at all. */
  probes: number;
  /** hits/probes as a whole-number percentage. 0 when there is nothing to divide. */
  percent: number;
};

function rate(hits: number, probes: number): Rate {
  return { hits, probes, percent: probes === 0 ? 0 : Math.round((hits / probes) * 100) };
}

/* ------------------------------------------------------------ pure core -- */

/** Share of probes across all prompts in which the brand appeared. */
export function computeVisibility(rows: readonly ProbeRow[]): Rate {
  const hits = rows.filter((row) => row.mentions.some((m) => m.isBrand)).length;
  return rate(hits, rows.length);
}

/** How many of this prompt's probes mentioned the brand. */
export function computePromptMentionRate(
  rows: readonly ProbeRow[],
  promptId: string,
): Rate {
  const forPrompt = rows.filter((row) => row.promptId === promptId);
  const hits = forPrompt.filter((row) => row.mentions.some((m) => m.isBrand)).length;
  return rate(hits, forPrompt.length);
}

/** Earliest character position at which the brand appears, across a prompt's probes. */
export function computeFirstMentionPosition(
  rows: readonly ProbeRow[],
  promptId: string,
): number | null {
  const positions = rows
    .filter((row) => row.promptId === promptId)
    .flatMap((row) => row.mentions.filter((m) => m.isBrand).map((m) => m.charPosition));

  return positions.length === 0 ? null : Math.min(...positions);
}

export type VoiceShare = {
  entityName: string;
  isBrand: boolean;
  /** Answers in which this entity appeared. */
  mentions: number;
  /** Percentage of all entity mentions in the run. */
  share: number;
};

/**
 * Mention count per entity as a percentage of all entity mentions.
 *
 * Brand first, then competitors by mention count descending — the order the
 * stacked bar renders in.
 */
export function computeShareOfVoice(rows: readonly ProbeRow[]): VoiceShare[] {
  const counts = new Map<string, { isBrand: boolean; mentions: number }>();

  for (const row of rows) {
    for (const mention of row.mentions) {
      const existing = counts.get(mention.entityName);
      if (existing) existing.mentions++;
      else counts.set(mention.entityName, { isBrand: mention.isBrand, mentions: 1 });
    }
  }

  const total = [...counts.values()].reduce((sum, entry) => sum + entry.mentions, 0);

  return [...counts.entries()]
    .map(([entityName, entry]) => ({
      entityName,
      isBrand: entry.isBrand,
      mentions: entry.mentions,
      share: total === 0 ? 0 : Math.round((entry.mentions / total) * 100),
    }))
    .sort((a, b) => {
      if (a.isBrand !== b.isBrand) return a.isBrand ? -1 : 1;
      return b.mentions - a.mentions || a.entityName.localeCompare(b.entityName);
    });
}

export type CitedDomain = {
  domain: string;
  /** Answers that cited this domain at least once. */
  count: number;
  isOwnDomain: boolean;
};

/** Normalises a URL to a bare hostname. Returns null for anything unparseable. */
export function toDomain(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    return null;
  }
}

/**
 * Cited domains ranked by how often they appear across the run's answers, with
 * the brand's own domain flagged.
 *
 * This is the page that shows a client which third-party pages the models
 * actually trust, so a domain is counted once per answer rather than once per
 * citation — five links to one directory in a single answer is one signal.
 */
export function computeCitedDomains(
  rows: readonly ProbeRow[],
  brandDomain: string,
): CitedDomain[] {
  const own = brandDomain.replace(/^www\./i, "").toLowerCase();
  const counts = new Map<string, number>();

  for (const row of rows) {
    const seen = new Set<string>();
    for (const citation of row.citations) {
      const domain = toDomain(citation);
      if (domain) seen.add(domain);
    }
    for (const domain of seen) counts.set(domain, (counts.get(domain) ?? 0) + 1);
  }

  return [...counts.entries()]
    .map(([domain, count]) => ({ domain, count, isOwnDomain: domain === own }))
    .sort((a, b) => b.count - a.count || a.domain.localeCompare(b.domain));
}

/* --------------------------------------------------------------- loaders -- */

/**
 * Loads a run's answers with their parsed mentions attached.
 *
 * `model` narrows to one engine, which is what the prompts table's filter uses
 * to compare engines against each other rather than averaging them together.
 */
export async function loadRun(
  runId: string,
  options: { model?: string } = {},
): Promise<ProbeRow[]> {
  const rows = await db
    .select({
      answerId: answers.id,
      promptId: answers.promptId,
      probeIndex: answers.probeIndex,
      citations: answers.citations,
      mentionEntity: mentions.entityName,
      mentionIsBrand: mentions.isBrand,
      mentionPosition: mentions.charPosition,
    })
    .from(answers)
    .leftJoin(mentions, eq(mentions.answerId, answers.id))
    .where(
      options.model
        ? and(eq(answers.runId, runId), eq(answers.model, options.model))
        : eq(answers.runId, runId),
    );

  const byAnswer = new Map<string, ProbeRow>();

  for (const row of rows) {
    let probe = byAnswer.get(row.answerId);
    if (!probe) {
      probe = {
        answerId: row.answerId,
        promptId: row.promptId,
        probeIndex: row.probeIndex,
        citations: row.citations ?? [],
        mentions: [],
      };
      byAnswer.set(row.answerId, probe);
    }
    if (row.mentionEntity !== null) {
      probe.mentions.push({
        entityName: row.mentionEntity,
        isBrand: row.mentionIsBrand!,
        charPosition: row.mentionPosition!,
      });
    }
  }

  return [...byAnswer.values()];
}

export async function visibilityScore(runId: string): Promise<Rate> {
  return computeVisibility(await loadRun(runId));
}

export async function promptMentionRate(runId: string, promptId: string): Promise<Rate> {
  return computePromptMentionRate(await loadRun(runId), promptId);
}

export async function shareOfVoice(runId: string): Promise<VoiceShare[]> {
  return computeShareOfVoice(await loadRun(runId));
}

export async function citedDomains(runId: string): Promise<CitedDomain[]> {
  const [row] = await db
    .select({ domain: brands.domain })
    .from(runs)
    .innerJoin(brands, eq(brands.id, runs.brandId))
    .where(eq(runs.id, runId))
    .limit(1);

  if (!row) throw new Error(`no run with id ${runId}`);
  return computeCitedDomains(await loadRun(runId), row.domain);
}
