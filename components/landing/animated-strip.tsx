"use client";

import { useEffect, useState } from "react";
import { PresenceStrip, type Tick } from "@/components/presence-strip";

/**
 * The presence strip, drawing itself left to right.
 *
 * The only animation in the product, and it exists because watching absence
 * accumulate tick by tick lands differently than being shown a finished
 * picture. Under `prefers-reduced-motion` it renders complete on first paint.
 */
export function AnimatedStrip({
  ticks,
  label,
  durationMs = 900,
}: {
  ticks: readonly Tick[];
  label: string;
  durationMs?: number;
}) {
  const [drawn, setDrawn] = useState(0);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (reduced || ticks.length === 0) {
      setDrawn(ticks.length);
      return;
    }

    setDrawn(0);
    const start = performance.now();
    let frame = 0;

    const step = (now: number) => {
      const progress = Math.min(1, (now - start) / durationMs);
      setDrawn(Math.round(progress * ticks.length));
      if (progress < 1) frame = requestAnimationFrame(step);
    };

    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [ticks, durationMs]);

  return <PresenceStrip ticks={ticks.slice(0, drawn)} label={label} />;
}
