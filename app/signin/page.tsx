import Link from "next/link";
import { redirect } from "next/navigation";
import { signIn } from "@/auth";
import { Button } from "@/components/ui";
import { currentUser } from "@/lib/auth/session";

export const metadata = { title: "Sign in · Ledger" };

export default async function SignInPage({ searchParams }: PageProps<"/signin">) {
  const { next } = await searchParams;
  if (await currentUser()) redirect(typeof next === "string" ? next : "/brands");

  return (
    <div className="mx-auto max-w-[460px] px-5 py-16 sm:px-8">
      <Link href="/" className="font-display text-prose font-medium">
        Ledger
      </Link>

      <h1 className="mt-10 mb-3 font-display text-display-m">Sign in</h1>
      <p className="mb-8 text-prose-s text-graphite">
        Enter your email and we will send a link that signs you in. There is no password to
        remember or reset.
      </p>

      <form
        action={async (formData: FormData) => {
          "use server";
          const email = String(formData.get("email") ?? "").trim();
          if (!email) return;

          await signIn("nodemailer", {
            email,
            redirectTo: typeof next === "string" ? next : "/brands",
          });
        }}
      >
        <label htmlFor="email" className="label mb-2 block text-graphite">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoFocus
          autoComplete="email"
          placeholder="you@company.com"
          className="w-full border border-rule bg-paper px-3 py-2 font-mono text-mono focus:border-ink"
        />
        <div className="mt-4">
          <Button type="submit">Send me a link</Button>
        </div>
      </form>
    </div>
  );
}
