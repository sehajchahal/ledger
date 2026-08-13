import { AnimatedStrip } from "@/components/landing/animated-strip";
import type { Tick } from "@/components/presence-strip";

/**
 * The hero is a demonstration, not a pitch.
 *
 * A real buyer question, an answer of the shape an engine actually returns,
 * four named competitors, and a gap where the visitor's company should be. The
 * strip underneath draws itself so the absence accumulates rather than arriving
 * pre-formed.
 */

const PROMPT = "best payroll software for a 20 person company in Canada";

const NAMED = [
  {
    name: "Payline",
    line: "Flat per-employee pricing and direct CRA remittance, which is the detail reviewers mention most.",
  },
  {
    name: "Northbridge HR",
    line: "Bundles payroll with benefits administration. Better fit if HR is already outsourced.",
  },
  {
    name: "Clearline Payroll",
    line: "Cheapest of the four, though several reviews note slow support during year-end.",
  },
  {
    name: "Vantage People",
    line: "Strongest reporting, and the only one of these with a documented API.",
  },
];

/** Mostly hollow, because that is what this looks like for most companies. */
const TICKS: Tick[] = [
  "miss", "miss", "hit", "miss", "miss", "miss", "miss", "hit", "miss", "miss",
  "miss", "miss", "miss", "hit", "miss", "drop", "miss", "miss", "miss", "miss",
  "hit", "miss", "miss", "miss", "miss", "miss", "drop", "miss", "miss", "miss",
];

export function HeroAnswer() {
  return (
    <div className="border border-rule bg-card p-5 sm:p-6">
      <p className="label mb-2 text-graphite">a question your buyers type</p>
      <p className="mb-6 font-mono text-mono">{PROMPT}</p>

      <p className="label mb-3 text-graphite">what the answer says</p>

      <div className="space-y-3 text-prose leading-relaxed">
        <p>For a team that size, four options come up consistently:</p>

        {NAMED.slice(0, 2).map((entry) => (
          <p key={entry.name}>
            <span className="font-medium text-ink">{entry.name}</span>
            <span className="text-graphite"> — {entry.line}</span>
          </p>
        ))}

        {/* The gap. Deliberately the loudest thing on the page. */}
        <p
          className="border border-dashed border-alert px-3 py-2"
          aria-label="Your company is absent from this answer"
        >
          <span className="label text-alert">your company</span>
          <span className="ml-3 font-mono text-mono text-graphite">not in this answer</span>
        </p>

        {NAMED.slice(2).map((entry) => (
          <p key={entry.name}>
            <span className="font-medium text-ink">{entry.name}</span>
            <span className="text-graphite"> — {entry.line}</span>
          </p>
        ))}
      </div>

      <div className="mt-6 border-t border-rule pt-5">
        <p className="label mb-3 text-graphite">the same question, asked daily for 30 days</p>
        <AnimatedStrip
          ticks={TICKS}
          label="Presence across 30 days: absent from most answers"
        />
        <p className="mt-3 font-mono text-mono text-graphite">
          named in 4 of 30 · two positions lost
        </p>
      </div>
    </div>
  );
}
