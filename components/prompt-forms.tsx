"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createPrompt,
  setPromptActive,
  updatePrompt,
} from "@/app/brands/[brandId]/prompts/actions";
import { Button } from "@/components/ui";
import type { Intent } from "@/lib/db/schema";

const INTENTS: { value: Intent; label: string; hint: string }[] = [
  { value: "discovery", label: "Discovery", hint: "buyer does not know who exists yet" },
  { value: "comparison", label: "Comparison", hint: "buyer is choosing between options" },
  { value: "problem", label: "Problem", hint: "buyer describes a symptom" },
  { value: "branded", label: "Branded", hint: "buyer already knows the name" },
];

const field =
  "w-full border border-rule bg-paper px-2 py-2 text-prose-s focus:border-ink";

function IntentSelect({ name, defaultValue }: { name: string; defaultValue?: Intent }) {
  return (
    <select name={name} defaultValue={defaultValue ?? "discovery"} className={`${field} font-mono text-mono`}>
      {INTENTS.map((intent) => (
        <option key={intent.value} value={intent.value}>
          {intent.label} — {intent.hint}
        </option>
      ))}
    </select>
  );
}

export function AddPromptForm({ brandId }: { brandId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!open) {
    return (
      <Button variant="secondary" onClick={() => setOpen(true)}>
        Add prompt
      </Button>
    );
  }

  return (
    <form
      className="border border-rule p-4"
      action={(formData) =>
        startTransition(async () => {
          const result = await createPrompt(brandId, formData);
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
      <label className="label mb-2 block text-graphite" htmlFor="new-prompt-text">
        What a buyer would type
      </label>
      <input
        id="new-prompt-text"
        name="text"
        autoFocus
        placeholder="best math tutor in North York"
        className={`${field} font-mono text-mono`}
      />

      <label className="label mt-4 mb-2 block text-graphite" htmlFor="new-prompt-intent">
        Intent
      </label>
      <IntentSelect name="intent" />

      <div className="mt-4 flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Adding" : "Add prompt"}
        </Button>
        <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
          Cancel
        </Button>
        {error ? <span className="font-mono text-mono text-alert">{error}</span> : null}
      </div>
      <p className="mt-3 max-w-prose text-prose-s text-graphite">
        The prompt is asked three times on the next run. It will not have a mention rate
        until then.
      </p>
    </form>
  );
}

export function EditPromptForm({
  brandId,
  promptId,
  text,
  intent,
  active,
}: {
  brandId: string;
  promptId: string;
  text: string;
  intent: Intent;
  active: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();

  const toggle = () =>
    startTransition(async () => {
      await setPromptActive(brandId, promptId, !active);
      router.refresh();
    });

  if (!editing) {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="secondary" onClick={() => setEditing(true)}>
          Edit
        </Button>
        <Button variant="secondary" disabled={pending} onClick={toggle}>
          {active ? "Deactivate" : "Reactivate"}
        </Button>
        {!active ? (
          <span className="font-mono text-mono text-graphite">
            not included in runs
          </span>
        ) : null}
      </div>
    );
  }

  return (
    <form
      action={(formData) =>
        startTransition(async () => {
          const result = await updatePrompt(brandId, promptId, formData);
          if (result.ok) {
            setEditing(false);
            router.refresh();
          }
        })
      }
    >
      <label className="label mb-2 block text-graphite" htmlFor="edit-prompt-text">
        Prompt text
      </label>
      <textarea
        id="edit-prompt-text"
        name="text"
        defaultValue={text}
        rows={2}
        className={`${field} font-mono text-mono`}
      />

      <label className="label mt-3 mb-2 block text-graphite" htmlFor="edit-prompt-intent">
        Intent
      </label>
      <IntentSelect name="intent" defaultValue={intent} />

      <div className="mt-3 flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving" : "Save"}
        </Button>
        <Button type="button" variant="secondary" onClick={() => setEditing(false)}>
          Cancel
        </Button>
      </div>
      <p className="mt-3 text-prose-s text-graphite">
        Editing the text changes what gets asked from the next run onward. Answers already
        collected stay as they are.
      </p>
    </form>
  );
}
