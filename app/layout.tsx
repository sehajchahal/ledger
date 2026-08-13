import type { Metadata } from "next";
import { JetBrains_Mono, Outfit, Work_Sans } from "next/font/google";
import "./globals.css";

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
  display: "swap",
});

const workSans = Work_Sans({
  variable: "--font-worksans",
  subsets: ["latin"],
  display: "swap",
});

const jetbrains = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Ledger — is your business in the AI answer?",
  description:
    "People ask ChatGPT which company to use. Ledger checks whether it names yours, works out why it doesn't, writes the fix, and proves whether the fix worked.",
};

/**
 * Applied before first paint so a dark-mode user never sees a white flash.
 * Inline and synchronous on purpose: a deferred script runs too late.
 */
const THEME_SCRIPT = `(function(){try{var t=localStorage.getItem("ledger-theme");if(!t){t="dark"}document.documentElement.setAttribute("data-theme",t)}catch(e){document.documentElement.setAttribute("data-theme","dark")}})()`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      data-theme="dark"
      suppressHydrationWarning
      className={`${outfit.variable} ${workSans.variable} ${jetbrains.variable} h-full`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="min-h-full bg-paper text-ink">{children}</body>
    </html>
  );
}
