import { and, desc, eq, inArray, sql } from "drizzle-orm";
import type { Tick } from "@/components/presence-strip";
import { db } from "@/lib/db";
import { brands, prompts, runs, type Brand } from "@/lib/db/schema";
import { computeCitedDomains, computeShareOfVoice, loadRun } from "@/lib/parse/metrics";

/** Raw SQL results come back with timestamps unparsed depending on the driver path. */
function toDate(value: string | Date | null): Date | null {
  if (value === null) return null;
  return value instanceof Date ? value : new Date(value);
}

/** Every prompt is asked three times. Mirrors PROBES_PER_PROMPT in lib/probe/run.ts. */
const PROBES_PER_PROMPT = 3;

/** How many runs of history the overview looks back over. */
export const HISTORY_RUNS = 30;

/**
 * A prompt counts as present in a run when the brand appeared in a majority of
 * that prompt's probes. One appearance out of three is not presence — it is
 * inconsistency, and the prompts table shows that as "1/3" where the nuance
 * belongs. The strip answers a yes-or-no question and so needs a yes-or-no rule.
 */
function isPresent(hits: number, probes: number): boolean {
  return probes > 0 && hits * 2 >= probes;
}

export type RunSummary = {
  id: string;
  startedAt: Date | null;
  completedAt: Date | null;
  probes: number;
  hits: number;
  percent: number;
};

/** Per-run visibility for the most recent completed runs, newest first. */
export async function recentRuns(brandId: string, limit = HISTORY_RUNS): Promise<RunSummary[]> {
  const rows = await db.execute<{
    id: string;
    started_at: string | Date | null;
    completed_at: string | Date | null;
    probes: number;
    hits: number;
  }>(sql`
    select r.id,
           r.started_at,
           r.completed_at,
           count(a.id)::int as probes,
           count(m.id)::int as hits
      from runs r
      join answers a on a.run_id = r.id
      left join mentions m on m.answer_id = a.id and m.is_brand = true
     where r.brand_id = ${brandId}
       and r.status = 'complete'
       and r.kind = 'full'
     group by r.id
     order by r.started_at desc
     limit ${limit}
  `);

  return [...rows].map((row) => ({
    id: row.id,
    startedAt: toDate(row.started_at),
    completedAt: toDate(row.completed_at),
    probes: row.probes,
    hits: row.hits,
    percent: row.probes === 0 ? 0 : Math.round((row.hits / row.probes) * 100),
  }));
}

/**
 * Presence of every prompt in every recent run, oldest run first.
 *
 * The aggregate strip is built from these: one tick per prompt per run, so the
 * comb shows the texture of where the brand holds a position and where it does
 * not, rather than collapsing 25 prompts into a single number per run.
 */
export async function promptPresenceHistory(
  brandId: string,
  limit = HISTORY_RUNS,
): Promise<{ runId: string; promptId: string; present: boolean }[]> {
  const rows = await db.execute<{
    run_id: string;
    prompt_id: string;
    probes: number;
    hits: number;
  }>(sql`
    with recent as (
      select id, started_at
        from runs
       where brand_id = ${brandId} and status = 'complete' and kind = 'full'
       order by started_at desc
       limit ${limit}
    )
    select recent.id as run_id,
           a.prompt_id,
           count(a.id)::int as probes,
           count(m.id)::int as hits
      from recent
      join answers a on a.run_id = recent.id
      left join mentions m on m.answer_id = a.id and m.is_brand = true
     group by recent.id, recent.started_at, a.prompt_id
     order by recent.started_at asc, a.prompt_id asc
  `);

  return [...rows].map((row) => ({
    runId: row.run_id,
    promptId: row.prompt_id,
    present: isPresent(row.hits, row.probes),
  }));
}

/** Turns a chronological presence series for one prompt into strip ticks. */
export function toTicks(series: readonly boolean[]): Tick[] {
  return series.map((present, i) => {
    if (present) return "hit";
    return i > 0 && series[i - 1] ? "drop" : "miss";
  });
}

/** Presence ticks for a single prompt across recent runs, oldest first. */
export async function promptTicks(
  brandId: string,
  promptId: string,
  limit = HISTORY_RUNS,
): Promise<Tick[]> {
  const history = await promptPresenceHistory(brandId, limit);
  return toTicks(history.filter((row) => row.promptId === promptId).map((row) => row.present));
}

/** Ticks for every prompt, keyed by prompt id. One pass for a whole table. */
export async function allPromptTicks(
  brandId: string,
  limit = HISTORY_RUNS,
): Promise<Map<string, Tick[]>> {
  const history = await promptPresenceHistory(brandId, limit);
  const series = new Map<string, boolean[]>();

  for (const row of history) {
    const existing = series.get(row.promptId);
    if (existing) existing.push(row.present);
    else series.set(row.promptId, [row.present]);
  }

  return new Map([...series].map(([promptId, values]) => [promptId, toTicks(values)]));
}

export type BrandOverview = {
  brand: Brand;
  latest: RunSummary | null;
  previous: RunSummary | null;
  /** Change in visibility against the previous run, in percentage points. */
  delta: number | null;
  runsCounted: number;
  activePrompts: number;
  aggregateTicks: Tick[];
  shareOfVoice: ReturnType<typeof computeShareOfVoice>;
  citedDomains: ReturnType<typeof computeCitedDomains>;
  /**
   * A run that is queued or in progress right now, with how far along it is.
   * The overview shows the real count rather than an indeterminate spinner.
   */
  inFlight: { id: string; startedAt: Date | null; stored: number; expected: number } | null;
  /** True when the latest run's answers were generated locally, not measured. */
  isDemoData: boolean;
};

export async function getBrandOverview(brandId: string): Promise<BrandOverview | null> {
  const [brand] = await db.select().from(brands).where(eq(brands.id, brandId)).limit(1);
  if (!brand) return null;

  const [history, runSummaries, activePromptRows, inFlightRows] = await Promise.all([
    promptPresenceHistory(brandId),
    recentRuns(brandId),
    db
      .select({ id: prompts.id })
      .from(prompts)
      .where(and(eq(prompts.brandId, brandId), eq(prompts.active, true))),
    db
      .select({ id: runs.id, startedAt: runs.startedAt })
      .from(runs)
      .where(and(eq(runs.brandId, brandId), inArray(runs.status, ["queued", "running"])))
      .orderBy(desc(runs.startedAt))
      .limit(1),
  ]);

  const [latest, previous] = runSummaries;

  // The aggregate strip walks runs oldest to newest, and within each run walks
  // prompts in a stable order, so a column of the comb is one point in time.
  const byRun = new Map<string, { promptId: string; present: boolean }[]>();
  for (const row of history) {
    const existing = byRun.get(row.runId);
    if (existing) existing.push(row);
    else byRun.set(row.runId, [row]);
  }

  const previousByPrompt = new Map<string, boolean>();
  const aggregateTicks: Tick[] = [];
  for (const [, entries] of byRun) {
    for (const entry of entries) {
      const was = previousByPrompt.get(entry.promptId);
      aggregateTicks.push(
        entry.present ? "hit" : was === true ? "drop" : "miss",
      );
      previousByPrompt.set(entry.promptId, entry.present);
    }
  }

  const latestRows = latest ? await loadRun(latest.id) : [];
  const isDemoData = latest ? await runIsDemoData(latest.id) : false;

  const inFlightRun = inFlightRows[0] ?? null;
  const inFlight = inFlightRun
    ? {
        ...inFlightRun,
        stored: await answersStored(inFlightRun.id),
        expected: activePromptRows.length * PROBES_PER_PROMPT,
      }
    : null;

  return {
    brand,
    latest: latest ?? null,
    previous: previous ?? null,
    delta: latest && previous ? latest.percent - previous.percent : null,
    runsCounted: runSummaries.length,
    activePrompts: activePromptRows.length,
    aggregateTicks,
    shareOfVoice: computeShareOfVoice(latestRows),
    citedDomains: computeCitedDomains(latestRows, brand.domain),
    inFlight,
    isDemoData,
  };
}

/** How many answers a run has stored so far. Drives the live first-run count. */
async function answersStored(runId: string): Promise<number> {
  const rows = await db.execute<{ n: number }>(sql`
    select count(*)::int as n from answers where run_id = ${runId}
  `);
  return [...rows][0]?.n ?? 0;
}

/** Answers synthesised locally carry a `fixture/` model prefix. */
export async function runIsDemoData(runId: string): Promise<boolean> {
  const rows = await db.execute<{ demo: boolean }>(sql`
    select bool_or(model like 'fixture/%') as demo
      from answers
     where run_id = ${runId}
  `);
  return [...rows][0]?.demo === true;
}
