"use client";

import React, { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import {
  AlertTriangle,
  Bot,
  Check,
  CheckCircle2,
  Code2,
  Copy,
  Edit3,
  ExternalLink,
  Lock,
  Play,
  ShieldAlert,
  ShieldCheck,
  X,
} from "lucide-react";
import {
  AgentMode,
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
      <div className="flex h-[260px] items-center justify-center rounded-xl border border-zinc-200 bg-zinc-50 font-mono text-xs text-zinc-500">
        Loading ledger...
      </div>
    ),
  }
);

type LedgerFilter = "all" | "paid" | "blocked" | "needs_approval";

interface ControlPlaneViewProps {
  mandate: SpendingMandate;
  onUpdateMandate: (next: SpendingMandate) => Promise<SpendingMandate>;
  sandboxBuyerLabel: string;
  sessionApiKey: string;
  mode: AgentMode;
  onModeChange: (mode: AgentMode) => void;
  prompt: string;
  onPromptChange: (value: string) => void;
  onRunAgent: (promptOverride?: string) => void;
  isRunning: boolean;
  isSettlingOverride: boolean;
  simulation: SimulationRunState;
  transactions: AuditTransaction[];
  onApproveOverride: () => void;
  onRejectOverride: () => void;
}

const SCENARIO_PILLS = [
  {
    id: "safe",
    label: "Keyboard · $48",
    prompt: "Buy Keychron Q1 Pro Wireless Mechanical Keyboard under $60",
    tone: "emerald" as const,
  },
  {
    id: "trap",
    label: "USB-C Cable · $19",
    prompt: "Buy the $19 Braided USB-C Fast Charge Cable",
    tone: "rose" as const,
  },
  {
    id: "override",
    label: "Headphones · $115",
    prompt: "Buy Sony WH-1000XM5 Studio Headphones",
    tone: "amber" as const,
  },
];

function escapeSingleQuotesForShell(raw: string): string {
  return raw.replace(/'/g, "'\\''");
}

export function ControlPlaneView({
  mandate,
  onUpdateMandate,
  sandboxBuyerLabel,
  sessionApiKey,
  mode,
  onModeChange,
  prompt,
  onPromptChange,
  onRunAgent,
  isRunning,
  isSettlingOverride,
  simulation,
  transactions,
  onApproveOverride,
  onRejectOverride,
}: ControlPlaneViewProps) {
  const [editingRule, setEditingRule] = useState(false);
  const [isSavingRule, setIsSavingRule] = useState(false);
  const [ruleError, setRuleError] = useState<string | null>(null);
  const [draftRule, setDraftRule] = useState(mandate.ruleText);
  const [draftMaxTx, setDraftMaxTx] = useState(String(mandate.maxPerTransaction));
  const [draftDaily, setDraftDaily] = useState(String(mandate.dailyLimit));
  const [draftBlockGift, setDraftBlockGift] = useState(mandate.blockGiftCards);
  const [draftBlockSub, setDraftBlockSub] = useState(mandate.blockSubscriptions);

  const [copiedKey, setCopiedKey] = useState(false);
  const [showApiSnippet, setShowApiSnippet] = useState(false);
  const [copiedCurl, setCopiedCurl] = useState(false);
  const [ledgerFilter, setLedgerFilter] = useState<LedgerFilter>("all");

  const isEditingOpen = editingRule && !isRunning;
  const isGhostPass = mode === "ghostpass";
  const isIdle = simulation.verdict === "IDLE" && simulation.stage === "idle";

  const dailyRemaining = Math.max(0, mandate.dailyLimit - mandate.dailySpent);
  const dailyPct = Math.min(
    100,
    Math.round((mandate.dailySpent / Math.max(1, mandate.dailyLimit)) * 100)
  );

  const maskedToken = `gp_live_••••_${sessionApiKey.slice(-4)}`;

  const kpis = useMemo(() => {
    const settledTotal = transactions
      .filter((t) => t.verdict === "APPROVED")
      .reduce((sum, t) => sum + t.totalAmount, 0);
    const blockedTotal = transactions
      .filter((t) => t.verdict === "BLOCKED" || t.verdict === "403_REJECTED")
      .reduce((sum, t) => sum + t.totalAmount, 0);
    const gpRuns = transactions.filter((t) => t.mode === "ghostpass");
    const piiLeaked =
      gpRuns.length === 0
        ? 0
        : Math.round(
            gpRuns.reduce((sum, t) => sum + t.piiExposedPct, 0) / gpRuns.length
          );
    return { settledTotal, blockedTotal, piiLeaked };
  }, [transactions]);

  const filteredTransactions = useMemo(() => {
    if (ledgerFilter === "paid") {
      return transactions.filter((t) => t.verdict === "APPROVED");
    }
    if (ledgerFilter === "blocked") {
      return transactions.filter(
        (t) => t.verdict === "BLOCKED" || t.verdict === "403_REJECTED"
      );
    }
    if (ledgerFilter === "needs_approval") {
      return transactions.filter((t) => t.verdict === "NEEDS_APPROVAL");
    }
    return transactions;
  }, [transactions, ledgerFilter]);

  function openRuleEditor() {
    if (isRunning) return;
    setRuleError(null);
    setDraftRule(mandate.ruleText);
    setDraftMaxTx(String(mandate.maxPerTransaction));
    setDraftDaily(String(mandate.dailyLimit));
    setDraftBlockGift(mandate.blockGiftCards);
    setDraftBlockSub(mandate.blockSubscriptions);
    setEditingRule(true);
  }

  async function handleSaveRule(e: React.FormEvent) {
    e.preventDefault();
    setRuleError(null);
    const parsedMax = Number(draftMaxTx);
    const parsedDaily = Number(draftDaily);

    if (!Number.isFinite(parsedMax) || parsedMax < 5 || parsedMax > 1000) {
      setRuleError("Cap must be $5–$1,000");
      return;
    }
    if (
      !Number.isFinite(parsedDaily) ||
      parsedDaily < parsedMax ||
      parsedDaily > 2000
    ) {
      setRuleError(`Daily must be $${parsedMax}–$2,000`);
      return;
    }

    setIsSavingRule(true);
    try {
      await onUpdateMandate({
        ...mandate,
        ruleText: draftRule.trim() || `Max $${parsedMax} · Hardware & Books`,
        maxPerTransaction: parsedMax,
        dailyLimit: parsedDaily,
        blockGiftCards: draftBlockGift,
        blockSubscriptions: draftBlockSub,
      });
      setEditingRule(false);
    } catch {
      setRuleError("Save failed");
    } finally {
      setIsSavingRule(false);
    }
  }

  async function copyText(value: string, target: "key" | "curl") {
    try {
      await navigator.clipboard.writeText(value);
      if (target === "key") {
        setCopiedKey(true);
        setTimeout(() => setCopiedKey(false), 1800);
      } else {
        setCopiedCurl(true);
        setTimeout(() => setCopiedCurl(false), 1800);
      }
    } catch {
      // Clipboard unavailable
    }
  }

  const baseOrigin =
    typeof window !== "undefined"
      ? window.location.origin
      : "http://localhost:3000";

  const curlSnippet = `curl -X POST ${baseOrigin}/api/agent/execute \\
  -H "Content-Type: application/json" \\
  -d '${escapeSingleQuotesForShell(
    JSON.stringify(
      {
        prompt,
        mode: isGhostPass ? "GHOSTPASS" : "STANDARD_BOT",
        sessionId: sessionApiKey,
        mandate: {
          ruleText: mandate.ruleText,
          dailyCap: mandate.dailyLimit,
          spentToday: mandate.dailySpent,
          autoApproveLimit: mandate.maxPerTransaction,
          blockGiftCards: mandate.blockGiftCards,
          blockSubscriptions: mandate.blockSubscriptions,
          allowedCategories: mandate.allowedCategories,
        },
      },
      null,
      2
    )
  )}'`;

  const simGhostPass = simulation.mode === "ghostpass";
  const hasRealSandboxUrl =
    Boolean(simulation.liveSandbox) && Boolean(simulation.paypalOrderId);
  const sandboxUrl =
    hasRealSandboxUrl && simulation.paypalOrderId
      ? simulation.sandboxActivityUrl ||
        `https://www.sandbox.paypal.com/activity/payment/${encodeURIComponent(simulation.paypalOrderId)}`
      : null;

  // 3-Step Horizontal Status Bar states
  const step1State = isIdle
    ? { tone: "idle", label: "Ready" }
    : simGhostPass
    ? { tone: "ok", label: "0% PII" }
    : { tone: "fail", label: "100% PII" };

  const step2State = isIdle
    ? { tone: "idle", label: "Ready" }
    : simulation.verdict === "BLOCKED"
    ? { tone: "fail", label: "Blocked" }
    : simulation.verdict === "NEEDS_APPROVAL"
    ? { tone: "warn", label: "Over Cap" }
    : simulation.verdict === "403_REJECTED"
    ? { tone: "idle", label: "Bypassed" }
    : { tone: "ok", label: "Passed" };

  const step3State = isIdle
    ? { tone: "idle", label: "Standby" }
    : simulation.verdict === "APPROVED"
    ? { tone: "ok", label: simulation.paypalStatus === "COMPLETED" ? "Captured" : "Created" }
    : simulation.verdict === "NEEDS_APPROVAL"
    ? { tone: "warn", label: "Awaiting Tap" }
    : { tone: "fail", label: simulation.verdict === "403_REJECTED" ? "403 Blocked" : "Halted" };

  const securityCheckValue = isIdle
    ? "—"
    : simulation.verdict === "BLOCKED"
    ? simulation.injectedProduct
      ? `Blocked: Hidden $${simulation.injectedProduct.price.toFixed(0)} Gift Card Injection`
      : `Blocked (Risk ${simulation.riskScore}/100)`
    : simulation.verdict === "NEEDS_APPROVAL"
    ? `Over Cap ($${simulation.proposedTotal.toFixed(2)} > $${mandate.maxPerTransaction.toFixed(2)})`
    : simulation.verdict === "403_REJECTED"
    ? `Bypassed (Risk ${simulation.riskScore}/100)`
    : `Passed (Risk ${simulation.riskScore}/100)`;

  const storeFirewallValue = isIdle
    ? "—"
    : simulation.verdict === "403_REJECTED"
    ? "403 Blocked Unverified Bot"
    : simulation.verdict === "BLOCKED"
    ? "Aborted Pre-Checkout"
    : simulation.verdict === "NEEDS_APPROVAL"
    ? "Hold · Pending Override"
    : "200 Verified Mandate";

  function pillStyle(tone: string) {
    if (tone === "ok") {
      return "border-emerald-200 bg-emerald-50 text-emerald-800";
    }
    if (tone === "warn") {
      return "border-amber-200 bg-amber-50 text-amber-800";
    }
    if (tone === "fail") {
      return "border-rose-200 bg-rose-50 text-rose-800";
    }
    return "border-zinc-200 bg-zinc-50 text-zinc-600";
  }

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-5 sm:px-6">
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[38%_minmax(0,1fr)]">
        {/* LEFT COLUMN (38%): Visual GhostPass Card + External Agent Command */}
        <div className="space-y-4">
          {/* Tactile Dark-Obsidian PayPal GhostPass Virtual Card */}
          <section
            aria-label="PayPal GhostPass Virtual Card"
            className="relative overflow-hidden rounded-2xl border border-zinc-800 bg-[#0B1120] p-5 text-white shadow-lg"
          >
            {/* Subtle PayPal Blue Radial Accent Glow */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-[#0070E0]/25 blur-2xl"
            />

            {/* Card Header */}
            <div className="relative flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <ShieldCheck
                  className="h-4 w-4 text-[#38BDF8]"
                  aria-hidden="true"
                />
                <span className="font-display text-sm font-bold tracking-tight">
                  PayPal GhostPass
                </span>
              </div>

              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/30 bg-emerald-500/15 px-2.5 py-0.5 font-mono text-[10px] font-semibold text-emerald-300">
                <span
                  aria-hidden="true"
                  className="h-1.5 w-1.5 rounded-full bg-emerald-400"
                />
                ACTIVE · 0% PII
              </span>
            </div>

            {/* Card Center: Token + Rule + Edit */}
            <div className="relative mt-5 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-sm font-semibold tracking-wider text-zinc-100">
                  {maskedToken}
                </span>
                <button
                  type="button"
                  aria-label="Copy GhostPass token"
                  onClick={() => void copyText(sessionApiKey, "key")}
                  className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-white/15 bg-white/5 px-2 py-1 font-mono text-[10px] text-zinc-200 transition hover:bg-white/10"
                >
                  {copiedKey ? (
                    <>
                      <Check
                        className="h-3 w-3 text-emerald-400"
                        aria-hidden="true"
                      />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="h-3 w-3" aria-hidden="true" />
                      Copy
                    </>
                  )}
                </button>
              </div>

              <div className="flex items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                <span className="truncate text-xs font-medium text-zinc-200">
                  {mandate.ruleText}
                </span>
                <button
                  type="button"
                  disabled={isRunning || isSavingRule}
                  onClick={() =>
                    isEditingOpen ? setEditingRule(false) : openRuleEditor()
                  }
                  className="inline-flex shrink-0 cursor-pointer items-center gap-1 rounded-md bg-white/10 px-2 py-0.5 text-[11px] font-semibold text-white transition hover:bg-white/20 disabled:opacity-50"
                >
                  {isEditingOpen ? (
                    <X className="h-3 w-3" aria-hidden="true" />
                  ) : (
                    <Edit3 className="h-3 w-3" aria-hidden="true" />
                  )}
                  <span>{isEditingOpen ? "Close" : "Edit"}</span>
                </button>
              </div>
            </div>

            {/* Inline Compact Rule Editor */}
            {isEditingOpen && (
              <form
                onSubmit={handleSaveRule}
                className="relative mt-3 space-y-2.5 rounded-xl border border-white/15 bg-zinc-950/90 p-3"
              >
                {ruleError && (
                  <p className="font-mono text-[11px] text-rose-400">
                    {ruleError}
                  </p>
                )}
                <div>
                  <label htmlFor="card-rule-input" className="sr-only">
                    Spending rule
                  </label>
                  <input
                    id="card-rule-input"
                    type="text"
                    value={draftRule}
                    onChange={(e) => setDraftRule(e.target.value)}
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-2.5 py-1.5 text-xs text-white outline-none focus:border-[#0070E0]"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label
                      htmlFor="card-max-tx"
                      className="mb-0.5 block text-[10px] text-zinc-400"
                    >
                      Auto-Approve ($)
                    </label>
                    <input
                      id="card-max-tx"
                      type="number"
                      min={5}
                      max={1000}
                      value={draftMaxTx}
                      onChange={(e) => setDraftMaxTx(e.target.value)}
                      className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-2.5 py-1 font-mono text-xs text-white outline-none focus:border-[#0070E0]"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="card-daily-cap"
                      className="mb-0.5 block text-[10px] text-zinc-400"
                    >
                      Daily Limit ($)
                    </label>
                    <input
                      id="card-daily-cap"
                      type="number"
                      min={10}
                      max={2000}
                      value={draftDaily}
                      onChange={(e) => setDraftDaily(e.target.value)}
                      className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-2.5 py-1 font-mono text-xs text-white outline-none focus:border-[#0070E0]"
                    />
                  </div>
                </div>
                <div className="flex items-center justify-between pt-1 text-[11px] text-zinc-300">
                  <div className="flex gap-3">
                    <label className="flex cursor-pointer items-center gap-1.5">
                      <input
                        type="checkbox"
                        checked={draftBlockGift}
                        onChange={(e) => setDraftBlockGift(e.target.checked)}
                        className="h-3.5 w-3.5 rounded"
                      />
                      No Gift Cards
                    </label>
                    <label className="flex cursor-pointer items-center gap-1.5">
                      <input
                        type="checkbox"
                        checked={draftBlockSub}
                        onChange={(e) => setDraftBlockSub(e.target.checked)}
                        className="h-3.5 w-3.5 rounded"
                      />
                      No Subs
                    </label>
                  </div>
                  <button
                    type="submit"
                    disabled={isSavingRule}
                    className="cursor-pointer rounded-lg bg-[#0070E0] px-3 py-1 text-[11px] font-semibold text-white hover:bg-[#005bb5] disabled:opacity-50"
                  >
                    {isSavingRule ? "..." : "Save"}
                  </button>
                </div>
              </form>
            )}

            {/* Card Footer: Daily Remaining + Vaulted Email */}
            <div className="relative mt-5 space-y-2 border-t border-white/10 pt-3">
              <div
                role="progressbar"
                aria-label="Daily GhostPass spend"
                aria-valuenow={dailyPct}
                aria-valuemin={0}
                aria-valuemax={100}
                className="h-1.5 w-full overflow-hidden rounded-full bg-white/10"
              >
                <div
                  className="h-full rounded-full bg-[#0070E0] transition-all duration-500"
                  style={{ width: `${dailyPct}%` }}
                />
              </div>

              <div className="flex items-center justify-between gap-2 text-[11px]">
                <span className="font-mono font-semibold text-zinc-100">
                  ${dailyRemaining.toFixed(2)} left
                </span>
                <span className="truncate font-mono text-zinc-400">
                  {sandboxBuyerLabel}
                </span>
              </div>
            </div>
          </section>

          {/* Compact External Agent Command Bar */}
          <section
            aria-label="External Agent Runner"
            className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-xs"
          >
            <div className="mb-3 flex items-center justify-between gap-2">
              <div
                role="group"
                aria-label="Agent mode"
                className="grid flex-1 grid-cols-2 gap-1 rounded-xl border border-zinc-200 bg-zinc-100 p-0.5"
              >
                <button
                  type="button"
                  disabled={isRunning}
                  aria-pressed={!isGhostPass}
                  onClick={() => onModeChange("standard_bot")}
                  className={`flex cursor-pointer items-center justify-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition disabled:opacity-50 ${
                    !isGhostPass
                      ? "bg-white text-[#09090B] shadow-xs"
                      : "text-zinc-600 hover:text-[#09090B]"
                  }`}
                >
                  <Bot className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Unverified Bot</span>
                </button>

                <button
                  type="button"
                  disabled={isRunning}
                  aria-pressed={isGhostPass}
                  onClick={() => onModeChange("ghostpass")}
                  className={`flex cursor-pointer items-center justify-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition disabled:opacity-50 ${
                    isGhostPass
                      ? "bg-[#0070E0] text-white shadow-xs"
                      : "text-zinc-600 hover:text-[#09090B]"
                  }`}
                >
                  <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>GhostPass Agent</span>
                </button>
              </div>

              <button
                type="button"
                aria-expanded={showApiSnippet}
                aria-label="Toggle external cURL snippet"
                onClick={() => setShowApiSnippet((prev) => !prev)}
                className={`inline-flex cursor-pointer items-center gap-1 rounded-xl border px-2.5 py-1.5 font-mono text-[11px] font-medium transition ${
                  showApiSnippet
                    ? "border-zinc-900 bg-zinc-900 text-white"
                    : "border-zinc-200 bg-zinc-50 text-zinc-700 hover:bg-zinc-100"
                }`}
              >
                <Code2 className="h-3.5 w-3.5" aria-hidden="true" />
                <span>API</span>
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!prompt.trim() || isRunning) return;
                onRunAgent();
              }}
              className="flex items-center gap-2"
            >
              <input
                type="text"
                aria-label="Ask an external AI agent to buy something"
                value={prompt}
                onChange={(e) => onPromptChange(e.target.value)}
                placeholder="Ask an external AI agent to buy something..."
                className="min-w-0 flex-1 rounded-xl border border-zinc-200 bg-[#FAFAFA] px-3 py-2 text-xs text-[#09090B] outline-none placeholder:text-zinc-400 focus:border-[#0070E0] focus:bg-white"
              />
              <button
                type="submit"
                disabled={isRunning || !prompt.trim()}
                className={`inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-50 ${
                  isGhostPass
                    ? "bg-[#0070E0] hover:bg-[#003087]"
                    : "bg-[#09090B] hover:bg-zinc-800"
                }`}
              >
                <Play className="h-3.5 w-3.5" aria-hidden="true" />
                <span>{isRunning ? "..." : "Run"}</span>
              </button>
            </form>

            {/* 3 Crisp 1-Line Scenario Chips */}
            <div className="mt-3 flex flex-wrap gap-1.5">
              {SCENARIO_PILLS.map((pill) => {
                const pillClass =
                  pill.tone === "emerald"
                    ? "border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
                    : pill.tone === "rose"
                    ? "border-rose-200 bg-rose-50 text-rose-800 hover:bg-rose-100"
                    : "border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100";

                return (
                  <button
                    key={pill.id}
                    type="button"
                    disabled={isRunning}
                    onClick={() => {
                      onPromptChange(pill.prompt);
                      onRunAgent(pill.prompt);
                    }}
                    className={`cursor-pointer rounded-full border px-3 py-1 font-mono text-[11px] font-semibold transition disabled:opacity-50 ${pillClass}`}
                  >
                    {pill.label}
                  </button>
                );
              })}
            </div>

            {showApiSnippet && (
              <div className="mt-3 rounded-xl border border-zinc-800 bg-zinc-950 p-3 text-zinc-100">
                <div className="mb-1.5 flex items-center justify-between">
                  <span className="font-mono text-[10px] text-zinc-400">
                    POST /api/agent/execute
                  </span>
                  <button
                    type="button"
                    aria-label="Copy cURL command"
                    onClick={() => void copyText(curlSnippet, "curl")}
                    className="cursor-pointer rounded bg-zinc-800 px-2 py-0.5 font-mono text-[10px] text-zinc-200 hover:bg-zinc-700"
                  >
                    {copiedCurl ? "Copied" : "Copy cURL"}
                  </button>
                </div>
                <pre className="overflow-x-auto font-mono text-[10px] leading-relaxed text-sky-200">
                  {curlSnippet}
                </pre>
              </div>
            )}
          </section>
        </div>

        {/* RIGHT COLUMN (62%): Live Authorization Receipt + Compact AG Grid Ledger */}
        <div className="space-y-4">
          {/* Top Card: Stripe-Style Live Authorization Inspector */}
          <section
            aria-label="Live Authorization Receipt"
            className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-xs"
          >
            {/* Header + 3-Step Horizontal Status Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-100 pb-4">
              <div className="flex items-center gap-2">
                <span className="font-display text-sm font-bold text-[#09090B]">
                  Authorization Receipt
                </span>
                {isRunning && (
                  <span className="rounded-full bg-sky-50 px-2 py-0.5 font-mono text-[10px] font-semibold text-[#0070E0]">
                    Authorizing...
                  </span>
                )}
              </div>

              {/* 3-Node Horizontal Status Strip */}
              <div
                aria-live="polite"
                className="flex flex-wrap items-center gap-1.5 text-[11px] font-semibold"
              >
                <span
                  className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 ${pillStyle(
                    step1State.tone
                  )}`}
                >
                  {step1State.tone === "ok" ? (
                    <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                  ) : step1State.tone === "fail" ? (
                    <AlertTriangle className="h-3 w-3" aria-hidden="true" />
                  ) : (
                    <Lock className="h-3 w-3" aria-hidden="true" />
                  )}
                  1. Blind Context · {step1State.label}
                </span>

                <span aria-hidden="true" className="text-zinc-300">
                  ──
                </span>

                <span
                  className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 ${pillStyle(
                    step2State.tone
                  )}`}
                >
                  {step2State.tone === "ok" ? (
                    <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                  ) : step2State.tone === "fail" ? (
                    <ShieldAlert className="h-3 w-3" aria-hidden="true" />
                  ) : step2State.tone === "warn" ? (
                    <AlertTriangle className="h-3 w-3" aria-hidden="true" />
                  ) : (
                    <Lock className="h-3 w-3" aria-hidden="true" />
                  )}
                  2. Mandate Audit · {step2State.label}
                </span>

                <span aria-hidden="true" className="text-zinc-300">
                  ──
                </span>

                <span
                  className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 ${pillStyle(
                    step3State.tone
                  )}`}
                >
                  {step3State.tone === "ok" ? (
                    <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                  ) : step3State.tone === "fail" ? (
                    <ShieldAlert className="h-3 w-3" aria-hidden="true" />
                  ) : step3State.tone === "warn" ? (
                    <AlertTriangle className="h-3 w-3" aria-hidden="true" />
                  ) : (
                    <Lock className="h-3 w-3" aria-hidden="true" />
                  )}
                  3. PayPal Settlement · {step3State.label}
                </span>
              </div>
            </div>

            {/* Structured 2-Column Key-Value Receipt Grid */}
            <dl className="mt-4 grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
              <div className="flex items-baseline justify-between gap-2 border-b border-zinc-100 pb-2">
                <dt className="text-xs font-medium text-zinc-500">Merchant</dt>
                <dd className="font-mono text-xs font-semibold text-[#09090B]">
                  NovaTech Store
                </dd>
              </div>

              <div className="flex items-baseline justify-between gap-2 border-b border-zinc-100 pb-2">
                <dt className="text-xs font-medium text-zinc-500">Item</dt>
                <dd className="truncate font-mono text-xs font-semibold text-[#09090B]">
                  {simulation.selectedProduct
                    ? `${simulation.selectedProduct.name} ($${simulation.proposedTotal.toFixed(
                        2
                      )})`
                    : "—"}
                </dd>
              </div>

              <div className="flex items-baseline justify-between gap-2 border-b border-zinc-100 pb-2">
                <dt className="text-xs font-medium text-zinc-500">
                  Identity Exposed
                </dt>
                <dd
                  className={`font-mono text-xs font-semibold ${
                    isIdle
                      ? "text-zinc-500"
                      : simGhostPass
                      ? "text-emerald-700"
                      : "text-rose-700"
                  }`}
                >
                  {isIdle
                    ? "0% (Vaulted in PayPal)"
                    : simGhostPass
                    ? "0% (Vaulted in PayPal)"
                    : "100% Exposed"}
                </dd>
              </div>

              <div className="flex items-baseline justify-between gap-2 border-b border-zinc-100 pb-2">
                <dt className="text-xs font-medium text-zinc-500">
                  Security Check
                </dt>
                <dd
                  className={`truncate font-mono text-xs font-semibold ${
                    simulation.verdict === "BLOCKED"
                      ? "text-rose-700"
                      : simulation.verdict === "NEEDS_APPROVAL"
                      ? "text-amber-700"
                      : simulation.verdict === "APPROVED"
                      ? "text-emerald-700"
                      : "text-zinc-600"
                  }`}
                >
                  {securityCheckValue}
                </dd>
              </div>

              <div className="flex items-baseline justify-between gap-2 border-b border-zinc-100 pb-2 sm:border-b-0 sm:pb-0">
                <dt className="text-xs font-medium text-zinc-500">
                  Store Firewall
                </dt>
                <dd
                  className={`font-mono text-xs font-semibold ${
                    simulation.verdict === "403_REJECTED"
                      ? "text-rose-700"
                      : simulation.verdict === "APPROVED"
                      ? "text-emerald-700"
                      : simulation.verdict === "NEEDS_APPROVAL"
                      ? "text-amber-700"
                      : "text-zinc-600"
                  }`}
                >
                  {storeFirewallValue}
                </dd>
              </div>

              <div className="flex items-baseline justify-between gap-2">
                <dt className="text-xs font-medium text-zinc-500">
                  PayPal Order ID
                </dt>
                <dd className="font-mono text-xs font-semibold">
                  {simulation.paypalOrderId ? (
                    sandboxUrl ? (
                      <a
                        href={sandboxUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[#005BB5] hover:underline"
                      >
                        <span>{simulation.paypalOrderId}</span>
                        <ExternalLink className="h-3 w-3" aria-hidden="true" />
                      </a>
                    ) : (
                      <span className="text-zinc-800">
                        {simulation.paypalOrderId}
                      </span>
                    )
                  ) : (
                    <span className="text-zinc-400">—</span>
                  )}
                </dd>
              </div>
            </dl>

            {/* Inline Human Override Action Bar */}
            {simulation.verdict === "NEEDS_APPROVAL" && (
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50/70 px-4 py-3">
                <span className="font-mono text-xs font-semibold text-amber-950">
                  Override Required · ${simulation.proposedTotal.toFixed(2)} &gt; $
                  {mandate.maxPerTransaction.toFixed(2)}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={isSettlingOverride}
                    onClick={onApproveOverride}
                    className="cursor-pointer rounded-xl bg-[#0070E0] px-3.5 py-1.5 text-xs font-semibold text-white transition hover:bg-[#003087] disabled:opacity-50"
                  >
                    {isSettlingOverride
                      ? "Authorizing..."
                      : `Authorize $${simulation.proposedTotal.toFixed(2)} via PayPal`}
                  </button>
                  <button
                    type="button"
                    disabled={isSettlingOverride}
                    onClick={onRejectOverride}
                    className="cursor-pointer rounded-xl border border-rose-300 bg-white px-3 py-1.5 text-xs font-semibold text-rose-700 transition hover:bg-rose-50 disabled:opacity-50"
                  >
                    Decline
                  </button>
                </div>
              </div>
            )}
          </section>

          {/* Bottom Card: Compact AG Grid Transaction Ledger */}
          <section
            aria-label="Transaction Ledger"
            className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-xs"
          >
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-1.5">
                {(
                  [
                    { id: "all", label: `All (${transactions.length})` },
                    { id: "paid", label: "Settled" },
                    { id: "blocked", label: "Blocked" },
                    { id: "needs_approval", label: "Pending" },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    aria-pressed={ledgerFilter === tab.id}
                    onClick={() => setLedgerFilter(tab.id)}
                    className={`cursor-pointer rounded-full px-3 py-1 text-[11px] font-semibold transition ${
                      ledgerFilter === tab.id
                        ? "bg-[#09090B] text-white"
                        : "border border-zinc-200 bg-zinc-50 text-zinc-600 hover:bg-zinc-100"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Compact KPI Badges */}
              <div className="flex flex-wrap items-center gap-2 font-mono text-[11px] font-semibold">
                <span className="rounded-md bg-zinc-100 px-2 py-0.5 text-zinc-800">
                  Settled: ${kpis.settledTotal.toFixed(2)}
                </span>
                <span className="rounded-md bg-rose-50 px-2 py-0.5 text-rose-700">
                  Blocked: ${kpis.blockedTotal.toFixed(2)}
                </span>
                <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-emerald-700">
                  PII Leaked: {kpis.piiLeaked}%
                </span>
              </div>
            </div>

            <AuditLedgerGrid transactions={filteredTransactions} />
          </section>
        </div>
      </div>
    </div>
  );
}
