import { findAllOccurrences, type Entity } from "@/lib/parse/mentions";

/**
 * The raw answer, with the brand and its competitors highlighted inline.
 *
 * This is the evidence behind every number in the product, so it renders whole
 * and unedited — no truncation, no summary. Answer engines emit `**bold**`
 * around the names they list; those markers are removed because the highlight
 * already does that job, and spans are computed after removal so the offsets
 * stay correct.
 */
export function AnswerText({ text, entities }: { text: string; entities: readonly Entity[] }) {
  const clean = text.replace(/\*\*/g, "");
  const spans = findAllOccurrences(clean, entities);

  const paragraphs: { start: number; end: number }[] = [];
  let cursor = 0;
  for (const block of clean.split(/\n{2,}/)) {
    const start = clean.indexOf(block, cursor);
    paragraphs.push({ start, end: start + block.length });
    cursor = start + block.length;
  }

  return (
    <div className="space-y-4">
      {paragraphs.map((paragraph) => (
        <p key={paragraph.start} className="text-prose leading-relaxed">
          {render(clean, paragraph, spans)}
        </p>
      ))}
    </div>
  );
}

function render(
  text: string,
  paragraph: { start: number; end: number },
  spans: ReturnType<typeof findAllOccurrences>,
) {
  const inside = spans.filter(
    (span) => span.start >= paragraph.start && span.end <= paragraph.end,
  );

  const nodes: React.ReactNode[] = [];
  let cursor = paragraph.start;

  for (const span of inside) {
    if (span.start > cursor) nodes.push(text.slice(cursor, span.start));
    nodes.push(
      <mark
        key={span.start}
        className={`bg-transparent font-medium ${
          span.isBrand ? "text-signal" : "text-graphite"
        }`}
      >
        {text.slice(span.start, span.end)}
      </mark>,
    );
    cursor = span.end;
  }

  if (cursor < paragraph.end) nodes.push(text.slice(cursor, paragraph.end));
  return nodes;
}
