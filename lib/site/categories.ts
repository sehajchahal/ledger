/**
 * Category inference from a site's own words.
 *
 * Coarse on purpose — it only has to be close enough to write buyer questions,
 * and the onboarding UI puts it in an editable field. The one thing it must not
 * do is return something that produces nonsense prompts: "best business for a
 * small business" is worse than admitting we do not know.
 *
 * `local` decides the shape of the questions. Nobody types "near me" about
 * payment processing, and nobody types "with an API" about a dentist.
 */

export type Category = {
  label: string;
  local: boolean;
};

/** Checked in order; first match wins, so put specific patterns above general ones. */
const PATTERNS: [RegExp, Category][] = [
  // Local services
  [/\btutor(ing|s)?\b|homework help|exam prep|grade \d/i, { label: "tutoring", local: true }],
  [/\bdentist|dental|orthodont/i, { label: "dental care", local: true }],
  [/\blaw firm|lawyer|attorney|legal services/i, { label: "legal services", local: true }],
  [/\bplumb(er|ing)|hvac|electrician|roofing|renovation/i, { label: "home services", local: true }],
  [/\breal estate|realtor|mortgage broker/i, { label: "real estate services", local: true }],
  [/\bclinic|physiotherapy|chiropract|massage therapy|veterinar/i, { label: "health clinic", local: true }],
  [/\brestaurant|catering|coffee shop|\bcafe\b/i, { label: "restaurant", local: true }],
  [/\bgym\b|fitness|personal training|yoga studio/i, { label: "fitness", local: true }],
  [/\bsalon|barber|\bspa\b/i, { label: "salon", local: true }],
  [/\bmoving company|movers\b|storage units/i, { label: "moving services", local: true }],
  [/\blandscap|lawn care|snow removal/i, { label: "landscaping", local: true }],

  // Professional services
  [/\baccounting|bookkeep|\bcpa\b|tax (services|preparation|filing)/i, { label: "accounting", local: true }],
  [/\b(marketing|advertising|seo|branding) agency\b|agency services/i, { label: "marketing agency", local: false }],
  [/\brecruit(ing|ment)|staffing agency|headhunt/i, { label: "recruiting", local: false }],
  [/\bconsult(ing|ancy)\b/i, { label: "consulting", local: false }],

  // Software, specific before general
  [/accept payments|payment (processing|gateway|platform)|checkout|\bmerchant account/i, { label: "payment processing", local: false }],
  [/\bpayroll\b|\bhris\b/i, { label: "payroll software", local: false }],
  [/\bissue track|bug track|sprint planning|product planning|roadmap(ping)?\b/i, { label: "issue tracking software", local: false }],
  [/\bproject management|task management|team collaboration/i, { label: "project management software", local: false }],
  [/\bcrm\b|sales pipeline|lead management/i, { label: "CRM software", local: false }],
  [/help ?desk|customer support software|support ticket/i, { label: "customer support software", local: false }],
  [/email marketing|newsletter platform|campaign automation/i, { label: "email marketing software", local: false }],
  [/\banalytics\b|product analytics|reporting platform|dashboards?\b/i, { label: "analytics software", local: false }],
  [/\binvoic(e|ing)\b|billing software|subscriptions? billing/i, { label: "invoicing software", local: false }],
  [/\bweb hosting|cloud hosting|deploy(ment)? platform|serverless/i, { label: "web hosting", local: false }],
  [/design tool|prototyping|\bui\/?ux tool/i, { label: "design software", local: false }],
  [/note.?taking|knowledge base|\bwiki\b|docs? workspace/i, { label: "note-taking software", local: false }],
  [/\becommerce|online store|storefront/i, { label: "ecommerce platform", local: false }],
  [/\binsurance\b/i, { label: "insurance", local: false }],
  [/\bpassword manager|identity (management|provider)|\bsso\b/i, { label: "identity software", local: false }],
];

/**
 * Returns null when nothing matched. Callers must handle that rather than
 * substituting a generic word into a sentence.
 */
export function inferCategory(text: string): Category | null {
  for (const [pattern, category] of PATTERNS) {
    if (pattern.test(text)) return category;
  }
  return null;
}

/** Whether a user-supplied category reads as a local service. */
export function looksLocal(label: string): boolean {
  const match = PATTERNS.find(([, category]) => category.label === label);
  if (match) return match[1].local;
  return /\b(clinic|salon|studio|repair|services|care|shop|restaurant)\b/i.test(label);
}
