"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  changeRole,
  inviteMember,
  removeMember,
} from "@/app/brands/[brandId]/settings/actions";
import { Button } from "@/components/ui";
import type { Role } from "@/lib/db/schema";

const ROLES: { value: Role; hint: string }[] = [
  { value: "owner", hint: "manages billing and members" },
  { value: "editor", hint: "approves fixes and runs checks" },
  { value: "viewer", hint: "read-only" },
];

const field = "border border-rule bg-paper px-2 py-2 font-mono text-mono focus:border-ink";

export function InviteMemberForm({ brandId }: { brandId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!open) {
    return (
      <Button variant="secondary" onClick={() => setOpen(true)}>
        Add member
      </Button>
    );
  }

  return (
    <form
      className="border border-rule p-4"
      action={(formData) =>
        startTransition(async () => {
          const result = await inviteMember(brandId, formData);
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
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-0 flex-1">
          <label htmlFor="member-email" className="label mb-2 block text-graphite">
            Email
          </label>
          <input id="member-email" name="email" type="email" required className={`${field} w-full`} />
        </div>
        <div>
          <label htmlFor="member-role" className="label mb-2 block text-graphite">
            Role
          </label>
          <select id="member-role" name="role" defaultValue="editor" className={field}>
            {ROLES.map((role) => (
              <option key={role.value} value={role.value}>
                {role.value} — {role.hint}
              </option>
            ))}
          </select>
        </div>
        <Button type="submit" disabled={pending}>
          {pending ? "Adding" : "Add"}
        </Button>
        <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>

      {error ? <p className="mt-3 font-mono text-mono text-alert">{error}</p> : null}

      <p className="mt-3 max-w-prose text-prose-s text-graphite">
        Nothing is emailed from here. They sign in with a link sent to this address the
        first time they visit.
      </p>
    </form>
  );
}

export function MemberRow({
  brandId,
  membershipId,
  role,
  isSelf,
}: {
  brandId: string;
  membershipId: string;
  role: Role;
  isSelf: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  const run = (task: () => Promise<{ ok: boolean; reason?: string }>) =>
    startTransition(async () => {
      setError(null);
      const result = await task();
      if (!result.ok && result.reason) setError(result.reason);
      router.refresh();
    });

  return (
    <span className="flex flex-wrap items-center justify-end gap-3">
      {error ? <span className="font-mono text-mono text-alert">{error}</span> : null}

      <select
        value={role}
        disabled={pending}
        aria-label="Role"
        onChange={(e) => run(() => changeRole(brandId, membershipId, e.target.value as Role))}
        className="border border-rule bg-paper px-2 py-1 font-mono text-mono focus:border-ink"
      >
        {ROLES.map((r) => (
          <option key={r.value} value={r.value}>
            {r.value}
          </option>
        ))}
      </select>

      {isSelf ? (
        <span className="label text-graphite">you</span>
      ) : confirming ? (
        <>
          <button
            disabled={pending}
            onClick={() => run(() => removeMember(brandId, membershipId))}
            className="label text-alert hover:underline"
          >
            {pending ? "Removing" : "Confirm"}
          </button>
          <button onClick={() => setConfirming(false)} className="label text-graphite hover:text-ink">
            Cancel
          </button>
        </>
      ) : (
        <button onClick={() => setConfirming(true)} className="label text-graphite hover:text-ink">
          Remove
        </button>
      )}
    </span>
  );
}
