import { and, asc, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { can, type Capability } from "@/lib/auth/capabilities";
import { db } from "@/lib/db";
import {
  brands,
  memberships,
  organizations,
  users,
  workspaces,
  type Brand,
  type Role,
} from "@/lib/db/schema";

/**
 * Who is signed in, and what they are allowed to do.
 *
 * Access is always resolved from the database rather than the session cookie:
 * the session says who you are, memberships say what you can reach. A brand id
 * in the URL proves nothing.
 */

export { can, type Capability } from "@/lib/auth/capabilities";

export type SessionUser = { id: string; email: string; name: string | null };

export async function currentUser(): Promise<SessionUser | null> {
  const session = await auth();
  if (!session?.user?.id) return null;

  const [user] = await db
    .select({ id: users.id, email: users.email, name: users.name })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);

  return user ?? null;
}

export async function requireUser(): Promise<SessionUser> {
  const user = await currentUser();
  if (!user) redirect("/signin");
  return user;
}

export type WorkspaceSummary = {
  id: string;
  name: string;
  orgId: string;
  orgName: string;
  role: Role;
  brands: { id: string; name: string }[];
};

/** Every workspace the user can reach, with the brands inside each. */
export async function workspacesForUser(userId: string): Promise<WorkspaceSummary[]> {
  const rows = await db
    .select({
      workspaceId: workspaces.id,
      workspaceName: workspaces.name,
      orgId: organizations.id,
      orgName: organizations.name,
      role: memberships.role,
      brandId: brands.id,
      brandName: brands.name,
    })
    .from(memberships)
    .innerJoin(organizations, eq(organizations.id, memberships.orgId))
    .innerJoin(workspaces, eq(workspaces.orgId, organizations.id))
    .leftJoin(brands, eq(brands.workspaceId, workspaces.id))
    .where(eq(memberships.userId, userId))
    .orderBy(asc(organizations.name), asc(workspaces.name), asc(brands.name));

  const byWorkspace = new Map<string, WorkspaceSummary>();

  for (const row of rows) {
    let workspace = byWorkspace.get(row.workspaceId);
    if (!workspace) {
      workspace = {
        id: row.workspaceId,
        name: row.workspaceName,
        orgId: row.orgId,
        orgName: row.orgName,
        role: row.role,
        brands: [],
      };
      byWorkspace.set(row.workspaceId, workspace);
    }
    if (row.brandId && row.brandName) {
      workspace.brands.push({ id: row.brandId, name: row.brandName });
    }
  }

  return [...byWorkspace.values()];
}

export type BrandAccess = {
  user: SessionUser;
  brand: Brand;
  workspace: { id: string; name: string };
  org: { id: string; name: string };
  role: Role;
};

/**
 * Resolves a brand the signed-in user is actually a member of.
 *
 * Returns null rather than throwing so callers can choose between a redirect
 * and a 404 — leaking "this brand exists but is not yours" is itself a
 * disclosure.
 */
export async function brandAccess(brandId: string): Promise<BrandAccess | null> {
  const user = await currentUser();
  if (!user) return null;

  const [row] = await db
    .select({
      brand: brands,
      workspaceId: workspaces.id,
      workspaceName: workspaces.name,
      orgId: organizations.id,
      orgName: organizations.name,
      role: memberships.role,
    })
    .from(brands)
    .innerJoin(workspaces, eq(workspaces.id, brands.workspaceId))
    .innerJoin(organizations, eq(organizations.id, workspaces.orgId))
    .innerJoin(
      memberships,
      and(eq(memberships.orgId, organizations.id), eq(memberships.userId, user.id)),
    )
    .where(eq(brands.id, brandId))
    .limit(1);

  if (!row) return null;

  return {
    user,
    brand: row.brand,
    workspace: { id: row.workspaceId, name: row.workspaceName },
    org: { id: row.orgId, name: row.orgName },
    role: row.role,
  };
}

/** Same, but sends unauthenticated users to sign in and non-members to a 404. */
export async function requireBrandAccess(brandId: string): Promise<BrandAccess> {
  const user = await currentUser();
  if (!user) redirect(`/signin?next=/brands/${brandId}`);

  const access = await brandAccess(brandId);
  if (!access) redirect("/brands");

  return access;
}

/**
 * Guards a mutation. Server Actions are a public HTTP surface — a hidden button
 * is not access control, so every action re-checks here.
 */
export async function requireCapability(
  brandId: string,
  capability: Capability,
): Promise<BrandAccess> {
  const access = await brandAccess(brandId);
  if (!access) throw new Error("You do not have access to this brand.");

  if (!can(access.role, capability)) {
    throw new Error(`Your role (${access.role}) cannot do that.`);
  }

  return access;
}
