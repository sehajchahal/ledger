import { DrizzleAdapter } from "@auth/drizzle-adapter";
import NextAuth from "next-auth";
import Nodemailer from "next-auth/providers/nodemailer";
import { getDb } from "@/lib/db";
import { accounts, sessions, users, verificationTokens } from "@/lib/db/schema";

/**
 * Email magic link, no passwords.
 *
 * When no SMTP server is configured the link is printed to the server log
 * instead of being sent. That keeps local development working without standing
 * up a mail server, and it fails loudly in production because `AUTH_SECRET` is
 * required there.
 */

const hasSmtp = Boolean(process.env.EMAIL_SERVER_HOST && process.env.EMAIL_FROM);

/**
 * Built once, on first request rather than on import.
 *
 * DrizzleAdapter reads the database object to detect its dialect, so it needs a
 * real connection — and `next build` imports this module while collecting route
 * config, on a machine with no database. Deferring construction keeps the build
 * independent of infrastructure.
 */
let adapter: ReturnType<typeof DrizzleAdapter> | undefined;

function drizzleAdapter() {
  adapter ??= DrizzleAdapter(getDb(), {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  });
  return adapter;
}

export const { handlers, auth, signIn, signOut } = NextAuth(() => ({
  adapter: drizzleAdapter(),
  session: { strategy: "database" },
  pages: { signIn: "/signin", verifyRequest: "/signin/check" },
  providers: [
    Nodemailer({
      server: hasSmtp
        ? {
            host: process.env.EMAIL_SERVER_HOST,
            port: Number(process.env.EMAIL_SERVER_PORT ?? 587),
            auth: process.env.EMAIL_SERVER_USER
              ? {
                  user: process.env.EMAIL_SERVER_USER,
                  pass: process.env.EMAIL_SERVER_PASSWORD,
                }
              : undefined,
          }
        : // Never dialled: sendVerificationRequest is overridden below.
          { host: "localhost", port: 25 },
      from: process.env.EMAIL_FROM ?? "ledger@localhost",

      async sendVerificationRequest(params) {
        if (!hasSmtp) {
          console.log(
            [
              "",
              "  ── Ledger sign-in link ────────────────────────────────────",
              `  ${params.identifier}`,
              `  ${params.url}`,
              "  No SMTP configured, so the link is printed here instead of sent.",
              "  ───────────────────────────────────────────────────────────",
              "",
            ].join("\n"),
          );
          return;
        }

        const { createTransport } = await import("nodemailer");
        const transport = createTransport(params.provider.server);

        await transport.sendMail({
          to: params.identifier,
          from: params.provider.from,
          subject: "Your Ledger sign-in link",
          text: `Sign in to Ledger: ${params.url}\n\nThis link works once and expires in 24 hours. If you did not ask for it, ignore this email.`,
        });
      },
    }),
  ],
  callbacks: {
    session({ session, user }) {
      // The app keys everything off the user id, so it has to be on the session.
      if (session.user) session.user.id = user.id;
      return session;
    },
  },
}));
