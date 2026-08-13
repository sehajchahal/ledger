"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { competitors } from "@/lib/db/schema";
import { requireCapability } from "@/lib/auth/session";

async function guard(brandId: string): Promise<string | null> {
  try {
    await requireCapability(brandId, "manageBrand");
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : "Something went wrong.";
  }
}

export async function addCompetitor(brandId: string, formData: FormData) {
  const denied = await guard(brandId);
  if (denied) return { ok: false as const, reason: denied };

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { ok: false as const, reason: "A competitor needs a name." };

  const aliases = String(formData.get("aliases") ?? "")
    .split(",")
    .map((alias) => alias.trim())
    .filter(Boolean);

  await db.insert(competitors).values({ brandId, name, aliases });

  revalidatePath(`/brands/${brandId}/competitors`);
  return { ok: true as const };
}

/**
 * Removes a competitor from future parsing. Mentions already recorded stay —
 * they are part of runs that have already been reported on.
 */
export async function removeCompetitor(brandId: string, competitorId: string) {
  const denied = await guard(brandId);
  if (denied) return { ok: false as const, reason: denied };

  await db
    .delete(competitors)
    .where(and(eq(competitors.id, competitorId), eq(competitors.brandId, brandId)));

  revalidatePath(`/brands/${brandId}/competitors`);
  return { ok: true as const };
}
