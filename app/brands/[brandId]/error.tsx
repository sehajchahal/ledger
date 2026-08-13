"use client";

import { useEffect } from "react";
import { Button, PageTitle } from "@/components/ui";

/**
 * Scoped to the product shell so the sidebar survives — a failed page should
 * not strand someone with no way to navigate.
 */
export default function BrandError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("unhandled error in a brand route", {
      message: error.message,
      digest: error.digest,
    });
  }, [error]);

  return (
    <>
      <PageTitle>This page did not load.</PageTitle>
      <div className="border border-rule px-6 py-10">
        <p className="mb-4 max-w-prose text-prose-s text-graphite">
          Something failed while reading this brand&rsquo;s data. Your runs and answers are
          untouched — this is a display problem, not a lost measurement.
        </p>
        <Button onClick={reset}>Try again</Button>
        {error.digest ? (
          <p className="mt-4 font-mono text-mono text-graphite">reference {error.digest}</p>
        ) : null}
      </div>
    </>
  );
}
