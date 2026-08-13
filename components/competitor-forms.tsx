"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  addCompetitor,
  removeCompetitor,
} from "@/app/brands/[brandId]/competitors/actions";
import { Button } from "@/components/ui";

const field =
  "w-full border border-rule bg-paper px-2 py-2 font-mono text-mono focus:border-ink";

export function AddCompetitorForm({ brandId }: { brandId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!open) {
    return (
      <Button variant="secondary" onClick={() => setOpen(true)}>
        Add competitor
      </Button>
    );
  }

  return (
    <form
      className="border border-rule p-4"
      action={(formData) =>
        startTransition(async () => {
          const result = await addCompetitor(brandId, formData);
          if (result.ok) {
            setOpen(false);
            setError(null);
            router.refresh();
          } else {
            setError(result.reason);
          }
        })
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label mb-2 block text-graphite" htmlFor="competitor-name">
            Name
          </label>
          <input id="competitor-name" name="name" autoFocus className={field} />
        </div>
        <div>
          <label className="label mb-2 block text-graphite" htmlFor="competitor-aliases">
            Other names, comma separated
          </label>
          <input
            id="competitor-aliases"
            name="aliases"
            placeholder="Mathwise, Mathwise Tutoring"
            className={field}
          />
        </div>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Adding" : "Add competitor"}
        </Button>
        <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
          Cancel
        </Button>
        {error ? <span className="font-mono text-mono text-alert">{error}</span> : null}
      </div>
      <p className="mt-3 max-w-prose text-prose-s text-graphite">
        Aliases matter. If answers call them something shorter than their legal name, add
        it here or the mentions will be missed.
      </p>
    </form>
  );
}

export function RemoveCompetitorButton({
  brandId,
  competitorId,
  name,
}: {
  brandId: string;
  competitorId: string;
  name: string;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  if (!confirming) {
    return (
      <button
        onClick={() => setConfirming(true)}
        className="label text-graphite hover:text-ink"
      >
        Remove
      </button>
    );
  }

  return (
    <span className="flex items-center justify-end gap-2">
      <button
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            await removeCompetitor(brandId, competitorId);
            router.refresh();
          })
        }
        className="label text-alert hover:underline"
        aria-label={`Confirm removing ${name}`}
      >
        {pending ? "Removing" : "Confirm"}
      </button>
      <button
        onClick={() => setConfirming(false)}
        className="label text-graphite hover:text-ink"
      >
        Cancel
      </button>
    </span>
  );
}
