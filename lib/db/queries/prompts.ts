import { and, asc, desc, eq } from "drizzle-orm";
import type { Tick } from "@/components/presence-strip";
import { db } from "@/lib/db";
import { answers, prompts, runs, type Intent, type Prompt } from "@/lib/db/schema";
import { allPromptTicks } from "@/lib/db/queries/overview";
import {
  computeFirstMentionPosition,
  computePromptMentionRate,
  loadRun,
  type Rate,
} from "@/lib/parse/metrics";
import { entitiesForBrand, type Entity } from "@/lib/parse/mentions";

export type PromptRow = {
  id: string;
  text: string;
  intent: Intent;
  active: boolean;
  /** Mention rate in the most recent completed run. */
  rate: Rate;
  ticks: Tick[];
  /** Character offset of the brand's first appearance. Null when absent. */
  firstMentionPosition: number | null;
};

async function latestCompleteRunId(brandId: string): Promise<string | null> {
  const [run] = await db
    .select({ id: runs.id })
    .from(runs)
    .where(and(eq(runs.brandId, brandId), eq(runs.status, "complete"), eq(runs.kind, "full")))
    .orderBy(desc(runs.startedAt))
    .limit(1);

  return run?.id ?? null;
}

export async function listPromptRows(
  brandId: string,
  options: { model?: string } = {},
): Promise<PromptRow[]> {
  const [rows, ticksByPrompt, runId] = await Promise.all([
    db
      .select()
      .from(prompts)
      .where(eq(prompts.brandId, brandId))
      .orderBy(asc(prompts.intent), asc(prompts.text)),
    allPromptTicks(brandId),
    latestCompleteRunId(brandId),
  ]);

  const probeRows = runId ? await loadRun(runId, { model: options.model }) : [];

  return rows.map((prompt) => ({
    id: prompt.id,
    text: prompt.text,
    intent: prompt.intent,
    active: prompt.active,
    rate: computePromptMentionRate(probeRows, prompt.id),
    ticks: ticksByPrompt.get(prompt.id) ?? [],
    firstMentionPosition: computeFirstMentionPosition(probeRows, prompt.id),
  }));
}

export type PromptDetail = {
  prompt: Prompt;
  entities: Entity[];
  /** How many probes of this prompt are stored in the latest run. */
  probeCount: number;
  /** The most recent probe for this prompt, whole and unedited. */
  answer: {
    id: string;
    model: string;
    probeIndex: number;
    rawText: string;
    citations: string[];
    createdAt: Date;
  } | null;
  rate: Rate;
};

export async function getPromptDetail(
  brandId: string,
  promptId: string,
  options: { model?: string } = {},
): Promise<PromptDetail | null> {
  const [prompt] = await db
    .select()
    .from(prompts)
    .where(and(eq(prompts.id, promptId), eq(prompts.brandId, brandId)))
    .limit(1);

  if (!prompt) return null;

  const runId = await latestCompleteRunId(brandId);

  const [entities, probeRows, answerRows] = await Promise.all([
    entitiesForBrand(brandId),
    runId ? loadRun(runId, { model: options.model }) : Promise.resolve([]),
    runId
      ? db
          .select()
          .from(answers)
          .where(
            options.model
              ? and(
                  eq(answers.runId, runId),
                  eq(answers.promptId, promptId),
                  eq(answers.model, options.model),
                )
              : and(eq(answers.runId, runId), eq(answers.promptId, promptId)),
          )
          .orderBy(desc(answers.createdAt), desc(answers.probeIndex))
          .limit(1)
      : Promise.resolve([]),
  ]);

  const answer = answerRows[0];

  return {
    prompt,
    entities,
    probeCount: probeRows.filter((row) => row.promptId === promptId).length,
    answer: answer
      ? {
          id: answer.id,
          model: answer.model,
          probeIndex: answer.probeIndex,
          rawText: answer.rawText,
          citations: answer.citations,
          createdAt: answer.createdAt,
        }
      : null,
    rate: computePromptMentionRate(probeRows, promptId),
  };
}


/** Engines that answered in the most recent completed run. */
export async function enginesInLatestRun(brandId: string): Promise<string[]> {
  const runId = await latestCompleteRunId(brandId);
  if (!runId) return [];

  const rows = await db
    .selectDistinct({ model: answers.model })
    .from(answers)
    .where(eq(answers.runId, runId))
    .orderBy(asc(answers.model));

  return rows.map((row) => row.model);
}
