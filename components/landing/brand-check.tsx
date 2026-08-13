"use client";

import { useState } from "react";
import { AnimatedStrip } from "@/components/landing/animated-strip";
import type { Tick } from "@/components/presence-strip";

type CheckResult = {
  domain: string;
  brandName: string;
  ticks: Tick[];
  prompts: { text: string; found: boolean; excerpt: string }[];
  engine: string;
  isDemo: boolean;
};

const STAGES = [
  "Reading your website",
  "Writing the questions your buyers ask",
  "Asking the AI",
  "Checking whether you were named",
];

/**
 * The check. Type a domain, three real questions get asked, and the result is
 * whatever came back.
 *
 * The staged progress is not decoration — the request genuinely takes ten to
 * twenty seconds against a live engine, and naming each step is what makes the
 * wait legible instead of suspicious.
 */
export function BrandCheck() {
  const [domain, setDomain] = useState("");
  const [state, setState] = useState<"idle" | "running" | "done" | "error">("idle");
  const [stage, setStage] = useState(0);
  const [result, setResult] = useState<CheckResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!domain.trim() || state === "running") return;

    setState("running");
    setError(null);
    setResult(null);
    setStage(0);

    const ticker = window.setInterval(
      () => setStage((s) => Math.min(s + 1, STAGES.length - 1)),
      2200,
    );

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
      setError("Could not reach the server. Try again in a moment.");
      setState("error");
    } finally {
      window.clearInterval(ticker);
    }
  }

  const hits = result?.ticks.filter((t) => t === "hit").length ?? 0;
  const total = result?.ticks.length ?? 0;

  return (
    <div className="panel p-5 sm:p-7">
      <form onSubmit={submit} className="flex flex-wrap items-center gap-3">
        <label htmlFor="check-domain" className="sr-only">
          Your website address
        </label>
        <div className="relative min-w-0 flex-1">
          <span className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 font-mono text-mono text-graphite">
            https://
          </span>
          <input
            id="check-domain"
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            placeholder="yourcompany.com"
            autoComplete="url"
            spellCheck={false}
            className="h-12 w-full rounded-[10px] border border-rule bg-paper pr-4 pl-[4.6rem] font-mono text-mono transition-colors duration-200 focus:border-accent"
          />
        </div>
        <button
          type="submit"
          disabled={state === "running"}
          className="label inline-flex h-12 cursor-pointer items-center gap-2 rounded-[10px] bg-accent px-5 text-accent-ink transition-opacity duration-200 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {state === "running" ? "Checking" : "Check my brand"}
          {state !== "running" ? (
            <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          ) : null}
        </button>
      </form>

      <p className="mt-3 font-mono text-mono text-graphite">
        No email. No account. Takes about fifteen seconds.
      </p>

      {/* Progress that says what is happening, rather than spinning. */}
      {state === "running" ? (
        <ol className="mt-6 space-y-2.5 border-t border-rule pt-6" aria-live="polite">
          {STAGES.map((label, i) => (
            <li key={label} className="flex items-center gap-3 text-prose-s">
              <span
                className={`flex size-5 shrink-0 items-center justify-center rounded-full border ${
                  i < stage
                    ? "border-signal bg-signal/15 text-signal"
                    : i === stage
                      ? "border-accent bg-accent/15 text-accent"
                      : "border-rule text-graphite"
                }`}
              >
                {i < stage ? (
                  <svg viewBox="0 0 24 24" className="size-3" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="m20 6-11 11-5-5" />
                  </svg>
                ) : (
                  <span className={`size-1.5 rounded-full bg-current ${i === stage ? "animate-pulse" : ""}`} />
                )}
              </span>
              <span className={i <= stage ? "text-ink" : "text-graphite"}>{label}</span>
            </li>
          ))}
        </ol>
      ) : null}

      {state === "error" && error ? (
        <p className="mt-6 flex items-start gap-2.5 border-t border-rule pt-6 text-prose-s text-alert">
          <svg viewBox="0 0 24 24" className="mt-0.5 size-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
            <circle cx="12" cy="12" r="9" />
            <path d="M12 8v4M12 16h.01" />
          </svg>
          {error}
        </p>
      ) : null}

      {state === "done" && result ? (
        <div className="mt-6 border-t border-rule pt-6">
          <div className="mb-5 flex flex-wrap items-end gap-x-6 gap-y-3">
            <div>
              <p className="label mb-1 text-graphite">named in</p>
              <p className="flex items-baseline gap-2">
                <span
                  className={`font-mono text-[2.75rem] leading-none font-semibold tabular-nums ${
                    hits === 0 ? "text-alert" : hits === total ? "text-signal" : "text-ink"
                  }`}
                >
                  {hits}
                </span>
                <span className="font-mono text-mono text-graphite">of {total} answers</span>
              </p>
            </div>
            <div className="pb-1">
              <p className="label mb-2 text-graphite">searched for</p>
              <p className="font-mono text-mono text-ink">{result.brandName}</p>
            </div>
            <div className="pb-1">
              <AnimatedStrip
                ticks={result.ticks}
                label={`${result.brandName} appeared in ${hits} of ${total} answers`}
              />
            </div>
          </div>

          <ul className="space-y-3">
            {result.prompts.map((prompt) => (
              <li
                key={prompt.text}
                className={`rounded-[10px] border-l-2 px-4 py-3 ${
                  prompt.found ? "border-signal bg-signal/5" : "border-alert bg-alert/5"
                }`}
              >
                <div className="mb-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span
                    className={`label ${prompt.found ? "text-signal" : "text-alert"}`}
                  >
                    {prompt.found ? "named" : "not named"}
                  </span>
                  <span className="font-mono text-mono text-ink">{prompt.text}</span>
                </div>
                {prompt.excerpt ? (
                  <p className="text-prose-s text-graphite">{prompt.excerpt}…</p>
                ) : null}
              </li>
            ))}
          </ul>

          {result.isDemo ? (
            <div className="mt-5 rounded-[10px] border border-amber/50 bg-amber/5 px-4 py-3">
              <p className="label mb-1.5 text-amber">demo answers</p>
              <p className="max-w-prose text-prose-s text-graphite">
                This deployment has no answer-engine key configured, so those answers were
                written locally rather than asked of a real AI. Everything else — reading
                your site, writing the questions, checking the result — ran for real.
              </p>
            </div>
          ) : (
            <p className="mt-5 max-w-prose text-prose-s text-graphite">
              Three questions is a sample, not a verdict. A paid account asks fifty or more
              on a schedule, which is what makes the number worth acting on.
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}
