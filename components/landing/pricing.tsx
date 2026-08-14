import { Reveal } from "@/components/reveal";

/**
 * Three plans as cards.
 *
 * The middle one is marked because it genuinely is the one most small teams
 * need — daily checks and enough fixes to work through a backlog. Every tier
 * includes the verification loop; that is the product, not an upsell.
 */

type Plan = {
  name: string;
  price: string;
  cadence: string;
  who: string;
  features: string[];
  cta: string;
  featured?: boolean;
};

const PLANS: Plan[] = [
  {
    name: "Starter",
    price: "$49",
    cadence: "per month",
    who: "One business, checked every week.",
    features: [
      "50 buyer questions tracked",
      "Weekly checks",
      "10 fixes written per month",
      "1 answer engine",
      "2 team members",
    ],
    cta: "Start with Starter",
  },
  {
    name: "Growth",
    price: "$199",
    cadence: "per month",
    who: "Most small teams and agencies land here.",
    features: [
      "250 buyer questions tracked",
      "Daily checks",
      "50 fixes written per month",
      "Both answer engines, compared",
      "5 brands, 10 team members",
    ],
    cta: "Start with Growth",
    featured: true,
  },
  {
    name: "Enterprise",
    price: "$600",
    cadence: "per month",
    who: "Agencies running many clients at once.",
    features: [
      "1,000 buyer questions tracked",
      "Daily checks",
      "200 fixes written per month",
      "Both answer engines, compared",
      "25 brands, unlimited members",
    ],
    cta: "Start with Enterprise",
  },
];

export function Pricing() {
  return (
    <>
      <div className="grid items-start gap-5 lg:grid-cols-3">
        {PLANS.map((plan, i) => (
          <Reveal key={plan.name} delay={i * 90}>
            <PlanCard plan={plan} />
          </Reveal>
        ))}
      </div>

      <p className="mt-6 max-w-prose text-prose-s text-graphite">
        A fix is one written change — markup to paste, a rewritten section, or a listing to
        claim. Running out of fixes never stops your checks, and every plan includes the
        14-day proof that a fix worked.
      </p>
    </>
  );
}

function PlanCard({ plan }: { plan: Plan }) {
  return (
    <div
      className={`panel relative flex h-full flex-col p-6 transition-colors duration-200 ${
        plan.featured ? "border-accent/60 panel-glow" : "hover:border-accent/40"
      }`}
    >
      {plan.featured ? (
        <span className="label absolute -top-2.5 left-6 rounded-full bg-accent px-2.5 py-1 text-accent-ink">
          Most chosen
        </span>
      ) : null}

      <h3 className="font-display text-display-m">{plan.name}</h3>
      <p className="mt-1 mb-5 text-prose-s text-graphite">{plan.who}</p>

      <p className="flex items-baseline gap-2">
        <span className="font-mono text-[2.5rem] leading-none font-semibold tabular-nums">
          {plan.price}
        </span>
        <span className="font-mono text-mono text-graphite">{plan.cadence}</span>
      </p>

      <ul className="my-6 space-y-2.5 border-t border-rule pt-6">
        {plan.features.map((feature) => (
          <li key={feature} className="flex items-start gap-2.5 text-prose-s">
            <svg viewBox="0 0 24 24" className="mt-1 size-3.5 shrink-0 text-accent" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="m20 6-11 11-5-5" />
            </svg>
            <span className="text-graphite">{feature}</span>
          </li>
        ))}
      </ul>

      <a
        href="#check"
        className={`label mt-auto inline-flex h-10 cursor-pointer items-center justify-center rounded-[10px] px-4 transition-colors duration-200 ${
          plan.featured
            ? "bg-accent text-accent-ink hover:opacity-90"
            : "border border-rule text-ink hover:border-accent"
        }`}
      >
        {plan.cta}
      </a>
    </div>
  );
}
