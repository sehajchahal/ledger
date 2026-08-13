import { authorizeCron } from "@/lib/cron";
import { detectChanges } from "@/lib/agent/changes";
import { buildDigest, digestTargets, isDue, markSent } from "@/lib/email/digest";
import { sendMail } from "@/lib/email/send";
import { errorContext, log } from "@/lib/log";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Sends digests that are due. Scheduled hourly.
 *
 * Hourly rather than daily because a workspace can ask to be told immediately
 * when visibility falls past its threshold, and "immediately" has to mean
 * something. Cadence is still respected for everything else.
 */
export async function GET(request: Request) {
  const auth = authorizeCron(request);
  if (!auth.ok) return auth.response;

  const targets = await digestTargets();
  let sent = 0;
  let skipped = 0;

  for (const target of targets) {
    try {
      const report = await detectChanges(target.brandId);
      const dropped = -report.visibilityDelta;
      const urgent =
        target.alertImmediately &&
        dropped >= target.dropThreshold &&
        report.previousRunId !== null;

      if (!urgent && !isDue(target)) {
        skipped++;
        continue;
      }

      const digest = await buildDigest(target.brandId, {
        cadence: target.cadence,
        to: target.recipientEmail,
      });

      if (!digest) {
        skipped++;
        continue;
      }

      await sendMail(digest);
      await markSent(target.digestId);
      sent++;

      log.info("digest sent", {
        brandId: target.brandId,
        cadence: target.cadence,
        urgent,
      });
    } catch (error) {
      // One broken digest must not stop the others.
      log.error("digest failed", { brandId: target.brandId, ...errorContext(error) });
    }
  }

  return Response.json({ targets: targets.length, sent, skipped });
}
