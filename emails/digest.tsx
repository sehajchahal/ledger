import { Fragment } from "react";
import {
  Body,
  Column,
  Container,
  Head,
  Hr,
  Html,
  Link,
  Preview,
  Row,
  Section,
  Text,
} from "@react-email/components";

/**
 * The digest.
 *
 * Built as tables with inline styles because Outlook renders mail with Word's
 * engine: no flexbox, no grid, no SVG, no external stylesheet. The presence
 * strip is therefore a row of table cells rather than the inline SVG the app
 * uses — the same data, drawn with the only primitive that survives.
 *
 * Custom fonts do not load reliably in mail, so this uses the same Georgia /
 * Courier split the app's serif and mono achieve, which degrades sensibly.
 */

const INK = "#16150F";
const PAPER = "#FBFAF7";
const RULE = "#E3E0D8";
const GRAPHITE = "#6B6862";
const SIGNAL = "#14713B";
const ALERT = "#A8321E";

const serif = "Georgia, 'Times New Roman', serif";
const mono = "'JetBrains Mono', Consolas, 'Courier New', monospace";

export type DigestTick = "hit" | "miss" | "drop";

export type DigestAction = {
  id: string;
  title: string;
  promptText: string | null;
  approveUrl: string;
};

export type DigestProps = {
  brandName: string;
  periodLabel: string;
  visibility: number;
  delta: number | null;
  hits: number;
  probes: number;
  ticks: DigestTick[];
  headlines: string[];
  actions: DigestAction[];
  dashboardUrl: string;
  isDemoData: boolean;
};

function tickColour(tick: DigestTick): string {
  if (tick === "hit") return INK;
  if (tick === "drop") return ALERT;
  return RULE;
}

/** The strip, as table cells. One 3px cell per tick, 2px spacer between. */
function PresenceTable({ ticks }: { ticks: DigestTick[] }) {
  return (
    <table
      cellPadding={0}
      cellSpacing={0}
      role="presentation"
      style={{ borderCollapse: "collapse", margin: "0 0 8px" }}
    >
      <tbody>
        <tr>
          {ticks.map((tick, i) => (
            <Fragment key={i}>
              <td
                width={3}
                height={22}
                style={{
                  width: "3px",
                  height: "22px",
                  backgroundColor: tickColour(tick),
                  fontSize: 0,
                  lineHeight: 0,
                }}
              >
                &nbsp;
              </td>
              {i < ticks.length - 1 ? (
                <td width={2} style={{ width: "2px", fontSize: 0, lineHeight: 0 }}>
                  &nbsp;
                </td>
              ) : null}
            </Fragment>
          ))}
        </tr>
      </tbody>
    </table>
  );
}

export function DigestEmail({
  brandName,
  periodLabel,
  visibility,
  delta,
  hits,
  probes,
  ticks,
  headlines,
  actions,
  dashboardUrl,
  isDemoData,
}: DigestProps) {
  const deltaText =
    delta === null ? "no previous run" : `${delta > 0 ? "+" : ""}${delta}pt`;
  const deltaColour = delta === null ? GRAPHITE : delta > 0 ? SIGNAL : delta < 0 ? ALERT : GRAPHITE;

  return (
    <Html lang="en">
      <Head />
      <Preview>{`${brandName} is named in ${visibility}% of answers (${deltaText})`}</Preview>
      <Body style={{ backgroundColor: PAPER, margin: 0, padding: "24px 0", fontFamily: serif }}>
        <Container style={{ maxWidth: "600px", margin: "0 auto", padding: "0 24px" }}>
          <Text style={{ fontFamily: mono, fontSize: "11px", letterSpacing: "0.08em", textTransform: "uppercase", color: GRAPHITE, margin: "0 0 4px" }}>
            Ledger · {periodLabel}
          </Text>
          <Text style={{ fontSize: "20px", color: INK, margin: "0 0 16px", fontWeight: 500 }}>
            {brandName}
          </Text>

          <Hr style={{ borderColor: RULE, borderWidth: "1px 0 0", margin: "0 0 20px" }} />

          {isDemoData ? (
            <Section style={{ border: `1px solid #B4740E`, padding: "10px 12px", marginBottom: "20px" }}>
              <Text style={{ fontSize: "13px", color: GRAPHITE, margin: 0 }}>
                These answers were generated locally because no answer engine key is
                configured. They are not a measurement.
              </Text>
            </Section>
          ) : null}

          {/* The number, and the change beside it. */}
          <Row>
            <Column>
              <Text style={{ fontFamily: mono, fontSize: "40px", color: INK, margin: "0 0 4px", fontWeight: 500 }}>
                {visibility}%
              </Text>
            </Column>
            <Column style={{ verticalAlign: "bottom", paddingBottom: "10px", paddingLeft: "12px" }}>
              <Text style={{ fontFamily: mono, fontSize: "13px", color: deltaColour, margin: 0 }}>
                {deltaText}
              </Text>
              <Text style={{ fontFamily: mono, fontSize: "13px", color: GRAPHITE, margin: 0 }}>
                {hits}/{probes} probes
              </Text>
            </Column>
          </Row>

          <Text style={{ fontFamily: mono, fontSize: "11px", letterSpacing: "0.08em", textTransform: "uppercase", color: GRAPHITE, margin: "16px 0 8px" }}>
            Presence, oldest first
          </Text>
          <PresenceTable ticks={ticks} />
          <Text style={{ fontFamily: mono, fontSize: "11px", color: GRAPHITE, margin: "0 0 20px" }}>
            dark = named · light = absent · red = position lost
          </Text>

          <Hr style={{ borderColor: RULE, borderWidth: "1px 0 0", margin: "0 0 20px" }} />

          {/* Plain sentences, not a chart. */}
          <Text style={{ fontFamily: mono, fontSize: "11px", letterSpacing: "0.08em", textTransform: "uppercase", color: GRAPHITE, margin: "0 0 8px" }}>
            What changed
          </Text>
          {headlines.length === 0 ? (
            <Text style={{ fontSize: "15px", color: GRAPHITE, margin: "0 0 20px" }}>
              Nothing moved since the last check.
            </Text>
          ) : (
            headlines.map((line) => (
              <Text key={line} style={{ fontSize: "15px", color: INK, margin: "0 0 8px", lineHeight: 1.5 }}>
                {line}
              </Text>
            ))
          )}

          {actions.length > 0 ? (
            <>
              <Hr style={{ borderColor: RULE, borderWidth: "1px 0 0", margin: "20px 0" }} />
              <Text style={{ fontFamily: mono, fontSize: "11px", letterSpacing: "0.08em", textTransform: "uppercase", color: GRAPHITE, margin: "0 0 12px" }}>
                Waiting on you
              </Text>

              {actions.map((action) => (
                <Section
                  key={action.id}
                  style={{ border: `1px solid ${RULE}`, padding: "14px", marginBottom: "12px" }}
                >
                  {action.promptText ? (
                    <Text style={{ fontFamily: mono, fontSize: "12px", color: GRAPHITE, margin: "0 0 6px" }}>
                      {action.promptText}
                    </Text>
                  ) : null}
                  <Text style={{ fontSize: "15px", color: INK, margin: "0 0 12px", lineHeight: 1.4 }}>
                    {action.title}
                  </Text>

                  {/* A table-wrapped link, because Outlook ignores padding on <a>. */}
                  <table cellPadding={0} cellSpacing={0} role="presentation">
                    <tbody>
                      <tr>
                        <td style={{ backgroundColor: INK, padding: "9px 16px" }}>
                          <Link
                            href={action.approveUrl}
                            style={{
                              fontFamily: mono,
                              fontSize: "11px",
                              letterSpacing: "0.08em",
                              textTransform: "uppercase",
                              color: PAPER,
                              textDecoration: "none",
                            }}
                          >
                            Approve
                          </Link>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </Section>
              ))}

              <Text style={{ fontSize: "13px", color: GRAPHITE, margin: "0 0 20px", lineHeight: 1.5 }}>
                Approving records the decision. It does not change your site — you still
                ship the change yourself, then mark it shipped so Ledger can re-check it.
              </Text>
            </>
          ) : null}

          <Hr style={{ borderColor: RULE, borderWidth: "1px 0 0", margin: "20px 0" }} />

          <Text style={{ fontFamily: mono, fontSize: "12px", margin: "0 0 8px" }}>
            <Link href={dashboardUrl} style={{ color: INK }}>
              Open Ledger
            </Link>
          </Text>
          <Text style={{ fontFamily: mono, fontSize: "11px", color: GRAPHITE, margin: 0, lineHeight: 1.5 }}>
            Ledger reports what answer engines said. It does not promise that any change
            will make a model mention you.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export default DigestEmail;
