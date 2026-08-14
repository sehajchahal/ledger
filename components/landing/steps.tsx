import { Reveal } from "@/components/reveal";

/**
 * Four steps, numbered because measure → diagnose → fix → prove is a real
 * sequence rather than a decorative list.
 *
 * Written in the first person on purpose. The earlier version described what
 * the product observed, which read as though the customer had to run it. The
 * point of the service is that they do none of this.
 */

type Step = {
  n: string;
  title: string;
  claim: string;
  body: string;
  bullets: string[];
  icon: "radar" | "search" | "wrench" | "check";
};

const STEPS: Step[] = [
  {
    n: "01",
    title: "We ask the questions",
    claim: "You never write a prompt.",
    body: "Our AI reads your website, works out what you sell and who buys it, then writes the questions those buyers actually type into ChatGPT. It asks every one of them, three times, on a schedule.",
    bullets: [
      "50+ buyer questions written for you",
      "Asked across ChatGPT and Perplexity",
      "Re-asked daily, so you see it move",
    ],
    icon: "radar",
  },
  {
    n: "02",
    title: "We read every answer",
    claim: "You never read a report.",
    body: "We keep each answer whole and check who got named, in what order, and which websites the AI trusted enough to quote. That tells us exactly where you are losing and to whom.",
    bullets: [
      "Who was named instead of you",
      "Which questions you lose outright",
      "Which sites the AI reads to decide",
    ],
    icon: "search",
  },
  {
    n: "03",
    title: "We write the fix",
    claim: "You never guess what to do.",
    body: "For each gap our AI produces one specific change — the code to paste, the paragraph to replace, or the listing to get on. You approve it. We never touch your site ourselves.",
    bullets: [
      "Ready to paste, not advice",
      "One change per problem",
      "Approve or dismiss in a click",
    ],
    icon: "wrench",
  },
  {
    n: "04",
    title: "We prove it worked",
    claim: "This is the part nobody else does.",
    body: "Fourteen days after you ship a change, we ask the same question again and show you what moved. If it did nothing, we say so. If it made things worse, we say that too.",
    bullets: [
      "Measured before and after",
      "Same question, same method",
      "Bad results shown, never hidden",
    ],
    icon: "check",
  },
];

export function Steps() {
  return (
    <ol className="grid gap-5 md:grid-cols-2">
      {STEPS.map((step, i) => (
        <Reveal as="li" key={step.n} delay={i * 90}>
          <StepCard step={step} />
        </Reveal>
      ))}
    </ol>
  );
}

function StepCard({ step }: { step: Step }) {
  return (
    <div className="panel group h-full p-6 transition-colors duration-200 hover:border-accent/50">
      <div className="mb-4 flex items-center gap-3">
        <span className="flex size-10 items-center justify-center rounded-[10px] bg-accent-soft text-accent">
          <Icon name={step.icon} />
        </span>
        <span className="font-mono text-mono text-graphite tabular-nums">{step.n}</span>
      </div>

      <h3 className="font-display text-display-m mb-1">{step.title}</h3>
      <p className="mb-3 font-mono text-mono text-accent">{step.claim}</p>
      <p className="mb-5 text-prose-s text-graphite">{step.body}</p>

      <ul className="space-y-2 border-t border-rule pt-4">
        {step.bullets.map((bullet) => (
          <li key={bullet} className="flex items-start gap-2.5 text-prose-s">
            <svg viewBox="0 0 24 24" className="mt-1 size-3.5 shrink-0 text-accent" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="m20 6-11 11-5-5" />
            </svg>
            <span className="text-graphite">{bullet}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Icon({ name }: { name: Step["icon"] }) {
  const shared = {
    viewBox: "0 0 24 24",
    className: "size-5",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };

  if (name === "radar") {
    return (
      <svg {...shared}>
        <path d="M19.1 4.9A10 10 0 1 0 21 12" />
        <path d="M15.5 8.5A5 5 0 1 0 17 12" />
        <path d="M12 12 20 4" />
      </svg>
    );
  }
  if (name === "search") {
    return (
      <svg {...shared}>
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.5-3.5" />
      </svg>
    );
  }
  if (name === "wrench") {
    return (
      <svg {...shared}>
        <path d="M14.7 6.3a4 4 0 0 0 5 5l-9.4 9.4a2.1 2.1 0 0 1-3-3Z" />
        <path d="M14.7 6.3 17.5 3.5" />
      </svg>
    );
  }
  return (
    <svg {...shared}>
      <path d="M12 3a9 9 0 1 0 9 9" />
      <path d="m9 11 3 3 9-9" />
    </svg>
  );
}
