"use client";

import React, { useEffect, useMemo, useState } from "react";
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
  ShieldAlert,
  ShieldCheck,
  Terminal,
  Webhook,
  X,
} from "lucide-react";
import {
  AgentMode,
  AuditTransaction,
  ProductCategory,
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
type ConfigTab = "mcp" | "curl";

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

const CATEGORY_DISPLAY: Record<ProductCategory, string> = {
  "Keyboards & Mice": "Hardware",
  Audio: "Audio",
  "Cloud & Books": "Books",
  Accessories: "Accessories",
};

function formatAllowedCategories(categories: ProductCategory[]): string {
  const mapped = categories.map((cat) => CATEGORY_DISPLAY[cat] ?? cat);
  return Array.from(new Set(mapped)).join(", ");
}

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
  const [mcpModalOpen, setMcpModalOpen] = useState(false);
  const [configTab, setConfigTab] = useState<ConfigTab>("mcp");
  const [activePayloadId, setActivePayloadId] = useState<string | null>(null);

  const [isSavingRule, setIsSavingRule] = useState(false);
  const [ruleError, setRuleError] = useState<string | null>(null);
  const [draftRule, setDraftRule] = useState(mandate.ruleText);
  const [draftMaxTx, setDraftMaxTx] = useState(String(mandate.maxPerTransaction));
  const [draftDaily, setDraftDaily] = useState(String(mandate.dailyLimit));
  const [draftBlockGift, setDraftBlockGift] = useState(mandate.blockGiftCards);
  const [draftBlockSub, setDraftBlockSub] = useState(mandate.blockSubscriptions);

  const [copiedTarget, setCopiedTarget] = useState<"key" | "mcp" | "curl" | null>(
    null
  );
  const [ledgerFilter, setLedgerFilter] = useState<LedgerFilter>("all");

  const isEditingOpen = editingRule && !isRunning;
  const isGhostPass = mode === "ghostpass";
  const isIdle = simulation.verdict === "IDLE" && simulation.stage === "idle";

  useEffect(() => {
    if (!editingRule && !mcpModalOpen) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setEditingRule(false);
        setMcpModalOpen(false);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [editingRule, mcpModalOpen]);

  const dailyRemaining = Math.max(0, mandate.dailyLimit - mandate.dailySpent);
  const dailyPct = Math.min(
    100,
    Math.round((mandate.dailySpent / Math.max(1, mandate.dailyLimit)) * 100)
  );
  const maskedToken = `gp_live_••••_${sessionApiKey.slice(-4)}`;
  const categoriesLabel = formatAllowedCategories(mandate.allowedCategories);

  const externalPayloads = useMemo(
    () => [
      {
        id: "safe",
        endpoint: "POST /mcp/checkout · $48.00",
        caller: 'External Agent: "NovaTech Keychron Q1 Pro"',
        detail: `Valid within $${mandate.maxPerTransaction.toFixed(0)} pass`,
        prompt: "Buy Keychron Q1 Pro Wireless Mechanical Keyboard under $60",
        tone: "emerald" as const,
      },
      {
        id: "trap",
        endpoint: "POST /mcp/checkout · $19.00 → $75.00 Trap",
        caller: "Compromised Agent: Hidden Steam Gift Card Injection",
        detail: "Blocked by Gatekeeper",
        prompt: "Buy the $19 Braided USB-C Fast Charge Cable",
        tone: "rose" as const,
      },
      {
        id: "override",
        endpoint: "POST /mcp/checkout · $115.00",
        caller: 'External Agent: "Sony WH-1000XM5 Headphones"',
        detail: `Exceeds $${mandate.maxPerTransaction.toFixed(
          0
        )} cap → Pauses for Human Approval`,
        prompt: "Buy Sony WH-1000XM5 Studio Headphones",
        tone: "amber" as const,
      },
    ],
    [mandate.maxPerTransaction]
  );

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
      setRuleError("Max Per Tx must be $5–$1,000");
      return;
    }
    if (
      !Number.isFinite(parsedDaily) ||
      parsedDaily < parsedMax ||
      parsedDaily > 2000
    ) {
      setRuleError(`Daily Limit must be $${parsedMax}–$2,000`);
      return;
    }

    setIsSavingRule(true);
    try {
      await onUpdateMandate({
        ...mandate,
        ruleText: draftRule.trim() || `Max $${parsedMax} · Hardware, Audio, Books`,
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

  async function copyText(value: string, target: "key" | "mcp" | "curl") {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedTarget(target);
      setTimeout(() => setCopiedTarget(null), 1800);
    } catch {
      // Clipboard unavailable
    }
  }

  const baseOrigin =
    typeof window !== "undefined"
      ? window.location.origin
      : "http://localhost:3000";

  const mcpJsonSnippet = JSON.stringify(
    {
      mcpServers: {
        "paypal-ghostpass": {
          command: "npx",
          args: ["-y", "@paypal-ghostpass/mcp-server"],
          env: {
            GHOSTPASS_TOKEN: sessionApiKey,
            GHOSTPASS_ENDPOINT: `${baseOrigin}/api/agent/execute`,
            MAX_PER_TX_USD: String(mandate.maxPerTransaction),
            DAILY_LIMIT_USD: String(mandate.dailyLimit),
            IDENTITY_EXPOSURE: "0_PERCENT_PAYPAL_VAULT_RELAY",
          },
        },
      },
    },
    null,
    2
  );

  const activePromptForSnippet = simulation.prompt || prompt;
  const curlSnippet = `curl -X POST ${baseOrigin}/api/agent/execute \\
  -H "Content-Type: application/json" \\
  -d '${escapeSingleQuotesForShell(
    JSON.stringify(
      {
        prompt: activePromptForSnippet,
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
        `https://www.sandbox.paypal.com/activity/payment/${encodeURIComponent(
          simulation.paypalOrderId
        )}`
      : null;

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
    ? {
        tone: "ok",
        label:
          simulation.paypalStatus === "COMPLETED" ? "Captured" : "Created",
      }
    : simulation.verdict === "NEEDS_APPROVAL"
    ? { tone: "warn", label: "Awaiting Approval" }
    : {
        tone: "fail",
        label: simulation.verdict === "403_REJECTED" ? "403 Blocked" : "Halted",
      };

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
        {/* LEFT COLUMN (38%): Programmable GhostPass Card + External Agent MCP Client */}
        <div className="space-y-4">
          {/* Top Left: Programmable Payment Pass Card */}
          <section
            aria-label="PayPal GhostPass Agent Payment Credential"
            className="relative overflow-hidden rounded-2xl border border-zinc-800 bg-[#0B1120] p-5 text-white shadow-lg"
          >
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -right-12 -top-12 h-44 w-44 rounded-full bg-[#0070E0]/25 blur-2xl"
            />

            {/* Card Header */}
            <div className="relative flex items-start justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/5">
                  <ShieldCheck
                    className="h-4 w-4 text-[#38BDF8]"
                    aria-hidden="true"
                  />
                </div>
                <div>
                  <h2 className="font-display text-sm font-bold leading-tight tracking-tight text-white">
                    PayPal GhostPass
                  </h2>
                  <p className="font-mono text-[10px] text-zinc-400">
                    Agent Payment Credential
                  </p>
                </div>
              </div>

              <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-emerald-400/30 bg-emerald-500/15 px-2.5 py-0.5 font-mono text-[10px] font-semibold text-emerald-300">
                <span
                  aria-hidden="true"
                  className="h-1.5 w-1.5 rounded-full bg-emerald-400"
                />
                ACTIVE · 0% PII
              </span>
            </div>

            {/* Scoped Pass Token + Action Buttons */}
            <div className="relative mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-semibold tracking-wider text-zinc-100">
                  {maskedToken}
                </span>
                <button
                  type="button"
                  aria-label="Copy GhostPass token"
                  onClick={() => void copyText(sessionApiKey, "key")}
                  className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-white/15 bg-white/5 px-1.5 py-0.5 font-mono text-[10px] text-zinc-200 transition hover:bg-white/15"
                >
                  {copiedTarget === "key" ? (
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

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setConfigTab("mcp");
                    setMcpModalOpen(true);
                  }}
                  className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-[#38BDF8]/30 bg-[#0070E0]/25 px-2 py-1 font-mono text-[10px] font-semibold text-[#7DD3FC] transition hover:bg-[#0070E0]/40"
                >
                  <Code2 className="h-3 w-3" aria-hidden="true" />
                  Copy MCP Config
                </button>
                <button
                  type="button"
                  disabled={isRunning || isSavingRule}
                  onClick={openRuleEditor}
                  className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-white/15 bg-white/10 px-2 py-1 text-[10px] font-semibold text-white transition hover:bg-white/20 disabled:opacity-50"
                >
                  <Edit3 className="h-3 w-3" aria-hidden="true" />
                  Edit Rules
                </button>
              </div>
            </div>

            {/* Structured Credential Guardrails Grid */}
            <dl className="relative mt-4 grid grid-cols-2 gap-2.5 text-xs">
              <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
                <dt className="text-[10px] font-medium text-zinc-400">
                  Max Per Tx
                </dt>
                <dd className="mt-0.5 font-mono text-sm font-bold text-white">
                  ${mandate.maxPerTransaction.toFixed(2)}
                </dd>
              </div>

              <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
                <dt className="text-[10px] font-medium text-zinc-400">
                  Daily Remaining
                </dt>
                <dd className="mt-0.5 font-mono text-sm font-bold text-white">
                  ${dailyRemaining.toFixed(2)}
                  <span className="ml-1 text-[10px] font-normal text-zinc-400">
                    / ${mandate.dailyLimit.toFixed(0)}
                  </span>
                </dd>
              </div>

              <div className="col-span-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <dt className="text-[10px] font-medium text-zinc-400">
                    Allowed Categories
                  </dt>
                  <dd className="truncate font-mono text-[11px] font-semibold text-zinc-100">
                    {categoriesLabel}
                  </dd>
                </div>
                <div className="mt-1.5 flex items-center justify-between gap-2 border-t border-white/10 pt-1.5">
                  <dt className="text-[10px] font-medium text-zinc-400">
                    Identity Exposure
                  </dt>
                  <dd className="font-mono text-[11px] font-semibold text-emerald-300">
                    0% (PayPal Vault Relay)
                  </dd>
                </div>
              </div>
            </dl>

            {/* Card Footer: Daily Bar + Vaulted Buyer */}
            <div className="relative mt-4 space-y-1.5">
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

              <div className="flex items-center justify-between gap-2 font-mono text-[10px] text-zinc-400">
                <span className="truncate">Vault: {sandboxBuyerLabel}</span>
                <span className="shrink-0 text-zinc-300">
                  {mandate.blockGiftCards ? "No Gift Cards" : "Gift Cards On"}
                </span>
              </div>
            </div>
          </section>

          {/* Bottom Left: External Agent MCP Client Simulator */}
          <section
            aria-label="External Agent MCP Client"
            className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-xs"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="flex items-center gap-1.5">
                  <Terminal
                    className="h-4 w-4 text-[#0070E0]"
                    aria-hidden="true"
                  />
                  <h2 className="font-display text-sm font-bold text-[#09090B]">
                    External Agent MCP Client (Incoming API Calls)
                  </h2>
                </div>
                <p className="mt-0.5 text-[11px] text-zinc-500">
                  Simulates Claude / Gemini / OpenAI Operator calling your
                  GhostPass endpoint.
                </p>
              </div>
            </div>

            {/* Client Authorization Mode Switch */}
            <div
              role="group"
              aria-label="Incoming external agent mode"
              className="mt-3 grid grid-cols-2 gap-1 rounded-xl border border-zinc-200 bg-zinc-100 p-0.5"
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
                <span>Unverified Bot (Direct)</span>
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
                <span>GhostPass Authorized</span>
              </button>
            </div>

            {/* 3 External Webhook / MCP Payload Trigger Cards */}
            <div className="mt-3 space-y-2">
              {externalPayloads.map((item) => {
                const isCardRunning = isRunning && activePayloadId === item.id;
                const badgeTone =
                  item.tone === "emerald"
                    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                    : item.tone === "rose"
                    ? "border-rose-200 bg-rose-50 text-rose-800"
                    : "border-amber-200 bg-amber-50 text-amber-800";
                const borderHover =
                  item.tone === "emerald"
                    ? "hover:border-emerald-300"
                    : item.tone === "rose"
                    ? "hover:border-rose-300"
                    : "hover:border-amber-300";

                return (
                  <button
                    key={item.id}
                    type="button"
                    disabled={isRunning || isSettlingOverride}
                    onClick={() => {
                      setActivePayloadId(item.id);
                      onPromptChange(item.prompt);
                      onRunAgent(item.prompt);
                    }}
                    className={`group w-full cursor-pointer rounded-xl border border-zinc-200 bg-[#FAFAFA] p-3 text-left transition hover:bg-white hover:shadow-xs disabled:cursor-not-allowed disabled:opacity-50 ${borderHover}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`inline-flex items-center rounded-md border px-2 py-0.5 font-mono text-[10px] font-bold ${badgeTone}`}
                      >
                        {item.endpoint}
                      </span>
                      <span className="font-mono text-[10px] font-semibold text-zinc-500 group-hover:text-[#005BB5]">
                        {isCardRunning ? "Calling..." : "Trigger ↗"}
                      </span>
                    </div>
                    <p className="mt-1.5 text-xs font-semibold text-[#09090B]">
                      {item.caller}
                    </p>
                    <p className="mt-0.5 font-mono text-[10px] text-zinc-500">
                      {item.detail}
                    </p>
                  </button>
                );
              })}
            </div>
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
                <Webhook
                  className="h-4 w-4 text-[#0070E0]"
                  aria-hidden="true"
                />
                <span className="font-display text-sm font-bold text-[#09090B]">
                  Live Authorization Receipt
                </span>
                <span className="rounded-md border border-zinc-200 bg-zinc-50 px-1.5 py-0.5 font-mono text-[10px] text-zinc-600">
                  {isRunning ? "POST /mcp/checkout" : "MCP Broker"}
                </span>
                {isRunning && (
                  <span className="rounded-full bg-sky-50 px-2 py-0.5 font-mono text-[10px] font-semibold text-[#0070E0]">
                    Authorizing...
                  </span>
                )}
              </div>

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
                <dt className="text-xs font-medium text-zinc-500">
                  Requested Item
                </dt>
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
                    ? "0% (PayPal Vault Relay)"
                    : simGhostPass
                    ? "0% (PayPal Vault Relay)"
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
                  Override Required · ${simulation.proposedTotal.toFixed(2)} &gt;
                  ${mandate.maxPerTransaction.toFixed(2)}
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

      {/* Modal 1: Copy MCP Server JSON / REST cURL Config */}
      {mcpModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/60 p-4 backdrop-blur-xs"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setMcpModalOpen(false);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="MCP Server Configuration"
            className="w-full max-w-lg rounded-2xl border border-zinc-800 bg-[#0B1120] p-5 text-white shadow-2xl"
          >
            <div className="flex items-start justify-between gap-3 border-b border-white/10 pb-3">
              <div>
                <h3 className="font-display text-sm font-bold text-white">
                  Connect External AI Agents via MCP
                </h3>
                <p className="mt-0.5 text-xs text-zinc-400">
                  Paste into Claude Desktop, Cursor, or OpenAI Operator MCP
                  config.
                </p>
              </div>
              <button
                type="button"
                aria-label="Close MCP config modal"
                onClick={() => setMcpModalOpen(false)}
                className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-white/15 bg-white/5 text-zinc-300 transition hover:bg-white/15 hover:text-white"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            <div className="mt-3 flex items-center justify-between gap-2">
              <div
                role="tablist"
                aria-label="Integration format"
                className="inline-flex rounded-lg border border-white/10 bg-white/5 p-0.5 text-xs"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={configTab === "mcp"}
                  onClick={() => setConfigTab("mcp")}
                  className={`cursor-pointer rounded-md px-3 py-1 font-mono text-[11px] font-semibold transition ${
                    configTab === "mcp"
                      ? "bg-[#0070E0] text-white"
                      : "text-zinc-400 hover:text-white"
                  }`}
                >
                  mcpServers JSON
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={configTab === "curl"}
                  onClick={() => setConfigTab("curl")}
                  className={`cursor-pointer rounded-md px-3 py-1 font-mono text-[11px] font-semibold transition ${
                    configTab === "curl"
                      ? "bg-[#0070E0] text-white"
                      : "text-zinc-400 hover:text-white"
                  }`}
                >
                  REST cURL
                </button>
              </div>

              <button
                type="button"
                onClick={() =>
                  void copyText(
                    configTab === "mcp" ? mcpJsonSnippet : curlSnippet,
                    configTab === "mcp" ? "mcp" : "curl"
                  )
                }
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 font-mono text-[11px] font-semibold text-[#09090B] transition hover:bg-zinc-200"
              >
                {copiedTarget === (configTab === "mcp" ? "mcp" : "curl") ? (
                  <>
                    <Check
                      className="h-3.5 w-3.5 text-emerald-600"
                      aria-hidden="true"
                    />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                    {configTab === "mcp" ? "Copy MCP JSON" : "Copy cURL"}
                  </>
                )}
              </button>
            </div>

            <pre className="mt-3 max-h-72 overflow-auto rounded-xl border border-white/10 bg-zinc-950 p-3.5 font-mono text-[11px] leading-relaxed text-sky-200">
              {configTab === "mcp" ? mcpJsonSnippet : curlSnippet}
            </pre>
          </div>
        </div>
      )}

      {/* Modal 2: Edit Pass Rules */}
      {isEditingOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/60 p-4 backdrop-blur-xs"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setEditingRule(false);
          }}
        >
          <form
            role="dialog"
            aria-modal="true"
            aria-label="Edit GhostPass Rules"
            onSubmit={handleSaveRule}
            className="w-full max-w-md space-y-4 rounded-2xl border border-zinc-200 bg-white p-5 shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
              <div>
                <h3 className="font-display text-sm font-bold text-[#09090B]">
                  Edit GhostPass Rules
                </h3>
                <p className="text-[11px] text-zinc-500">
                  Update programmatic spend limits enforced on incoming agent
                  requests.
                </p>
              </div>
              <button
                type="button"
                aria-label="Close rules modal"
                onClick={() => setEditingRule(false)}
                className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-zinc-200 text-zinc-600 transition hover:bg-zinc-100"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            {ruleError && (
              <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 font-mono text-xs text-rose-700">
                {ruleError}
              </p>
            )}

            <div>
              <label
                htmlFor="modal-rule-input"
                className="mb-1 block text-xs font-semibold text-zinc-700"
              >
                Mandate Rule Summary
              </label>
              <input
                id="modal-rule-input"
                type="text"
                value={draftRule}
                onChange={(e) => setDraftRule(e.target.value)}
                className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-xs text-[#09090B] outline-none focus:border-[#0070E0]"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="modal-max-tx"
                  className="mb-1 block text-xs font-semibold text-zinc-700"
                >
                  Max Per Tx ($)
                </label>
                <input
                  id="modal-max-tx"
                  type="number"
                  min={5}
                  max={1000}
                  value={draftMaxTx}
                  onChange={(e) => setDraftMaxTx(e.target.value)}
                  className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 font-mono text-xs text-[#09090B] outline-none focus:border-[#0070E0]"
                />
              </div>

              <div>
                <label
                  htmlFor="modal-daily-cap"
                  className="mb-1 block text-xs font-semibold text-zinc-700"
                >
                  Daily Limit ($)
                </label>
                <input
                  id="modal-daily-cap"
                  type="number"
                  min={10}
                  max={2000}
                  value={draftDaily}
                  onChange={(e) => setDraftDaily(e.target.value)}
                  className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 font-mono text-xs text-[#09090B] outline-none focus:border-[#0070E0]"
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-4 text-xs text-zinc-700">
              <label className="flex cursor-pointer items-center gap-2 font-medium">
                <input
                  type="checkbox"
                  checked={draftBlockGift}
                  onChange={(e) => setDraftBlockGift(e.target.checked)}
                  className="h-4 w-4 rounded accent-[#0070E0]"
                />
                Block Gift Cards
              </label>

              <label className="flex cursor-pointer items-center gap-2 font-medium">
                <input
                  type="checkbox"
                  checked={draftBlockSub}
                  onChange={(e) => setDraftBlockSub(e.target.checked)}
                  className="h-4 w-4 rounded accent-[#0070E0]"
                />
                Block Subscriptions
              </label>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-zinc-100 pt-3">
              <button
                type="button"
                onClick={() => setEditingRule(false)}
                className="cursor-pointer rounded-xl border border-zinc-200 bg-white px-3.5 py-2 text-xs font-semibold text-zinc-700 transition hover:bg-zinc-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSavingRule}
                className="cursor-pointer rounded-xl bg-[#0070E0] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[#003087] disabled:opacity-50"
              >
                {isSavingRule ? "Saving..." : "Save Pass Rules"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
