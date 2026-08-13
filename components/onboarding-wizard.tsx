"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { confirmOnboarding, inspectAndPropose, regeneratePlan } from "@/app/onboarding/actions";
import { Badge, Button, SectionHead } from "@/components/ui";
import type { Plan } from "@/lib/onboarding/diagnose";
import type { SiteProfile } from "@/lib/site/inspect";
import type { Intent } from "@/lib/db/schema";

const field =
  "w-full border border-rule bg-paper px-2 py-2 font-mono text-mono focus:border-ink";

const INTENT_ORDER: Intent[] = ["discovery", "comparison", "problem", "branded"];

const INTENT_NOTE: Record<Intent, string> = {
  discovery: "buyer does not know who exists yet",
  comparison: "buyer is choosing between options",
  problem: "buyer describes a symptom",
  branded: "buyer already knows your name",
};

type Row = { text: string; intent: Intent; keep: boolean };

/**
 * Three steps, and nothing on any of them the user has to look up.
 *
 * Everything the site inspection guessed is shown in an editable field rather
 * than presented as fact, because it is a guess and being wrong about a company
 * name would quietly corrupt every measurement that follows.
 */
export function OnboardingWizard() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [step, setStep] = useState<1 | 2>(1);
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);

  const [site, setSite] = useState<SiteProfile | null>(null);
  const [isTemplate, setIsTemplate] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [rivals, setRivals] = useState<{ name: string; aliases: string[] }[]>([]);
  const [newRival, setNewRival] = useState("");
  const [needsCategory, setNeedsCategory] = useState(false);

  function applyPlan(plan: Plan) {
    setIsTemplate(plan.isTemplate);
    setNeedsCategory(plan.needsCategory);
    setRows(plan.prompts.map((p) => ({ ...p, keep: true })));
    setRivals(plan.competitors);
  }

  function regenerate() {
    if (!site) return;
    startTransition(async () => {
      applyPlan(await regeneratePlan(site));
    });
  }

  function inspect(event: React.FormEvent) {
    event.preventDefault();
    if (!url.trim()) return;

    startTransition(async () => {
      setError(null);
      const result = await inspectAndPropose(url);

      if (!result.ok) {
        setError(result.reason);
        return;
      }

      setSite(result.site);
      applyPlan(result.plan);
      setStep(2);
    });
  }

  function confirm() {
    if (!site) return;

    startTransition(async () => {
      setError(null);
      const result = await confirmOnboarding({
        site: { domain: site.domain, name: site.name, category: site.category },
        prompts: rows.filter((r) => r.keep).map(({ text, intent }) => ({ text, intent })),
        competitors: rivals,
      });

      if (!result.ok) {
        setError(result.reason);
        return;
      }

      router.push(`/brands/${result.brandId}`);
    });
  }

  const kept = rows.filter((r) => r.keep).length;

  /* ------------------------------------------------------------- step 1 -- */

  if (step === 1) {
    return (
      <form onSubmit={inspect}>
        <label htmlFor="site-url" className="label mb-2 block text-graphite">
          Your website
        </label>
        <div className="flex flex-wrap gap-3">
          <input
            id="site-url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="yourcompany.com"
            autoFocus
            spellCheck={false}
            className={`${field} sm:max-w-sm`}
          />
          <Button type="submit" disabled={pending}>
            {pending ? "Reading your site" : "Continue"}
          </Button>
        </div>

        {error ? <p className="mt-3 font-mono text-mono text-alert">{error}</p> : null}

        <p className="mt-4 max-w-prose text-prose-s text-graphite">
          Ledger reads the page to work out your name and what you sell, then writes the
          questions your buyers would ask. You can change all of it on the next screen.
        </p>
      </form>
    );
  }

  /* ------------------------------------------------------------- step 2 -- */

  return (
    <div>
      <SectionHead note={site?.fetched ? "read from your site" : "site could not be read"}>
        What we found
      </SectionHead>

      <div className="mb-10 grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="brand-name" className="label mb-2 block text-graphite">
            Company name
          </label>
          <input
            id="brand-name"
            value={site?.name ?? ""}
            onChange={(e) => setSite((s) => (s ? { ...s, name: e.target.value } : s))}
            className={field}
          />
          <p className="mt-2 text-prose-s text-graphite">
            This is the exact string matched against every answer. If answers call you
            something shorter, use that.
          </p>
        </div>
        <div>
          <label htmlFor="brand-category" className="label mb-2 block text-graphite">
            Category
          </label>
          <div className="flex gap-2">
            <input
              id="brand-category"
              value={site?.category ?? ""}
              placeholder="payment processing"
              onChange={(e) => setSite((s) => (s ? { ...s, category: e.target.value } : s))}
              className={field}
            />
            <Button variant="secondary" type="button" disabled={pending} onClick={regenerate}>
              {pending ? "Writing" : "Rewrite prompts"}
            </Button>
          </div>
          <p className="mt-2 text-prose-s text-graphite">
            The questions below are built from this. Change it and rewrite them if it is
            wrong.
          </p>
        </div>
      </div>

      <SectionHead note={`${kept} of ${rows.length} selected`}>Prompts to track</SectionHead>

      {needsCategory ? (
        <div className="mb-6 border border-amber px-4 py-3">
          <p className="max-w-prose text-prose-s">
            Ledger could not tell what {site?.name} sells from the page, and it will not
            write questions around a filler word — &ldquo;best business for a
            business&rdquo; is not something anyone types. Put the category above in the
            words your buyers would use, then rewrite the prompts.
          </p>
        </div>
      ) : null}

      {isTemplate && !needsCategory ? (
        <p className="mb-4 max-w-prose text-prose-s text-graphite">
          These came from templates, not a model — no answer engine key is configured. They
          are a reasonable starting set, but edit anything that does not sound like your
          buyers.
        </p>
      ) : null}

      <ul className="mb-10">
        {INTENT_ORDER.map((intent) => {
          const group = rows
            .map((row, index) => ({ row, index }))
            .filter(({ row }) => row.intent === intent);

          if (group.length === 0) return null;

          return (
            <li key={intent} className="mb-6">
              <div className="mb-2 flex items-center gap-3">
                <Badge>{intent}</Badge>
                <span className="text-prose-s text-graphite">{INTENT_NOTE[intent]}</span>
              </div>

              <ul>
                {group.map(({ row, index }) => (
                  <li key={index} className="flex items-center gap-3 border-b border-rule py-2">
                    <input
                      type="checkbox"
                      checked={row.keep}
                      aria-label={`Track "${row.text}"`}
                      onChange={(e) =>
                        setRows((all) =>
                          all.map((r, i) => (i === index ? { ...r, keep: e.target.checked } : r)),
                        )
                      }
                      className="size-4 shrink-0 accent-[#16150f]"
                    />
                    <input
                      value={row.text}
                      onChange={(e) =>
                        setRows((all) =>
                          all.map((r, i) => (i === index ? { ...r, text: e.target.value } : r)),
                        )
                      }
                      className={`w-full border-0 bg-transparent px-0 py-0 font-mono text-mono focus:border-0 ${
                        row.keep ? "" : "text-graphite line-through"
                      }`}
                    />
                  </li>
                ))}
              </ul>
            </li>
          );
        })}
      </ul>

      <SectionHead note={`${rivals.length}`}>Competitors</SectionHead>

      {rivals.length === 0 ? (
        <p className="mb-3 max-w-prose text-prose-s text-graphite">
          None suggested. Ledger will not invent competitor names — a fabricated company in
          your account would be measured as if it were real. Add the ones you actually
          compete with.
        </p>
      ) : (
        <ul className="mb-3">
          {rivals.map((rival, index) => (
            <li key={rival.name} className="flex items-center justify-between border-b border-rule py-2">
              <span className="font-mono text-mono">
                {rival.name}
                {rival.aliases.length > 0 ? (
                  <span className="text-graphite"> · {rival.aliases.join(", ")}</span>
                ) : null}
              </span>
              <button
                onClick={() => setRivals((all) => all.filter((_, i) => i !== index))}
                className="label text-graphite hover:text-ink"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="mb-10 flex flex-wrap gap-3">
        <input
          value={newRival}
          onChange={(e) => setNewRival(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && newRival.trim()) {
              e.preventDefault();
              setRivals((all) => [...all, { name: newRival.trim(), aliases: [] }]);
              setNewRival("");
            }
          }}
          placeholder="Competitor name"
          aria-label="Competitor name"
          className={`${field} sm:max-w-xs`}
        />
        <Button
          variant="secondary"
          type="button"
          onClick={() => {
            if (!newRival.trim()) return;
            setRivals((all) => [...all, { name: newRival.trim(), aliases: [] }]);
            setNewRival("");
          }}
        >
          Add competitor
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3 border-t border-rule pt-6">
        <Button disabled={pending || kept === 0} onClick={confirm}>
          {pending ? "Starting" : `Start tracking ${kept} prompts`}
        </Button>
        <Button variant="secondary" type="button" onClick={() => setStep(1)}>
          Back
        </Button>
        {error ? <span className="font-mono text-mono text-alert">{error}</span> : null}
      </div>

      <p className="mt-3 max-w-prose text-prose-s text-graphite">
        The first run asks every selected prompt three times. You will land on the overview
        while it is still going.
      </p>
    </div>
  );
}
