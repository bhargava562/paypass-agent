"use client";

import React, { useState } from "react";
import {
  CheckCircle2,
  EyeOff,
  Play,
  ShieldAlert,
  ShieldCheck,
  ShoppingBag,
} from "lucide-react";
import { SimulationRunState } from "@/data/catalog";

interface LandingHeroProps {
  onLaunchControlPlane: () => void;
  onExploreStore: () => void;
  sessionApiKey?: string;
  maxPerTx?: number;
  simulation?: SimulationRunState;
}

export function LandingHero({
  onLaunchControlPlane,
  onExploreStore,
  sessionApiKey = "gp_live_0pii_sandbox_v2",
  maxPerTx = 60,
  simulation,
}: LandingHeroProps) {
  const [selectedLayer, setSelectedLayer] = useState<0 | 1 | 2>(1);
  const safeMaxPerTx = Number.isFinite(Number(maxPerTx)) ? Number(maxPerTx) : 60;
  const safeToken = sessionApiKey || "gp_live_0pii_sandbox_v2";
  const maskedToken = `gp_live_••••_${safeToken.slice(-4)}`;
  const liveOrder =
    simulation?.verdict === "APPROVED" && simulation?.paypalOrderId
      ? simulation.paypalOrderId
      : null;

  return (
    <section
      aria-label="PayPal GhostPass Overview"
      className="relative flex min-h-[calc(100vh-4rem)] flex-col justify-between overflow-hidden bg-[#FAFAFA] text-[#09090B]"
    >
      {/* Crisp Light Fintech Atmosphere: PayPal Blue Radial Glow + Hairline Grid */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "radial-gradient(circle at 76% 30%, rgba(0, 112, 224, 0.09), transparent 48%), radial-gradient(circle at 22% 80%, rgba(14, 165, 233, 0.06), transparent 45%), linear-gradient(to right, rgba(24, 24, 27, 0.035) 1px, transparent 1px), linear-gradient(to bottom, rgba(24, 24, 27, 0.035) 1px, transparent 1px)",
          backgroundSize: "100% 100%, 100% 100%, 40px 40px, 40px 40px",
        }}
      />

      <div className="relative mx-auto flex w-full max-w-7xl flex-1 flex-col justify-center px-4 py-10 sm:px-6 lg:py-12">
        {/* Split Hero Section */}
        <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-12 lg:gap-12">
          {/* Left Column */}
          <div className="lg:col-span-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#0070E0]/25 bg-[#0070E0]/8 px-3.5 py-1 font-mono text-[11px] font-semibold tracking-wider text-[#005BB5]">
              <span
                aria-hidden="true"
                className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#0070E0]"
              />
              PAYPAL SANDBOX · GEMINI 2.5 · MCP PROTOCOL
            </div>

            <h1 className="mt-6 font-display text-4xl font-bold tracking-[-0.03em] text-[#09090B] sm:text-5xl xl:text-[56px] xl:leading-[1.06]">
              Zero-Trust Payments{" "}
              <span className="bg-gradient-to-r from-[#0070E0] via-[#005BB5] to-[#0284C7] bg-clip-text text-transparent">
                for Autonomous AI Agents.
              </span>
            </h1>

            <p className="mt-4 max-w-lg text-base leading-relaxed text-[#52525B] sm:text-lg">
              Stop 403 bot-blocks, PII leaks, and prompt injections with
              spend-capped PayPal passes.
            </p>

            {/* 2 Clean Action Buttons */}
            <div className="mt-8 flex flex-wrap items-center gap-3.5">
              <button
                type="button"
                onClick={onLaunchControlPlane}
                className="inline-flex h-12 cursor-pointer items-center justify-center gap-2 rounded-xl bg-[#0070E0] px-6 text-sm font-semibold text-white shadow-[0_8px_24px_rgba(0,112,224,0.28)] transition-colors duration-200 hover:bg-[#005BB5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0070E0] focus-visible:ring-offset-2"
              >
                <Play className="h-4 w-4" aria-hidden="true" />
                <span>Launch Live Control Plane</span>
              </button>

              <button
                type="button"
                onClick={onExploreStore}
                className="inline-flex h-12 cursor-pointer items-center justify-center gap-2 rounded-xl border border-[#E4E4E7] bg-white px-6 text-sm font-semibold text-[#09090B] shadow-xs transition-colors duration-200 hover:border-zinc-300 hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0070E0] focus-visible:ring-offset-2"
              >
                <ShoppingBag className="h-4 w-4 text-zinc-700" aria-hidden="true" />
                <span>Explore Merchant Store</span>
              </button>
            </div>
          </div>

          {/* Right Column: Tactile Dark-Obsidian Virtual Card + White Telemetry Stack */}
          <div className="lg:col-span-6">
            <div className="relative mx-auto max-w-lg">
              <div
                aria-hidden="true"
                className="pointer-events-none absolute -inset-4 rounded-3xl bg-gradient-to-br from-[#0070E0]/12 via-sky-400/8 to-transparent blur-2xl"
              />

              {/* Signature Dark-Obsidian Virtual Payment Pass Card */}
              <div className="relative overflow-hidden rounded-2xl border border-zinc-800 bg-[#0B1120] p-5 text-white shadow-xl">
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-[#0070E0]/25 blur-2xl"
                />
                <div className="relative flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#38BDF8]/30 bg-[#0070E0]/20">
                      <ShieldCheck
                        className="h-4 w-4 text-[#38BDF8]"
                        aria-hidden="true"
                      />
                    </div>
                    <span className="font-display text-sm font-bold text-white">
                      PayPal GhostPass
                    </span>
                  </div>

                  <span className="rounded-full border border-emerald-400/30 bg-emerald-500/15 px-2.5 py-0.5 font-mono text-[10px] font-semibold text-emerald-300">
                    ACTIVE · ${safeMaxPerTx.toFixed(0)} CAP
                  </span>
                </div>

                <div className="relative mt-4 flex items-center justify-between border-t border-white/10 pt-3.5">
                  <span className="font-mono text-sm font-semibold tracking-wider text-sky-100">
                    {maskedToken}
                  </span>
                  <span className="font-mono text-[11px] text-[#38BDF8]">
                    {liveOrder ? `ORDER ${liveOrder}` : "HMAC-SHA256 SCOPED"}
                  </span>
                </div>
              </div>

              {/* Dotted SVG Connector + 3 Crisp Elevated Telemetry Nodes */}
              <div className="relative mt-3 pl-6">
                <svg
                  aria-hidden="true"
                  className="pointer-events-none absolute bottom-5 left-2.5 top-1 h-[calc(100%-24px)] w-4"
                  viewBox="0 0 16 140"
                  preserveAspectRatio="none"
                >
                  <line
                    x1="8"
                    y1="0"
                    x2="8"
                    y2="140"
                    stroke="rgba(0, 112, 224, 0.25)"
                    strokeWidth="2"
                    strokeDasharray="4 4"
                  />
                  <circle cx="8" cy="18" r="3.5" fill="#10B981" />
                  <circle cx="8" cy="70" r="3.5" fill="#0284C7" />
                  <circle cx="8" cy="122" r="3.5" fill="#0070E0" />
                </svg>

                <div className="space-y-2.5">
                  <button
                    type="button"
                    aria-pressed={selectedLayer === 0}
                    onClick={() => setSelectedLayer(0)}
                    className={`flex w-full cursor-pointer items-center justify-between gap-3 rounded-xl border bg-white px-4 py-3 text-left shadow-xs transition-colors duration-200 ${
                      selectedLayer === 0
                        ? "border-emerald-400 bg-emerald-50/30"
                        : "border-[#E4E4E7] hover:border-zinc-300"
                    }`}
                  >
                    <span className="text-xs font-semibold text-[#09090B] sm:text-sm">
                      External AI Agent (Claude / Gemini)
                    </span>
                    <span className="shrink-0 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 font-mono text-[11px] font-semibold text-emerald-800">
                      0% PII Exposed
                    </span>
                  </button>

                  <button
                    type="button"
                    aria-pressed={selectedLayer === 1}
                    onClick={() => setSelectedLayer(1)}
                    className={`flex w-full cursor-pointer items-center justify-between gap-3 rounded-xl border bg-white px-4 py-3 text-left shadow-xs transition-colors duration-200 ${
                      selectedLayer === 1
                        ? "border-[#0070E0] bg-sky-50/40"
                        : "border-[#E4E4E7] hover:border-zinc-300"
                    }`}
                  >
                    <span className="text-xs font-semibold text-[#09090B] sm:text-sm">
                      Gemini 2.5 + HMAC Guardrail
                    </span>
                    <span className="shrink-0 rounded-full border border-sky-200 bg-sky-50 px-2.5 py-0.5 font-mono text-[11px] font-semibold text-[#005BB5]">
                      ${safeMaxPerTx.toFixed(0)} Cap · Injection Blocked
                    </span>
                  </button>

                  <button
                    type="button"
                    aria-pressed={selectedLayer === 2}
                    onClick={() => setSelectedLayer(2)}
                    className={`flex w-full cursor-pointer items-center justify-between gap-3 rounded-xl border bg-white px-4 py-3 text-left shadow-xs transition-colors duration-200 ${
                      selectedLayer === 2
                        ? "border-[#0070E0] bg-sky-50/40"
                        : "border-[#E4E4E7] hover:border-zinc-300"
                    }`}
                  >
                    <span className="text-xs font-semibold text-[#09090B] sm:text-sm">
                      PayPal Orders v2 Settlement
                    </span>
                    <span className="shrink-0 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 font-mono text-[11px] font-semibold text-emerald-800">
                      200 Verified · No CAPTCHA
                    </span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom 3-Card Bento Strip */}
        <div
          aria-label="Key Guarantees"
          className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-3"
        >
          <div className="rounded-2xl border border-[#E4E4E7] bg-white p-5 shadow-xs transition-colors duration-200 hover:border-zinc-300">
            <div className="flex items-center justify-between">
              <span className="font-mono text-2xl font-bold text-emerald-700 sm:text-3xl">
                0%
              </span>
              <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700">
                <EyeOff className="h-4 w-4" aria-hidden="true" />
              </div>
            </div>
            <p className="mt-2 font-display text-sm font-bold text-[#09090B]">
              PII Leaked
            </p>
            <p className="mt-1 text-xs text-[#52525B]">
              Name, email &amp; address stay vaulted in PayPal.
            </p>
          </div>

          <div className="rounded-2xl border border-[#E4E4E7] bg-white p-5 shadow-xs transition-colors duration-200 hover:border-zinc-300">
            <div className="flex items-center justify-between">
              <span className="font-mono text-2xl font-bold text-[#005BB5] sm:text-3xl">
                100%
              </span>
              <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-rose-200 bg-rose-50 text-rose-700">
                <ShieldAlert className="h-4 w-4" aria-hidden="true" />
              </div>
            </div>
            <p className="mt-2 font-display text-sm font-bold text-[#09090B]">
              Injection Defense
            </p>
            <p className="mt-1 text-xs text-[#52525B]">
              Blocks hidden gift-card &amp; price-tampering traps.
            </p>
          </div>

          <div className="rounded-2xl border border-[#E4E4E7] bg-white p-5 shadow-xs transition-colors duration-200 hover:border-zinc-300">
            <div className="flex items-center justify-between">
              <span className="font-mono text-2xl font-bold text-[#0070E0] sm:text-3xl">
                200 OK
              </span>
              <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-sky-200 bg-sky-50 text-[#0070E0]">
                <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
              </div>
            </div>
            <p className="mt-2 font-display text-sm font-bold text-[#09090B]">
              Merchant Pass
            </p>
            <p className="mt-1 text-xs text-[#52525B]">
              Cryptographic human mandate bypasses 403 bot-bans.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
