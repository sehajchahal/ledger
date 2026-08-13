import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-[560px] px-5 py-16 sm:px-8">
      <Link href="/" className="font-display text-prose font-medium">
        Ledger
      </Link>

      <h1 className="mt-10 mb-3 font-display text-display-m">That page does not exist.</h1>
      <p className="mb-6 max-w-prose text-prose-s text-graphite">
        The link may be out of date, or the brand may have been removed.
      </p>

      <Link href="/brands" className="label text-graphite hover:text-ink">
        Back to your brands
      </Link>
    </div>
  );
}
