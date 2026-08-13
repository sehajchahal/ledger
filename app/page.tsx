import Link from "next/link";
import { asc } from "drizzle-orm";
import { BrandCheck } from "@/components/landing/brand-check";
import { HeroAnswer } from "@/components/landing/hero-answer";
import { Steps } from "@/components/landing/steps";
import { Table, TD, TH, THead, TR } from "@/components/ui";
import { db } from "@/lib/db";
import { brands } from "@/lib/db/schema";
import { listProofRows } from "@/lib/db/queries/fixes";

export const dynamic = "force-dynamic";

/** The Proof section shows real rows from a real account, negatives included. */
async function proofRows() {
  try {
    const [brand] = await db.select({ id: brands.id }).from(brands).orderBy(asc(brands.createdAt)).limit(1);
    if (!brand) return [];
    const rows = await listProofRows(brand.id);
    return rows.filter((row) => row.verification.kind === "resolved").slice(0, 6);
  } catch {
    return [];
  }
}

export default async function Landing() {
  const proof = await proofRows();

  return (
    <div className="mx-auto max-w-[1100px] px-5 sm:px-8">
      <Header />

      {/* Hero: a demonstration, not a headline over a gradient. */}
      <section className="grid gap-10 py-14 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] lg:gap-14 lg:py-20">
        <div className="lg:pt-4">
          <h1 className="font-display text-display-l sm:text-display-xl text-balance">
            Your competitors are in the answer. You are not.
          </h1>
          <p className="mt-6 max-w-prose text-prose text-graphite">
            People ask ChatGPT and Perplexity what to buy, and get back four names. Ledger
            measures whether one of them is yours, explains why it is not, and re-checks
            after you change something.
          </p>
          <div className="mt-8">
            <a
              href="#check"
              className="label inline-flex h-9 items-center bg-ink px-4 text-paper hover:opacity-85"
            >
              Check your brand
            </a>
          </div>
        </div>

        <HeroAnswer />
      </section>

      {/* The check. Email-free, runs for real. */}
      <section id="check" className="scroll-mt-8 border-t border-rule py-14">
        <h2 className="font-display text-display-l mb-3">See it for your own domain.</h2>
        <p className="mb-8 max-w-prose text-prose text-graphite">
          Type your website. Ledger asks three questions a buyer would type and shows you
          what came back. No email, no account.
        </p>
        <BrandCheck />
      </section>

      {/* How it works — a real sequence, so the numbering earns its place. */}
      <section id="how" className="scroll-mt-8 py-14">
        <h2 className="font-display text-display-l mb-8">How it works</h2>
        <Steps />
      </section>

      {/* The differentiator, stated plainly. */}
      <section className="border-t border-rule py-14">
        <h2 className="font-display text-display-l mb-3">Other tools stop at the diagnosis.</h2>
        <p className="mb-8 max-w-prose text-prose text-graphite">
          Eleven products will tell you that you were mentioned 38 times. None of them tell
          you whether the work you did afterwards changed anything. This is the record from
          a live account — every shipped fix, with what the re-check found.
        </p>

        {proof.length > 0 ? (
          <>
            <Table>
              <THead>
                <TH>Shipped</TH>
                <TH>Fix</TH>
                <TH align="right">Before</TH>
                <TH align="right">After</TH>
                <TH align="right">Change</TH>
              </THead>
              <tbody>
                {proof.map((row) => {
                  const state = row.verification;
                  if (state.kind !== "resolved") return null;
                  const points = Math.round(state.delta * 100);

                  return (
                    <TR key={row.action.id}>
                      <TD mono>{row.shippedAt.toISOString().slice(0, 10)}</TD>
                      <TD>{row.action.title}</TD>
                      <TD mono align="right">{Math.round(state.before * 100)}%</TD>
                      <TD mono align="right">{Math.round(state.after * 100)}%</TD>
                      <TD mono align="right">
                        <span
                          className={
                            points > 0 ? "text-signal" : points < 0 ? "text-alert" : undefined
                          }
                        >
                          {points > 0 ? "+" : ""}
                          {points}pt
                        </span>
                      </TD>
                    </TR>
                  );
                })}
              </tbody>
            </Table>
            <p className="mt-4 max-w-prose text-prose-s text-graphite">
              The negative rows are not an oversight. Some changes do not work, and a record
              that only showed the wins would not be worth forwarding to anyone.
            </p>
          </>
        ) : (
          <p className="max-w-prose text-prose-s text-graphite">
            The proof table fills in from a live account once fixes have shipped and been
            re-checked.
          </p>
        )}
      </section>

      <Pricing />
      <Footer />
    </div>
  );
}

function Header() {
  return (
    <header className="flex items-center justify-between border-b border-rule py-5">
      <span className="font-display text-prose font-medium">Ledger</span>
      <nav aria-label="Primary" className="flex items-center gap-6">
        <a href="#check" className="label text-graphite hover:text-ink">
          Check
        </a>
        <a href="#pricing" className="label text-graphite hover:text-ink">
          Pricing
        </a>
        <Link href="/brands" className="label text-graphite hover:text-ink">
          Sign in
        </Link>
      </nav>
    </header>
  );
}

const TIERS = ["Starter", "Growth", "Enterprise"] as const;

const PRICING_ROWS: { label: string; values: [string, string, string]; mono?: boolean }[] = [
  { label: "Per month", values: ["$49", "$199", "$600"], mono: true },
  { label: "Prompts tracked", values: ["50", "250", "1,000"], mono: true },
  { label: "Checks", values: ["weekly", "daily", "daily"], mono: true },
  { label: "Fixes per month", values: ["10", "50", "200"], mono: true },
  { label: "Brands", values: ["1", "5", "25"], mono: true },
  { label: "Team members", values: ["2", "10", "unlimited"], mono: true },
  { label: "Answer engines", values: ["1", "2", "2"], mono: true },
  { label: "Proof export", values: ["CSV", "CSV", "CSV"], mono: true },
];

function Pricing() {
  return (
    <section id="pricing" className="scroll-mt-8 border-t border-rule py-14">
      <h2 className="font-display text-display-l mb-3">Pricing</h2>
      <p className="mb-8 max-w-prose text-prose text-graphite">
        Every tier includes the verification loop. Prices are per workspace, billed monthly,
        and you can leave whenever you like.
      </p>

      <Table>
        <THead>
          <TH>
            <span className="sr-only">Plan</span>
          </TH>
          {TIERS.map((tier) => (
            <TH key={tier} align="right">
              {tier}
            </TH>
          ))}
        </THead>
        <tbody>
          {PRICING_ROWS.map((row) => (
            <TR key={row.label}>
              <TD>{row.label}</TD>
              {row.values.map((value, i) => (
                <TD key={TIERS[i]} mono={row.mono} align="right">
                  {value}
                </TD>
              ))}
            </TR>
          ))}
        </tbody>
      </Table>

      <p className="mt-4 max-w-prose text-prose-s text-graphite">
        A fix is one generated change — markup, a rewritten section, or an outreach target.
        Running out of them does not stop your checks.
      </p>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-rule py-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <span className="font-mono text-mono text-graphite">Ledger</span>
        <nav aria-label="Footer" className="flex flex-wrap gap-6">
          {[
            ["Check", "#check"],
            ["How it works", "#how"],
            ["Pricing", "#pricing"],
          ].map(([label, href]) => (
            <a key={label} href={href} className="font-mono text-mono text-graphite hover:text-ink">
              {label}
            </a>
          ))}
          <Link href="/brands" className="font-mono text-mono text-graphite hover:text-ink">
            Sign in
          </Link>
        </nav>
      </div>
      <p className="mt-6 max-w-prose font-mono text-mono text-graphite">
        Ledger reports what answer engines said. It does not promise that any change will
        make a model mention you.
      </p>
    </footer>
  );
}
