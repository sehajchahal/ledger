import type { ComponentProps, ReactNode } from "react";

/**
 * Shared primitives. Every rule here comes from DESIGN.md: hairlines instead of
 * shadows, zero border radius, mono for anything measured, sentence case in all
 * copy, and colour that carries meaning rather than decoration.
 */

function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}

/* -------------------------------------------------------------- headings -- */

export function PageTitle({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="mb-8 flex items-baseline justify-between gap-4">
      <h1 className="font-display text-display-m">{children}</h1>
      {aside}
    </div>
  );
}

export function SectionHead({ children, note }: { children: ReactNode; note?: ReactNode }) {
  return (
    <div className="mb-4 flex items-baseline justify-between gap-4 border-b border-rule pb-2">
      <h2 className="label text-graphite">{children}</h2>
      {note ? <span className="font-mono text-mono text-graphite">{note}</span> : null}
    </div>
  );
}

/* --------------------------------------------------------------- buttons -- */

export function Button({
  variant = "primary",
  className,
  ...props
}: ComponentProps<"button"> & { variant?: "primary" | "secondary" }) {
  return (
    <button
      {...props}
      className={cx(
        "label inline-flex h-9 items-center px-4 transition-opacity",
        "disabled:cursor-not-allowed disabled:opacity-40",
        variant === "primary"
          ? "bg-ink text-paper hover:opacity-85"
          : "border border-rule bg-paper text-ink hover:border-ink",
        className,
      )}
    />
  );
}

/* ------------------------------------------------------------- measured -- */

/** The large mono number. Whole numbers only — see DESIGN.md. */
export function Metric({ value, suffix }: { value: number; suffix?: string }) {
  return (
    <span className="font-mono text-metric tabular-nums">
      {value}
      {suffix ? <span className="text-display-m text-graphite">{suffix}</span> : null}
    </span>
  );
}

/**
 * A signed change. Negative deltas get exactly the same weight as positive
 * ones: same size, same placement, no softening. That is the point of the
 * product.
 */
export function Delta({ value, unit = "pt" }: { value: number | null; unit?: string }) {
  if (value === null) {
    return <span className="font-mono text-mono text-graphite">no previous run</span>;
  }

  const tone = value > 0 ? "text-signal" : value < 0 ? "text-alert" : "text-graphite";
  const sign = value > 0 ? "+" : "";

  return (
    <span className={cx("font-mono text-mono tabular-nums", tone)}>
      {sign}
      {value}
      {unit}
    </span>
  );
}

/** Sample size, shown next to any percentage built from under 100 observations. */
export function SampleSize({ hits, probes }: { hits: number; probes: number }) {
  return (
    <span className="font-mono text-mono text-graphite tabular-nums">
      {hits}/{probes}
    </span>
  );
}

export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "signal" | "alert" | "amber" }) {
  const tones = {
    neutral: "border-rule text-graphite",
    signal: "border-signal text-signal",
    alert: "border-alert text-alert",
    amber: "border-amber text-amber",
  } as const;

  return (
    <span className={cx("label inline-flex items-center border px-1.5 py-0.5", tones[tone])}>
      {children}
    </span>
  );
}

/* ---------------------------------------------------------------- tables -- */

export function Table({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cx("overflow-x-auto", className)}>
      <table className="w-full border-collapse text-left">{children}</table>
    </div>
  );
}

export function THead({ children }: { children: ReactNode }) {
  return (
    <thead className="bg-wash">
      <tr className="border-b border-rule">{children}</tr>
    </thead>
  );
}

export function TH({
  children,
  align = "left",
  className,
}: {
  children: ReactNode;
  align?: "left" | "right";
  className?: string;
}) {
  return (
    <th
      scope="col"
      className={cx(
        "label px-3 py-2 font-medium text-graphite",
        align === "right" && "text-right",
        className,
      )}
    >
      {children}
    </th>
  );
}

/** Row hover is a 2px gutter bar, never a fill. No zebra striping, ever. */
export function TR({
  children,
  onClick,
  selected,
}: {
  children: ReactNode;
  onClick?: () => void;
  selected?: boolean;
}) {
  return (
    <tr
      onClick={onClick}
      className={cx(
        "group border-b border-rule",
        onClick && "cursor-pointer",
        selected && "bg-wash",
      )}
    >
      {children}
    </tr>
  );
}

export function TD({
  children,
  align = "left",
  mono,
  className,
}: {
  children: ReactNode;
  align?: "left" | "right";
  mono?: boolean;
  className?: string;
}) {
  return (
    <td
      className={cx(
        "px-3 py-3 align-middle",
        mono ? "font-mono text-mono tabular-nums" : "text-prose-s",
        align === "right" && "text-right",
        className,
      )}
    >
      {children}
    </td>
  );
}

/* ----------------------------------------------------------- empty state -- */

/**
 * One line of prose saying what is missing, one line of mono saying what fixes
 * it. Never a spinner, never an illustration.
 */
export function EmptyState({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="border border-rule px-6 py-10">
      <p className="max-w-prose text-prose-s text-graphite">{children}</p>
      {action ? <div className="mt-3 font-mono text-mono">{action}</div> : null}
    </div>
  );
}

/**
 * Marks values that were generated locally rather than measured. Demo data is
 * never allowed to look like a measurement.
 */
export function DemoDataNotice() {
  return (
    <div className="mb-8 flex flex-wrap items-center gap-3 border border-amber px-3 py-2">
      <Badge tone="amber">demo data</Badge>
      <p className="text-prose-s text-graphite">
        No answer engine key is set, so these answers were generated locally. They are not a
        measurement. Add <span className="font-mono text-mono">PERPLEXITY_API_KEY</span> to{" "}
        <span className="font-mono text-mono">.env.local</span> and run checks again to
        measure for real.
      </p>
    </div>
  );
}
