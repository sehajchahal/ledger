# Ledger

Ledger measures whether AI assistants recommend a brand, explains why they
don't, and proves whether a fix changed the answer.

Eleven tools will tell you that you were mentioned 38 times. None of them tell
you whether the work you did afterwards changed anything. That gap — ship a fix,
wait, re-run the same prompts, report the delta including when it is negative —
is what this is for.

Read `AGENTS.md` before changing code and `DESIGN.md` before changing UI.

---

## Setup

Requires Node 20+ and Postgres 14+ (`brew install postgresql@14`).

```bash
npm install

# Create and start a local Postgres cluster inside the repo (.pgdata, port 5433)
initdb -D .pgdata -U ledger --auth=trust -E UTF8
npm run db:start
createdb -h localhost -p 5433 -U ledger ledger

cp .env.example .env.local
# Generate the one required secret:
echo "AUTH_SECRET=$(openssl rand -base64 32)" >> .env.local

npm run db:migrate
npm run seed            # one org, one brand, 3 competitors, 25 prompts, 3 users
npm run seed:history    # 14 days of back-dated runs so the charts have data
npm run dev
```

Then open http://localhost:3000 and sign in as `owner@northsidetutoring.ca`. With
no mail server configured the sign-in link is **printed to the terminal running
`npm run dev`** — look for "Ledger sign-in link".

The seed creates one user per role so the permission model can be exercised:

| Email | Role | Can |
|---|---|---|
| `owner@northsidetutoring.ca` | owner | everything, including members and billing |
| `editor@northsidetutoring.ca` | editor | run checks, approve fixes, edit prompts |
| `viewer@northsidetutoring.ca` | viewer | read only — approve buttons are absent |

## Environment

Only `DATABASE_URL` and `AUTH_SECRET` are required. Everything else degrades to a
mode that works locally and says so on screen.

| Variable | Required | What happens without it |
|---|---|---|
| `DATABASE_URL` | yes | Nothing runs. |
| `AUTH_SECRET` | yes | Sign-in and signed email links fail. `openssl rand -base64 32`. |
| `PERPLEXITY_API_KEY` | no | Probes fall back to another engine, then to locally generated **fixture** answers. Fixture runs are labelled as demo data everywhere and are not measurements. |
| `ANTHROPIC_API_KEY` | no | `diagnose` and `draft` fall back to templates; onboarding still works. |
| `OPENAI_API_KEY` | no | The second probe engine is unavailable, so there is nothing to compare against. |
| `OPENAI_PROBE_MODEL` | no | Defaults to `gpt-4o`. |
| `EMAIL_SERVER_HOST`, `EMAIL_FROM`, … | no | Sign-in links and digests print to the server log instead of sending. |
| `APP_URL` | no | Defaults to `http://localhost:3000`. Used for links inside emails. |
| `LOG_FORMAT=json` | no | Job runner logs one JSON object per line instead of the readable form. |
| `LOG_LEVEL` | no | `debug`, `info` (default), `warn`, `error`. |

**Without any model key the product is fully demoable** — answers are synthesised
locally, deterministically, and every surface that shows them says so. They are
not measurements and must never be shown to a customer as one.

## Running a probe manually

A run asks every active prompt three times and stores each answer whole.

```bash
# Find a brand id
psql -h localhost -p 5433 -U ledger -d ledger -c "select id, name from brands"

npm run probe -- <brand-id>                 # configured engine
npm run probe -- <brand-id> --all-engines   # every engine, for side-by-side comparison
```

The runner parses mentions, then runs the agent, which proposes a fix for any
prompt lost since the previous run.

```bash
npm run parse                # re-parse the most recent run
npm run verify               # run every verification whose 14 days have elapsed
npm run digest -- --dry      # build digests and print them, send nothing
npm run digest               # send what is due
```

On a deployment these run from `/api/cron/*` instead — see Deploying below.

## How it fits together

```
scripts/          CLI entry points; all real logic lives in lib/
config/models.ts  job name -> model id. The ONLY place a model id is written.
lib/ai/router.ts  runJob(job, input). The ONLY place a model is called.
lib/parse/        mention matching and metrics. Deterministic, no model calls, tested.
lib/probe/run.ts  one definition of what a run is, shared by CLI, UI, and verification.
lib/actions/      fix generation, JSON-LD validation, the verification loop.
lib/agent/        change detection between runs, and what to do about it.
```

Two invariants worth knowing before changing anything:

1. **`lib/parse/` never calls a model.** Verification deltas are computed from
   its output, so the same input must produce the same mentions forever.
2. **Runs are `full` or `verification`.** A verification re-check asks one
   prompt; if it were mistaken for the latest measurement, visibility would read
   as near-zero. Every "latest run" query filters `kind = 'full'`.

## Tests

```bash
npm test         # parser, metrics, and the role matrix
npm run typecheck
npm run build
```

The parser is the part that must be tested — it is the foundation every number
rests on. UI is verified by running it.

## Deploying (Vercel + Neon)

The build does not need a database — the connection is created on first query,
not on import — so these can be done in any order.

**1. Provision Postgres.** Create a Neon project and copy the **pooled**
connection string (the host contains `-pooler`). Prepared statements are
disabled automatically when a pooled URL is detected, because PgBouncer in
transaction mode cannot hold them between queries.

**2. Set environment variables** in the Vercel project:

| Variable | Value |
|---|---|
| `DATABASE_URL` | the pooled Neon string |
| `AUTH_SECRET` | `openssl rand -base64 32` |
| `APP_URL` | `https://your-domain` — without it, approve links in digests point at localhost |
| `CRON_SECRET` | Vercel generates this; the `/api/cron/*` routes refuse to run without it |

Optional: `PERPLEXITY_API_KEY`, `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, and the
`EMAIL_SERVER_*` set. Without them the deployment still works and labels itself
as demo data.

**3. Run migrations against the cloud database:**

```bash
DATABASE_URL='<pooled neon string>' npx drizzle-kit migrate
DATABASE_URL='<pooled neon string>' npm run seed   # optional demo data
```

**4. Deploy.** `vercel.json` registers three schedules:

| Route | Schedule | Does |
|---|---|---|
| `/api/cron/run-queue` | every 5 min | processes one queued run, reclaims dead ones, prunes rate limits |
| `/api/cron/digest` | hourly | sends digests that are due, and immediate drop alerts |
| `/api/cron/verify` | daily 06:30 | re-checks every action whose 14 days have elapsed |

### Why runs are queued rather than run inline

A full run is 75+ model calls and outlives any serverless function. "Run checks
now" writes a `queued` row and returns; the cron worker claims it with
`FOR UPDATE SKIP LOCKED` so two firings cannot probe the same run twice, and a
run left `running` for more than 15 minutes — a killed function — is reclaimed
and retried. Locally there is no cron, so the same drain runs in the background
after the request, which keeps the button behaving identically in both places.

## Operations

- `GET /api/health` — returns 503 if the database is unreachable, and reports
  whether this instance is measuring or running on fixtures.
- `POST /api/check` — the public brand check. Rate limited to 5 per IP per hour,
  counted in Postgres so the limit holds across instances. Fails open: if the
  database is unreachable the request is allowed, because this is a spend
  control and not an authorisation check.
- `/api/cron/*` — require `Authorization: Bearer $CRON_SECRET`. With no secret
  set they return 503 rather than running unauthenticated.
