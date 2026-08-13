"use server";

import { and, eq } from "drizzle-orm";
import { after } from "next/server";
import { db } from "@/lib/db";
import {
  brands,
  competitors,
  organizations,
  prompts,
  runs,
  workspaces,
  type Intent,
} from "@/lib/db/schema";
import { proposePlan, type Plan } from "@/lib/onboarding/diagnose";
import { inspectSite, type SiteProfile } from "@/lib/site/inspect";
import { runProbe } from "@/lib/probe/run";

/** Step 1 and 2 run together: read the site, then propose a plan from it. */
export async function inspectAndPropose(
  url: string,
): Promise<{ ok: true; site: SiteProfile; plan: Plan } | { ok: false; reason: string }> {
  const site = await inspectSite(url);

  if (!site) {
    return { ok: false, reason: "That does not look like a website. Try something like example.com." };
  }

  const plan = await proposePlan(site);
  return { ok: true, site, plan };
}

/**
 * Regenerates the prompt set after the user corrects the name or category.
 *
 * Without this, editing the category would leave 25 prompts built from the
 * wrong guess sitting on screen looking authoritative.
 */
export async function regeneratePlan(site: SiteProfile): Promise<Plan> {
  return proposePlan(site);
}

export type ConfirmInput = {
  site: { domain: string; name: string; category: string };
  prompts: { text: string; intent: Intent }[];
  competitors: { name: string; aliases: string[] }[];
};

/**
 * Step 3: create everything and start the first run.
 *
 * The run row is written before returning so the overview can show it in
 * progress on the very first paint; the probes themselves happen after the
 * response is flushed.
 */
export async function confirmOnboarding(
  input: ConfirmInput,
): Promise<{ ok: true; brandId: string } | { ok: false; reason: string }> {
  const name = input.site.name.trim();
  const domain = input.site.domain.trim();

  if (!name || !domain) return { ok: false, reason: "A brand needs a name and a domain." };
  if (input.prompts.length === 0) {
    return { ok: false, reason: "Keep at least one prompt — there is nothing to measure otherwise." };
  }

  // Until Phase 10 adds accounts, reuse the first org and workspace if one
  // exists so onboarding does not accumulate empty organisations.
  const [existingOrg] = await db.select().from(organizations).limit(1);
  const org =
    existingOrg ??
    (await db.insert(organizations).values({ name, plan: "starter" }).returning())[0];

  const [existingWorkspace] = await db
    .select()
    .from(workspaces)
    .where(eq(workspaces.orgId, org.id))
    .limit(1);

  const workspace =
    existingWorkspace ??
    (await db.insert(workspaces).values({ orgId: org.id, name }).returning())[0];

  const [duplicate] = await db
    .select({ id: brands.id })
    .from(brands)
    .where(and(eq(brands.workspaceId, workspace.id), eq(brands.domain, domain)))
    .limit(1);

  if (duplicate) {
    return { ok: false, reason: `${domain} is already being tracked in this workspace.` };
  }

  const [brand] = await db
    .insert(brands)
    .values({ workspaceId: workspace.id, name, domain, aliases: [] })
    .returning();

  await db
    .insert(prompts)
    .values(input.prompts.map((p) => ({ brandId: brand.id, text: p.text, intent: p.intent })));

  if (input.competitors.length > 0) {
    await db.insert(competitors).values(
      input.competitors.map((c) => ({
        brandId: brand.id,
        name: c.name,
        aliases: c.aliases,
      })),
    );
  }

  const [run] = await db
    .insert(runs)
    .values({ brandId: brand.id, status: "queued", kind: "full" })
    .returning();

  after(async () => {
    try {
      await runProbe(brand.id, { existingRunId: run.id });
    } catch (error) {
      console.error(`first run ${run.id} failed`, error);
      await db
        .update(runs)
        .set({ status: "failed", completedAt: new Date() })
        .where(eq(runs.id, run.id));
    }
  });

  return { ok: true, brandId: brand.id };
}
