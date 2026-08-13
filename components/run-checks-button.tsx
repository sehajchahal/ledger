"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { enqueueRun } from "@/app/brands/[brandId]/actions";
import { Button } from "@/components/ui";

/**
 * Enqueues a run and shows an amber running indicator while it is in flight.
 *
 * While a run is in progress the page is refreshed on an interval rather than
 * shown a spinner: the user gets the real count of stored answers climbing,
 * which is both more honest and more useful than an indeterminate bar.
 */
export function RunChecksButton({
  brandId,
  running,
  promptCount,
}: {
  brandId: string;
  running: boolean;
  promptCount: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => router.refresh(), 2500);
    return () => clearInterval(timer);
  }, [running, router]);

  if (running) {
    return (
      <div className="flex items-center gap-3">
        <span aria-hidden className="inline-block h-2 w-2 bg-amber" />
        <span className="label text-amber">running</span>
        <span className="font-mono text-mono text-graphite">
          {promptCount} prompts, 3 times each — about {estimateMinutes(promptCount)}
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <Button
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setError(null);
            const result = await enqueueRun(brandId);
            if (!result.ok) setError(result.reason);
            router.refresh();
          })
        }
      >
        {pending ? "Starting" : "Run checks now"}
      </Button>
      {error ? <span className="font-mono text-mono text-alert">{error}</span> : null}
    </div>
  );
}

function estimateMinutes(promptCount: number): string {
  // Roughly four probes in flight at a time, a few seconds each.
  const seconds = Math.ceil((promptCount * 3) / 4) * 3;
  if (seconds < 90) return `${Math.max(20, Math.round(seconds / 10) * 10)} seconds`;
  return `${Math.round(seconds / 60)} minutes`;
}
