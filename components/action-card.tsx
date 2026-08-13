"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  approveAction,
  dismissAction,
  markShipped,
  proposeActions,
} from "@/app/brands/[brandId]/fixes/actions";
import { Badge, Button } from "@/components/ui";
import type { ActionRow } from "@/lib/db/queries/fixes";

const TYPE_LABEL = {
  schema_markup: "schema markup",
  page_edit: "page edit",
  offsite_target: "offsite target",
} as const;

/** Renders the fenced code blocks in an action body as copyable blocks. */
function Body({ text }: { text: string }) {
  const parts = text.split(/```(?:json)?\n?/);

  return (
    <div className="space-y-3">
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <CodeBlock key={i} code={part.replace(/\n$/, "")} />
        ) : part.trim() ? (
          <p key={i} className="whitespace-pre-wrap text-prose-s text-graphite">
            {part.trim()}
          </p>
        ) : null,
      )}
    </div>
  );
}

function CodeBlock({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <div className="border border-rule bg-wash">
      <div className="flex items-center justify-between border-b border-rule px-3 py-1.5">
        <span className="label text-graphite">copy this</span>
        <button
          className="label text-graphite hover:text-ink"
          onClick={async () => {
            await navigator.clipboard.writeText(code);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          }}
        >
          {copied ? "copied" : "copy"}
        </button>
      </div>
      <pre className="overflow-x-auto px-3 py-3 font-mono text-mono leading-relaxed">
        {code}
      </pre>
    </div>
  );
}

function VerificationState({ state }: { state: ActionRow["verification"] }) {
  if (state.kind === "none") return null;

  if (state.kind === "pending") {
    return (
      <div className="flex flex-wrap items-center gap-3 border-t border-rule pt-3">
        <Badge tone="amber">verification pending</Badge>
        <span className="font-mono text-mono text-graphite">
          re-checks in {state.daysLeft} {state.daysLeft === 1 ? "day" : "days"} ·{" "}
          {state.scheduledFor.toISOString().slice(0, 10)}
        </span>
      </div>
    );
  }

  const points = Math.round(state.delta * 100);
  const tone = points > 0 ? "signal" : points < 0 ? "alert" : "neutral";

  return (
    <div className="flex flex-wrap items-center gap-3 border-t border-rule pt-3">
      <Badge tone={tone}>{points > 0 ? "improved" : points < 0 ? "declined" : "no change"}</Badge>
      <span
        className={`font-mono text-mono tabular-nums ${
          points > 0 ? "text-signal" : points < 0 ? "text-alert" : "text-graphite"
        }`}
      >
        {points > 0 ? "+" : ""}
        {points}pt
      </span>
      <span className="font-mono text-mono text-graphite">
        {Math.round(state.before * 100)}% → {Math.round(state.after * 100)}% on this prompt ·
        checked {state.checkedAt.toISOString().slice(0, 10)}
      </span>
    </div>
  );
}

export function ActionCard({
  brandId,
  row,
  canDecide,
}: {
  brandId: string;
  row: ActionRow;
  canDecide: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const run = (task: () => Promise<{ ok: boolean; reason?: string }>) =>
    startTransition(async () => {
      setError(null);
      const result = await task();
      if (!result.ok && result.reason) setError(result.reason);
      router.refresh();
    });

  const { action } = row;

  return (
    <article className="border border-rule p-5">
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <Badge>{TYPE_LABEL[action.type]}</Badge>
        {action.status === "shipped" ? <Badge tone="signal">shipped</Badge> : null}
        {action.status === "approved" ? <Badge>approved</Badge> : null}
        {action.status === "dismissed" ? <Badge>dismissed</Badge> : null}
        {row.promptText ? (
          <span className="font-mono text-mono text-graphite">{row.promptText}</span>
        ) : null}
      </div>

      <h3 className="mb-3 text-prose font-medium">{action.title}</h3>

      <Body text={action.body} />

      <div className="mt-5 flex flex-wrap items-center gap-3">
        {canDecide && action.status === "proposed" ? (
          <>
            <Button disabled={pending} onClick={() => run(() => approveAction(brandId, action.id))}>
              Approve
            </Button>
            <Button
              variant="secondary"
              disabled={pending}
              onClick={() => run(() => dismissAction(brandId, action.id))}
            >
              Dismiss
            </Button>
          </>
        ) : null}

        {canDecide && action.status === "approved" ? (
          <>
            <Button disabled={pending} onClick={() => run(() => markShipped(brandId, action.id))}>
              Mark as shipped
            </Button>
            <span className="max-w-prose text-prose-s text-graphite">
              Mark this once the change is actually live. That starts the 14-day clock and
              records the run it will be measured against.
            </span>
          </>
        ) : null}

        {error ? <span className="font-mono text-mono text-alert">{error}</span> : null}
      </div>

      <div className="mt-4">
        <VerificationState state={row.verification} />
      </div>
    </article>
  );
}

export function ProposeActionsButton({ brandId }: { brandId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [note, setNote] = useState<string | null>(null);

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await proposeActions(brandId);
            setNote(result.ok ? `Proposed ${result.created} fixes.` : result.reason);
            router.refresh();
          })
        }
      >
        {pending ? "Working" : "Propose fixes"}
      </Button>
      {note ? <span className="text-prose-s text-graphite">{note}</span> : null}
    </div>
  );
}
