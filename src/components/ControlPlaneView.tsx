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
  KeyRound,
  Lock,
  ShieldAlert,
  ShieldCheck,
  Terminal,
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
        Loading audit ledger...
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

const MCP_TRIGGERS = [
  {
    id: "valid",
    label: "1. Valid Order ($48 · Keychron Q1)",
    prompt: "Buy Keychron Q1 Pro Wireless Mechanical Keyboard under $60",
    tone: "emerald" as const,
  },
  {
    id: "injection",
    label: "2. Prompt Injection ($19 Cable → $75 Gift Card)",
    prompt: "Buy the $19 Braided USB-C Fast Charge Cable",
    tone: "rose" as const,
  },
  {
    id: "hitl",
    label: "3. Over-Cap Order ($115 · Sony XM5 — HITL)",
    prompt: "Buy Sony WH-1000XM5 Studio Headphones",
    tone: "amber" as const,
  },
];

function escapeSingleQuotesForShell(raw: string): string {
  return raw.replace(/'/g, "'\\''");
}

function truncateMiddle(value: string, head = 12, tail = 8): string {
  if (value.length <= head + tail + 3) return value;
  return `${value.slice(0, head)}...${value.slice(-tail)}`;
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
  const [activeTriggerId, setActiveTriggerId] = useState<string | null>(null);

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
        ruleText:
          draftRule.trim() ||
          `Max $${parsedMax} · Hardware, Audio & Tech Books`,
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
        "paypal-agentic-guardrail": {
          command: "npx",
          args: ["-y", "@paypal/agent-toolkit", "mcp"],
          env: {
            SCOPED_MANDATE_TOKEN: sessionApiKey,
            GUARDRAIL_ENDPOINT: `${baseOrigin}/api/agent/execute`,
            MAX_PER_TX_USD: String(mandate.maxPerTransaction),
            DAILY_LIMIT_USD: String(mandate.dailyLimit),
            PII_REDACTION: "STRICT_VAULT_RELAY",
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

  const simRawPii = !isIdle && simulation.piiExposedPct > 0;
  const hasRealSandboxUrl =
    Boolean(simulation.liveSandbox) && Boolean(simulation.paypalOrderId);
  const sandboxUrl =
    hasRealSandboxUrl && simulation.paypalOrderId
      ? simulation.sandboxActivityUrl ||
        `https://www.sandbox.paypal.com/activity/payment/${encodeURIComponent(
          simulation.paypalOrderId
        )}`
      : null;

  // Panel 1: INPUT JSON Context Window
  const inputJsonPayload = useMemo(() => {
    const ctx = simulation.agentContextPreview ?? {};
    const isRedacted = isIdle || simulation.piiExposedPct === 0;
    return {
      tool: "tools/call: paypal_checkout",
      mode: isIdle
        ? isGhostPass
          ? "PAYPAL_GUARDRAIL_ZERO_PII"
          : "UNVERIFIED_AGENT_RAW_PII"
        : simRawPii
        ? "UNVERIFIED_AGENT_RAW_PII"
        : "PAYPAL_GUARDRAIL_ZERO_PII",
      arguments: {
        merchant: "NovaTech Electronics",
        requested_item: simulation.selectedProduct?.name ?? "[AWAITING_MCP_CALL]",
        requested_amount_usd: simulation.selectedProduct
          ? Number(simulation.proposedTotal.toFixed(2))
          : 0,
      },
      agent_context: {
        payer_name: isRedacted
          ? "[REDACTED]"
          : ctx.buyerName ?? "Alex Mercer",
        payer_email: isRedacted
          ? "[REDACTED]"
          : ctx.buyerEmail ?? sandboxBuyerLabel,
        shipping_address: isRedacted
          ? "[PAYPAL_VAULT_RELAY]"
          : ctx.shippingAddr ?? "742 Evergreen Terrace, Austin TX",
        scoped_token: isRedacted
          ? maskedToken
          : ctx.authToken ?? "RAW_SESSION_COOKIE_UNSCOPED",
      },
    };
  }, [
    isIdle,
    isGhostPass,
    simRawPii,
    simulation,
    sandboxBuyerLabel,
    maskedToken,
  ]);

  // Panel 2: ANALYSIS Guardrail Telemetry
  const hmacAttestationValue = simulation.verificationHash
    ? `sha256=${truncateMiddle(simulation.verificationHash, 10, 6)}`
    : simulation.approvalToken
    ? `hitl=${truncateMiddle(simulation.approvalToken, 10, 6)}`
    : isIdle
    ? "STANDBY"
    : "NONE";

  const intentMatchValue = isIdle
    ? "STANDBY"
    : simulation.verdict === "403_REJECTED"
    ? "UNVERIFIED"
    : simulation.verdict === "BLOCKED"
    ? "FALSE (SKU_HIJACK)"
    : "TRUE";

  const injectionScanValue = isIdle
    ? "STANDBY"
    : simulation.verdict === "BLOCKED"
    ? "INJECTION_DETECTED"
    : simulation.verdict === "403_REJECTED"
    ? "BYPASSED"
    : "CLEAN";

  const spendCheckValue = isIdle
    ? "STANDBY"
    : simulation.verdict === "NEEDS_APPROVAL"
    ? `OVER_CAP ($${simulation.proposedTotal.toFixed(2)} > $${mandate.maxPerTransaction.toFixed(2)})`
    : simulation.verdict === "BLOCKED"
    ? `POLICY_BLOCK ($${simulation.proposedTotal.toFixed(2)})`
    : simulation.verdict === "403_REJECTED"
    ? "UNAUDITED"
    : `WITHIN_CAP ($${simulation.proposedTotal.toFixed(2)} <= $${mandate.maxPerTransaction.toFixed(2)})`;

  // Panel 3: OUTPUT Orders v2 + Store Firewall
  const firewallStatus = isIdle
    ? { label: "LISTENING", tone: "idle" }
    : simulation.verdict === "403_REJECTED"
    ? { label: "403 SCRAPER_PII_BLOCKED", tone: "fail" }
    : simulation.verdict === "BLOCKED"
    ? { label: "ABORTED PRE_CHECKOUT", tone: "fail" }
    : simulation.verdict === "NEEDS_APPROVAL"
    ? { label: "HOLD · HITL_REQUIRED", tone: "warn" }
    : { label: "200 VERIFIED_MANDATE", tone: "ok" };

  const outputJsonPayload = useMemo(() => {
    if (isIdle) {
      return {
        endpoint: "POST /v2/checkout/orders",
        status: "STANDBY",
        intent: "CAPTURE",
        payee: "NovaTech Electronics",
        "X-PayPal-Agent-Attestation": "READY",
      };
    }
    if (simulation.verdict === "403_REJECTED") {
      return {
        endpoint: "POST /api/store/checkout",
        http_status: 403,
        error: "BOT_SCRAPER_BLOCKED",
        reason: "Unscoped bot with raw PII rejected by merchant firewall",
        "X-PayPal-Agent-Attestation": "MISSING_OR_INVALID",
      };
    }
    if (simulation.verdict === "BLOCKED") {
      return {
        endpoint: "POST /v2/checkout/orders",
        http_status: 422,
        status: "HALTED_BY_GUARDRAIL",
        funds_moved_usd: 0,
        "X-PayPal-Agent-Attestation": "DENIED_INJECTION",
      };
    }
    if (simulation.verdict === "NEEDS_APPROVAL") {
      return {
        endpoint: "POST /v2/checkout/orders",
        status: "PENDING_HITL_OVERRIDE",
        intent: "CAPTURE",
        purchase_units: [
          {
            amount: {
              currency_code: "USD",
              value: simulation.proposedTotal.toFixed(2),
            },
            payee: "NovaTech Electronics",
          },
        ],
        "X-PayPal-Agent-Attestation": "AWAITING_HUMAN_SIGNATURE",
      };
    }
    return {
      order_id: simulation.paypalOrderId ?? "PENDING",
      intent: "CAPTURE",
      status: simulation.paypalStatus ?? "CREATED",
      purchase_units: [
        {
          amount: {
            currency_code: "USD",
            value: simulation.proposedTotal.toFixed(2),
          },
          payee: "NovaTech Electronics",
        },
      ],
      "X-PayPal-Agent-Attestation": "VERIFIED",
    };
  }, [isIdle, simulation]);

  function badgeClass(tone: string) {
    if (tone === "ok") {
      return "border-emerald-200 bg-emerald-50 text-emerald-800";
    }
    if (tone === "warn") {
      return "border-amber-200 bg-amber-50 text-amber-800";
    }
    if (tone === "fail") {
      return "border-rose-200 bg-rose-50 text-rose-800";
    }
    return "border-zinc-200 bg-zinc-100 text-zinc-700";
  }

  return (
    <div className="mx-auto w-full max-w-7xl space-y-4 px-4 py-4 sm:px-6">
      {/* TOP CONTROL STRIP: Scoped Mandate Bar + Mode Switch + Direct MCP Triggers */}
      <section
        aria-label="Scoped Mandate and MCP Tool Triggers"
        className="rounded-2xl border border-zinc-200 bg-white p-3.5 shadow-xs"
      >
        {/* Row 1: Active Scoped Mandate Pill + Edit Mandate & MCP Config */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-zinc-100 pb-3">
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-zinc-800 bg-[#0B1120] px-3 py-1.5 font-mono text-[11px] text-zinc-200">
            <span className="inline-flex items-center gap-1.5 font-semibold text-[#38BDF8]">
              <KeyRound className="h-3.5 w-3.5" aria-hidden="true" />
              Token: {maskedToken}
            </span>
            <button
              type="button"
              aria-label="Copy Scoped Mandate Token"
              onClick={() => void copyText(sessionApiKey, "key")}
              className="inline-flex cursor-pointer items-center gap-1 rounded border border-white/15 bg-white/5 px-1.5 py-0.5 text-[10px] text-zinc-200 transition hover:bg-white/15"
            >
              {copiedTarget === "key" ? (
                <Check className="h-3 w-3 text-emerald-400" aria-hidden="true" />
              ) : (
                <Copy className="h-3 w-3" aria-hidden="true" />
              )}
            </button>
            <span aria-hidden="true" className="text-zinc-600">
              ·
            </span>
            <span>Cap: ${mandate.maxPerTransaction.toFixed(0)}/tx</span>
            <span aria-hidden="true" className="text-zinc-600">
              ·
            </span>
            <span>
              Daily: ${dailyRemaining.toFixed(0)}/${mandate.dailyLimit.toFixed(0)}{" "}
              left
            </span>
            <span aria-hidden="true" className="text-zinc-600">
              ·
            </span>
            <span className="font-semibold text-emerald-300">
              PII: 0% Exposed
            </span>
            <span aria-hidden="true" className="hidden text-zinc-600 xl:inline">
              ·
            </span>
            <span className="hidden text-zinc-400 xl:inline">
              {sandboxBuyerLabel}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={isRunning || isSavingRule}
              onClick={openRuleEditor}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-[#09090B] transition hover:bg-zinc-50 disabled:opacity-50"
            >
              <Edit3 className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Edit Mandate</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setConfigTab("mcp");
                setMcpModalOpen(true);
              }}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-[#0B1120] px-3 py-1.5 font-mono text-xs font-semibold text-white transition hover:bg-zinc-800"
            >
              <Code2 className="h-3.5 w-3.5 text-[#38BDF8]" aria-hidden="true" />
              <span>MCP Config</span>
            </button>
          </div>
        </div>

        {/* Row 2: Agent Mode Toggle + 3 Direct MCP Tool Triggers */}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2.5">
          <div
            role="group"
            aria-label="Agent authorization mode"
            className="inline-flex rounded-xl border border-zinc-200 bg-zinc-100 p-0.5"
          >
            <button
              type="button"
              disabled={isRunning}
              aria-pressed={!isGhostPass}
              onClick={() => onModeChange("standard_bot")}
              className={`inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition disabled:opacity-50 ${
                !isGhostPass
                  ? "bg-white text-rose-700 shadow-xs"
                  : "text-zinc-600 hover:text-[#09090B]"
              }`}
            >
              <Bot className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Unverified Agent (Raw PII)</span>
            </button>

            <button
              type="button"
              disabled={isRunning}
              aria-pressed={isGhostPass}
              onClick={() => onModeChange("ghostpass")}
              className={`inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition disabled:opacity-50 ${
                isGhostPass
                  ? "bg-[#0070E0] text-white shadow-xs"
                  : "text-zinc-600 hover:text-[#09090B]"
              }`}
            >
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
              <span>PayPal Guardrail (Zero-PII)</span>
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <span className="hidden items-center gap-1 rounded-md bg-zinc-100 px-2 py-1 font-mono text-[10px] font-semibold text-zinc-600 lg:inline-flex">
              <Terminal className="h-3 w-3" aria-hidden="true" />
              tools/call: paypal_checkout
            </span>

            {MCP_TRIGGERS.map((item) => {
              const isItemRunning = isRunning && activeTriggerId === item.id;
              const toneClass =
                item.tone === "emerald"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-900 hover:bg-emerald-100"
                  : item.tone === "rose"
                  ? "border-rose-200 bg-rose-50 text-rose-900 hover:bg-rose-100"
                  : "border-amber-200 bg-amber-50 text-amber-900 hover:bg-amber-100";

              return (
                <button
                  key={item.id}
                  type="button"
                  disabled={isRunning || isSettlingOverride}
                  onClick={() => {
                    setActiveTriggerId(item.id);
                    onPromptChange(item.prompt);
                    onRunAgent(item.prompt);
                  }}
                  className={`cursor-pointer rounded-xl border px-3 py-1.5 font-mono text-[11px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${toneClass}`}
                >
                  {isItemRunning ? `Running...` : item.label}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* CENTER STAGE: Live 3-Stage Payload & Diff Inspector (INPUT -> ANALYSIS -> OUTPUT) */}
      <div
        aria-label="Live 3-Stage Payload and Diff Inspector"
        className="grid grid-cols-1 gap-4 lg:grid-cols-3"
      >
        {/* PANEL 1 · INPUT: Agent Context Window */}
        <section
          aria-label="Input Agent Context Window"
          className="flex flex-col rounded-2xl border border-zinc-200 bg-white p-4 shadow-xs"
        >
          <div className="mb-3 flex items-center justify-between gap-2 border-b border-zinc-100 pb-2.5">
            <h2 className="font-mono text-xs font-bold uppercase tracking-wide text-[#09090B]">
              INPUT · Agent Context Window
            </h2>
            <span
              className={`rounded-full border px-2 py-0.5 font-mono text-[10px] font-bold ${
                isIdle
                  ? "border-zinc-200 bg-zinc-100 text-zinc-600"
                  : simRawPii
                  ? "border-rose-200 bg-rose-50 text-rose-800"
                  : "border-emerald-200 bg-emerald-50 text-emerald-800"
              }`}
            >
              {isIdle
                ? isGhostPass
                  ? "ZERO-PII READY"
                  : "RAW PII MODE"
                : simRawPii
                ? "100% PII LEAKED"
                : "0% PII EXPOSED"}
            </span>
          </div>

          <pre
            className={`flex-1 overflow-x-auto rounded-xl border p-3 font-mono text-[11px] leading-relaxed ${
              simRawPii
                ? "border-rose-900/50 bg-[#1A0B10] text-rose-200"
                : "border-zinc-800 bg-[#0B1120] text-sky-200"
            }`}
          >
            {JSON.stringify(inputJsonPayload, null, 2)}
          </pre>
        </section>

        {/* PANEL 2 · ANALYSIS: Guardrail & Policy Engine */}
        <section
          aria-label="Analysis Guardrail and Policy Engine"
          className="flex flex-col rounded-2xl border border-zinc-200 bg-white p-4 shadow-xs"
        >
          <div className="mb-3 flex items-center justify-between gap-2 border-b border-zinc-100 pb-2.5">
            <h2 className="font-mono text-xs font-bold uppercase tracking-wide text-[#09090B]">
              ANALYSIS · Guardrail &amp; Policy
            </h2>
            <span
              className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[10px] font-bold ${badgeClass(
                isIdle
                  ? "idle"
                  : simulation.verdict === "APPROVED"
                  ? "ok"
                  : simulation.verdict === "NEEDS_APPROVAL"
                  ? "warn"
                  : "fail"
              )}`}
            >
              {isIdle ? (
                <Lock className="h-3 w-3" aria-hidden="true" />
              ) : simulation.verdict === "APPROVED" ? (
                <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
              ) : simulation.verdict === "NEEDS_APPROVAL" ? (
                <AlertTriangle className="h-3 w-3" aria-hidden="true" />
              ) : (
                <ShieldAlert className="h-3 w-3" aria-hidden="true" />
              )}
              {isIdle
                ? "STANDBY"
                : simulation.verdict === "APPROVED"
                ? "PASS"
                : simulation.verdict === "NEEDS_APPROVAL"
                ? "HITL PAUSE"
                : simulation.verdict === "403_REJECTED"
                ? "UNAUDITED"
                : "BLOCKED"}
            </span>
          </div>

          <dl className="space-y-2 font-mono text-[11px]">
            <div className="flex items-center justify-between gap-2 border-b border-zinc-100 pb-1.5">
              <dt className="text-zinc-500">Intent Match</dt>
              <dd className="font-semibold text-[#09090B]">{intentMatchValue}</dd>
            </div>
            <div className="flex items-center justify-between gap-2 border-b border-zinc-100 pb-1.5">
              <dt className="text-zinc-500">Prompt Injection Scan</dt>
              <dd
                className={`font-semibold ${
                  simulation.verdict === "BLOCKED"
                    ? "text-rose-700"
                    : simulation.verdict === "APPROVED"
                    ? "text-emerald-700"
                    : "text-zinc-700"
                }`}
              >
                {injectionScanValue}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-2 border-b border-zinc-100 pb-1.5">
              <dt className="text-zinc-500">Spend Limit Check</dt>
              <dd
                className={`font-semibold ${
                  simulation.verdict === "NEEDS_APPROVAL"
                    ? "text-amber-700"
                    : simulation.verdict === "BLOCKED"
                    ? "text-rose-700"
                    : "text-[#09090B]"
                }`}
              >
                {spendCheckValue}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-2 border-b border-zinc-100 pb-1.5">
              <dt className="text-zinc-500">Risk Score</dt>
              <dd
                className={`font-bold ${
                  simulation.riskScore >= 70
                    ? "text-rose-700"
                    : simulation.riskScore >= 40
                    ? "text-amber-700"
                    : "text-emerald-700"
                }`}
              >
                {isIdle ? "0/100" : `${simulation.riskScore}/100`}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-2">
              <dt className="text-zinc-500">HMAC Attestation</dt>
              <dd className="truncate font-semibold text-[#005BB5]">
                {hmacAttestationValue}
              </dd>
            </div>
          </dl>

          {/* Red Diff Highlight Box when Prompt Injection Caught */}
          {simulation.verdict === "BLOCKED" && (
            <div className="mt-3 rounded-xl border border-rose-300 bg-rose-50 p-3 font-mono text-[11px]">
              <div className="flex items-center justify-between font-bold text-rose-800">
                <span>THREAT DIFF · STRIPPED_PAYLOAD</span>
                <span>RISK {simulation.riskScore}/100</span>
              </div>
              <div className="mt-1.5 rounded-lg border border-rose-200 bg-white px-2.5 py-2 text-[10px] leading-relaxed text-rose-900">
                <div className="font-semibold text-rose-700">
                  -{" "}
                  {simulation.injectedProduct
                    ? `Injected SKU: ${simulation.injectedProduct.name} ($${simulation.injectedProduct.price.toFixed(
                        2
                      )})`
                    : "Hidden Adversarial Merchant Instruction"}
                </div>
                {simulation.selectedProduct?.hiddenHtmlMetadata && (
                  <div className="mt-1 break-words text-rose-800">
                    - {simulation.selectedProduct.hiddenHtmlMetadata}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Inline Human-in-the-Loop (HITL) Control when Over Cap */}
          {simulation.verdict === "NEEDS_APPROVAL" && (
            <div className="mt-3 rounded-xl border border-amber-300 bg-amber-50 p-3">
              <div className="font-mono text-[11px] font-bold text-amber-950">
                HITL_OVERRIDE · ${simulation.proposedTotal.toFixed(2)} &gt; $
                {mandate.maxPerTransaction.toFixed(2)}
              </div>
              <div className="mt-2 flex items-center gap-2">
                <button
                  type="button"
                  disabled={isSettlingOverride}
                  onClick={onApproveOverride}
                  className="flex-1 cursor-pointer rounded-lg bg-[#0070E0] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[#003087] disabled:opacity-50"
                >
                  {isSettlingOverride
                    ? "Signing..."
                    : `Approve $${simulation.proposedTotal.toFixed(2)}`}
                </button>
                <button
                  type="button"
                  disabled={isSettlingOverride}
                  onClick={onRejectOverride}
                  className="cursor-pointer rounded-lg border border-rose-300 bg-white px-3 py-1.5 text-xs font-semibold text-rose-700 transition hover:bg-rose-50 disabled:opacity-50"
                >
                  Reject
                </button>
              </div>
            </div>
          )}
        </section>

        {/* PANEL 3 · OUTPUT: PayPal Orders v2 & Store Gate */}
        <section
          aria-label="Output PayPal Orders v2 and Store Gate"
          className="flex flex-col rounded-2xl border border-zinc-200 bg-white p-4 shadow-xs"
        >
          <div className="mb-3 flex items-center justify-between gap-2 border-b border-zinc-100 pb-2.5">
            <h2 className="font-mono text-xs font-bold uppercase tracking-wide text-[#09090B]">
              OUTPUT · Orders v2 &amp; Store Gate
            </h2>
            <span
              className={`rounded-full border px-2 py-0.5 font-mono text-[10px] font-bold ${badgeClass(
                firewallStatus.tone
              )}`}
            >
              {firewallStatus.label}
            </span>
          </div>

          <pre className="flex-1 overflow-x-auto rounded-xl border border-zinc-800 bg-[#0B1120] p-3 font-mono text-[11px] leading-relaxed text-emerald-200">
            {JSON.stringify(outputJsonPayload, null, 2)}
          </pre>

          {sandboxUrl && (
            <div className="mt-2.5 flex items-center justify-between rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 font-mono text-[11px]">
              <span className="font-semibold text-[#003087]">
                Order {simulation.paypalOrderId}
              </span>
              <a
                href={sandboxUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 font-semibold text-[#005BB5] hover:underline"
              >
                <span>Open in PayPal Sandbox</span>
                <ExternalLink className="h-3 w-3" aria-hidden="true" />
              </a>
            </div>
          )}
        </section>
      </div>

      {/* BOTTOM PANEL: Full-Width AG Grid Audit Ledger */}
      <section
        aria-label="Audit Ledger"
        className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-xs"
      >
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            {(
              [
                { id: "all", label: `All (${transactions.length})` },
                { id: "paid", label: "Settled" },
                { id: "blocked", label: "Blocked" },
                { id: "needs_approval", label: "HITL Pending" },
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
              Guardrail PII Leaked: {kpis.piiLeaked}%
            </span>
          </div>
        </div>

        <AuditLedgerGrid transactions={filteredTransactions} />
      </section>

      {/* Modal 1: MCP Server Config & REST cURL */}
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
              <h3 className="font-mono text-xs font-bold uppercase tracking-wide text-white">
                MCP Config · @paypal/agent-toolkit
              </h3>
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
                    {configTab === "mcp" ? "Copy JSON" : "Copy cURL"}
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

      {/* Modal 2: Edit Scoped Mandate */}
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
            aria-label="Edit Scoped Mandate"
            onSubmit={handleSaveRule}
            className="w-full max-w-md space-y-4 rounded-2xl border border-zinc-200 bg-white p-5 shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
              <h3 className="font-mono text-xs font-bold uppercase tracking-wide text-[#09090B]">
                Edit Scoped Mandate
              </h3>
              <button
                type="button"
                aria-label="Close mandate modal"
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
                Policy String
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
                {isSavingRule ? "Saving..." : "Save Mandate"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
