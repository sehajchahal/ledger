"use client";

import { useEffect, useState } from "react";

type Theme = "dark" | "light";

/**
 * Dark is the default. The toggle exists because some people read long prose in
 * daylight and some workplaces mandate it — not because the design is neutral
 * between the two.
 *
 * The choice is written to localStorage and applied by an inline script in the
 * document head, so a returning user never sees the wrong theme flash first.
 */
export function ThemeToggle({ className = "" }: { className?: string }) {
  const [theme, setTheme] = useState<Theme>("dark");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const current = (document.documentElement.getAttribute("data-theme") as Theme) ?? "dark";
    setTheme(current);
    setMounted(true);
  }, []);

  function apply(next: Theme) {
    const root = document.documentElement;

    // Only animate the swap for people who want motion; the class is removed
    // afterwards so it never interferes with ordinary hover transitions.
    const wantsMotion = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (wantsMotion) {
      root.classList.add("theme-transition");
      window.setTimeout(() => root.classList.remove("theme-transition"), 260);
    }

    root.setAttribute("data-theme", next);
    try {
      localStorage.setItem("ledger-theme", next);
    } catch {
      // Private mode or blocked storage: the theme still applies for this visit.
    }
    setTheme(next);
  }

  const next: Theme = theme === "dark" ? "light" : "dark";

  return (
    <button
      type="button"
      onClick={() => apply(next)}
      aria-label={`Switch to ${next} mode`}
      title={`Switch to ${next} mode`}
      className={`inline-flex size-9 cursor-pointer items-center justify-center rounded-[10px] border border-rule text-graphite transition-colors duration-200 hover:border-accent hover:text-ink ${className}`}
    >
      {/* Rendered only after mount so the icon can never contradict the theme
          the inline script already applied. */}
      {mounted ? (
        theme === "dark" ? (
          <SunIcon />
        ) : (
          <MoonIcon />
        )
      ) : (
        <span className="size-4" />
      )}
    </button>
  );
}

function SunIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
    </svg>
  );
}
