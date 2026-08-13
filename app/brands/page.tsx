import Link from "next/link";
import { redirect } from "next/navigation";
import { EmptyState, PageTitle } from "@/components/ui";
import { requireUser, workspacesForUser } from "@/lib/auth/session";

// Reads the database to decide where to send you, so it must not be baked at
// build time.
export const dynamic = "force-dynamic";

/** Drops you into your only brand, or lists them when there is more than one. */
export default async function BrandsIndex() {
  const user = await requireUser();
  const workspaces = await workspacesForUser(user.id);
  const brands = workspaces.flatMap((w) => w.brands.map((b) => ({ ...b, workspace: w.name })));

  if (brands.length === 1) redirect(`/brands/${brands[0].id}`);

  return (
    <main className="mx-auto max-w-[700px] px-8 py-16">
      <PageTitle aside={<span className="font-mono text-mono text-graphite">{user.email}</span>}>
        Your brands
      </PageTitle>

      {brands.length === 0 ? (
        <EmptyState action={<Link href="/onboarding" className="hover:underline">Set up a brand →</Link>}>
          You are signed in but not tracking anything yet. Setting up a brand takes a website
          address and about two minutes.
        </EmptyState>
      ) : (
        <ul>
          {brands.map((brand) => (
            <li key={brand.id} className="border-b border-rule">
              <Link href={`/brands/${brand.id}`} className="flex items-baseline justify-between gap-4 py-3 hover:underline">
                <span className="text-prose">{brand.name}</span>
                <span className="font-mono text-mono text-graphite">{brand.workspace}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
