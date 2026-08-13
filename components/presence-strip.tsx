/**
 * The presence strip. Answers "were we in the answer, over time" in one glance.
 *
 * Geometry is fixed by DESIGN.md and is not configurable: 3px ticks on a 5px
 * pitch, 22px teeth, a 2px baseline stub for a miss, a 1px baseline underneath.
 * It scales by adding ticks, never by stretching them, which is what keeps it
 * reading as a comb rather than a bar chart.
 *
 * Misses are drawn in graphite rather than the border colour. On a near-black
 * surface a border-coloured stub disappears entirely, and the strip stops
 * reading as a comb with gaps — it reads as a few bars floating in space, which
 * loses the whole point of showing absence.
 */

export type Tick = "hit" | "miss" | "drop";

export const TICK_WIDTH = 3;
export const TICK_PITCH = 5;
const TOOTH_HEIGHT = 22;
const STUB_HEIGHT = 2;
const BASELINE_Y = 22;
const VIEWBOX_HEIGHT = 24;

/** Ticks that fit in a container of the given pixel width. */
export function ticksThatFit(width: number): number {
  return Math.max(0, Math.floor((width + TICK_PITCH - TICK_WIDTH) / TICK_PITCH));
}

export function stripWidth(count: number): number {
  return count === 0 ? 0 : count * TICK_PITCH - (TICK_PITCH - TICK_WIDTH);
}

export function PresenceStrip({
  ticks,
  label,
  className,
}: {
  ticks: readonly Tick[];
  /** Accessible description. The strip is data, so it always gets one. */
  label: string;
  className?: string;
}) {
  const width = stripWidth(ticks.length);

  if (ticks.length === 0) {
    return (
      <div className={className}>
        <span className="label text-graphite">no runs yet</span>
      </div>
    );
  }

  return (
    <svg
      className={className}
      width={width}
      height={VIEWBOX_HEIGHT}
      viewBox={`0 0 ${width} ${VIEWBOX_HEIGHT}`}
      role="img"
      aria-label={label}
      shapeRendering="crispEdges"
    >
      <rect x={0} y={BASELINE_Y} width={width} height={1} className="fill-graphite/25" />
      {ticks.map((tick, i) => {
        const x = i * TICK_PITCH;

        if (tick === "miss") {
          return (
            <rect
              key={i}
              x={x}
              y={BASELINE_Y - STUB_HEIGHT}
              width={TICK_WIDTH}
              height={STUB_HEIGHT}
              className="fill-graphite/55"
            />
          );
        }

        return (
          <rect
            key={i}
            x={x}
            y={0}
            width={TICK_WIDTH}
            height={TOOTH_HEIGHT}
            className={tick === "drop" ? "fill-alert" : "fill-ink"}
          />
        );
      })}
    </svg>
  );
}
