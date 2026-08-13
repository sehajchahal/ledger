"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui";

/**
 * Top-level error boundary. One line on what happened, one on what to do —
 * the same standard the empty states are held to.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("unhandled error in a route", {
      message: error.message,
      digest: error.digest,
    });
  }, [error]);

  return (
    <div className="mx-auto max-w-[560px] px-5 py-16 sm:px-8">
      <Link href="/" className="font-display text-prose font-medium">
        Ledger
      </Link>

      <h1 className="mt-10 mb-3 font-display text-display-m">This page did not load.</h1>
      <p className="mb-6 max-w-prose text-prose-s text-graphite">
        Something failed while building the page. Nothing you were looking at has changed,
        and no measurement was lost.
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={reset}>Try again</Button>
        <Link href="/brands" className="label text-graphite hover:text-ink">
          Back to your brands
        </Link>
      </div>

      {error.digest ? (
        <p className="mt-6 font-mono text-mono text-graphite">
          reference {error.digest}
        </p>
      ) : null}
    </div>
  );
}
