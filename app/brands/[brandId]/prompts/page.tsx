import Link from "next/link";
import { notFound } from "next/navigation";
import { AnswerText } from "@/components/answer-text";
import { PresenceStrip } from "@/components/presence-strip";
import { AddPromptForm, EditPromptForm } from "@/components/prompt-forms";
import {
  Badge,
  EmptyState,
  PageTitle,
  SectionHead,
  Table,
  TD,
  TH,
  THead,
  TR,
} from "@/components/ui";
import {
  enginesInLatestRun,
  getPromptDetail,
  listPromptRows,
} from "@/lib/db/queries/prompts";
import { can, requireBrandAccess } from "@/lib/auth/session";

export default async function PromptsPage({
  params,
  searchParams,
}: PageProps<"/brands/[brandId]/prompts">) {
  const { brandId } = await params;
  const { prompt: selectedId, model: modelParam } = await searchParams;

  const access = await requireBrandAccess(brandId);
  const canEdit = can(access.role, "manageBrand");

  const engines = await enginesInLatestRun(brandId);
  // Only honour a filter for an engine that actually answered, so a stale link
  // shows the full picture rather than an empty table.
  const model = typeof modelParam === "string" && engines.includes(modelParam) ? modelParam : undefined;

  const rows = await listPromptRows(brandId, { model });
  const selected =
    typeof selectedId === "string"
      ? await getPromptDetail(brandId, selectedId, { model })
      : null;

  if (typeof selectedId === "string" && !selected) notFound();

  const active = rows.filter((row) => row.active).length;

  return (
    <>
      <PageTitle
        aside={
          <span className="font-mono text-mono text-graphite">
            {active} active · {rows.length} total
          </span>
        }
      >
        Prompts
      </PageTitle>

      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        {canEdit ? <AddPromptForm brandId={brandId} /> : <span />}

        {engines.length > 1 ? (
          <div className="flex flex-wrap items-center gap-3">
            <span className="label text-graphite">engine</span>
            {[undefined, ...engines].map((engine) => {
              const active = model === engine;
              const query = new URLSearchParams();
              if (engine) query.set("model", engine);
              if (typeof selectedId === "string") query.set("prompt", selectedId);
              const href = `/brands/${brandId}/prompts${query.size ? `?${query}` : ""}`;

              return (
                <Link
                  key={engine ?? "all"}
                  href={href}
                  scroll={false}
                  aria-current={active ? "true" : undefined}
                  className={`font-mono text-mono ${
                    active ? "text-ink underline" : "text-graphite hover:text-ink"
                  }`}
                >
                  {engine ?? "both"}
                </Link>
              );
            })}
          </div>
        ) : null}
      </div>

      {rows.length === 0 ? (
        <EmptyState action={canEdit ? "Add prompt" : undefined}>
          There are no prompts yet. A prompt is a question a real buyer would type — the
          product measures whether you show up in the answer.
        </EmptyState>
      ) : (
        <div className={selected ? "grid gap-8 lg:grid-cols-[1fr_380px]" : undefined}>
          <Table>
            <THead>
              <TH>Prompt</TH>
              <TH>Intent</TH>
              <TH align="right">Rate</TH>
              <TH>Presence</TH>
              <TH align="right">First mention</TH>
            </THead>
            <tbody>
              {rows.map((row) => (
                <TR key={row.id} selected={selected?.prompt.id === row.id}>
                  <TD mono className="max-w-[26rem]">
                    <Link
                      href={`/brands/${brandId}/prompts?prompt=${row.id}${model ? `&model=${encodeURIComponent(model)}` : ""}`}
                      scroll={false}
                      className="block hover:underline"
                    >
                      {row.text}
                    </Link>
                    {!row.active ? (
                      <span className="label mt-1 block text-graphite">inactive</span>
                    ) : null}
                  </TD>
                  <TD>
                    <Badge>{row.intent}</Badge>
                  </TD>
                  <TD mono align="right">
                    {row.rate.probes === 0 ? (
                      <span className="text-graphite">—</span>
                    ) : (
                      <span className={row.rate.hits === 0 ? "text-alert" : undefined}>
                        {row.rate.hits}/{row.rate.probes}
                      </span>
                    )}
                  </TD>
                  <TD>
                    <PresenceStrip
                      ticks={row.ticks}
                      label={`Presence for "${row.text}" across recent runs`}
                    />
                  </TD>
                  <TD mono align="right">
                    {row.firstMentionPosition === null ? (
                      <span className="text-graphite">absent</span>
                    ) : (
                      `char ${row.firstMentionPosition}`
                    )}
                  </TD>
                </TR>
              ))}
            </tbody>
          </Table>

          {selected ? (
            <aside className="border-l border-rule pl-8">
              <div className="sticky top-8">
                <SectionHead
                  note={
                    <Link
                      href={`/brands/${brandId}/prompts${model ? `?model=${encodeURIComponent(model)}` : ""}`}
                      scroll={false}
                      className="hover:underline"
                    >
                      close
                    </Link>
                  }
                >
                  Answer
                </SectionHead>

                <p className="mb-4 font-mono text-mono">{selected.prompt.text}</p>

                <div className="mb-5 flex flex-wrap items-center gap-3">
                  <Badge>{selected.prompt.intent}</Badge>
                  <span className="font-mono text-mono text-graphite">
                    {selected.rate.hits}/{selected.rate.probes} probes
                  </span>
                  {selected.answer ? (
                    <>
                      <span className="font-mono text-mono text-graphite">
                        probe {selected.answer.probeIndex + 1} of {selected.probeCount}
                      </span>
                      <span className="font-mono text-mono text-graphite">
                        {selected.answer.model}
                      </span>
                    </>
                  ) : null}
                </div>

                {selected.answer ? (
                  <>
                    <AnswerText
                      text={selected.answer.rawText}
                      entities={selected.entities}
                    />

                    {selected.answer.citations.length > 0 ? (
                      <div className="mt-6">
                        <SectionHead>Sources cited</SectionHead>
                        <ul className="space-y-1">
                          {selected.answer.citations.map((url) => (
                            <li key={url} className="truncate font-mono text-mono text-graphite">
                              <a href={url} rel="noopener noreferrer" target="_blank" className="hover:text-ink hover:underline">
                                {url}
                              </a>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                  </>
                ) : (
                  <EmptyState>
                    This prompt has not been answered in a completed run yet.
                  </EmptyState>
                )}

                {canEdit ? (
                <div className="mt-8 border-t border-rule pt-5">
                  <EditPromptForm
                    brandId={brandId}
                    promptId={selected.prompt.id}
                    text={selected.prompt.text}
                    intent={selected.prompt.intent}
                    active={selected.prompt.active}
                  />
                </div>
                ) : null}
              </div>
            </aside>
          ) : null}
        </div>
      )}
    </>
  );
}
