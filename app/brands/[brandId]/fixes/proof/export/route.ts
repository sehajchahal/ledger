import { listProofRows } from "@/lib/db/queries/fixes";

/** RFC 4180 quoting: wrap in quotes, double any quote inside. */
function cell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  return `"${String(value).replace(/"/g, '""')}"`;
}

export async function GET(_request: Request, context: RouteContext<"/brands/[brandId]/fixes/proof/export">) {
  const { brandId } = await context.params;
  const rows = await listProofRows(brandId);

  const header = [
    "shipped_at",
    "type",
    "title",
    "prompt",
    "status",
    "before_rate",
    "after_rate",
    "change_points",
    "checked_at",
  ];

  const lines = [header.join(",")];

  for (const row of rows) {
    const state = row.verification;

    lines.push(
      [
        cell(row.shippedAt.toISOString().slice(0, 10)),
        cell(row.action.type),
        cell(row.action.title),
        cell(row.promptText),
        cell(state.kind === "resolved" ? "verified" : state.kind),
        cell(state.kind === "resolved" ? state.before.toFixed(2) : ""),
        cell(state.kind === "resolved" ? state.after.toFixed(2) : ""),
        cell(state.kind === "resolved" ? Math.round(state.delta * 100) : ""),
        cell(state.kind === "resolved" ? state.checkedAt.toISOString().slice(0, 10) : ""),
      ].join(","),
    );
  }

  return new Response(lines.join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="ledger-proof-${brandId.slice(0, 8)}.csv"`,
    },
  });
}
