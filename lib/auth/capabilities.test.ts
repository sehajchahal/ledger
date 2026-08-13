import { describe, expect, it } from "vitest";
import { can, type Capability } from "@/lib/auth/capabilities";
import type { Role } from "@/lib/db/schema";

/**
 * The role matrix, pinned.
 *
 * Server Actions are a public HTTP surface, so this is what actually stops a
 * viewer approving a fix — the hidden buttons are only presentation. A change
 * here that widens a role should be deliberate enough to update this table.
 */

const EXPECTED: Record<Role, Record<Capability, boolean>> = {
  viewer: {
    viewBrand: true,
    runChecks: false,
    manageBrand: false,
    approveActions: false,
    manageMembers: false,
    manageBilling: false,
  },
  editor: {
    viewBrand: true,
    runChecks: true,
    manageBrand: true,
    approveActions: true,
    manageMembers: false,
    manageBilling: false,
  },
  owner: {
    viewBrand: true,
    runChecks: true,
    manageBrand: true,
    approveActions: true,
    manageMembers: true,
    manageBilling: true,
  },
};

describe("can", () => {
  for (const [role, capabilities] of Object.entries(EXPECTED) as [
    Role,
    Record<Capability, boolean>,
  ][]) {
    describe(role, () => {
      for (const [capability, allowed] of Object.entries(capabilities) as [
        Capability,
        boolean,
      ][]) {
        it(`${allowed ? "can" : "cannot"} ${capability}`, () => {
          expect(can(role, capability)).toBe(allowed);
        });
      }
    });
  }

  it("never lets a viewer change anything", () => {
    const mutating: Capability[] = [
      "runChecks",
      "manageBrand",
      "approveActions",
      "manageMembers",
      "manageBilling",
    ];

    expect(mutating.filter((capability) => can("viewer", capability))).toEqual([]);
  });

  it("gives an editor everything except member and billing management", () => {
    expect(can("editor", "approveActions")).toBe(true);
    expect(can("editor", "manageMembers")).toBe(false);
    expect(can("editor", "manageBilling")).toBe(false);
  });
});
