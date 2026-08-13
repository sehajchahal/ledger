"use client";

import { useEffect, useRef, useState } from "react";
import { PresenceStrip, ticksThatFit, type Tick } from "@/components/presence-strip";

/**
 * A full-width strip that takes as many ticks as fit the container and shows
 * the most recent ones. Ticks are never widened to fill space — the strip grows
 * by adding teeth, so a wider screen shows more history rather than a stretched
 * version of the same history.
 *
 * Measuring requires the DOM, which is the only reason this is a client
 * component. `ticks` arrives already computed from the server.
 */
export function AggregatePresenceStrip({
  ticks,
  label,
}: {
  ticks: readonly Tick[];
  label: string;
}) {
  const container = useRef<HTMLDivElement>(null);
  const [capacity, setCapacity] = useState<number | null>(null);

  useEffect(() => {
    const element = container.current;
    if (!element) return;

    const observer = new ResizeObserver(([entry]) => {
      setCapacity(ticksThatFit(entry.contentRect.width));
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  // Before measurement, render nothing rather than a wrong-width strip that
  // reflows on the next frame.
  const shown = capacity === null ? [] : ticks.slice(Math.max(0, ticks.length - capacity));

  return (
    <div ref={container} className="w-full">
      <div style={{ height: 24 }}>
        {capacity !== null && <PresenceStrip ticks={shown} label={label} />}
      </div>
    </div>
  );
}
