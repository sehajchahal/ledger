import { notFound } from "next/navigation";
import { AggregatePresenceStrip } from "@/components/aggregate-presence-strip";
import { RunChecksButton } from "@/components/run-checks-button";
import { ShareOfVoice } from "@/components/share-of-voice";
import {
  Delta,
  DemoDataNotice,
  EmptyState,
  Metric,
  PageTitle,
  SampleSize,
  SectionHead,
} from "@/components/ui";
import { getBrandOverview, HISTORY_RUNS } from "@/lib/db/queries/overview";
import { can, requireBrandAccess } from "@/lib/auth/session";

export default async function OverviewPage({ params }: PageProps<"/brands/[brandId]">) {
  const { brandId } = await params;
  const access = await requireBrandAccess(brandId);
  const overview = await getBrandOverview(brandId);
  if (!overview) notFound();

  // Absent, not disabled: a viewer should not see a control they cannot use.
  const canRun = can(access.role, "runChecks");

  const { brand, latest, delta, activePrompts, aggregateTicks, runsCounted } = overview;
  const running = overview.inFlight !== null;

  return (
    <>
      <PageTitle
        aside={
          <span className="font-mono text-mono text-graphite">{brand.domain}</span>
        }
      >
        Overview
      </PageTitle>

      {overview.isDemoData && <DemoDataNotice />}

      {/* Visibility, the delta beside it, and when we last checked. */}
      <section className="mb-12">
        <SectionHead note={latest ? `${runsCounted} runs on record` : undefined}>
          Visibility
        </SectionHead>

        {latest ? (
          <div className="flex flex-wrap items-end gap-x-8 gap-y-3">
            <Metric value={latest.percent} suffix="%" />
            <div className="flex flex-col gap-1 pb-2">
              <Delta value={delta} />
              <SampleSize hits={latest.hits} probes={latest.probes} />
            </div>
            <div className="flex flex-col gap-1 pb-2">
              <span className="label text-graphite">last checked</span>
              <time
                dateTime={latest.completedAt?.toISOString()}
                className="font-mono text-mono tabular-nums"
              >
                {formatTimestamp(latest.completedAt ?? latest.startedAt)}
              </time>
            </div>
            {canRun ? (
              <div className="ml-auto pb-2">
                <RunChecksButton
                  brandId={brandId}
                  running={running}
                  promptCount={activePrompts}
                />
              </div>
            ) : null}
          </div>
        ) : (
          <EmptyState
            action={
              canRun ? (
                <RunChecksButton
                  brandId={brandId}
                  running={running}
                  promptCount={activePrompts}
                />
              ) : null
            }
          >
            {running
              ? `Running now — ${overview.inFlight?.stored ?? 0} of ${overview.inFlight?.expected ?? activePrompts * 3} answers stored. Each of your ${activePrompts} prompts is asked three times, and every answer is kept whole.`
              : `Nothing has been measured yet. A run asks all ${activePrompts} prompts three times each and records which brands each answer recommends.`}
          </EmptyState>
        )}
      </section>

      {/* The comb: one tick per prompt per run. */}
      <section className="mb-12">
        <SectionHead
          note={
            aggregateTicks.length > 0
              ? `${activePrompts} prompts · last ${Math.min(runsCounted, HISTORY_RUNS)} runs`
              : undefined
          }
        >
          Presence
        </SectionHead>

        {aggregateTicks.length > 0 ? (
          <>
            <AggregatePresenceStrip
              ticks={aggregateTicks}
              label={`Brand presence per prompt across the last ${runsCounted} runs`}
            />
            <p className="mt-3 max-w-prose text-prose-s text-graphite">
              One tick per prompt per run, oldest on the left. A full tick means the brand
              appeared in most of that prompt&rsquo;s probes. A red tick means a position
              held in the previous run was lost.
            </p>
          </>
        ) : (
          <EmptyState>
            The strip fills in once there is a completed run to draw from.
          </EmptyState>
        )}
      </section>

      {/* Who the models actually name. */}
      <section>
        <SectionHead note={latest ? "last run" : undefined}>Share of voice</SectionHead>
        {latest ? (
          <ShareOfVoice shares={overview.shareOfVoice} />
        ) : (
          <EmptyState>
            Share of voice compares how often each brand is named. It needs one completed
            run.
          </EmptyState>
        )}
      </section>
    </>
  );
}

function formatTimestamp(value: Date | null): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-CA", {
    dateStyle: "medium",
    timeStyle: "short",
    hour12: false,
  }).format(value);
}
