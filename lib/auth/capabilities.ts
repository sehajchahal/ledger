import type { Role } from "@/lib/db/schema";

/**
 * What each role is allowed to do.
 *
 * Deliberately free of imports beyond the role type: this is the policy, and it
 * has to be readable and testable without dragging in session plumbing or a
 * database connection.
 */

export type Capability =
  | "viewBrand"
  | "runChecks"
  | "manageBrand"
  | "approveActions"
  | "manageMembers"
  | "manageBilling";

const CAPABILITIES: Record<Role, Capability[]> = {
  viewer: ["viewBrand"],
  editor: ["viewBrand", "runChecks", "manageBrand", "approveActions"],
  owner: [
    "viewBrand",
    "runChecks",
    "manageBrand",
    "approveActions",
    "manageMembers",
    "manageBilling",
  ],
};

export function can(role: Role, capability: Capability): boolean {
  return CAPABILITIES[role].includes(capability);
}
