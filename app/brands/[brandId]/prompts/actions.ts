"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { intentEnum, prompts, type Intent } from "@/lib/db/schema";
import { requireCapability } from "@/lib/auth/session";
import { checkPromptAllowance } from "@/lib/limits";

const INTENTS = intentEnum.enumValues;

function describe(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong.";
}

/** Every mutation re-checks the role; a hidden button is not access control. */
async function guard(brandId: string): Promise<string | null> {
  try {
    await requireCapability(brandId, "manageBrand");
    return null;
  } catch (error) {
    return describe(error);
  }
}

function readIntent(value: FormDataEntryValue | null): Intent {
  const candidate = String(value ?? "");
  return (INTENTS as readonly string[]).includes(candidate)
    ? (candidate as Intent)
    : "discovery";
}

export async function createPrompt(brandId: string, formData: FormData) {
  const denied = await guard(brandId);
  if (denied) return { ok: false as const, reason: denied };

  const text = String(formData.get("text") ?? "").trim();
  if (!text) return { ok: false as const, reason: "A prompt needs some text." };

  const allowance = await checkPromptAllowance(brandId);
  if (!allowance.allowed) return { ok: false as const, reason: allowance.reason };

  await db.insert(prompts).values({
    brandId,
    text,
    intent: readIntent(formData.get("intent")),
  });

  revalidatePath(`/brands/${brandId}/prompts`);
  return { ok: true as const };
}

export async function updatePrompt(brandId: string, promptId: string, formData: FormData) {
  const denied = await guard(brandId);
  if (denied) return { ok: false as const, reason: denied };

  const text = String(formData.get("text") ?? "").trim();
  if (!text) return { ok: false as const, reason: "A prompt needs some text." };

  await db
    .update(prompts)
    .set({ text, intent: readIntent(formData.get("intent")) })
    .where(and(eq(prompts.id, promptId), eq(prompts.brandId, brandId)));

  revalidatePath(`/brands/${brandId}/prompts`);
  return { ok: true as const };
}

/**
 * Deactivates rather than deletes. Answers already collected for this prompt
 * stay where they are — deleting them would rewrite history that a shipped
 * action may already have been verified against.
 */
export async function setPromptActive(brandId: string, promptId: string, active: boolean) {
  const denied = await guard(brandId);
  if (denied) return { ok: false as const, reason: denied };

  await db
    .update(prompts)
    .set({ active })
    .where(and(eq(prompts.id, promptId), eq(prompts.brandId, brandId)));

  revalidatePath(`/brands/${brandId}/prompts`);
  return { ok: true as const };
}
