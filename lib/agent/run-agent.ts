import { generateActionsForBrand } from "@/lib/actions/generate";
import { detectChanges, type ChangeReport } from "@/lib/agent/changes";

/**
 * The scheduled agent.
 *
 * Its job is not to email a summary. It is to notice a change, prepare a fix,
 * and put a decision in front of someone. Runs after every full run.
 *
 * It only proposes for prompts that were actually lost since the previous run.
 * Proposing for everything the brand is missing from is the Fixes page's job,
 * on demand — an agent that generated six fixes every night would burn the plan
 * allowance and train people to ignore it.
 */

export type AgentResult = {
  report: ChangeReport;
  proposed: number;
  /** Present when nothing was proposed and there is a reason worth surfacing. */
  reason?: string;
};

export async function runAgentForBrand(brandId: string): Promise<AgentResult> {
  const report = await detectChanges(brandId);

  if (report.losses.length === 0) {
    return { report, proposed: 0, reason: "No prompt was lost since the previous run." };
  }

  const result = await generateActionsForBrand(brandId, {
    promptIds: report.losses.map((loss) => loss.promptId),
    limit: report.losses.length,
  });

  return { report, proposed: result.created, reason: result.reason };
}
