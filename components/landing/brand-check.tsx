"use client";

import { useState } from "react";
import { AnimatedStrip } from "@/components/landing/animated-strip";
import { Badge, Button } from "@/components/ui";
import type { Tick } from "@/components/presence-strip";

type CheckResult = {
  domain: string;
  brandName: string;
  ticks: Tick[];
  prompts: { text: string; found: boolean; excerpt: string }[];
  engine: string;
  isDemo: boolean;
};

/**
 * The check. A visitor types a domain, three prompts run for real, and the
 * strip shows what came back.
 *
 * No email, no account, no score out of 100. It reports what the answers said.
 */
export function BrandCheck() {
  const [domain, setDomain] = useState("");
  const [state, setState] = useState<"idle" | "running" | "done" | "error">("idle");
  const [result, setResult] = useState<CheckResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!domain.trim()) return;

    setState("running");
    setError(null);

    try {
      const response = await fetch("/api/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error ?? "The check could not run. Try again in a moment.");
        setState("error");
        return;
      }

      setResult(data);
      setState("done");
    } catch {
      setError("The check could not reach the server. Try again in a moment.");
      setState("error");
    }
  }

  const hits = result?.ticks.filter((tick) => tick === "hit").length ?? 0;

  return (
    <div>
      <form onSubmit={submit} className="flex flex-wrap items-stretch gap-3">
        <label htmlFor="check-domain" className="sr-only">
          Your website
        </label>
        <input
          id="check-domain"
          value={domain}
          onChange={(event) => setDomain(event.target.value)}
          placeholder="yourcompany.com"
          autoComplete="url"
          spellCheck={false}
          className="h-9 min-w-0 flex-1 border border-rule bg-paper px-3 font-mono text-mono focus:border-ink sm:max-w-xs"
        />
        <Button type="submit" disabled={state === "running"}>
          {state === "running" ? "Asking" : "Check your brand"}
        </Button>
      </form>

      {state === "running" ? (
        <p className="mt-4 font-mono text-mono text-amber">
          Asking three questions a buyer would type. About fifteen seconds.
        </p>
      ) : null}

      {state === "error" && error ? (
        <p className="mt-4 max-w-prose font-mono text-mono text-alert">{error}</p>
      ) : null}

      {state === "done" && result ? (
        <div className="mt-6 border-t border-rule pt-6">
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <AnimatedStrip
              ticks={result.ticks}
              label={`${result.brandName} appeared in ${hits} of ${result.ticks.length} answers`}
            />
            <span className="font-mono text-mono tabular-nums">
              {hits}/{result.ticks.length} answers named {result.brandName}
            </span>
            {result.isDemo ? <Badge tone="amber">demo answers</Badge> : null}
          </div>

          <ul className="space-y-3">
            {result.prompts.map((prompt) => (
              <li key={prompt.text} className="border-l-2 border-rule pl-3">
                <p className="font-mono text-mono">{prompt.text}</p>
                <p className="mt-1 text-prose-s text-graphite">
                  <span className={prompt.found ? "text-signal" : "text-alert"}>
                    {prompt.found ? "named" : "not named"}
                  </span>
                  {prompt.excerpt ? ` — ${prompt.excerpt}…` : null}
                </p>
              </li>
            ))}
          </ul>

          <p className="mt-5 max-w-prose text-prose-s text-graphite">
            {result.isDemo
              ? "No answer engine key is configured on this deployment, so those answers were generated locally. With a key set, these are live results from a real engine."
              : `Three questions is a sample, not a verdict. Ledger runs 50 or more on a schedule so the number means something.`}
          </p>
        </div>
      ) : null}
    </div>
  );
}
