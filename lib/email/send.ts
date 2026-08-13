/**
 * Sends mail, or prints it when there is no mail server.
 *
 * Same rule as the sign-in link: local development must not require standing up
 * SMTP, and it must be obvious which of the two happened.
 */

export type Mail = { to: string; subject: string; html: string; text: string };

const hasSmtp = () => Boolean(process.env.EMAIL_SERVER_HOST && process.env.EMAIL_FROM);

export async function sendMail(mail: Mail): Promise<{ sent: boolean }> {
  if (!hasSmtp()) {
    console.log(
      [
        "",
        "  ── Ledger email (not sent — no SMTP configured) ───────────",
        `  to:      ${mail.to}`,
        `  subject: ${mail.subject}`,
        "",
        mail.text
          .split("\n")
          .map((line) => `  ${line}`)
          .join("\n"),
        "  ───────────────────────────────────────────────────────────",
        "",
      ].join("\n"),
    );
    return { sent: false };
  }

  const { createTransport } = await import("nodemailer");

  const transport = createTransport({
    host: process.env.EMAIL_SERVER_HOST,
    port: Number(process.env.EMAIL_SERVER_PORT ?? 587),
    auth: process.env.EMAIL_SERVER_USER
      ? {
          user: process.env.EMAIL_SERVER_USER,
          pass: process.env.EMAIL_SERVER_PASSWORD,
        }
      : undefined,
  });

  await transport.sendMail({
    from: process.env.EMAIL_FROM,
    to: mail.to,
    subject: mail.subject,
    html: mail.html,
    text: mail.text,
  });

  return { sent: true };
}
