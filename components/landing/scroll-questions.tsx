import { ScrollType } from "@/components/scroll-type";

/**
 * The questions band. A scroll-driven list where the line nearest the middle of
 * the viewport is lit and the rest fall back to near-black.
 *
 * This is a Server Component and ships no JavaScript. The effect is the CSS
 * `view()` timeline (see `.scroll-focus` in globals.css), not a scroll library —
 * the same reason there is no chart library for the presence strip.
 *
 * The content is deliberately mundane. These read like things a real person
 * types, because the argument the section is making is that ordinary buying
 * questions now get answered with a company name, and the reader should
 * recognise their own trade somewhere in the list.
 */

/**
 * Seven, not twenty. The point lands on the third or fourth line and every one
 * after that is just scrolling — a band that outlasts its own argument stops
 * being emphasis and becomes an obstacle between the reader and the check.
 *
 * They are spread across unrelated trades on purpose, so the reader places
 * their own business somewhere in the set rather than deciding this is a tool
 * for somebody else's industry.
 */
const QUESTIONS = [
  "who should I use for payroll",
  "best accountant for a small business",
  "same day HVAC repair",
  "good dentist taking new patients",
  "reliable web designer for a local business",
  "IT support for a small office",
  "a good electrician, licensed",
];

export function ScrollQuestions() {
  return (
    // z-20 lifts the whole band, scrim included, above the sections either side
    // of it, which is what lets a child of this section paint over them.
    <section className="relative z-20 border-t border-rule py-16">
      {/* Full-bleed wash of the page colour. Fixed to the viewport, so while the
          band is centred there is nothing else on screen to look at. */}
      <div
        aria-hidden
        className="scroll-scrim pointer-events-none absolute inset-0 -z-10"
      >
        <div className="fixed inset-0 bg-paper" />
      </div>

      <div className="scroll-zoom">
        <p className="label mb-4 text-graphite">what buyers actually type</p>
        <h2 className="text-display-l font-display max-w-[18ch]">
          <ScrollType text="These are being typed right now." />
        </h2>
        <p className="mt-4 max-w-[52ch] text-prose text-graphite">
          Not into Google. Into ChatGPT, into Perplexity, into the assistant
          built into the browser. Each one comes back with a short list of
          companies.
        </p>

        <ul
          className="scroll-focus mt-10 mb-10 flex flex-col gap-7 sm:gap-8"
          // The list is decorative emphasis over content stated plainly above
          // and below it; a screen reader gets the point without walking seven
          // near-identical items.
          aria-hidden="true"
        >
          {QUESTIONS.map((question) => (
            <li
              key={question}
              className="text-display-m font-display sm:text-display-l"
            >
              {question}
            </li>
          ))}
        </ul>

        <p className="max-w-[52ch] text-prose text-graphite">
          Every one of them got answered with somebody&rsquo;s name.{" "}
          <span className="text-ink">
            Ledger checks whether it was yours, and how often.
          </span>
        </p>
      </div>
    </section>
  );
}
