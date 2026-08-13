"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveDigestSettings } from "@/app/brands/[brandId]/settings/actions";
import { Button } from "@/components/ui";
import type { Cadence } from "@/lib/db/schema";

const field = "border border-rule bg-paper px-2 py-2 font-mono text-mono focus:border-ink";

const CADENCES: { value: Cadence; hint: string }[] = [
  { value: "daily", hint: "every morning" },
  { value: "weekly", hint: "Monday mornings" },
  { value: "monthly", hint: "first of the month" },
];

export function DigestSettings({
  brandId,
  digestId,
  cadence,
  recipientEmail,
  alertImmediately,
  dropThreshold,
  canEdit,
}: {
  brandId: string;
  digestId: string | null;
  cadence: Cadence;
  recipientEmail: string;
  alertImmediately: boolean;
  dropThreshold: number;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [note, setNote] = useState<string | null>(null);
  const [alerting, setAlerting] = useState(alertImmediately);

  if (!canEdit) {
    return (
      <p className="max-w-prose text-prose-s text-graphite">
        The digest goes to <span className="font-mono text-mono">{recipientEmail}</span>{" "}
        {cadence}. Only an owner can change it.
      </p>
    );
  }

  return (
    <form
      action={(formData) =>
        startTransition(async () => {
          const result = await saveDigestSettings(brandId, digestId, formData);
          setNote(result.ok ? "Saved." : result.reason);
          router.refresh();
        })
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="digest-email" className="label mb-2 block text-graphite">
            Send to
          </label>
          <input
            id="digest-email"
            name="recipientEmail"
            type="email"
            required
            defaultValue={recipientEmail}
            className={`${field} w-full`}
          />
        </div>
        <div>
          <label htmlFor="digest-cadence" className="label mb-2 block text-graphite">
            How often
          </label>
          <select
            id="digest-cadence"
            name="cadence"
            defaultValue={cadence}
            className={`${field} w-full`}
          >
            {CADENCES.map((option) => (
              <option key={option.value} value={option.value}>
                {option.value} — {option.hint}
              </option>
            ))}
          </select>
        </div>
      </div>

      <label className="mt-5 flex items-start gap-3">
        <input
          type="checkbox"
          name="alertImmediately"
          checked={alerting}
          onChange={(e) => setAlerting(e.target.checked)}
          className="mt-1 size-4 shrink-0 accent-[#16150f]"
        />
        <span className="text-prose-s">
          Tell me straight away when visibility falls sharply
          <span className="mt-1 block text-graphite">
            Sent outside the schedule, so a bad week does not sit unread until Monday.
          </span>
        </span>
      </label>

      {alerting ? (
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <div>
            <label htmlFor="digest-threshold" className="label mb-2 block text-graphite">
              Drop of at least
            </label>
            <input
              id="digest-threshold"
              name="dropThreshold"
              type="number"
              min={1}
              max={100}
              defaultValue={dropThreshold}
              className={`${field} w-24`}
            />
          </div>
          <span className="pb-3 font-mono text-mono text-graphite">
            percentage points against the previous run
          </span>
        </div>
      ) : null}

      <div className="mt-5 flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving" : "Save"}
        </Button>
        {note ? <span className="font-mono text-mono text-graphite">{note}</span> : null}
      </div>
    </form>
  );
}
