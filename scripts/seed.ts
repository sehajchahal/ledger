import "../lib/env";
import { closeDb, db } from "../lib/db";
import {
  brands,
  competitors,
  digests,
  memberships,
  organizations,
  prompts,
  users,
  workspaces,
  type Intent,
} from "../lib/db/schema";

/**
 * Seeds one org, one workspace, one brand with three competitors, and 25
 * prompts.
 *
 * The brand is a Toronto tutoring company because that is the customer this
 * product is for: too small for the enterprise tools, competing against
 * businesses that are getting recommended by name without them knowing.
 */

const PROMPTS: ReadonlyArray<readonly [Intent, string]> = [
  // discovery — the buyer does not know who exists yet
  ["discovery", "best math tutor in North York"],
  ["discovery", "where can I find a grade 9 math tutor in Toronto"],
  ["discovery", "affordable tutoring services near me in Toronto"],
  ["discovery", "good SAT prep tutors in Toronto"],
  ["discovery", "how much does a private math tutor cost in North York"],
  ["discovery", "best tutoring centres for high school students in Toronto"],
  ["discovery", "who offers one on one math tutoring in Toronto"],
  ["discovery", "grade 12 calculus tutor Toronto"],
  ["discovery", "tutoring for kids with math anxiety in Toronto"],
  ["discovery", "weekend math tutoring North York"],

  // comparison — the buyer is choosing between options
  ["comparison", "tutoring centre vs private tutor for grade 9 math"],
  ["comparison", "Mathwise Academy vs Bright Path Learning"],
  ["comparison", "compare tutoring prices in North York"],
  ["comparison", "best alternative to a big chain tutoring franchise"],
  ["comparison", "group tutoring or one on one for high school math"],
  ["comparison", "which Toronto tutoring company gets the best results"],
  ["comparison", "online vs in person tutoring for high school math"],

  // problem — the buyer describes a symptom, not a solution
  ["problem", "my son is failing grade 10 math what should I do"],
  ["problem", "how do I help my kid catch up in math before exams"],
  ["problem", "my daughter has test anxiety in math what helps"],
  ["problem", "is tutoring worth it for a grade 9 student"],
  ["problem", "how many tutoring sessions does it take to raise a math grade"],

  // branded — the buyer already knows the name
  ["branded", "Northside Tutoring reviews"],
  ["branded", "how much does Northside Tutoring cost"],
  ["branded", "is Northside Tutoring any good"],
];

async function main() {
  console.log("seeding...");

  // Start from a clean slate. Cascades take care of everything downstream.
  await db.delete(memberships);
  await db.delete(digests);
  await db.delete(organizations);
  await db.delete(users);

  const [org] = await db
    .insert(organizations)
    .values({ name: "Northside Learning", plan: "growth" })
    .returning();

  const [workspace] = await db
    .insert(workspaces)
    .values({ orgId: org.id, name: "Northside Learning" })
    .returning();

  // A second workspace so workspace switching has something to switch to. This
  // is the agency shape: one org, several client workspaces.
  const [clientWorkspace] = await db
    .insert(workspaces)
    .values({ orgId: org.id, name: "Client work" })
    .returning();

  // One user per role, so the role gating can actually be exercised.
  const [owner, editor, viewer] = await db
    .insert(users)
    .values([
      { email: "owner@northsidetutoring.ca", name: "Priya Raman" },
      { email: "editor@northsidetutoring.ca", name: "Sam Okoye" },
      { email: "viewer@northsidetutoring.ca", name: "Dana Whitfield" },
    ])
    .returning();

  await db.insert(memberships).values([
    { userId: owner.id, orgId: org.id, role: "owner" },
    { userId: editor.id, orgId: org.id, role: "editor" },
    { userId: viewer.id, orgId: org.id, role: "viewer" },
  ]);

  const [brand] = await db
    .insert(brands)
    .values({
      workspaceId: workspace.id,
      name: "Northside Tutoring",
      domain: "northsidetutoring.ca",
      aliases: ["Northside", "Northside Tutors"],
    })
    .returning();

  await db.insert(competitors).values([
    { brandId: brand.id, name: "Mathwise Academy", aliases: ["Mathwise"] },
    {
      brandId: brand.id,
      name: "Bright Path Learning",
      aliases: ["Bright Path", "BrightPath"],
    },
    {
      brandId: brand.id,
      name: "Scholar's Edge Tutoring",
      aliases: ["Scholar's Edge", "Scholars Edge"],
    },
  ]);

  await db
    .insert(prompts)
    .values(PROMPTS.map(([intent, text]) => ({ brandId: brand.id, text, intent })));

  await db.insert(digests).values({
    workspaceId: workspace.id,
    cadence: "weekly",
    recipientEmail: owner.email,
  });

  console.log(`org         ${org.id}  ${org.name} (${org.plan})`);
  console.log(`workspaces  ${workspace.name}, ${clientWorkspace.name}`);
  console.log(`brand       ${brand.id}  ${brand.name}  ${brand.domain}`);
  console.log(`competitors 3`);
  console.log(`prompts     ${PROMPTS.length}`);
  console.log("");
  console.log("sign in as any of these — the link is printed to the dev server log:");
  console.log(`  owner   ${owner.email}`);
  console.log(`  editor  ${editor.email}`);
  console.log(`  viewer  ${viewer.email}`);
  console.log(`\nrun a probe with:  npm run probe -- ${brand.id}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => closeDb());
