import { AnimatedStrip } from "@/components/landing/animated-strip";
import type { Tick } from "@/components/presence-strip";

/**
 * A demonstration, not a diagram.
 *
 * The previous version assumed the visitor already understood that AI
 * assistants recommend companies by name. Most people do not, so this one
 * shows the actual thing happening — a question, an answer, and the company
 * that is missing from it — before asking anyone to care.
 */

const PROMPT = "best payroll software for a 20 person company in Canada";

const NAMED = [
  { name: "Payline", line: "Flat per-employee pricing, direct CRA remittance." },
  { name: "Northbridge HR", line: "Bundles payroll with benefits administration." },
  { name: "Clearline Payroll", line: "Cheapest of the four; slower support at year-end." },
  { name: "Vantage People", line: "Strongest reporting and the only documented API." },
];

/** Mostly hollow, because that is what this looks like for most companies. */
const TICKS: Tick[] = [
  "miss", "miss", "hit", "miss", "miss", "miss", "miss", "hit", "miss", "miss",
  "miss", "miss", "miss", "hit", "miss", "drop", "miss", "miss", "miss", "miss",
  "hit", "miss", "miss", "miss", "miss", "miss", "drop", "miss", "miss", "miss",
];

export function HeroAnswer() {
  return (
    <div className="panel panel-glow overflow-hidden">
      {/* Chrome that reads as "an AI assistant", without faking a browser. */}
      <div className="flex items-center gap-2 border-b border-rule bg-wash/60 px-4 py-3">
        <span className="size-2 rounded-full bg-accent" aria-hidden />
        <span className="label text-graphite">a real question a buyer types</span>
      </div>

      <div className="p-5 sm:p-6">
        <p className="mb-6 font-mono text-mono text-ink">{PROMPT}</p>

        <p className="label mb-4 text-graphite">what the AI answers</p>

        <div className="space-y-3">
          {NAMED.slice(0, 2).map((entry) => (
            <Row key={entry.name} name={entry.name} line={entry.line} />
          ))}

          {/* The gap. Deliberately the loudest thing on the page. */}
          <div className="flex items-center gap-3 rounded-[10px] border border-dashed border-alert/70 bg-alert/5 px-3 py-3">
            <svg viewBox="0 0 24 24" className="size-4 shrink-0 text-alert" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
              <path d="M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
            </svg>
            <p className="text-prose-s">
              <span className="font-medium text-alert">Your company is not here.</span>{" "}
              <span className="text-graphite">
                Four competitors were named. You were not mentioned once.
              </span>
            </p>
          </div>

          {NAMED.slice(2).map((entry) => (
            <Row key={entry.name} name={entry.name} line={entry.line} />
          ))}
        </div>
      </div>

      <div className="border-t border-rule bg-wash/40 px-5 py-5 sm:px-6">
        <p className="label mb-3 text-graphite">the same question, asked every day for a month</p>
        <AnimatedStrip
          ticks={TICKS}
          label="Named in 4 of the last 30 daily checks"
        />
        <p className="mt-3 font-mono text-mono text-graphite">
          named in <span className="text-ink">4 of 30</span> · two positions lost
        </p>
      </div>
    </div>
  );
}

function Row({ name, line }: { name: string; line: string }) {
  return (
    <div className="flex items-baseline gap-3">
      <span className="mt-2 size-1.5 shrink-0 rounded-full bg-graphite/60" aria-hidden />
      <p className="text-prose-s">
        <span className="font-medium text-ink">{name}</span>{" "}
        <span className="text-graphite">— {line}</span>
      </p>
    </div>
  );
}
