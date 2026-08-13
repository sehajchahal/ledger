import { and, count, eq, gte } from "drizzle-orm";
import { db } from "@/lib/db";
import { actions, brands, organizations, prompts, runs, workspaces } from "@/lib/db/schema";
import type { Plan } from "@/lib/db/schema";

/**
 * Plan limits, in one place.
 *
 * Every path that spends money or creates work checks here first. When a limit
 * is hit the caller gets back a sentence naming the limit and what lifting it
 * takes — not a boolean, because "false" gives the UI nothing honest to say.
 */

export type Limits = {
  prompts: number;
  /** Minimum hours between full runs. */
  checkIntervalHours: number;
  actionsPerMonth: number;
  brands: number;
  members: number;
  engines: number;
};

export const PLAN_LIMITS: Record<Plan, Limits> = {
  starter: {
    prompts: 50,
    checkIntervalHours: 24 * 7,
    actionsPerMonth: 10,
    brands: 1,
    members: 2,
    engines: 1,
  },
  growth: {
    prompts: 250,
    checkIntervalHours: 24,
    actionsPerMonth: 50,
    brands: 5,
    members: 10,
    engines: 2,
  },
  enterprise: {
    prompts: 1000,
    checkIntervalHours: 24,
    actionsPerMonth: 200,
    brands: 25,
    members: Number.POSITIVE_INFINITY,
    engines: 2,
  },
};

export const PLAN_LABEL: Record<Plan, string> = {
  starter: "Starter",
  growth: "Growth",
  enterprise: "Enterprise",
};

/** The next plan up, or null at the top. */
function nextPlan(plan: Plan): Plan | null {
  if (plan === "starter") return "growth";
  if (plan === "growth") return "enterprise";
  return null;
}

export type LimitCheck =
  | { allowed: true; remaining: number }
  | { allowed: false; reason: string };

/** Resolves the plan a brand bills under. */
export async function planForBrand(brandId: string): Promise<{ plan: Plan; orgId: string }> {
  const [row] = await db
    .select({ plan: organizations.plan, orgId: organizations.id })
    .from(brands)
    .innerJoin(workspaces, eq(workspaces.id, brands.workspaceId))
    .innerJoin(organizations, eq(organizations.id, workspaces.orgId))
    .where(eq(brands.id, brandId))
    .limit(1);

  if (!row) throw new Error(`no brand with id ${brandId}`);
  return row;
}

/** "Growth allows 50." — or nothing at all when already on the top plan. */
function upgradeSentence(plan: Plan, pick: (limits: Limits) => number): string {
  const next = nextPlan(plan);
  if (!next) return "";
  return ` ${PLAN_LABEL[next]} allows ${pick(PLAN_LIMITS[next])}.`;
}

/** Start of the current calendar month, UTC. */
function monthStart(now = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

/**
 * Whether more fixes can be generated this month.
 *
 * Counts every action created this month regardless of what happened to it
 * afterwards — generating a fix costs a model call whether or not the user
 * approves it, so dismissing one does not buy another.
 */
export async function checkActionAllowance(
  brandId: string,
  wanted = 1,
): Promise<LimitCheck> {
  const { plan } = await planForBrand(brandId);
  const limit = PLAN_LIMITS[plan].actionsPerMonth;

  const [row] = await db
    .select({ n: count() })
    .from(actions)
    .where(and(eq(actions.brandId, brandId), gte(actions.proposedAt, monthStart())));

  const used = row?.n ?? 0;
  const remaining = Math.max(0, limit - used);

  if (remaining === 0) {
    return {
      allowed: false,
      reason:
        `You have used all ${limit} fixes this month on ${PLAN_LABEL[plan]}.` +
        upgradeSentence(plan, (l) => l.actionsPerMonth) +
        " Your checks keep running either way.",
    };
  }

  return { allowed: true, remaining: Math.min(remaining, wanted) };
}

/** Whether another prompt can be added to a brand. */
export async function checkPromptAllowance(brandId: string): Promise<LimitCheck> {
  const { plan } = await planForBrand(brandId);
  const limit = PLAN_LIMITS[plan].prompts;

  const [row] = await db
    .select({ n: count() })
    .from(prompts)
    .where(eq(prompts.brandId, brandId));

  const used = row?.n ?? 0;

  if (used >= limit) {
    return {
      allowed: false,
      reason:
        `You are tracking ${used} prompts, which is the ${PLAN_LABEL[plan]} limit.` +
        upgradeSentence(plan, (l) => l.prompts),
    };
  }

  return { allowed: true, remaining: limit - used };
}

/**
 * Whether a full run may start now.
 *
 * Rate is per plan: a Starter account checking hourly would cost more to serve
 * than it pays. Verification re-checks are exempt — they are the product's
 * whole point and they only ask one prompt.
 */
export async function checkRunAllowance(brandId: string): Promise<LimitCheck> {
  const { plan } = await planForBrand(brandId);
  const { checkIntervalHours } = PLAN_LIMITS[plan];

  const since = new Date(Date.now() - checkIntervalHours * 60 * 60 * 1000);

  const [row] = await db
    .select({ n: count() })
    .from(runs)
    .where(
      and(
        eq(runs.brandId, brandId),
        eq(runs.kind, "full"),
        gte(runs.startedAt, since),
      ),
    );

  if ((row?.n ?? 0) > 0) {
    const cadence = checkIntervalHours >= 24 * 7 ? "once a week" : "once a day";
    const next = nextPlan(plan);

    return {
      allowed: false,
      reason: next
        ? `${PLAN_LABEL[plan]} runs checks ${cadence}. ${PLAN_LABEL[next]} runs them daily.`
        : `This plan runs checks ${cadence}.`,
    };
  }

  return { allowed: true, remaining: 1 };
}
