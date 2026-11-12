import type { Metadata } from "next";
import { Inter, JetBrains_Mono, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const jakartaDisplay = Plus_Jakarta_Sans({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

const interBody = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "PayPal GhostPass — Zero-Trust Payments for Autonomous AI Agents",
  description:
    "Programmable spend-capped payment passes, Zero-PII LLM context vaulting, prompt-injection firewall, and live PayPal Sandbox Orders v2 settlement via MCP.",
  applicationName: "PayPal GhostPass",
  keywords: [
    "PayPal GhostPass",
    "Agentic Commerce",
    "PayPal Orders v2",
    "Gemini 2.5",
    "Model Context Protocol",
    "Zero-PII",
    "AI Guardrail",
  ],
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
    shortcut: "/icon.svg",
  },
  openGraph: {
    title: "PayPal GhostPass — Zero-Trust Payments for Autonomous AI Agents",
    description:
      "Eliminate 403 merchant bot-blocks, PII leaks, and prompt injections with spend-capped PayPal passes.",
    type: "website",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${jakartaDisplay.variable} ${interBody.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body
        suppressHydrationWarning
        className="min-h-full flex flex-col bg-[#FAFAFA] text-[#09090B] font-sans selection:bg-[#0070E0]/15 selection:text-[#003087]"
      >
        {children}
      </body>
    </html>
  );
}
