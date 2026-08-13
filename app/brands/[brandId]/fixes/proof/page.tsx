import Link from "next/link";
import { EmptyState, PageTitle, Table, TD, TH, THead, TR } from "@/components/ui";
import { listProofRows } from "@/lib/db/queries/fixes";

/**
 * The Proof view: every shipped action in the order it shipped, with what the
 * re-check found.
 *
 * Nothing is filtered, sorted by outcome, or hidden. Actions that made things
 * worse appear in the same table, in the same type size, with a minus sign.
 * A record that only showed wins would not be worth forwarding to anyone.
 */
export default async function ProofPage({
  params,
}: PageProps<"/brands/[brandId]/fixes/proof">) {
  const { brandId } = await params;
  const rows = await listProofRows(brandId);

  const resolved = rows.filter((row) => row.verification.kind === "resolved");
  const net = resolved.reduce(
    (sum, row) => sum + (row.verification.kind === "resolved" ? row.verification.delta : 0),
    0,
  );

  return (
    <>
      <PageTitle
        aside={
          <span className="flex items-center gap-4">
            <Link
              href={`/brands/${brandId}/fixes`}
              className="font-mono text-mono text-graphite hover:text-ink hover:underline"
            >
              ← Fixes
            </Link>
            {rows.length > 0 ? (
              <a
                href={`/brands/${brandId}/fixes/proof/export`}
                className="font-mono text-mono text-graphite hover:text-ink hover:underline"
              >
                Export CSV
              </a>
            ) : null}
          </span>
        }
      >
        Proof
      </PageTitle>

      {rows.length === 0 ? (
        <EmptyState action="Mark a fix as shipped">
          Nothing has shipped yet. Once you mark a fix as shipped, Ledger records the run it
          is measured against and re-checks that prompt 14 days later.
        </EmptyState>
      ) : (
        <>
          <p className="mb-6 max-w-prose text-prose-s text-graphite">
            Every fix that has shipped, in order, with the measured change on the prompt it
            addressed. Results that went the wrong way are listed the same as any other.
          </p>

          <Table>
            <THead>
              <TH>Shipped</TH>
              <TH>Fix</TH>
              <TH>Prompt</TH>
              <TH align="right">Before</TH>
              <TH align="right">After</TH>
              <TH align="right">Change</TH>
            </THead>
            <tbody>
              {rows.map((row) => {
                const state = row.verification;
                const points =
                  state.kind === "resolved" ? Math.round(state.delta * 100) : null;

                return (
                  <TR key={row.action.id}>
                    <TD mono>{row.shippedAt.toISOString().slice(0, 10)}</TD>
                    <TD>{row.action.title}</TD>
                    <TD mono className="text-graphite">
                      {row.promptText ?? "—"}
                    </TD>
                    <TD mono align="right">
                      {state.kind === "resolved" ? `${Math.round(state.before * 100)}%` : "—"}
                    </TD>
                    <TD mono align="right">
                      {state.kind === "resolved" ? `${Math.round(state.after * 100)}%` : "—"}
                    </TD>
                    <TD mono align="right">
                      {points === null ? (
                        <span className="text-amber">
                          {state.kind === "pending" ? `in ${state.daysLeft}d` : "not scheduled"}
                        </span>
                      ) : (
                        <span
                          className={
                            points > 0 ? "text-signal" : points < 0 ? "text-alert" : undefined
                          }
                        >
                          {points > 0 ? "+" : ""}
                          {points}pt
                        </span>
                      )}
                    </TD>
                  </TR>
                );
              })}
            </tbody>
          </Table>

          {resolved.length > 0 ? (
            <p className="mt-4 font-mono text-mono text-graphite">
              {resolved.length} of {rows.length} verified · net{" "}
              <span
                className={
                  net > 0 ? "text-signal" : net < 0 ? "text-alert" : undefined
                }
              >
                {net > 0 ? "+" : ""}
                {Math.round(net * 100)}pt
              </span>{" "}
              across the prompts these fixes addressed
            </p>
          ) : null}
        </>
      )}
    </>
  );
}
