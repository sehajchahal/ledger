import type { VoiceShare } from "@/lib/parse/metrics";

/**
 * Share of voice as a single horizontal stacked bar: brand first, competitors
 * after, every segment labelled in mono.
 *
 * The brand is ink; competitors step down through graphite by opacity. Colour
 * is not carrying meaning here beyond "you" versus "them", so no signal or
 * alert appears — those are reserved for direction of change.
 */
export function ShareOfVoice({ shares }: { shares: readonly VoiceShare[] }) {
  const total = shares.reduce((sum, share) => sum + share.mentions, 0);

  if (total === 0) {
    return (
      <p className="text-prose-s text-graphite">
        No entities were mentioned in the last run.
      </p>
    );
  }

  let competitorIndex = -1;

  const segments = shares.map((share) => {
    if (!share.isBrand) competitorIndex++;
    return {
      ...share,
      percent: (share.mentions / total) * 100,
      opacity: share.isBrand ? 1 : Math.max(0.28, 0.85 - competitorIndex * 0.2),
    };
  });

  return (
    <div>
      <div className="flex h-8 w-full border border-rule" role="img" aria-label={
        segments.map((s) => `${s.entityName} ${s.share}%`).join(", ")
      }>
        {segments.map((segment, i) => (
          <div
            key={segment.entityName}
            style={{ width: `${segment.percent}%`, opacity: segment.opacity }}
            className={`${segment.isBrand ? "bg-ink" : "bg-graphite"} ${
              i > 0 ? "border-l border-paper" : ""
            }`}
          />
        ))}
      </div>

      <ul className="mt-3 flex flex-wrap gap-x-6 gap-y-2">
        {segments.map((segment) => (
          <li key={segment.entityName} className="flex items-center gap-2">
            <span
              aria-hidden
              style={{ opacity: segment.opacity }}
              className={`inline-block h-2.5 w-2.5 ${segment.isBrand ? "bg-ink" : "bg-graphite"}`}
            />
            <span className={`font-mono text-mono ${segment.isBrand ? "text-ink" : "text-graphite"}`}>
              {segment.entityName}
            </span>
            <span className="font-mono text-mono tabular-nums text-graphite">
              {segment.share}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
