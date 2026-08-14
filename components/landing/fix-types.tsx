import { Reveal } from "@/components/reveal";

/**
 * What "we write the fix" actually means.
 *
 * This section used to be a raw JSON-LD block, which told a non-technical
 * visitor nothing except that the product was complicated. The markup still
 * exists — it is what the app generates and it is validated before saving — but
 * the landing page's job is to say what a fix *is*, not to prove it compiles.
 */

type FixType = {
  tag: string;
  title: string;
  problem: string;
  fix: string;
  effort: string;
  icon: "code" | "page" | "link";
};

const FIXES: FixType[] = [
  {
    tag: "Site markup",
    title: "Make your page machine-readable",
    problem: "The AI cannot tell what your page is about, so it quotes someone else's.",
    fix: "We generate the hidden structured data that describes your business, your prices and your answers — and check it is valid before you ever see it.",
    effort: "Paste one block into your page. Two minutes.",
    icon: "code",
  },
  {
    tag: "Page rewrite",
    title: "Answer the question in the first line",
    problem: "Your page warms up for three paragraphs before saying anything useful.",
    fix: "We rewrite the opening so the answer comes first, keeping every real fact from the original. You get a before and after, side by side.",
    effort: "Copy the new version over the old. Five minutes.",
    icon: "page",
  },
  {
    tag: "Get listed",
    title: "Get onto the pages the AI already trusts",
    problem: "The AI reads a directory or a forum thread, and you are not on it.",
    fix: "We rank the exact third-party pages being quoted for your market and tell you which listing to claim, in one sentence each.",
    effort: "One listing at a time. Often free.",
    icon: "link",
  },
];

export function FixTypes() {
  return (
    <div className="grid gap-5 md:grid-cols-3">
      {FIXES.map((fix, i) => (
        <Reveal as="article" key={fix.tag} delay={i * 90}>
          <div className="panel flex h-full flex-col p-6 transition-colors duration-200 hover:border-accent/50">
            <div className="mb-4 flex items-center gap-3">
              <span className="flex size-9 items-center justify-center rounded-[10px] bg-accent-soft text-accent">
                <Icon name={fix.icon} />
              </span>
              <span className="label rounded-full border border-rule px-2 py-1 text-graphite">
                {fix.tag}
              </span>
            </div>

            <h3 className="mb-4 font-display text-[1.15rem] leading-snug font-semibold">
              {fix.title}
            </h3>

            <div className="mb-4 rounded-[10px] border-l-2 border-alert/60 bg-alert/5 px-3 py-2.5">
              <p className="label mb-1 text-alert">the problem</p>
              <p className="text-prose-s text-graphite">{fix.problem}</p>
            </div>

            <div className="mb-4 rounded-[10px] border-l-2 border-signal/60 bg-signal/5 px-3 py-2.5">
              <p className="label mb-1 text-signal">what we do</p>
              <p className="text-prose-s text-graphite">{fix.fix}</p>
            </div>

            <p className="mt-auto flex items-center gap-2 border-t border-rule pt-4 font-mono text-mono text-graphite">
              <svg viewBox="0 0 24 24" className="size-3.5 text-accent" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
                <circle cx="12" cy="12" r="9" />
                <path d="M12 7v5l3 2" />
              </svg>
              {fix.effort}
            </p>
          </div>
        </Reveal>
      ))}
    </div>
  );
}

function Icon({ name }: { name: FixType["icon"] }) {
  const shared = {
    viewBox: "0 0 24 24",
    className: "size-4.5",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };

  if (name === "code") {
    return (
      <svg {...shared}>
        <path d="m8 6-6 6 6 6M16 6l6 6-6 6" />
      </svg>
    );
  }
  if (name === "page") {
    return (
      <svg {...shared}>
        <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z" />
        <path d="M14 3v5h5M9 13h6M9 17h4" />
      </svg>
    );
  }
  return (
    <svg {...shared}>
      <path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1" />
      <path d="M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1" />
    </svg>
  );
}
