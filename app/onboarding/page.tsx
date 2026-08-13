import Link from "next/link";
import { OnboardingWizard } from "@/components/onboarding-wizard";
import { PageTitle } from "@/components/ui";

export const metadata = { title: "Set up a brand · Ledger" };

export default function OnboardingPage() {
  return (
    <div className="mx-auto max-w-[760px] px-5 py-10 sm:px-8">
      <header className="mb-10 flex items-center justify-between border-b border-rule pb-5">
        <Link href="/" className="font-display text-prose font-medium">
          Ledger
        </Link>
        <Link href="/brands" className="label text-graphite hover:text-ink">
          Skip to app
        </Link>
      </header>

      <PageTitle>Set up a brand</PageTitle>
      <p className="mb-10 max-w-prose text-prose text-graphite">
        Two screens and a website address. Nothing here needs anything you would have to go
        and look up.
      </p>

      <OnboardingWizard />
    </div>
  );
}
