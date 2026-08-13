"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Role } from "@/lib/db/schema";
import type { WorkspaceSummary } from "@/lib/auth/session";
import { ThemeToggle } from "@/components/theme-toggle";

/**
 * Fixed 220px left rail. No top bar, no breadcrumbs, no icons in the nav.
 * The active item is marked by a 2px ink bar in the left gutter.
 *
 * The switcher is a plain disclosure — no floating panel, no shadow. It pushes
 * the nav down while open, which is fine on a rail this short.
 */

const NAV = [
  { href: "", label: "Overview" },
  { href: "/prompts", label: "Prompts" },
  { href: "/competitors", label: "Competitors" },
  { href: "/sources", label: "Sources" },
  { href: "/fixes", label: "Fixes" },
  { href: "/settings", label: "Settings" },
] as const;

export function Sidebar({
  brandId,
  brandName,
  workspaceName,
  role,
  email,
  workspaces,
  signOutAction,
}: {
  brandId: string;
  brandName: string;
  workspaceName: string;
  role: Role;
  email: string;
  workspaces: WorkspaceSummary[];
  signOutAction: () => Promise<void>;
}) {
  const pathname = usePathname();
  const base = `/brands/${brandId}`;
  const [open, setOpen] = useState(false);

  const canSwitch = workspaces.some((w) => w.brands.length > 0) && workspaces.length + workspaces.reduce((n, w) => n + w.brands.length, 0) > 2;

  return (
    <nav
      aria-label="Main"
      className="fixed inset-y-0 left-0 flex w-[220px] flex-col border-r border-rule bg-paper"
    >
      <div className="border-b border-rule px-4 py-4">
        <div className="flex items-center justify-between gap-2">
          <Link href="/" className="flex cursor-pointer items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-[7px] bg-accent text-accent-ink">
              <svg viewBox="0 0 24 24" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden>
                <path d="M4 18V9M10 18V5M16 18v-6M22 18h-2" />
              </svg>
            </span>
            <span className="font-display text-prose font-semibold">Ledger</span>
          </Link>
          <ThemeToggle className="size-8" />
        </div>

        <button
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="mt-4 block w-full cursor-pointer rounded-[8px] border border-rule px-3 py-2 text-left transition-colors duration-200 hover:border-accent"
        >
          <span className="label block text-graphite">{workspaceName}</span>
          <span className="mt-1 flex items-baseline justify-between gap-2">
            <span className="truncate text-prose-s" title={brandName}>
              {brandName}
            </span>
            {canSwitch ? (
              <span aria-hidden className="font-mono text-mono text-graphite">
                {open ? "×" : "▾"}
              </span>
            ) : null}
          </span>
        </button>
      </div>

      {open ? (
        <div className="border-b border-rule py-2">
          {workspaces.map((workspace) => (
            <div key={workspace.id} className="mb-2 last:mb-0">
              <p className="label px-4 py-1 text-graphite">{workspace.name}</p>
              {workspace.brands.length === 0 ? (
                <p className="px-4 py-1 text-prose-s text-graphite">no brands yet</p>
              ) : (
                <ul>
                  {workspace.brands.map((brand) => (
                    <li key={brand.id}>
                      <Link
                        href={`/brands/${brand.id}`}
                        onClick={() => setOpen(false)}
                        className={`block truncate px-4 py-1.5 text-prose-s ${
                          brand.id === brandId ? "text-ink" : "text-graphite hover:text-ink"
                        }`}
                      >
                        {brand.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
          <Link
            href="/onboarding"
            onClick={() => setOpen(false)}
            className="label mt-2 block px-4 py-1.5 text-graphite hover:text-ink"
          >
            Add a brand
          </Link>
        </div>
      ) : null}

      <ul className="flex-1 py-2">
        {NAV.map((item) => {
          const href = `${base}${item.href}`;
          const active = item.href === "" ? pathname === base : pathname.startsWith(href);

          return (
            <li key={item.label} className="px-2">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={`label relative block cursor-pointer rounded-[8px] px-3 py-2.5 transition-colors duration-200 ${
                  active
                    ? "bg-accent-soft text-ink"
                    : "text-graphite hover:bg-wash/60 hover:text-ink"
                }`}
              >
                {active ? (
                  <span aria-hidden className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-accent" />
                ) : null}
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>

      <div className="border-t border-rule px-4 py-3">
        <p className="truncate font-mono text-mono text-graphite" title={email}>
          {email}
        </p>
        <div className="mt-1 flex items-center justify-between gap-2">
          <span className="label text-graphite">{role}</span>
          <form action={signOutAction}>
            <button className="label text-graphite hover:text-ink">Sign out</button>
          </form>
        </div>
      </div>
    </nav>
  );
}
