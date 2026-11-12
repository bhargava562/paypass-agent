"use client";

import React, { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import {
  AlertOctagon,
  Bot,
  Check,
  CheckCircle2,
  Code2,
  Copy,
  Edit3,
  ExternalLink,
  KeyRound,
  Lock,
  Send,
  ShieldAlert,
  ShieldCheck,
  Store,
  UserCheck,
  Vault,
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
      <div className="flex h-[340px] items-center justify-center rounded-2xl border border-zinc-200 bg-zinc-50 text-xs text-zinc-500">
        Loading Audit &amp; Compliance Ledger...
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

const CONTROL_PLANE_SCENARIOS = [
  {
    id: "safe",
    title: "1. Buy Wireless Keyboard ($48)",
    subtitle: "Safe purchase within $60 rule — settles via PayPal Orders v2",
    prompt: "Buy Keychron Q1 Pro Wireless Mechanical Keyboard under $60",
    tone: "emerald" as const,
  },
  {
    id: "trap",
    title: "2. Buy USB-C Cable ($19 — Hidden Gift Card Trap)",
    subtitle: "Store HTML tries to sneak a $75 Steam Gift Card into checkout",
    prompt: "Buy the $19 Braided USB-C Fast Charge Cable",
    tone: "rose" as const,
  },
  {
    id: "override",
    title: "3. Buy Studio Headphones ($115 — Requires Human Approval)",
    subtitle: "Safe audio hardware over $60 cap — pauses for 1-click approve",
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

  const dailyPct = Math.min(
    100,
    Math.round((mandate.dailySpent / Math.max(1, mandate.dailyLimit)) * 100)
  );

  // KPI calculations
  const kpis = useMemo(() => {
    const settledTotal = transactions
      .filter((t) => t.verdict === "APPROVED")
      .reduce((sum, t) => sum + t.totalAmount, 0);
    const scamBlockedTotal = transactions
      .filter((t) => t.verdict === "BLOCKED" || t.verdict === "403_REJECTED")
      .reduce((sum, t) => sum + t.totalAmount, 0);
    const ghostpassRuns = transactions.filter((t) => t.mode === "ghostpass");
    const ghostpassAvgPii =
      ghostpassRuns.length === 0
        ? 0
        : Math.round(
            ghostpassRuns.reduce((sum, t) => sum + t.piiExposedPct, 0) /
              ghostpassRuns.length
          );
    return {
      settledTotal,
      scamBlockedTotal,
      ghostpassAvgPii,
    };
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
      setRuleError("Auto-Approve Cap must be between $5 and $1,000.");
      return;
    }
    if (!Number.isFinite(parsedDaily) || parsedDaily < parsedMax || parsedDaily > 2000) {
      setRuleError(
        `Daily Cap must be between $${parsedMax.toFixed(0)} and $2,000.`
      );
      return;
    }

    setIsSavingRule(true);
    try {
      await onUpdateMandate({
        ...mandate,
        ruleText: draftRule.trim() || `Max $${parsedMax} · Hardware & books only`,
        maxPerTransaction: parsedMax,
        dailyLimit: parsedDaily,
        blockGiftCards: draftBlockGift,
        blockSubscriptions: draftBlockSub,
      });
      setEditingRule(false);
    } catch {
      setRuleError("Failed to save mandate rules. Please try again.");
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
      // Clipboard unavailable in restricted browser context
    }
  }

  const baseOrigin =
    typeof window !== "undefined" ? window.location.origin : "http://localhost:3000";

  const jsonPayload = escapeSingleQuotesForShell(
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
  );

  const curlSnippet = `curl -X POST ${baseOrigin}/api/agent/execute \\
  -H "Content-Type: application/json" \\
  -d '${jsonPayload}'`;

  const simModeGhostPass = simulation.mode === "ghostpass";
  const hasRealSandboxUrl =
    Boolean(simulation.liveSandbox) && Boolean(simulation.paypalOrderId);
  const sandboxUrl =
    hasRealSandboxUrl && simulation.paypalOrderId
      ? simulation.sandboxActivityUrl ||
        `https://www.sandbox.paypal.com/activity/payment/${encodeURIComponent(simulation.paypalOrderId)}`
      : null;

  const settlementHeading =
    simulation.paypalStatus === "COMPLETED"
      ? `Captured $${simulation.proposedTotal.toFixed(2)} USD via PayPal Orders v2`
      : simulation.paypalStatus === "SIMULATED_SANDBOX"
      ? `Simulated Sandbox Order ($${simulation.proposedTotal.toFixed(2)} USD)`
      : `Created PayPal Sandbox Order ($${simulation.proposedTotal.toFixed(2)} USD)`;

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 px-4 py-6 sm:px-6">
      {/* Main 2-Column Infrastructure Workspace */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* COLUMN 1: Mandate Vault & Agent Sandbox Runner */}
        <div className="space-y-5 lg:col-span-5">
          {/* Card A: PayPal GhostPass Vault & Mandate */}
          <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-xs">
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-[#0070E0]">
                  <Vault className="h-3.5 w-3.5" aria-hidden="true" />
                  1. PayPal Vault &amp; Spending Mandate
                </span>
                <h2 className="mt-1 font-display text-base font-bold text-[#09090B]">
                  Your Protected PayPal Rules
                </h2>
              </div>

              <button
                type="button"
                disabled={isRunning || isSavingRule}
                onClick={() =>
                  isEditingOpen ? setEditingRule(false) : openRuleEditor()
                }
                className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-xs font-medium text-zinc-700 transition hover:bg-zinc-100 disabled:opacity-50"
              >
                {isEditingOpen ? (
                  <>
                    <X className="h-3.5 w-3.5" aria-hidden="true" />
                    Cancel
                  </>
                ) : (
                  <>
                    <Edit3 className="h-3.5 w-3.5" aria-hidden="true" />
                    Edit Rule
                  </>
                )}
              </button>
            </div>

            {/* Connected Vault Account */}
            <div className="mt-3 flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50/70 px-3 py-2 text-xs">
              <span className="font-medium text-emerald-950">
                PayPal Vault: <span className="font-mono">{sandboxBuyerLabel}</span>
              </span>
              <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-semibold text-white">
                Hidden from AI
              </span>
            </div>

            {!isEditingOpen ? (
              <div className="mt-3.5 space-y-3">
                <div className="rounded-xl border border-zinc-200 bg-[#FAFAFA] p-3">
                  <p className="text-[11px] font-medium text-zinc-500">
                    Active Plain-English Mandate
                  </p>
                  <p className="mt-1 text-xs font-semibold text-[#09090B]">
                    &ldquo;{mandate.ruleText}&rdquo;
                  </p>
                </div>

                <div>
                  <div className="mb-1.5 flex items-center justify-between text-xs">
                    <span className="text-zinc-600">
                      Auto-Approve Cap:{" "}
                      <strong className="font-mono text-[#09090B]">
                        ${mandate.maxPerTransaction.toFixed(2)}
                      </strong>
                    </span>
                    <span className="font-mono text-zinc-600">
                      Daily ${mandate.dailySpent.toFixed(2)} / $
                      {mandate.dailyLimit.toFixed(2)}
                    </span>
                  </div>
                  <div
                    role="progressbar"
                    aria-label="Daily mandate budget used"
                    aria-valuenow={dailyPct}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    className="h-2 w-full overflow-hidden rounded-full bg-zinc-100"
                  >
                    <div
                      className="h-full rounded-full bg-[#0070E0] transition-all duration-500"
                      style={{ width: `${dailyPct}%` }}
                    />
                  </div>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSaveRule} className="mt-3.5 space-y-3">
                {ruleError && (
                  <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">
                    {ruleError}
                  </p>
                )}

                <div>
                  <label
                    htmlFor="cp-rule-text"
                    className="mb-1 block text-xs font-medium text-zinc-600"
                  >
                    Plain-English Spending Rule
                  </label>
                  <input
                    id="cp-rule-text"
                    type="text"
                    value={draftRule}
                    onChange={(e) => setDraftRule(e.target.value)}
                    className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-[#09090B] outline-none focus:border-[#0070E0] focus:bg-white"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label
                      htmlFor="cp-max-tx"
                      className="mb-1 block text-xs font-medium text-zinc-600"
                    >
                      Auto-Approve Cap ($)
                    </label>
                    <input
                      id="cp-max-tx"
                      type="number"
                      min={5}
                      max={1000}
                      value={draftMaxTx}
                      onChange={(e) => setDraftMaxTx(e.target.value)}
                      className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 font-mono text-xs text-[#09090B] outline-none focus:border-[#0070E0] focus:bg-white"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="cp-daily-cap"
                      className="mb-1 block text-xs font-medium text-zinc-600"
                    >
                      Daily Cap ($)
                    </label>
                    <input
                      id="cp-daily-cap"
                      type="number"
                      min={10}
                      max={2000}
                      value={draftDaily}
                      onChange={(e) => setDraftDaily(e.target.value)}
                      className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 font-mono text-xs text-[#09090B] outline-none focus:border-[#0070E0] focus:bg-white"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap gap-4 text-xs text-zinc-700">
                  <label className="flex cursor-pointer items-center gap-2">
                    <input
                      type="checkbox"
                      checked={draftBlockGift}
                      onChange={(e) => setDraftBlockGift(e.target.checked)}
                      className="h-4 w-4 rounded"
                    />
                    Block Gift Cards
                  </label>
                  <label className="flex cursor-pointer items-center gap-2">
                    <input
                      type="checkbox"
                      checked={draftBlockSub}
                      onChange={(e) => setDraftBlockSub(e.target.checked)}
                      className="h-4 w-4 rounded"
                    />
                    Block Subscriptions
                  </label>
                </div>

                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={isSavingRule}
                    className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-[#0070E0] px-4 py-1.5 text-xs font-semibold text-white hover:bg-[#003087] disabled:opacity-50"
                  >
                    <Check className="h-3.5 w-3.5" aria-hidden="true" />
                    {isSavingRule ? "Saving..." : "Save Mandate"}
                  </button>
                </div>
              </form>
            )}

            {/* Zero-PII Session / API Key */}
            <div className="mt-4 flex items-center justify-between gap-2 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2">
              <div className="flex min-w-0 items-center gap-2">
                <KeyRound
                  className="h-3.5 w-3.5 shrink-0 text-[#0070E0]"
                  aria-hidden="true"
                />
                <div className="min-w-0">
                  <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">
                    Zero-PII Agent Session Key
                  </p>
                  <p className="truncate font-mono text-xs font-semibold text-[#09090B]">
                    {sessionApiKey}
                  </p>
                </div>
              </div>
              <button
                type="button"
                aria-label="Copy Zero-PII Agent Session Key"
                onClick={() => void copyText(sessionApiKey, "key")}
                className="inline-flex shrink-0 cursor-pointer items-center gap-1 rounded-lg border border-zinc-200 bg-white px-2.5 py-1 text-[11px] font-medium text-zinc-700 hover:bg-zinc-100"
              >
                {copiedKey ? (
                  <>
                    <Check className="h-3 w-3 text-emerald-600" aria-hidden="true" />
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
          </section>

          {/* Card B: Live Agent Sandbox Runner */}
          <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-xs">
            <div className="flex items-center justify-between gap-2">
              <div>
                <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                  <Bot className="h-3.5 w-3.5 text-[#0070E0]" aria-hidden="true" />
                  2. Live Agent Sandbox Runner
                </span>
                <h2 className="mt-1 font-display text-base font-bold text-[#09090B]">
                  Trigger Any External AI Agent
                </h2>
              </div>

              <button
                type="button"
                aria-expanded={showApiSnippet}
                onClick={() => setShowApiSnippet((prev) => !prev)}
                className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-[11px] font-medium text-zinc-700 hover:bg-zinc-100"
              >
                <Code2 className="h-3.5 w-3.5" aria-hidden="true" />
                {showApiSnippet ? "Hide cURL" : "API / MCP"}
              </button>
            </div>

            {/* Mode Toggle */}
            <div
              role="group"
              aria-label="Agent authorization mode"
              className="mt-3.5 grid grid-cols-2 gap-2 rounded-xl border border-zinc-200 bg-zinc-100 p-1"
            >
              <button
                type="button"
                disabled={isRunning}
                aria-pressed={!isGhostPass}
                onClick={() => onModeChange("standard_bot")}
                className={`flex cursor-pointer items-center justify-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-semibold transition disabled:opacity-50 ${
                  !isGhostPass
                    ? "bg-white text-[#09090B] shadow-xs"
                    : "text-zinc-600 hover:text-[#09090B]"
                }`}
              >
                <Bot className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Unverified AI Bot</span>
              </button>

              <button
                type="button"
                disabled={isRunning}
                aria-pressed={isGhostPass}
                onClick={() => onModeChange("ghostpass")}
                className={`flex cursor-pointer items-center justify-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-semibold transition disabled:opacity-50 ${
                  isGhostPass
                    ? "bg-[#0070E0] text-white shadow-xs"
                    : "text-zinc-600 hover:text-[#09090B]"
                }`}
              >
                <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                <span>PayPal GhostPass</span>
              </button>
            </div>

            {/* Prompt Form */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!prompt.trim() || isRunning) return;
                onRunAgent();
              }}
              className="mt-3.5 flex items-center gap-2"
            >
              <input
                type="text"
                aria-label="Shopping instruction for AI agent"
                value={prompt}
                onChange={(e) => onPromptChange(e.target.value)}
                placeholder="Ask agent to buy something..."
                className="min-w-0 flex-1 rounded-xl border border-zinc-200 bg-[#FAFAFA] px-3.5 py-2.5 text-xs text-[#09090B] outline-none focus:border-[#0070E0] focus:bg-white"
              />
              <button
                type="submit"
                disabled={isRunning || !prompt.trim()}
                className={`inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-xl px-4 py-2.5 text-xs font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-50 ${
                  isGhostPass
                    ? "bg-[#0070E0] hover:bg-[#003087]"
                    : "bg-[#09090B] hover:bg-zinc-800"
                }`}
              >
                <Send className="h-3.5 w-3.5" aria-hidden="true" />
                <span>{isRunning ? "Running..." : "Run Agent"}</span>
              </button>
            </form>

            {/* 3 Clear Demo Scenarios */}
            <div className="mt-4 space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                One-Click Test Scenarios
              </p>
              {CONTROL_PLANE_SCENARIOS.map((sc) => {
                const style =
                  sc.tone === "emerald"
                    ? "border-emerald-200 bg-emerald-50/70 hover:bg-emerald-50 text-emerald-950"
                    : sc.tone === "rose"
                    ? "border-rose-200 bg-rose-50/70 hover:bg-rose-50 text-rose-950"
                    : "border-amber-200 bg-amber-50/70 hover:bg-amber-50 text-amber-950";

                return (
                  <button
                    key={sc.id}
                    type="button"
                    disabled={isRunning}
                    onClick={() => {
                      onPromptChange(sc.prompt);
                      onRunAgent(sc.prompt);
                    }}
                    className={`w-full cursor-pointer rounded-xl border p-3 text-left transition disabled:cursor-not-allowed disabled:opacity-50 ${style}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold">{sc.title}</span>
                      <span className="shrink-0 font-mono text-[10px] font-semibold opacity-75">
                        Execute →
                      </span>
                    </div>
                    <p className="mt-0.5 text-[11px] opacity-80">
                      {sc.subtitle}
                    </p>
                  </button>
                );
              })}
            </div>

            {showApiSnippet && (
              <div className="mt-4 rounded-xl border border-zinc-200 bg-zinc-950 p-3 text-zinc-100">
                <div className="mb-2 flex items-center justify-between">
                  <span className="font-mono text-[10px] uppercase tracking-wider text-zinc-400">
                    External Agent / MCP cURL Request
                  </span>
                  <button
                    type="button"
                    aria-label="Copy cURL command"
                    onClick={() => void copyText(curlSnippet, "curl")}
                    className="inline-flex cursor-pointer items-center gap-1 rounded bg-zinc-800 px-2 py-0.5 text-[10px] font-medium text-zinc-200 hover:bg-zinc-700"
                  >
                    {copiedCurl ? "Copied!" : "Copy cURL"}
                  </button>
                </div>
                <pre className="overflow-x-auto font-mono text-[11px] leading-relaxed text-sky-200">
                  {curlSnippet}
                </pre>
              </div>
            )}
          </section>
        </div>

        {/* COLUMN 2: Plain-English Live Execution Pipeline (4 Crystal-Clear Cards) */}
        <div className="lg:col-span-7">
          <section className="flex h-full flex-col rounded-2xl border border-zinc-200 bg-white p-5 shadow-xs">
            <div
              aria-live="polite"
              className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-zinc-100 pb-3.5"
            >
              <div>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                  Live Transaction Pipeline
                </span>
                <h2 className="mt-0.5 font-display text-lg font-bold text-[#09090B]">
                  {isIdle
                    ? "Ready — Run an agent to watch the 4-step handshake"
                    : simulation.selectedProduct
                    ? `Agent Request: ${simulation.selectedProduct.name} ($${simulation.proposedTotal.toFixed(2)})`
                    : "Executing GhostPass Pipeline..."}
                </h2>
              </div>

              <span
                className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                  simulation.verdict === "APPROVED"
                    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                    : simulation.verdict === "BLOCKED" ||
                      simulation.verdict === "403_REJECTED"
                    ? "border-rose-200 bg-rose-50 text-rose-800"
                    : simulation.verdict === "NEEDS_APPROVAL"
                    ? "border-amber-200 bg-amber-50 text-amber-800"
                    : "border-zinc-200 bg-zinc-50 text-zinc-600"
                }`}
              >
                {isRunning
                  ? "Processing..."
                  : simulation.verdict === "APPROVED"
                  ? "Authorized via PayPal"
                  : simulation.verdict === "BLOCKED"
                  ? "Blocked ($0 Moved)"
                  : simulation.verdict === "403_REJECTED"
                  ? "Blocked by Store (403)"
                  : simulation.verdict === "NEEDS_APPROVAL"
                  ? "Paused for Your Tap"
                  : "Standby"}
              </span>
            </div>

            <div className="grid flex-1 grid-cols-1 gap-4">
              {/* Step 1: Privacy Shield */}
              <div
                className={`rounded-2xl border p-4 transition ${
                  isIdle
                    ? "border-zinc-200 bg-[#FAFAFA]"
                    : simModeGhostPass
                    ? "border-emerald-200 bg-emerald-50/40"
                    : "border-rose-200 bg-rose-50/50"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#09090B] font-mono text-xs font-bold text-white">
                      1
                    </span>
                    <h3 className="text-sm font-bold text-[#09090B]">
                      Privacy Shield — What the AI Agent Saw
                    </h3>
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-0.5 font-mono text-[11px] font-semibold ${
                      isIdle
                        ? "bg-zinc-200 text-zinc-700"
                        : simModeGhostPass
                        ? "bg-emerald-600 text-white"
                        : "bg-rose-600 text-white"
                    }`}
                  >
                    {isIdle
                      ? "0% Leaked"
                      : `${simulation.piiExposedPct}% Personal Info Exposed`}
                  </span>
                </div>

                <div className="mt-3 grid grid-cols-1 gap-3 text-xs sm:grid-cols-2">
                  <div className="rounded-xl border border-zinc-200 bg-white p-3">
                    <p className="font-semibold text-zinc-700">
                      Shared With AI Agent
                    </p>
                    <p className="mt-1 text-zinc-600">
                      {isIdle || simModeGhostPass
                        ? "Public product catalog & item prices only."
                        : `${simulation.agentContextPreview.buyerName} · ${simulation.agentContextPreview.buyerEmail} · ${simulation.agentContextPreview.shippingAddr}`}
                    </p>
                  </div>
                  <div className="rounded-xl border border-zinc-200 bg-white p-3">
                    <p className="font-semibold text-zinc-700">
                      Stayed Locked in PayPal Vault
                    </p>
                    <p className="mt-1 text-zinc-600">
                      {isIdle || simModeGhostPass
                        ? "Your Name, Email, Home Address & PayPal Password (100% hidden)."
                        : "Nothing protected — standard scraper carried your raw identity."}
                    </p>
                  </div>
                </div>
              </div>

              {/* Step 2: Scam & Rule Check */}
              <div
                className={`rounded-2xl border p-4 transition ${
                  isIdle
                    ? "border-zinc-200 bg-[#FAFAFA]"
                    : simulation.verdict === "BLOCKED"
                    ? "border-rose-200 bg-rose-50/50"
                    : simulation.verdict === "NEEDS_APPROVAL"
                    ? "border-amber-200 bg-amber-50/50"
                    : simulation.verdict === "403_REJECTED"
                    ? "border-zinc-200 bg-zinc-50"
                    : "border-emerald-200 bg-emerald-50/40"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#09090B] font-mono text-xs font-bold text-white">
                      2
                    </span>
                    <h3 className="text-sm font-bold text-[#09090B]">
                      Scam &amp; Rule Check — GhostPass Gatekeeper
                    </h3>
                  </div>
                  <span className="font-mono text-xs font-semibold text-zinc-600">
                    Risk Score: {simulation.riskScore}/100
                  </span>
                </div>

                <ul className="mt-2.5 space-y-1 text-xs text-zinc-700">
                  {simulation.gatekeeperNotes.map((note, idx) => (
                    <li key={idx} className="leading-relaxed">
                      {note}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Step 3: Store Checkout Gate */}
              <div
                className={`rounded-2xl border p-4 transition ${
                  isIdle
                    ? "border-zinc-200 bg-[#FAFAFA]"
                    : simulation.verdict === "403_REJECTED"
                    ? "border-rose-200 bg-rose-50/50"
                    : simulation.verdict === "BLOCKED"
                    ? "border-zinc-200 bg-zinc-50"
                    : "border-emerald-200 bg-emerald-50/40"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#09090B] font-mono text-xs font-bold text-white">
                      3
                    </span>
                    <h3 className="text-sm font-bold text-[#09090B]">
                      Store Checkout Gate — NovaTech Merchant Firewall
                    </h3>
                  </div>
                  <span className="inline-flex items-center gap-1 font-mono text-xs font-semibold text-zinc-700">
                    <Store className="h-3.5 w-3.5" aria-hidden="true" />
                    {simulation.merchantStatusCode
                      ? `HTTP ${simulation.merchantStatusCode}`
                      : simulation.verdict === "BLOCKED"
                      ? "Aborted"
                      : "Standby"}
                  </span>
                </div>

                <p className="mt-2 text-xs text-zinc-700">
                  {simulation.verdict === "403_REJECTED"
                    ? "Blocked (HTTP 403): NovaTech's anti-bot firewall rejected the unverified AI scraper and triggered a CAPTCHA wall."
                    : simulation.verdict === "BLOCKED"
                    ? "Halted locally by GhostPass before touching NovaTech checkout — $0.00 left your wallet."
                    : simulation.verdict === "APPROVED"
                    ? "Accepted: NovaTech verified the cryptographic PayPal Human Mandate (No CAPTCHA / No 403 Bot-Block) and received your shipping address directly from PayPal."
                    : simulation.verdict === "NEEDS_APPROVAL"
                    ? "Hold: GhostPass Mandate signature waiting for your 1-click over-budget approval."
                    : "Merchants accept verified PayPal Human Mandates while blocking unverified bots."}
                </p>
              </div>

              {/* Step 4: PayPal Sandbox Settlement */}
              <div
                className={`rounded-2xl border p-4 transition ${
                  simulation.verdict === "APPROVED"
                    ? "border-emerald-300 bg-emerald-50/60"
                    : simulation.verdict === "NEEDS_APPROVAL"
                    ? "border-amber-300 bg-amber-50/60"
                    : simulation.verdict === "BLOCKED" ||
                      simulation.verdict === "403_REJECTED"
                    ? "border-rose-200 bg-rose-50/50"
                    : "border-zinc-200 bg-[#FAFAFA]"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#0070E0] font-mono text-xs font-bold text-white">
                      4
                    </span>
                    <h3 className="text-sm font-bold text-[#09090B]">
                      PayPal Sandbox Settlement (Orders v2)
                    </h3>
                  </div>
                  {simulation.verdict === "APPROVED" && (
                    <CheckCircle2
                      className="h-5 w-5 text-emerald-600"
                      aria-hidden="true"
                    />
                  )}
                  {simulation.verdict === "BLOCKED" && (
                    <ShieldAlert
                      className="h-5 w-5 text-rose-600"
                      aria-hidden="true"
                    />
                  )}
                  {simulation.verdict === "403_REJECTED" && (
                    <AlertOctagon
                      className="h-5 w-5 text-rose-600"
                      aria-hidden="true"
                    />
                  )}
                  {simulation.verdict === "NEEDS_APPROVAL" && (
                    <UserCheck
                      className="h-5 w-5 text-amber-600"
                      aria-hidden="true"
                    />
                  )}
                  {simulation.verdict === "IDLE" && (
                    <Lock className="h-4 w-4 text-zinc-400" aria-hidden="true" />
                  )}
                </div>

                {simulation.verdict === "APPROVED" ? (
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-white p-3">
                    <div>
                      <p className="text-xs font-bold text-emerald-950">
                        {settlementHeading}
                      </p>
                      <p className="mt-0.5 font-mono text-xs text-zinc-600">
                        Order ID: {simulation.paypalOrderId} · Status:{" "}
                        {simulation.paypalStatus ?? "CREATED"}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {simulation.approveUrl && (
                        <a
                          href={simulation.approveUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-xs font-semibold text-zinc-800 hover:bg-zinc-100"
                        >
                          Approve Sandbox Flow
                          <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                        </a>
                      )}
                      {sandboxUrl && (
                        <a
                          href={sandboxUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 rounded-xl bg-[#0070E0] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#003087]"
                        >
                          Verify in PayPal Sandbox
                          <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                        </a>
                      )}
                    </div>
                  </div>
                ) : simulation.verdict === "NEEDS_APPROVAL" ? (
                  <div className="mt-3 rounded-xl border border-amber-200 bg-white p-3.5">
                    <p className="text-xs font-semibold text-amber-950">
                      Human Approval Required: ${simulation.proposedTotal.toFixed(2)} exceeds your ${mandate.maxPerTransaction.toFixed(2)} auto-approve cap.
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={isSettlingOverride}
                        onClick={onApproveOverride}
                        className="cursor-pointer rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50"
                      >
                        {isSettlingOverride
                          ? "Settling via PayPal..."
                          : `Approve $${simulation.proposedTotal.toFixed(2)} & Pay via PayPal`}
                      </button>
                      <button
                        type="button"
                        disabled={isSettlingOverride}
                        onClick={onRejectOverride}
                        className="cursor-pointer rounded-xl border border-rose-300 bg-white px-4 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50"
                      >
                        Reject Purchase
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="mt-2 text-xs text-zinc-600">
                    {simulation.verdict === "IDLE"
                      ? "Awaiting verified mandate to mint a live PayPal Sandbox Order ID."
                      : "Vault remained locked — $0.00 USD moved."}
                  </p>
                )}
              </div>
            </div>
          </section>
        </div>
      </div>

      {/* BOTTOM FULL-WIDTH PANEL: KPIs + AG Grid Compliance & Audit Ledger */}
      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-xs">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="font-display text-base font-bold text-[#09090B]">
              Compliance &amp; Audit Ledger
            </h2>
            <p className="text-xs text-zinc-500">
              Every agent execution, blocked prompt injection, human override,
              and PayPal Sandbox Order ID.
            </p>
          </div>

          {/* Filter Pills */}
          <div className="flex flex-wrap items-center gap-1.5">
            {(
              [
                { id: "all", label: `All (${transactions.length})` },
                { id: "paid", label: "Paid on PayPal" },
                { id: "blocked", label: "Blocked" },
                { id: "needs_approval", label: "Needs Approval" },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                aria-pressed={ledgerFilter === tab.id}
                onClick={() => setLedgerFilter(tab.id)}
                className={`cursor-pointer rounded-full px-3 py-1 text-xs font-medium transition ${
                  ledgerFilter === tab.id
                    ? "bg-[#09090B] text-white"
                    : "border border-zinc-200 bg-zinc-50 text-zinc-600 hover:bg-zinc-100"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* 3 KPI Summary Cards */}
        <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-zinc-200 bg-[#FAFAFA] p-3.5">
            <p className="text-xs font-medium text-zinc-500">
              Total Settled via PayPal
            </p>
            <p className="mt-1 font-mono text-xl font-bold text-[#09090B]">
              ${kpis.settledTotal.toFixed(2)}
            </p>
          </div>
          <div className="rounded-xl border border-zinc-200 bg-[#FAFAFA] p-3.5">
            <p className="text-xs font-medium text-zinc-500">
              Scam / Unauthorized Spend Blocked
            </p>
            <p className="mt-1 font-mono text-xl font-bold text-rose-600">
              ${kpis.scamBlockedTotal.toFixed(2)}
            </p>
          </div>
          <div className="rounded-xl border border-zinc-200 bg-[#FAFAFA] p-3.5">
            <p className="text-xs font-medium text-zinc-500">
              Personal Data Leaked (GhostPass)
            </p>
            <p className="mt-1 font-mono text-xl font-bold text-emerald-600">
              {kpis.ghostpassAvgPii}%
            </p>
          </div>
        </div>

        <AuditLedgerGrid transactions={filteredTransactions} />
      </section>
    </div>
  );
}
