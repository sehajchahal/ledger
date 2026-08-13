import Link from "next/link";
import { asc } from "drizzle-orm";
import { BrandCheck } from "@/components/landing/brand-check";
import { FixTypes } from "@/components/landing/fix-types";
import { HeroAnswer } from "@/components/landing/hero-answer";
import { Pricing } from "@/components/landing/pricing";
import { Steps } from "@/components/landing/steps";
import { Reveal } from "@/components/reveal";
import { ThemeToggle } from "@/components/theme-toggle";
import { db } from "@/lib/db";
import { brands } from "@/lib/db/schema";
import { listProofRows } from "@/lib/db/queries/fixes";

export const dynamic = "force-dynamic";

/** The Proof section shows real rows from a real account, negatives included. */
async function proofRows() {
  try {
    const [brand] = await db
      .select({ id: brands.id })
      .from(brands)
      .orderBy(asc(brands.createdAt))
      .limit(1);
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
    <div className="relative">
      {/* One soft light source behind the hero. Fixed, so it never reflows. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[620px] opacity-70"
        style={{
          background:
            "radial-gradient(60% 60% at 50% 0%, rgb(var(--glow) / 0.16) 0%, transparent 70%)",
        }}
      />

      <div className="relative mx-auto max-w-[1120px] px-5 sm:px-8">
        <Header />

        {/* ── Hero ─────────────────────────────────────────────────────── */}
        <section className="grid gap-12 py-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:gap-16 lg:py-24">
          <Reveal className="lg:pt-6">
            <span className="label mb-6 inline-flex items-center gap-2 rounded-full border border-rule px-3 py-1.5 text-graphite">
              <span className="size-1.5 rounded-full bg-signal" aria-hidden />
              for small businesses and agencies
            </span>

            <h1 className="font-display text-display-xl text-balance">
              When someone asks AI{" "}
              <span className="text-gradient">which company to use</span>, does it say
              your name?
            </h1>

            <p className="mt-6 max-w-[46ch] text-prose text-graphite">
              Your customers have stopped Googling. They ask ChatGPT, and it answers with
              three or four companies by name. Ledger checks whether you are one of them,
              works out why you are not, writes the fix, and then proves whether the fix
              worked.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <a
                href="#check"
                className="label inline-flex h-12 cursor-pointer items-center gap-2 rounded-[10px] bg-accent px-5 text-accent-ink transition-opacity duration-200 hover:opacity-90"
              >
                Check my brand free
                <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M5 12h14M13 6l6 6-6 6" />
                </svg>
              </a>
              <a
                href="#how"
                className="label inline-flex h-12 cursor-pointer items-center rounded-[10px] border border-rule px-5 text-ink transition-colors duration-200 hover:border-accent"
              >
                See how it works
              </a>
            </div>

            <p className="mt-4 font-mono text-mono text-graphite">
              No email, no account. Fifteen seconds.
            </p>
          </Reveal>

          <Reveal delay={120}>
            <HeroAnswer />
          </Reveal>
        </section>

        {/* ── What this is, in one line ────────────────────────────────── */}
        <Reveal as="section" className="border-t border-rule py-12">
          <div className="grid gap-6 md:grid-cols-3">
            {[
              {
                k: "The problem",
                v: "AI assistants now recommend companies by name, and most businesses have no idea whether they are being named or ignored.",
              },
              {
                k: "What we do",
                v: "We measure it every day, explain exactly why you are missing, and write the specific change that fixes it.",
              },
              {
                k: "Why us",
                v: "Everyone else hands you a dashboard. We do the work and then prove whether it moved the number.",
              },
            ].map((item) => (
              <div key={item.k}>
                <p className="label mb-2 text-accent">{item.k}</p>
                <p className="text-prose-s text-graphite">{item.v}</p>
              </div>
            ))}
          </div>
        </Reveal>

        {/* ── The check ────────────────────────────────────────────────── */}
        <section id="check" className="scroll-mt-8 border-t border-rule py-16">
          <Reveal>
            <h2 className="font-display text-display-l mb-3 text-balance">
              Try it on your own website, right now.
            </h2>
            <p className="mb-8 max-w-prose text-prose text-graphite">
              Type your address. We read your site, work out what you sell, write three
              questions your buyers would ask, and show you exactly what the AI said back.
            </p>
          </Reveal>
          <Reveal delay={80}>
            <BrandCheck />
          </Reveal>
        </section>

        {/* ── How it works ─────────────────────────────────────────────── */}
        <section id="how" className="scroll-mt-8 border-t border-rule py-16">
          <Reveal>
            <h2 className="font-display text-display-l mb-3 text-balance">
              You do nothing. That is the product.
            </h2>
            <p className="mb-10 max-w-prose text-prose text-graphite">
              There is no dashboard to learn and no keywords to research. Our AI does the
              asking, the reading, and the writing — and picks whichever answer engine is
              best suited to each job.
            </p>
          </Reveal>
          <Steps />
        </section>

        {/* ── What a fix actually is ───────────────────────────────────── */}
        <section className="border-t border-rule py-16">
          <Reveal>
            <h2 className="font-display text-display-l mb-3 text-balance">
              And we hand you the fix, not a to-do list.
            </h2>
            <p className="mb-10 max-w-prose text-prose text-graphite">
              Every gap becomes one specific, finished change. Three kinds, depending on
              what is actually wrong.
            </p>
          </Reveal>
          <FixTypes />
        </section>

        {/* ── Proof, the differentiator ────────────────────────────────── */}
        <section className="border-t border-rule py-16">
          <Reveal>
            <h2 className="font-display text-display-l mb-3 text-balance">
              Other tools stop at the diagnosis.
            </h2>
            <p className="mb-8 max-w-prose text-prose text-graphite">
              Eleven products will tell you that you were mentioned 38 times. None of them
              tell you whether the work you did afterwards changed anything. This is the
              real record from a live account — every shipped fix, with what the re-check
              found two weeks later.
            </p>
          </Reveal>

          {proof.length > 0 ? (
            <Reveal delay={80}>
              <div className="panel overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-left">
                    <thead className="bg-wash/60">
                      <tr className="border-b border-rule">
                        <Th>Shipped</Th>
                        <Th>The fix</Th>
                        <Th align="right">Before</Th>
                        <Th align="right">After</Th>
                        <Th align="right">Change</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {proof.map((row) => {
                        const state = row.verification;
                        if (state.kind !== "resolved") return null;
                        const points = Math.round(state.delta * 100);

                        return (
                          <tr key={row.action.id} className="border-b border-rule last:border-0">
                            <Td mono className="whitespace-nowrap text-graphite">
                              {row.shippedAt.toISOString().slice(0, 10)}
                            </Td>
                            <Td>{row.action.title}</Td>
                            <Td mono align="right" className="text-graphite">
                              {Math.round(state.before * 100)}%
                            </Td>
                            <Td mono align="right" className="text-graphite">
                              {Math.round(state.after * 100)}%
                            </Td>
                            <Td mono align="right">
                              <span
                                className={
                                  points > 0
                                    ? "text-signal"
                                    : points < 0
                                      ? "text-alert"
                                      : "text-graphite"
                                }
                              >
                                {points > 0 ? "+" : ""}
                                {points}pt
                              </span>
                            </Td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </Reveal>
          ) : (
            <p className="max-w-prose text-prose-s text-graphite">
              The proof table fills in from a live account once fixes have shipped and been
              re-checked.
            </p>
          )}

          <Reveal delay={120}>
            <p className="mt-5 max-w-prose text-prose-s text-graphite">
              The negative rows are not an oversight. Some changes do not work, and a
              record that only showed the wins would not be worth forwarding to anyone.
            </p>
          </Reveal>
        </section>

        {/* ── Pricing ──────────────────────────────────────────────────── */}
        <section id="pricing" className="scroll-mt-8 border-t border-rule py-16">
          <Reveal>
            <h2 className="font-display text-display-l mb-3 text-balance">Pricing</h2>
            <p className="mb-10 max-w-prose text-prose text-graphite">
              Billed monthly, cancel whenever. Every plan includes the part that matters —
              re-checking whether the fix worked.
            </p>
          </Reveal>
          <Pricing />
        </section>

        {/* ── Closing ──────────────────────────────────────────────────── */}
        <Reveal as="section" className="border-t border-rule py-16">
          <div className="panel panel-glow p-8 text-center sm:p-12">
            <h2 className="font-display text-display-l mx-auto mb-4 max-w-[20ch] text-balance">
              Find out where you stand in fifteen seconds.
            </h2>
            <p className="mx-auto mb-8 max-w-prose text-prose text-graphite">
              No email, no account, no call with sales. Type your website and see what the
              AI says about you.
            </p>
            <a
              href="#check"
              className="label inline-flex h-12 cursor-pointer items-center gap-2 rounded-[10px] bg-accent px-6 text-accent-ink transition-opacity duration-200 hover:opacity-90"
            >
              Check my brand free
              <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            </a>
          </div>
        </Reveal>

        <Footer />
      </div>
    </div>
  );
}

function Header() {
  return (
    <header className="flex items-center justify-between border-b border-rule py-5">
      <span className="flex items-center gap-2.5">
        <span className="flex size-8 items-center justify-center rounded-[8px] bg-accent text-accent-ink">
          <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden>
            <path d="M4 18V9M10 18V5M16 18v-6M22 18h-2" />
          </svg>
        </span>
        <span className="font-display text-[1.05rem] font-semibold">Ledger</span>
      </span>

      <nav aria-label="Primary" className="flex items-center gap-2 sm:gap-5">
        <a href="#how" className="label hidden cursor-pointer text-graphite transition-colors hover:text-ink sm:inline">
          How it works
        </a>
        <a href="#pricing" className="label hidden cursor-pointer text-graphite transition-colors hover:text-ink sm:inline">
          Pricing
        </a>
        <Link href="/brands" className="label cursor-pointer text-graphite transition-colors hover:text-ink">
          Sign in
        </Link>
        <ThemeToggle />
      </nav>
    </header>
  );
}

function Footer() {
  return (
    <footer className="border-t border-rule py-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <span className="font-mono text-mono text-graphite">Ledger</span>
        <nav aria-label="Footer" className="flex flex-wrap gap-5">
          {[
            ["Check", "#check"],
            ["How it works", "#how"],
            ["Pricing", "#pricing"],
          ].map(([label, href]) => (
            <a key={label} href={href} className="cursor-pointer font-mono text-mono text-graphite transition-colors hover:text-ink">
              {label}
            </a>
          ))}
          <Link href="/brands" className="cursor-pointer font-mono text-mono text-graphite transition-colors hover:text-ink">
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

function Th({ children, align = "left" }: { children: React.ReactNode; align?: "left" | "right" }) {
  return (
    <th
      scope="col"
      className={`label px-4 py-3 font-medium text-graphite ${align === "right" ? "text-right" : ""}`}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  align = "left",
  mono,
  className = "",
}: {
  children: React.ReactNode;
  align?: "left" | "right";
  mono?: boolean;
  className?: string;
}) {
  return (
    <td
      className={`px-4 py-3.5 ${mono ? "font-mono text-mono tabular-nums" : "text-prose-s"} ${
        align === "right" ? "text-right" : ""
      } ${className}`}
    >
      {children}
    </td>
  );
}
