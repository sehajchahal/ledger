import "../lib/env";
import { client } from "../lib/db";
import { detectChanges } from "../lib/agent/changes";
import { buildDigest, digestTargets, isDue, markSent } from "../lib/email/digest";
import { sendMail } from "../lib/email/send";

/**
 * Sends every digest that is due.
 *
 *   npm run digest            send what is due
 *   npm run digest -- --force send regardless of cadence
 *   npm run digest -- --dry   build and print, send nothing, mark nothing
 *
 * Intended to run hourly on a schedule. A digest whose visibility dropped by
 * more than its threshold is sent immediately regardless of cadence, if the
 * workspace asked for that.
 */
async function main() {
  const force = process.argv.includes("--force");
  const dry = process.argv.includes("--dry");

  const targets = await digestTargets();
  if (targets.length === 0) {
    console.log("no digests configured");
    return;
  }

  let sent = 0;

  for (const target of targets) {
    const report = await detectChanges(target.brandId);
    const dropped = -report.visibilityDelta;

    const urgent =
      target.alertImmediately && dropped >= target.dropThreshold && report.previousRunId !== null;

    if (!force && !urgent && !isDue(target)) {
      console.log(`skip  ${target.brandName} — ${target.cadence}, not due`);
      continue;
    }

    const digest = await buildDigest(target.brandId, {
      cadence: target.cadence,
      to: target.recipientEmail,
    });

    if (!digest) {
      console.log(`skip  ${target.brandName} — nothing measured yet`);
      continue;
    }

    if (urgent) {
      console.log(`alert ${target.brandName} — down ${dropped}pt, over the ${target.dropThreshold}pt threshold`);
    }

    if (dry) {
      console.log(`\n── ${target.brandName} → ${digest.to}`);
      console.log(`   subject: ${digest.subject}`);
      console.log(`   html:    ${digest.html.length} bytes`);
      console.log(`   actions: ${digest.props.actions.length}`);
      for (const line of digest.props.headlines) console.log(`   · ${line}`);
      continue;
    }

    const { sent: delivered } = await sendMail(digest);
    if (!dry) await markSent(target.digestId);
    sent++;

    console.log(`${delivered ? "sent " : "wrote"} ${target.brandName} → ${digest.to}`);
  }

  console.log(`\n${dry ? "dry run" : `${sent} digest${sent === 1 ? "" : "s"}`}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => client.end());
