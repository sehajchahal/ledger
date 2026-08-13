import Link from "next/link";

export const metadata = { title: "Check your email · Ledger" };

const HAS_SMTP = Boolean(process.env.EMAIL_SERVER_HOST && process.env.EMAIL_FROM);

export default function CheckEmailPage() {
  return (
    <div className="mx-auto max-w-[460px] px-5 py-16 sm:px-8">
      <Link href="/" className="font-display text-prose font-medium">
        Ledger
      </Link>

      <h1 className="mt-10 mb-3 font-display text-display-m">Check your email</h1>

      {HAS_SMTP ? (
        <p className="text-prose-s text-graphite">
          A sign-in link is on its way. It works once and expires in 24 hours. If it does
          not arrive in a minute, check the spam folder.
        </p>
      ) : (
        <>
          <p className="mb-4 text-prose-s text-graphite">
            No mail server is configured on this deployment, so the link was printed to the
            server log instead of being sent.
          </p>
          <p className="font-mono text-mono text-graphite">
            Look for &ldquo;Ledger sign-in link&rdquo; in the terminal running{" "}
            <span className="text-ink">npm run dev</span>.
          </p>
        </>
      )}
    </div>
  );
}
