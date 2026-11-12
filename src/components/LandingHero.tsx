"use client";

import React, { useState } from "react";
import {
  CheckCircle2,
  ExternalLink,
  EyeOff,
  KeyRound,
  Lock,
  Play,
  ShieldAlert,
  ShieldCheck,
  ShoppingBag,
} from "lucide-react";
import { SimulationRunState } from "@/data/catalog";

interface LandingHeroProps {
  onTrySandbox: () => void;
  onOpenStorefront: () => void;
  simulation: SimulationRunState;
  maxPerTx: number;
}

export function LandingHero({
  onTrySandbox,
  onOpenStorefront,
  simulation,
  maxPerTx,
}: LandingHeroProps) {
  const [activeNode, setActiveNode] = useState<number>(1);

  const hasLiveSettlement =
    simulation.verdict === "APPROVED" && Boolean(simulation.paypalOrderId);

  return (
    <section
      id="overview"
      aria-label="PayPal GhostPass Overview"
      className="relative overflow-hidden border-b border-[#E4E4E7] bg-[#FAFAFA]"
    >
      {/* Subtle 32px engineering grid + faint PayPal Blue radial mesh */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "radial-gradient(circle at 75% 20%, rgba(0, 112, 224, 0.08), transparent 52%), linear-gradient(to right, rgba(24, 24, 27, 0.04) 1px, transparent 1px), linear-gradient(to bottom, rgba(24, 24, 27, 0.04) 1px, transparent 1px)",
          backgroundSize: "100% 100%, 32px 32px, 32px 32px",
        }}
      />

      <div className="relative mx-auto w-full max-w-7xl px-4 pb-12 pt-10 sm:px-6 lg:pb-14 lg:pt-14">
        {/* Hero 2-Column Asymmetric Grid */}
        <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-12 lg:gap-12">
          {/* Left Hero Copy & Action Row */}
          <div className="lg:col-span-7">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#0070E0]/25 bg-[#0070E0]/8 px-3.5 py-1 font-mono text-[11px] font-semibold tracking-wider text-[#005BB5]">
              <span
                aria-hidden="true"
                className="h-1.5 w-1.5 rounded-full bg-[#0070E0]"
              />
              AGENTIC COMMERCE INFRASTRUCTURE · PAYPAL ORDERS V2 &amp; GEMINI 2.5
            </div>

            <h1 className="mt-5 font-display text-3xl font-bold tracking-[-0.03em] text-[#09090B] sm:text-5xl sm:leading-[1.08]">
              Let AI agents shop at full speed.{" "}
              <span className="text-[#0070E0]">
                Keep your identity and wallet locked.
              </span>
            </h1>

            <p className="mt-4 max-w-2xl text-base leading-relaxed text-[#52525B] sm:text-lg">
              Eliminate 403 merchant bot-blocks, prompt-injection hijacks, and PII
              exposure. PayPal GhostPass issues single-use, spend-capped
              cryptographic mandates so external AI agents settle safely via PayPal
              Sandbox.
            </p>

            {/* Primary CTA Row */}
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={onTrySandbox}
                className="inline-flex h-11 cursor-pointer items-center justify-center gap-2 rounded-xl bg-[#0070E0] px-5 text-sm font-semibold text-white shadow-sm transition-colors duration-200 hover:bg-[#003087] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0070E0] focus-visible:ring-offset-2"
              >
                <Play className="h-4 w-4" aria-hidden="true" />
                <span>Try Interactive Sandbox</span>
              </button>

              <button
                type="button"
                onClick={onOpenStorefront}
                className="inline-flex h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-[#E4E4E7] bg-white px-5 text-sm font-semibold text-[#09090B] shadow-xs transition-colors duration-200 hover:border-zinc-300 hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0070E0] focus-visible:ring-offset-2"
              >
                <ShoppingBag className="h-4 w-4 text-zinc-700" aria-hidden="true" />
                <span>Browse Merchant Storefront</span>
              </button>

              <a
                href="https://github.com/bhargava562/paypass-agent"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-11 cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-transparent px-4 font-mono text-xs font-semibold text-[#3F3F46] transition-colors duration-200 hover:border-[#E4E4E7] hover:bg-white hover:text-[#09090B] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0070E0] focus-visible:ring-offset-2"
              >
                <span>GitHub Repo</span>
                <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
              </a>
            </div>
          </div>

          {/* Right Hero Visual Artifact: Interactive 3-Card Triple-Blind Handshake */}
          <div className="lg:col-span-5">
            <div
              aria-label="Triple-Blind Cryptographic Handshake"
              className="rounded-2xl border border-[#E4E4E7] bg-white/95 p-5 shadow-md backdrop-blur-xs"
            >
              <div className="mb-4 flex items-center justify-between border-b border-zinc-100 pb-3">
                <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-zinc-700">
                  Triple-Blind Handshake
                </span>
                <span className="inline-flex items-center gap-1.5 font-mono text-[11px] font-semibold text-emerald-700">
                  <span
                    aria-hidden="true"
                    className="h-2 w-2 animate-pulse rounded-full bg-emerald-500"
                  />
                  Live Architecture
                </span>
              </div>

              <div className="space-y-2.5">
                {/* Tier 1: External AI Agent */}
                <button
                  type="button"
                  onClick={() => setActiveNode(0)}
                  className={`w-full cursor-pointer rounded-xl border p-3.5 text-left transition-colors duration-200 ${
                    activeNode === 0
                      ? "border-[#0070E0] bg-sky-50/40"
                      : "border-[#E4E4E7] bg-[#FAFAFA] hover:border-zinc-300 hover:bg-white"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-[#09090B]">
                      1. External AI Agent (Claude / Gemini MCP)
                    </span>
                    <span className="shrink-0 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 font-mono text-[10px] font-bold text-emerald-800">
                      0% PII in Context
                    </span>
                  </div>
                  <p className="mt-1.5 font-mono text-[11px] text-zinc-600">
                    {`{ payer: "[REDACTED]", token: "gp_live_••••_v2" }`}
                  </p>
                </button>

                {/* Animated Pulse Beam 1 */}
                <div className="flex items-center justify-center py-0.5">
                  <div className="flex items-center gap-2 rounded-full border border-[#0070E0]/25 bg-[#0070E0]/8 px-3 py-1 font-mono text-[10px] font-semibold text-[#005BB5]">
                    <span
                      aria-hidden="true"
                      className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#0070E0]"
                    />
                    <span>HMAC-SHA256 + Scam Scan</span>
                  </div>
                </div>

                {/* Tier 2: PayPal GhostPass Guardrail */}
                <button
                  type="button"
                  onClick={() => setActiveNode(1)}
                  className={`w-full cursor-pointer rounded-xl border p-3.5 text-left transition-colors duration-200 ${
                    activeNode === 1
                      ? "border-[#0070E0] bg-[#0B1120] text-white"
                      : "border-zinc-800 bg-[#0B1120] text-zinc-100 hover:border-[#0070E0]/70"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold text-white">
                      <ShieldCheck
                        className="h-4 w-4 text-[#38BDF8]"
                        aria-hidden="true"
                      />
                      2. PayPal GhostPass Guardrail
                    </span>
                    <span className="shrink-0 rounded-full border border-sky-400/30 bg-sky-500/20 px-2.5 py-0.5 font-mono text-[10px] font-bold text-sky-200">
                      Max ${maxPerTx.toFixed(0)} · HITL Ready
                    </span>
                  </div>
                  <p className="mt-1.5 font-mono text-[11px] text-zinc-300">
                    Deterministic cap check + Gemini 2.5 Flash injection firewall
                  </p>
                </button>

                {/* Animated Pulse Beam 2 */}
                <div className="flex items-center justify-center py-0.5">
                  <div className="flex items-center gap-2 rounded-full border border-zinc-200 bg-zinc-100 px-3 py-1 font-mono text-[10px] font-semibold text-zinc-700">
                    <Lock className="h-3 w-3 text-[#0070E0]" aria-hidden="true" />
                    <span>X-PayPal-GhostPass-Signature</span>
                  </div>
                </div>

                {/* Tier 3: PayPal Sandbox Orders v2 + Merchant */}
                <button
                  type="button"
                  onClick={() => setActiveNode(2)}
                  className={`w-full cursor-pointer rounded-xl border p-3.5 text-left transition-colors duration-200 ${
                    activeNode === 2
                      ? "border-[#0070E0] bg-sky-50/40"
                      : "border-[#E4E4E7] bg-[#FAFAFA] hover:border-zinc-300 hover:bg-white"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-[#09090B]">
                      3. PayPal Sandbox Orders v2 + Merchant
                    </span>
                    <span className="shrink-0 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 font-mono text-[10px] font-bold text-emerald-800">
                      200 Verified · No CAPTCHA
                    </span>
                  </div>
                  <p className="mt-1.5 font-mono text-[11px] text-zinc-600">
                    {hasLiveSettlement
                      ? `Live Order ${simulation.paypalOrderId} ($${simulation.proposedTotal.toFixed(
                          2
                        )}) settled`
                      : `POST /v2/checkout/orders · Vaulted shipping relay`}
                  </p>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Concise 3-Pillar Bento Grid */}
        <div
          aria-label="Core Architecture Pillars"
          className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-3"
        >
          {/* Pillar 1 */}
          <article className="rounded-2xl border border-[#E4E4E7] bg-white p-6 shadow-xs transition-all duration-200 hover:border-zinc-300 hover:shadow-md">
            <div className="flex items-center justify-between gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700">
                <EyeOff className="h-5 w-5" aria-hidden="true" />
              </div>
              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 font-mono text-[10px] font-bold text-emerald-800">
                0% Identity Leaked
              </span>
            </div>
            <h2 className="mt-4 font-display text-base font-bold text-[#09090B]">
              Zero-PII Agent Context
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-[#52525B]">
              Your name, email, shipping address, and PayPal credentials stay
              vaulted—the LLM only sees a scoped session token.
            </p>
          </article>

          {/* Pillar 2 */}
          <article className="rounded-2xl border border-[#E4E4E7] bg-white p-6 shadow-xs transition-all duration-200 hover:border-zinc-300 hover:shadow-md">
            <div className="flex items-center justify-between gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-rose-200 bg-rose-50 text-rose-700">
                <ShieldAlert className="h-5 w-5" aria-hidden="true" />
              </div>
              <span className="rounded-full border border-rose-200 bg-rose-50 px-2.5 py-0.5 font-mono text-[10px] font-bold text-rose-800">
                Prompt-Injection Firewall
              </span>
            </div>
            <h2 className="mt-4 font-display text-base font-bold text-[#09090B]">
              Adversarial &amp; Spend Guardrails
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-[#52525B]">
              Deterministic dollar caps + Gemini 2.5 Flash semantic auditing block
              hidden gift-card traps and pause over-budget items for 1-click
              Human-in-the-Loop (HITL) approval.
            </p>
          </article>

          {/* Pillar 3 */}
          <article className="rounded-2xl border border-[#E4E4E7] bg-white p-6 shadow-xs transition-all duration-200 hover:border-zinc-300 hover:shadow-md">
            <div className="flex items-center justify-between gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-sky-200 bg-sky-50 text-[#0070E0]">
                <KeyRound className="h-5 w-5" aria-hidden="true" />
              </div>
              <span className="inline-flex items-center gap-1 rounded-full border border-sky-200 bg-sky-50 px-2.5 py-0.5 font-mono text-[10px] font-bold text-[#005BB5]">
                <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                Stops 403 Bot-Blocks
              </span>
            </div>
            <h2 className="mt-4 font-display text-base font-bold text-[#09090B]">
              Universal Merchant Pass
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-[#52525B]">
              Replaces closed retailer silos with a PayPal-backed{" "}
              <code className="rounded bg-zinc-100 px-1 py-0.5 font-mono text-xs text-[#09090B]">
                X-PayPal-GhostPass
              </code>{" "}
              attestation that merchants verify instantly.
            </p>
          </article>
        </div>
      </div>
    </section>
  );
}
