import { PresenceStrip, type Tick } from "@/components/presence-strip";
import { Badge } from "@/components/ui";

/**
 * Four steps, numbered because measure → diagnose → fix → prove is a real
 * sequence rather than a decorative list.
 *
 * Each step shows a piece of the actual product, cropped — the same components
 * the app renders, not a screenshot and not a mockup in a browser frame. They
 * cannot drift out of date because they are the real thing.
 */

const STRIP: Tick[] = [
  "hit", "hit", "miss", "hit", "hit", "hit", "drop", "miss", "miss", "hit",
  "hit", "miss", "hit", "hit",
];

export function Steps() {
  return (
    <ol className="border-t border-rule">
      <Step
        n={1}
        title="Measure"
        body="Ledger asks the questions your buyers actually type, three times each, on a schedule, and stores every answer whole."
      >
        <div className="flex min-w-0 items-center gap-4">
          <PresenceStrip ticks={STRIP} label="Example presence strip" />
          <span className="font-mono text-mono text-graphite">9/14 runs</span>
        </div>
      </Step>

      <Step
        n={2}
        title="Diagnose"
        body="Every prompt gets a mention rate and a position. You can see which questions you lose outright and which third-party pages the models read instead of yours."
      >
        <div className="w-full min-w-0 max-w-md">
          <div className="flex items-center justify-between border-b border-rule bg-wash px-3 py-1.5">
            <span className="label text-graphite">prompt</span>
            <span className="label text-graphite">rate</span>
          </div>
          {[
            ["best payroll software for a 20 person company", "0/3", true],
            ["payroll software with CRA remittance", "1/3", false],
          ].map(([text, rate, missing]) => (
            <div key={text as string} className="flex items-center justify-between gap-4 border-b border-rule px-3 py-2">
              <span className="truncate font-mono text-mono">{text}</span>
              <span className={`font-mono text-mono ${missing ? "text-alert" : ""}`}>{rate}</span>
            </div>
          ))}
        </div>
      </Step>

      <Step
        n={3}
        title="Fix"
        body="Each gap becomes one specific change: markup to paste, a section to rewrite, or a page to get listed on. You approve it. Ledger never touches your site."
      >
        <div className="w-full min-w-0 max-w-md border border-rule p-3">
          <div className="mb-2 flex items-center gap-2">
            <Badge>schema markup</Badge>
            <span className="font-mono text-mono text-graphite">
              best payroll software for a 20 person company
            </span>
          </div>
          <pre className="overflow-x-auto border border-rule bg-wash px-3 py-2 font-mono text-mono">
{`{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [{ "@type": "Question", … }]
}`}
          </pre>
        </div>
      </Step>

      <Step
        n={4}
        title="Prove"
        body="Fourteen days after you ship, Ledger asks the same question again and reports what changed. Including when nothing did, and including when it got worse."
      >
        <div className="w-full min-w-0 max-w-md">
          <div className="flex items-center justify-between border-b border-rule bg-wash px-3 py-1.5">
            <span className="label text-graphite">fix</span>
            <span className="label text-graphite">change</span>
          </div>
          {[
            ["Add FAQPage markup", "+33pt", "text-signal"],
            ["Rewrite /pricing opening", "0pt", "text-graphite"],
            ["Get listed on the comparison page", "-33pt", "text-alert"],
          ].map(([text, delta, tone]) => (
            <div key={text} className="flex items-center justify-between gap-4 border-b border-rule px-3 py-2">
              <span className="truncate text-prose-s">{text}</span>
              <span className={`font-mono text-mono tabular-nums ${tone}`}>{delta}</span>
            </div>
          ))}
        </div>
      </Step>
    </ol>
  );
}

function Step({
  n,
  title,
  body,
  children,
}: {
  n: number;
  title: string;
  body: string;
  children: React.ReactNode;
}) {
  return (
    // Grid items default to min-width:auto, which lets a wide code block or
    // table push the whole track past the viewport instead of scrolling inside
    // itself. min-w-0 on every child is what makes the overflow-x-auto work.
    <li className="grid min-w-0 gap-6 border-b border-rule py-8 md:grid-cols-[auto_20rem_1fr] md:gap-10">
      <span className="font-mono text-mono text-graphite tabular-nums">{String(n).padStart(2, "0")}</span>
      <div className="min-w-0">
        <h3 className="font-display text-display-m mb-2">{title}</h3>
        <p className="text-prose-s text-graphite">{body}</p>
      </div>
      <div className="flex min-w-0 items-start md:justify-end">{children}</div>
    </li>
  );
}
