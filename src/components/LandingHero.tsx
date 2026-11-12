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
      className="relative flex min-h-[calc(100vh-4rem)] flex-col justify-between overflow-hidden bg-[#060B19] text-white"
    >
      {/* Obsidian Atmosphere: Electric PayPal Blue + Cyan Spotlight + Subtle Grid */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "radial-gradient(circle at 74% 34%, rgba(0, 112, 224, 0.22), transparent 46%), radial-gradient(circle at 60% 72%, rgba(6, 182, 212, 0.12), transparent 45%), linear-gradient(to right, rgba(255, 255, 255, 0.035) 1px, transparent 1px), linear-gradient(to bottom, rgba(255, 255, 255, 0.035) 1px, transparent 1px)",
          backgroundSize: "100% 100%, 100% 100%, 40px 40px, 40px 40px",
        }}
      />

      <div className="relative mx-auto flex w-full max-w-7xl flex-1 flex-col justify-center px-4 py-10 sm:px-6 lg:py-12">
        {/* Split Hero Section */}
        <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-12 lg:gap-12">
          {/* Left Column (Crisp Display Headline, Short Subheadline, 2 CTAs) */}
          <div className="lg:col-span-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#38BDF8]/30 bg-[#0070E0]/15 px-3.5 py-1 font-mono text-[11px] font-semibold tracking-wider text-sky-200 shadow-[0_0_20px_rgba(0,112,224,0.2)]">
              <span
                aria-hidden="true"
                className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#38BDF8]"
              />
              PAYPAL SANDBOX · GEMINI 2.5 · MCP PROTOCOL
            </div>

            <h1 className="mt-6 font-display text-4xl font-bold tracking-[-0.03em] text-white sm:text-5xl xl:text-[56px] xl:leading-[1.06]">
              Zero-Trust Payments{" "}
              <span className="bg-gradient-to-r from-[#38BDF8] via-[#0070E0] to-cyan-300 bg-clip-text text-transparent">
                for Autonomous AI Agents.
              </span>
            </h1>

            <p className="mt-4 max-w-lg text-base leading-relaxed text-[#94A3B8] sm:text-lg">
              Stop 403 bot-blocks, PII leaks, and prompt injections with
              spend-capped PayPal passes.
            </p>

            {/* 2 Clean Action Buttons */}
            <div className="mt-8 flex flex-wrap items-center gap-3.5">
              <button
                type="button"
                onClick={onLaunchControlPlane}
                className="inline-flex h-12 cursor-pointer items-center justify-center gap-2 rounded-xl bg-[#0070E0] px-6 text-sm font-semibold text-white shadow-[0_0_28px_rgba(0,112,224,0.45)] transition-colors duration-200 hover:bg-[#005BB5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#38BDF8] focus-visible:ring-offset-2 focus-visible:ring-offset-[#060B19]"
              >
                <Play className="h-4 w-4" aria-hidden="true" />
                <span>Launch Live Control Plane</span>
              </button>

              <button
                type="button"
                onClick={onExploreStore}
                className="inline-flex h-12 cursor-pointer items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 px-6 text-sm font-semibold text-white backdrop-blur-xs transition-colors duration-200 hover:border-white/25 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#38BDF8] focus-visible:ring-offset-2 focus-visible:ring-offset-[#060B19]"
              >
                <ShoppingBag className="h-4 w-4 text-sky-300" aria-hidden="true" />
                <span>Explore Merchant Store</span>
              </button>
            </div>
          </div>

          {/* Right Column: Interactive 3D-Layered Virtual GhostPass Card + Telemetry Shield */}
          <div className="lg:col-span-6">
            <div className="relative mx-auto max-w-lg">
              {/* Soft Backlight Halo */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute -inset-4 rounded-3xl bg-gradient-to-br from-[#0070E0]/25 via-cyan-500/10 to-transparent blur-2xl"
              />

              {/* Floating Tactile Dark-Glass Virtual Payment Card */}
              <div className="relative rounded-2xl border border-white/15 bg-gradient-to-br from-[#0F172A]/95 via-[#0B1221]/95 to-[#081020]/95 p-5 shadow-[0_20px_50px_rgba(0,0,0,0.6)] backdrop-blur-xl">
                <div className="flex items-center justify-between gap-2">
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

                <div className="mt-4 flex items-center justify-between border-t border-white/10 pt-3.5">
                  <span className="font-mono text-sm font-semibold tracking-wider text-sky-100">
                    {maskedToken}
                  </span>
                  <span className="font-mono text-[11px] text-cyan-300">
                    {liveOrder ? `ORDER ${liveOrder}` : "HMAC-SHA256 SCOPED"}
                  </span>
                </div>
              </div>

              {/* Animated SVG Pulse Connector + 3 Glowing Telemetry Pills */}
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
                    stroke="rgba(56, 189, 248, 0.3)"
                    strokeWidth="2"
                    strokeDasharray="4 4"
                  />
                  <circle cx="8" cy="18" r="3.5" fill="#34D399" />
                  <circle cx="8" cy="70" r="3.5" fill="#22D3EE" />
                  <circle cx="8" cy="122" r="3.5" fill="#3B82F6" />
                </svg>

                <div className="space-y-2.5">
                  {/* Node 1 */}
                  <button
                    type="button"
                    aria-pressed={selectedLayer === 0}
                    onClick={() => setSelectedLayer(0)}
                    className={`flex w-full cursor-pointer items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left transition-colors duration-200 ${
                      selectedLayer === 0
                        ? "border-emerald-400/45 bg-[#0B1221] shadow-[0_0_20px_rgba(16,185,129,0.16)]"
                        : "border-white/10 bg-[#0B1221]/90 hover:border-white/20"
                    }`}
                  >
                    <span className="text-xs font-semibold text-zinc-100 sm:text-sm">
                      External AI Agent (Claude / Gemini)
                    </span>
                    <span className="shrink-0 rounded-full border border-emerald-400/30 bg-emerald-500/15 px-2.5 py-0.5 font-mono text-[11px] font-semibold text-emerald-300">
                      0% PII Exposed
                    </span>
                  </button>

                  {/* Node 2 */}
                  <button
                    type="button"
                    aria-pressed={selectedLayer === 1}
                    onClick={() => setSelectedLayer(1)}
                    className={`flex w-full cursor-pointer items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left transition-colors duration-200 ${
                      selectedLayer === 1
                        ? "border-cyan-400/45 bg-[#0B1221] shadow-[0_0_20px_rgba(34,211,238,0.18)]"
                        : "border-white/10 bg-[#0B1221]/90 hover:border-white/20"
                    }`}
                  >
                    <span className="text-xs font-semibold text-zinc-100 sm:text-sm">
                      Gemini 2.5 + HMAC Guardrail
                    </span>
                    <span className="shrink-0 rounded-full border border-cyan-400/30 bg-cyan-500/15 px-2.5 py-0.5 font-mono text-[11px] font-semibold text-cyan-300">
                      ${safeMaxPerTx.toFixed(0)} Cap · Injection Blocked
                    </span>
                  </button>

                  {/* Node 3 */}
                  <button
                    type="button"
                    aria-pressed={selectedLayer === 2}
                    onClick={() => setSelectedLayer(2)}
                    className={`flex w-full cursor-pointer items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left transition-colors duration-200 ${
                      selectedLayer === 2
                        ? "border-[#0070E0]/60 bg-[#0B1221] shadow-[0_0_20px_rgba(0,112,224,0.22)]"
                        : "border-white/10 bg-[#0B1221]/90 hover:border-white/20"
                    }`}
                  >
                    <span className="text-xs font-semibold text-zinc-100 sm:text-sm">
                      PayPal Orders v2 Settlement
                    </span>
                    <span className="shrink-0 rounded-full border border-sky-400/30 bg-[#0070E0]/25 px-2.5 py-0.5 font-mono text-[11px] font-semibold text-sky-200">
                      200 Verified · No CAPTCHA
                    </span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom 3-Card Bento Strip (Large Metrics + Short Micro-Captions) */}
        <div
          aria-label="Key Guarantees"
          className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-3"
        >
          <div className="rounded-2xl border border-white/10 bg-[#0B1221] p-5 transition-colors duration-200 hover:border-white/20">
            <div className="flex items-center justify-between">
              <span className="font-mono text-2xl font-bold text-emerald-300 sm:text-3xl">
                0%
              </span>
              <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-emerald-400/20 bg-emerald-500/10 text-emerald-300">
                <EyeOff className="h-4 w-4" aria-hidden="true" />
              </div>
            </div>
            <p className="mt-2 font-display text-sm font-semibold text-white">
              PII Leaked
            </p>
            <p className="mt-1 text-xs text-[#94A3B8]">
              Name, email &amp; address stay vaulted in PayPal.
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-[#0B1221] p-5 transition-colors duration-200 hover:border-white/20">
            <div className="flex items-center justify-between">
              <span className="font-mono text-2xl font-bold text-cyan-300 sm:text-3xl">
                100%
              </span>
              <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-cyan-400/20 bg-cyan-500/10 text-cyan-300">
                <ShieldAlert className="h-4 w-4" aria-hidden="true" />
              </div>
            </div>
            <p className="mt-2 font-display text-sm font-semibold text-white">
              Injection Defense
            </p>
            <p className="mt-1 text-xs text-[#94A3B8]">
              Blocks hidden gift-card &amp; price-tampering traps.
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-[#0B1221] p-5 transition-colors duration-200 hover:border-white/20">
            <div className="flex items-center justify-between">
              <span className="font-mono text-2xl font-bold text-[#38BDF8] sm:text-3xl">
                200 OK
              </span>
              <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#0070E0]/30 bg-[#0070E0]/20 text-sky-200">
                <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
              </div>
            </div>
            <p className="mt-2 font-display text-sm font-semibold text-white">
              Merchant Pass
            </p>
            <p className="mt-1 text-xs text-[#94A3B8]">
              Cryptographic human mandate bypasses 403 bot-bans.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
