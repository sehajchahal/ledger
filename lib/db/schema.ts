import {
  boolean,
  index,
  integer,
  primaryKey,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

/* ---------------------------------------------------------------- enums -- */

export const planEnum = pgEnum("plan", ["starter", "growth", "enterprise"]);
export const roleEnum = pgEnum("role", ["owner", "editor", "viewer"]);
export const intentEnum = pgEnum("intent", [
  "discovery",
  "comparison",
  "problem",
  "branded",
]);
export const runStatusEnum = pgEnum("run_status", [
  "queued",
  "running",
  "complete",
  "failed",
]);
export const actionTypeEnum = pgEnum("action_type", [
  "schema_markup",
  "page_edit",
  "offsite_target",
]);
export const actionStatusEnum = pgEnum("action_status", [
  "proposed",
  "approved",
  "shipped",
  "dismissed",
]);
export const cadenceEnum = pgEnum("cadence", ["daily", "weekly", "monthly"]);
/**
 * A `full` run asks every active prompt and is what every metric reads. A
 * `verification` run asks only the prompts one shipped action touched, so it
 * must never be mistaken for the brand's latest measurement.
 */
export const runKindEnum = pgEnum("run_kind", ["full", "verification"]);

/* ------------------------------------------------------------- accounts -- */

export const organizations = pgTable("organizations", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  plan: planEnum("plan").notNull().default("starter"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const workspaces = pgTable(
  "workspaces",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("workspaces_org_id_idx").on(t.orgId)],
);

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  name: text("name"),
  /** Set by Auth.js when a magic link is used. */
  emailVerified: timestamp("email_verified", { withTimezone: true }),
  image: text("image"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/* ----------------------------------------------------------- auth.js -- */

/**
 * Auth.js tables. Shapes are dictated by @auth/drizzle-adapter — the column
 * names are not ours to choose.
 */
export const accounts = pgTable(
  "accounts",
  {
    userId: uuid("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("providerAccountId").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (t) => [
    primaryKey({ columns: [t.provider, t.providerAccountId] }),
    index("accounts_user_id_idx").on(t.userId),
  ],
);

export const sessions = pgTable(
  "sessions",
  {
    sessionToken: text("sessionToken").primaryKey(),
    userId: uuid("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expires: timestamp("expires", { withTimezone: true }).notNull(),
  },
  (t) => [index("sessions_user_id_idx").on(t.userId)],
);

export const verificationTokens = pgTable(
  "verificationToken",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { withTimezone: true }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.identifier, t.token] })],
);

export const memberships = pgTable(
  "memberships",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    role: roleEnum("role").notNull().default("viewer"),
  },
  (t) => [
    index("memberships_user_id_idx").on(t.userId),
    index("memberships_org_id_idx").on(t.orgId),
  ],
);

/* --------------------------------------------------------------- brands -- */

export const brands = pgTable(
  "brands",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    domain: text("domain").notNull(),
    /** Other names the brand is known by. Matched with the same word-boundary rules. */
    aliases: text("aliases").array().notNull().default([]),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("brands_workspace_id_idx").on(t.workspaceId)],
);

export const competitors = pgTable(
  "competitors",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    brandId: uuid("brand_id")
      .notNull()
      .references(() => brands.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    aliases: text("aliases").array().notNull().default([]),
  },
  (t) => [index("competitors_brand_id_idx").on(t.brandId)],
);

export const prompts = pgTable(
  "prompts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    brandId: uuid("brand_id")
      .notNull()
      .references(() => brands.id, { onDelete: "cascade" }),
    text: text("text").notNull(),
    intent: intentEnum("intent").notNull(),
    active: boolean("active").notNull().default(true),
  },
  (t) => [index("prompts_brand_id_idx").on(t.brandId)],
);

/* ---------------------------------------------------------- measurement -- */

export const runs = pgTable(
  "runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    brandId: uuid("brand_id")
      .notNull()
      .references(() => brands.id, { onDelete: "cascade" }),
    status: runStatusEnum("status").notNull().default("queued"),
    kind: runKindEnum("kind").notNull().default("full"),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (t) => [index("runs_brand_id_idx").on(t.brandId), index("runs_brand_id_kind_idx").on(t.brandId, t.kind)],
);

export const answers = pgTable(
  "answers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    runId: uuid("run_id")
      .notNull()
      .references(() => runs.id, { onDelete: "cascade" }),
    promptId: uuid("prompt_id")
      .notNull()
      .references(() => prompts.id, { onDelete: "cascade" }),
    /** `provider/model` of the engine that answered. */
    model: text("model").notNull(),
    /** 0, 1, 2 — the same prompt asked three times. */
    probeIndex: integer("probe_index").notNull(),
    /** The full answer, stored verbatim. Never summarised before storage. */
    rawText: text("raw_text").notNull(),
    /** Source URLs the engine returned, in order. */
    citations: jsonb("citations").$type<string[]>().notNull().default([]),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("answers_run_id_idx").on(t.runId),
    index("answers_prompt_id_idx").on(t.promptId),
    index("answers_run_id_prompt_id_idx").on(t.runId, t.promptId),
  ],
);

export const mentions = pgTable(
  "mentions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    answerId: uuid("answer_id")
      .notNull()
      .references(() => answers.id, { onDelete: "cascade" }),
    entityName: text("entity_name").notNull(),
    isBrand: boolean("is_brand").notNull(),
    /** Character offset of the first occurrence. Earlier is better. */
    charPosition: integer("char_position").notNull(),
    /** Null until the classify job runs. Null means unknown, not false. */
    isRecommendation: boolean("is_recommendation"),
  },
  (t) => [index("mentions_answer_id_idx").on(t.answerId)],
);

/* ------------------------------------------------------------- the loop -- */

export const actions = pgTable(
  "actions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    brandId: uuid("brand_id")
      .notNull()
      .references(() => brands.id, { onDelete: "cascade" }),
    /**
     * The prompt this action addresses. Verification re-runs exactly this
     * prompt, so a delta measures the fix rather than the brand's whole week.
     */
    promptId: uuid("prompt_id").references(() => prompts.id, { onDelete: "set null" }),
    type: actionTypeEnum("type").notNull(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    status: actionStatusEnum("status").notNull().default("proposed"),
    proposedAt: timestamp("proposed_at", { withTimezone: true }).notNull().defaultNow(),
    shippedAt: timestamp("shipped_at", { withTimezone: true }),
    approvedBy: uuid("approved_by").references(() => users.id, { onDelete: "set null" }),
  },
  (t) => [
    index("actions_brand_id_idx").on(t.brandId),
    index("actions_prompt_id_idx").on(t.promptId),
    index("actions_approved_by_idx").on(t.approvedBy),
  ],
);

export const verifications = pgTable(
  "verifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    actionId: uuid("action_id")
      .notNull()
      .references(() => actions.id, { onDelete: "cascade" }),
    runBeforeId: uuid("run_before_id").references(() => runs.id, { onDelete: "set null" }),
    runAfterId: uuid("run_after_id").references(() => runs.id, { onDelete: "set null" }),
    /** When the re-check becomes due. 14 days after the action was shipped. */
    scheduledFor: timestamp("scheduled_for", { withTimezone: true }).notNull(),
    /** Mention rate for the affected prompts before and after, for display. */
    rateBefore: numeric("rate_before", { precision: 6, scale: 4 }),
    rateAfter: numeric("rate_after", { precision: 6, scale: 4 }),
    /** Change in mention rate for the affected prompts only. Signed. */
    delta: numeric("delta", { precision: 6, scale: 4 }),
    checkedAt: timestamp("checked_at", { withTimezone: true }),
  },
  (t) => [
    index("verifications_action_id_idx").on(t.actionId),
    index("verifications_run_before_id_idx").on(t.runBeforeId),
    index("verifications_run_after_id_idx").on(t.runAfterId),
    index("verifications_scheduled_for_idx").on(t.scheduledFor),
  ],
);

export const digests = pgTable(
  "digests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    cadence: cadenceEnum("cadence").notNull().default("weekly"),
    recipientEmail: text("recipient_email").notNull(),
    lastSentAt: timestamp("last_sent_at", { withTimezone: true }),
    /** Send immediately when visibility falls by more than this many points. */
    alertImmediately: boolean("alert_immediately").notNull().default(false),
    dropThreshold: integer("drop_threshold").notNull().default(10),
  },
  (t) => [index("digests_workspace_id_idx").on(t.workspaceId)],
);

/**
 * Who did what to an action, and when.
 *
 * Written on approve, dismiss, and mark-shipped. Kept separate from `actions`
 * so the history survives an action being superseded, and so the settings page
 * can show a workspace-wide record rather than a per-action one.
 */
export const auditLog = pgTable(
  "audit_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    actorId: uuid("actor_id").references(() => users.id, { onDelete: "set null" }),
    /** Denormalised so the record still reads correctly if the user is deleted. */
    actorEmail: text("actor_email"),
    action: text("action").notNull(),
    subjectId: uuid("subject_id"),
    subjectLabel: text("subject_label"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("audit_log_workspace_id_idx").on(t.workspaceId),
    index("audit_log_created_at_idx").on(t.createdAt),
  ],
);

/* ---------------------------------------------------------------- types -- */

export type Organization = typeof organizations.$inferSelect;
export type Workspace = typeof workspaces.$inferSelect;
export type User = typeof users.$inferSelect;
export type Brand = typeof brands.$inferSelect;
export type Competitor = typeof competitors.$inferSelect;
export type Prompt = typeof prompts.$inferSelect;
export type Run = typeof runs.$inferSelect;
export type Answer = typeof answers.$inferSelect;
export type Mention = typeof mentions.$inferSelect;
export type Action = typeof actions.$inferSelect;
export type Verification = typeof verifications.$inferSelect;
export type Digest = typeof digests.$inferSelect;
export type Membership = typeof memberships.$inferSelect;
export type AuditEntry = typeof auditLog.$inferSelect;

export type Intent = (typeof intentEnum.enumValues)[number];
export type RunStatus = (typeof runStatusEnum.enumValues)[number];
export type RunKind = (typeof runKindEnum.enumValues)[number];
export type ActionType = (typeof actionTypeEnum.enumValues)[number];
export type ActionStatus = (typeof actionStatusEnum.enumValues)[number];
export type Plan = (typeof planEnum.enumValues)[number];
export type Role = (typeof roleEnum.enumValues)[number];
export type Cadence = (typeof cadenceEnum.enumValues)[number];
