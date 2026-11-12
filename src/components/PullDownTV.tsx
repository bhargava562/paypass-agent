"use client";

import React, { useState } from "react";
import dynamic from "next/dynamic";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronUp,
  EyeOff,
  Lock,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  Table2,
  Tv,
  UserCheck,
  Vault,
} from "lucide-react";
import {
  AuditTransaction,
  SimulationRunState,
  SpendingMandate,
} from "@/data/catalog";

const AuditLedgerGrid = dynamic(
  () =>
    import("@/components/AuditLedgerGrid").then((mod) => mod.AuditLedgerGrid),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[340px] items-center justify-center rounded-2xl border border-slate-800 bg-slate-900/70 text-xs text-slate-400">
        Loading Audit Ledger...
      </div>
    ),
  }
);

interface PullDownTVProps {
  open: boolean;
  onClose: () => void;
  simulation: SimulationRunState;
  mandate: SpendingMandate;
  transactions: AuditTransaction[];
  isRunning: boolean;
  isSettlingOverride: boolean;
  onApproveOverride: () => void;
  onRejectOverride: () => void;
  onResetDemo: () => void;
}

const STAGE_LABEL: Record<SimulationRunState["stage"], string> = {
  idle: "Standby · Ready for Agent Run",
  agent_browsing: "Camera 1: AI Agent Browsing Catalog...",
  gatekeeper_auditing: "Camera 3: Gatekeeper Auditing Cart...",
  merchant_checking: "Camera 2: Store Security Guard Checking Mandate...",
  paypal_settling: "Camera 3: Settling via PayPal Vault...",
  complete: "Run Complete · Telemetry Captured",
};

export function PullDownTV({
  open,
  onClose,
  simulation,
  mandate,
  transactions,
  isRunning,
  isSettlingOverride,
  onApproveOverride,
  onRejectOverride,
  onResetDemo,
}: PullDownTVProps) {
  const [activeTab, setActiveTab] = useState<"cameras" | "ledger">("cameras");

  const isGhostPass = simulation.mode === "ghostpass";
  const isIdle = simulation.verdict === "IDLE" && simulation.stage === "idle";
  const exceedsPerTx = simulation.proposedTotal > mandate.maxPerTransaction;
  const overBudgetHeading = exceedsPerTx
    ? `Over Cap ($${simulation.proposedTotal.toFixed(2)} > $${mandate.maxPerTransaction})`
    : `Daily Limit ($${(mandate.dailySpent + simulation.proposedTotal).toFixed(2)} > $${mandate.dailyLimit})`;

  return (
    <aside
      aria-label="Behind the Scenes X-Ray Television"
      aria-hidden={!open}
      inert={!open}
      className={`fixed inset-x-0 top-0 z-40 transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
        open
          ? "visible translate-y-0"
          : "invisible -translate-y-full pointer-events-none"
      }`}
    >
      <div className="tv-scanlines max-h-[88vh] overflow-y-auto border-b border-slate-700/80 bg-slate-950/96 text-slate-100 shadow-[0_30px_90px_rgba(2,6,23,0.85)] backdrop-blur-2xl">
        <div className="mx-auto max-w-7xl px-4 pb-5 pt-4 sm:px-6">
          {/* TV Top Bezel Controls */}
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#0070BA]/20 text-sky-400 ring-1 ring-sky-400/30">
                <Tv className="h-4 w-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-semibold tracking-tight text-white">
                    PayPal GhostPass X-Ray · Behind the Scenes
                  </h2>
                  <span className="rounded-full border border-slate-700 bg-slate-900 px-2 py-0.5 font-mono text-[10px] text-slate-300">
                    {STAGE_LABEL[simulation.stage]}
                  </span>
                </div>
                <p className="text-xs text-slate-400">
                  Live security cameras showing what the AI sees, what the store
                  blocks, and how PayPal guards your money.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Tab Toggle */}
              <div className="inline-flex rounded-xl border border-slate-800 bg-slate-900 p-0.5">
                <button
                  type="button"
                  onClick={() => setActiveTab("cameras")}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                    activeTab === "cameras"
                      ? "bg-[#0070BA] text-white"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Live Cameras (3)
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("ledger")}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                    activeTab === "ledger"
                      ? "bg-[#0070BA] text-white"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  <Table2 className="h-3.5 w-3.5" />
                  Audit Ledger ({transactions.length})
                </button>
              </div>

              <button
                type="button"
                disabled={isRunning}
                onClick={onResetDemo}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-medium text-slate-300 transition hover:border-slate-600 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Reset Demo
              </button>

              <button
                type="button"
                onClick={onClose}
                className="inline-flex items-center gap-1 rounded-xl border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-slate-700"
              >
                <ChevronUp className="h-4 w-4" />
                Roll Up TV
              </button>
            </div>
          </div>

          {/* Active Tab Content */}
          {activeTab === "cameras" ? (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              {/* CAMERA 1: PRIVACY X-RAY */}
              <div
                className={`flex flex-col justify-between rounded-2xl border p-4 transition ${
                  isIdle
                    ? "border-slate-800 bg-slate-900/75"
                    : isGhostPass
                    ? "border-emerald-500/40 bg-emerald-950/20"
                    : "border-rose-500/50 bg-rose-950/25"
                }`}
              >
                <div>
                  <div className="mb-3 flex items-center justify-between">
                    <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                      CAM 01 · Privacy X-Ray
                    </span>
                    {isIdle ? (
                      <span className="rounded-full bg-slate-800 px-2.5 py-0.5 text-[11px] font-medium text-slate-400">
                        Waiting
                      </span>
                    ) : isGhostPass ? (
                      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-500/15 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-300">
                        <EyeOff className="h-3 w-3" />
                        0% PII Leaked
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full border border-rose-500/50 bg-rose-500/20 px-2.5 py-0.5 text-[11px] font-semibold text-rose-300">
                        <AlertTriangle className="h-3 w-3" />
                        100% PII Exposed
                      </span>
                    )}
                  </div>

                  <h3 className="text-sm font-semibold text-white">
                    {isIdle
                      ? "What the AI Agent Can See"
                      : isGhostPass
                      ? "Blindfolded VIP Pass Active"
                      : "Raw Wallet & Identity Exposed to Bot"}
                  </h3>
                  <p className="mt-1 text-xs text-slate-400">
                    {isIdle
                      ? "Send an agent below to inspect the exact identity payload entering the AI context window."
                      : isGhostPass
                      ? "Your personal name, home address, and PayPal credentials never enter the AI agent's context."
                      : "Standard AI bots carry raw login credentials, email, and shipping address in every prompt."}
                  </p>

                  <div className="mt-3 space-y-1.5 rounded-xl border border-slate-800 bg-slate-950/90 p-3 font-mono text-[11px]">
                    {Object.entries(simulation.agentContextPreview).map(
                      ([key, val]) => (
                        <div
                          key={key}
                          className="flex items-center justify-between gap-2"
                        >
                          <span className="text-slate-500">{key}:</span>
                          <span
                            className={`truncate ${
                              isIdle
                                ? "text-slate-300"
                                : isGhostPass
                                ? "text-emerald-300"
                                : "text-rose-300"
                            }`}
                          >
                            {val}
                          </span>
                        </div>
                      )
                    )}
                  </div>
                </div>

                <div className="mt-3 border-t border-slate-800/80 pt-2.5 text-[11px] text-slate-400">
                  Mode:{" "}
                  <span className="font-semibold text-slate-200">
                    {isGhostPass
                      ? "PayPal GhostPass (Zero-PII)"
                      : "Standard Unverified Bot"}
                  </span>
                </div>
              </div>

              {/* CAMERA 2: STORE SECURITY GUARD */}
              <div
                className={`flex flex-col justify-between rounded-2xl border p-4 transition ${
                  isIdle
                    ? "border-slate-800 bg-slate-900/75"
                    : simulation.verdict === "403_REJECTED"
                    ? "border-rose-500/50 bg-rose-950/25"
                    : simulation.verdict === "BLOCKED"
                    ? "border-amber-500/40 bg-amber-950/15"
                    : "border-emerald-500/40 bg-emerald-950/20"
                }`}
              >
                <div>
                  <div className="mb-3 flex items-center justify-between">
                    <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                      CAM 02 · Store Security Guard
                    </span>
                    {simulation.merchantStatusCode ? (
                      <span
                        className={`rounded-full border px-2.5 py-0.5 font-mono text-[11px] font-semibold ${
                          simulation.merchantStatusCode === 403
                            ? "border-rose-500/50 bg-rose-500/20 text-rose-300"
                            : "border-emerald-500/40 bg-emerald-500/15 text-emerald-300"
                        }`}
                      >
                        HTTP {simulation.merchantStatusCode}
                      </span>
                    ) : (
                      <span className="rounded-full bg-slate-800 px-2.5 py-0.5 text-[11px] font-medium text-slate-400">
                        Standby
                      </span>
                    )}
                  </div>

                  <h3 className="text-sm font-semibold text-white">
                    {simulation.merchantBadge}
                  </h3>
                  <p className="mt-1 text-xs text-slate-400">
                    {simulation.verdict === "403_REJECTED"
                      ? "Store bot-defense flagged an unverified scraper with no cryptographic proof of human intent and slammed the door shut."
                      : simulation.verdict === "BLOCKED"
                      ? "GhostPass Gatekeeper aborted checkout locally before contacting the merchant settlement endpoint."
                      : simulation.verdict === "APPROVED"
                      ? "Store accepted the verified PayPal Human Mandate header and received your shipping address directly from PayPal Vault."
                      : simulation.verdict === "NEEDS_APPROVAL"
                      ? "GhostPass Mandate signature ready — paused for your 1-click budget override before store capture."
                      : "Online stores verify X-PayPal-GhostPass instead of tripping CAPTCHAs."}
                  </p>

                  <div className="mt-3 space-y-2 rounded-xl border border-slate-800 bg-slate-950/90 p-3 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Mandate Header</span>
                      <span className="font-mono text-[11px] text-slate-200">
                        {isGhostPass && !isIdle
                          ? "X-PayPal-GhostPass: Verified ✓"
                          : "Missing / Unverified"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Shipping Relay</span>
                      <span className="text-[11px] font-medium text-sky-300">
                        {simulation.shippingRelayLabel}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-3 border-t border-slate-800/80 pt-2.5 text-[11px] text-slate-400">
                  Merchant Defense:{" "}
                  <span className="font-semibold text-slate-200">
                    Anti-Scraper + Mandate Verifier
                  </span>
                </div>
              </div>

              {/* CAMERA 3: PAYPAL MONEY VAULT */}
              <div
                className={`flex flex-col justify-between rounded-2xl border p-4 transition ${
                  simulation.verdict === "APPROVED"
                    ? "border-emerald-500/40 bg-emerald-950/20"
                    : simulation.verdict === "BLOCKED" ||
                      simulation.verdict === "403_REJECTED"
                    ? "border-rose-500/50 bg-rose-950/25"
                    : simulation.verdict === "NEEDS_APPROVAL"
                    ? "border-amber-500/50 bg-amber-950/25"
                    : "border-slate-800 bg-slate-900/75"
                }`}
              >
                <div>
                  <div className="mb-3 flex items-center justify-between">
                    <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                      CAM 03 · PayPal Money Vault
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full border border-slate-700 bg-slate-900 px-2.5 py-0.5 font-mono text-[11px] text-slate-300">
                      <Vault className="h-3 w-3 text-[#0070BA]" />
                      Risk {simulation.riskScore}/100
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {simulation.verdict === "APPROVED" && (
                      <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-400" />
                    )}
                    {simulation.verdict === "BLOCKED" && (
                      <ShieldAlert className="h-5 w-5 shrink-0 text-rose-400" />
                    )}
                    {simulation.verdict === "NEEDS_APPROVAL" && (
                      <UserCheck className="h-5 w-5 shrink-0 text-amber-400" />
                    )}
                    {(simulation.verdict === "IDLE" ||
                      simulation.verdict === "403_REJECTED") && (
                      <Lock className="h-5 w-5 shrink-0 text-slate-400" />
                    )}

                    <h3 className="text-sm font-semibold text-white">
                      {simulation.verdict === "APPROVED"
                        ? `Settled $${simulation.proposedTotal.toFixed(2)} via PayPal`
                        : simulation.verdict === "BLOCKED"
                        ? "Threat Caught · $0.00 Moved"
                        : simulation.verdict === "NEEDS_APPROVAL"
                        ? overBudgetHeading
                        : simulation.verdict === "403_REJECTED"
                        ? "Vault Untouched · $0.00 Moved"
                        : `Guarding $${mandate.maxPerTransaction}/tx Limit`}
                    </h3>
                  </div>

                  {/* Gatekeeper Rule Trace */}
                  <ul className="mt-3 space-y-1.5 rounded-xl border border-slate-800 bg-slate-950/90 p-3 text-xs text-slate-300">
                    {simulation.gatekeeperNotes.map((note, idx) => (
                      <li key={idx} className="leading-snug">
                        {note}
                      </li>
                    ))}
                  </ul>

                  {/* Live PayPal Order ID / Receipt Badge */}
                  {simulation.paypalOrderId && (
                    <div className="mt-3 space-y-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-emerald-200">
                          Merchant Receipt / Order ID
                        </span>
                        <span className="font-mono font-semibold text-emerald-300">
                          {simulation.paypalOrderId}
                        </span>
                      </div>
                      {simulation.verificationHash && (
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-emerald-200/80">
                            HMAC Verification Hash
                          </span>
                          <span className="font-mono text-emerald-300">
                            {simulation.verificationHash}
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* 1-Click Human Override Controls */}
                  {simulation.verdict === "NEEDS_APPROVAL" && (
                    <div className="mt-3 flex items-center gap-2">
                      <button
                        type="button"
                        disabled={isSettlingOverride}
                        onClick={onApproveOverride}
                        className="flex-1 rounded-xl bg-emerald-500 px-3 py-2 text-xs font-semibold text-slate-950 shadow-sm transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        ✓ Approve ${simulation.proposedTotal.toFixed(2)} Override
                      </button>
                      <button
                        type="button"
                        disabled={isSettlingOverride}
                        onClick={onRejectOverride}
                        className="rounded-xl border border-rose-500/50 bg-rose-500/15 px-3 py-2 text-xs font-semibold text-rose-200 transition hover:bg-rose-500/25 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Reject
                      </button>
                    </div>
                  )}
                </div>

                <div className="mt-3 border-t border-slate-800/80 pt-2.5 text-[11px] text-slate-400">
                  Daily Spend:{" "}
                  <span className="font-semibold text-slate-200">
                    ${mandate.dailySpent.toFixed(2)} / $
                    {mandate.dailyLimit.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <AuditLedgerGrid transactions={transactions} />
          )}

          {/* Subtle Bottom Pull-Handle */}
          <div className="mt-4 flex justify-center">
            <button
              type="button"
              onClick={onClose}
              className="group flex items-center gap-2 rounded-full border border-slate-800 bg-slate-900 px-4 py-1 text-[11px] font-medium text-slate-400 transition hover:border-slate-700 hover:text-white"
            >
              <span className="h-1 w-8 rounded-full bg-slate-700 group-hover:bg-slate-500" />
              <span>Close Behind the Scenes</span>
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}
