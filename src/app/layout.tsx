import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "PayPal GhostPass — Blindfolded VIP Checkout Pass | NovaTech & CloudForge",
  description:
    "Universal privacy-preserving agentic checkout passport. Shop at AI speed with 0% PII exposure, prompt-injection defense, and verified PayPal human mandates.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-slate-50 text-slate-900 font-sans selection:bg-[#0070BA]/15 selection:text-[#003087]">
        {children}
      </body>
    </html>
  );
}
