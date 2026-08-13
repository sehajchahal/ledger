import { notFound } from "next/navigation";
import Link from "next/link";
import { AggregatePresenceStrip } from "@/components/aggregate-presence-strip";
import { RunChecksButton } from "@/components/run-checks-button";
import { ShareOfVoice } from "@/components/share-of-voice";
import {
  Delta,
  DemoDataNotice,
  EmptyState,
  PageTitle,
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
  const missed = latest ? latest.probes - latest.hits : 0;

  return (
    <>
      <PageTitle
        aside={
          <span className="flex items-center gap-3">
            <span className="hidden font-mono text-mono text-graphite sm:inline">
              {brand.domain}
            </span>
            {canRun ? (
              <RunChecksButton
                brandId={brandId}
                running={running}
                promptCount={activePrompts}
              />
            ) : null}
          </span>
        }
      >
        Overview
      </PageTitle>

      {overview.isDemoData && <DemoDataNotice />}

      {latest ? (
        <>
          {/* The headline number, said in words as well as digits — the number
              alone assumes the reader already knows what it measures. */}
          <section className="mb-10">
            <div className="panel p-6 sm:p-8">
              <div className="flex flex-wrap items-end gap-x-10 gap-y-6">
                <div>
                  <p className="label mb-3 text-graphite">how often AI names you</p>
                  <p className="flex items-baseline gap-3">
                    <span className="font-mono text-metric tabular-nums">
                      {latest.percent}
                      <span className="text-display-m text-graphite">%</span>
                    </span>
                    <Delta value={delta} />
                  </p>
                </div>

                <div className="sm:border-l sm:border-rule sm:pl-10">
                  <p className="label mb-3 text-graphite">what that means</p>
                  <p className="max-w-[40ch] text-prose-s text-graphite">
                    You were named in{" "}
                    <span className="text-ink">
                      {latest.hits} of {latest.probes}
                    </span>{" "}
                    answers. That leaves{" "}
                    <span className={missed > 0 ? "text-alert" : "text-signal"}>{missed}</span>{" "}
                    where a buyer asked and someone else got recommended.
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              <Tile
                label="last checked"
                value={formatTimestamp(latest.completedAt ?? latest.startedAt)}
              />
              <Tile label="questions tracked" value={String(activePrompts)} />
              <Tile label="checks on record" value={String(runsCounted)} />
            </div>
          </section>

          {/* The comb: one tick per prompt per run. */}
          <section className="mb-10">
            <SectionHead
              note={
                aggregateTicks.length > 0
                  ? `${activePrompts} questions · last ${Math.min(runsCounted, HISTORY_RUNS)} checks`
                  : undefined
              }
            >
              Every question, every check
            </SectionHead>

            {aggregateTicks.length > 0 ? (
              <div className="panel p-6">
                <AggregatePresenceStrip
                  ticks={aggregateTicks}
                  label={`Brand presence per question across the last ${runsCounted} checks`}
                />
                <div className="mt-5 flex flex-wrap gap-x-6 gap-y-2 border-t border-rule pt-4">
                  <Key tone="bg-ink" text="named in the answer" />
                  <Key tone="bg-graphite/55" text="not named" stub />
                  <Key tone="bg-alert" text="lost a spot you had" />
                </div>
              </div>
            ) : (
              <EmptyState>This fills in once a check has finished.</EmptyState>
            )}
          </section>

          {/* Who the models actually name. */}
          <section>
            <SectionHead note="most recent check">
              You versus the companies named instead
            </SectionHead>
            <div className="panel p-6">
              <ShareOfVoice shares={overview.shareOfVoice} />
              <p className="mt-5 border-t border-rule pt-4 text-prose-s text-graphite">
                Want to know why they are winning?{" "}
                <Link
                  href={`/brands/${brandId}/sources`}
                  className="cursor-pointer text-accent hover:underline"
                >
                  See which websites the AI trusts
                </Link>
                .
              </p>
            </div>
          </section>
        </>
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
            ? `Running now — ${overview.inFlight?.stored ?? 0} of ${overview.inFlight?.expected ?? activePrompts * 3} answers stored. Each of your ${activePrompts} questions is asked three times, and every answer is kept whole.`
            : `Nothing has been checked yet. A check asks all ${activePrompts} of your questions three times each and records which companies the AI recommends.`}
        </EmptyState>
      )}
    </>
  );
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="panel px-5 py-4">
      <p className="label mb-2 text-graphite">{label}</p>
      <p className="font-mono text-mono tabular-nums">{value}</p>
    </div>
  );
}

/**
 * Legend swatch. Shape matches the strip: a full tooth for a hit, a baseline
 * stub for a miss — so the key reads as a sample of the graphic, not a colour
 * chip that happens to sit next to it.
 */
function Key({ tone, text, stub = false }: { tone: string; text: string; stub?: boolean }) {
  return (
    <span className="flex items-center gap-2">
      <span aria-hidden className="inline-flex h-3 w-[3px] items-end">
        <span className={`w-full ${stub ? "h-[2px]" : "h-full"} ${tone}`} />
      </span>
      <span className="font-mono text-mono text-graphite">{text}</span>
    </span>
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
