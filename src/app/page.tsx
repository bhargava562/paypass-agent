"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  AgentMode,
  AuditTransaction,
  DEFAULT_MANDATE,
  PRODUCT_CATALOG,
  Product,
  SimulationRunState,
  SpendingMandate,
} from "@/data/catalog";
import {
  appendTransaction,
  getMandate,
  listTransactions,
  resetDemoState,
  saveMandate,
  updateTransaction,
} from "@/lib/db";
import { MandateHeader } from "@/components/MandateHeader";
import { ProductGrid } from "@/components/ProductGrid";
import { FloatingAgentBar } from "@/components/FloatingAgentBar";
import { PullDownTV } from "@/components/PullDownTV";

const INITIAL_SIMULATION: SimulationRunState = {
  stage: "idle",
  mode: "ghostpass",
  prompt: "",
  verdict: "IDLE",
  riskScore: 0,
  piiExposedPct: 0,
  merchantStatusCode: null,
  merchantBadge: "Waiting for Checkout Request",
  selectedProduct: null,
  injectedProduct: null,
  proposedTotal: 0,
  paypalOrderId: null,
  shippingRelayLabel: "PayPal Vault Standby",
  gatekeeperNotes: [
    "• Ready to audit cart against your Universal Spending Mandate.",
    "• Zero personal identity leaves your PayPal Vault in GhostPass mode.",
  ],
  agentContextPreview: {
    buyerName: "[VAULTED_IN_PAYPAL]",
    buyerEmail: "[VAULTED_IN_PAYPAL]",
    shippingAddr: "[PAYPAL_DIRECT_RELAY]",
    authToken: "gp_blindfolded_session_pending",
  },
  pendingOverrideTransactionId: null,
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function matchProductFromPrompt(promptText: string): Product {
  const q = promptText.toLowerCase();

  if (q.includes("cable") || q.includes("usb-c") || q.includes("19")) {
    return (
      PRODUCT_CATALOG.find((p) => p.id === "prod-cable-trap") ??
      PRODUCT_CATALOG[2]
    );
  }
  if (
    q.includes("headphone") ||
    q.includes("anc") ||
    q.includes("sony") ||
    q.includes("115") ||
    q.includes("audio")
  ) {
    return (
      PRODUCT_CATALOG.find((p) => p.id === "prod-headphones-sony") ??
      PRODUCT_CATALOG[4]
    );
  }
  if (q.includes("gift") || q.includes("steam") || q.includes("75")) {
    return (
      PRODUCT_CATALOG.find((p) => p.id === "prod-gift-steam75") ??
      PRODUCT_CATALOG[3]
    );
  }
  if (q.includes("subscription") || q.includes("cloudforge") || q.includes("compute")) {
    return (
      PRODUCT_CATALOG.find((p) => p.id === "prod-cloud-credit") ??
      PRODUCT_CATALOG[9]
    );
  }
  if (q.includes("ssd") || q.includes("samsung") || q.includes("89")) {
    return (
      PRODUCT_CATALOG.find((p) => p.id === "prod-ssd-samsung") ??
      PRODUCT_CATALOG[8]
    );
  }
  if (q.includes("ddia") || q.includes("data-intensive")) {
    return (
      PRODUCT_CATALOG.find((p) => p.id === "prod-book-ddia") ??
      PRODUCT_CATALOG[1]
    );
  }
  if (q.includes("book") || q.includes("guardrail") || q.includes("agent")) {
    return (
      PRODUCT_CATALOG.find((p) => p.id === "prod-book-ai") ??
      PRODUCT_CATALOG[6]
    );
  }
  if (q.includes("hub") || q.includes("thunderbolt")) {
    return (
      PRODUCT_CATALOG.find((p) => p.id === "prod-hub-anker") ??
      PRODUCT_CATALOG[5]
    );
  }
  if (q.includes("mouse") || q.includes("ergonomic") || q.includes("logitech")) {
    return (
      PRODUCT_CATALOG.find((p) => p.id === "prod-mouse-mx") ??
      PRODUCT_CATALOG[7]
    );
  }

  return (
    PRODUCT_CATALOG.find((p) => p.id === "prod-kbd-k2") ?? PRODUCT_CATALOG[0]
  );
}

function buildSimOrderId(): string {
  const suffix = Math.random().toString(36).slice(2, 10).toUpperCase();
  return `SBX-GP-${suffix}`;
}

export default function GhostPassStorefrontPage() {
  const [mandate, setMandate] = useState<SpendingMandate>(DEFAULT_MANDATE);
  const [transactions, setTransactions] = useState<AuditTransaction[]>([]);
  const [mode, setMode] = useState<AgentMode>("ghostpass");
  const [prompt, setPrompt] = useState(
    "Buy a wireless mechanical keyboard under $60"
  );
  const [tvOpen, setTvOpen] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [simulation, setSimulation] =
    useState<SimulationRunState>(INITIAL_SIMULATION);

  const promptInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    let active = true;
    async function hydrate() {
      const [loadedMandate, loadedTxs] = await Promise.all([
        getMandate(),
        listTransactions(),
      ]);
      if (!active) return;
      setMandate(loadedMandate);
      setTransactions(loadedTxs);
    }
    hydrate();
    return () => {
      active = false;
    };
  }, []);

  async function handleUpdateMandate(next: SpendingMandate) {
    const saved = await saveMandate(next);
    setMandate(saved);
  }

  function handleAskAgentToBuy(product: Product) {
    setPrompt(`Buy ${product.name} ($${product.price.toFixed(2)})`);
    promptInputRef.current?.focus();
  }

  async function handleRunAgent(promptOverride?: string) {
    const activePrompt = (promptOverride ?? prompt).trim();
    if (!activePrompt || isRunning) return;

    setIsRunning(true);
    setTvOpen(true);

    const selected = matchProductFromPrompt(activePrompt);
    const giftCardTrap =
      PRODUCT_CATALOG.find((p) => p.id === "prod-gift-steam75") ?? null;

    const standardBotPreview = {
      buyerName: "Alex Rivera",
      buyerEmail: "alex.rivera@example.com",
      shippingAddr: "742 Evergreen Terrace, Austin, TX 78701",
      authToken: "raw_paypal_session_9f8a21c4",
    };

    const ghostPassPreview = {
      buyerName: "[VAULTED_BUYER]",
      buyerEmail: "[VAULTED_EMAIL]",
      shippingAddr: "[PAYPAL_DIRECT_RELAY]",
      authToken: `gp_mandate_${mandate.id.slice(-4)}_0pii`,
    };

    // Stage 1: Agent Browsing
    setSimulation({
      ...INITIAL_SIMULATION,
      stage: "agent_browsing",
      mode,
      prompt: activePrompt,
      piiExposedPct: mode === "standard_bot" ? 100 : 0,
      selectedProduct: selected,
      proposedTotal: selected.price,
      merchantBadge: "Inspecting Product Catalog...",
      shippingRelayLabel:
        mode === "standard_bot"
          ? "Bot Typing Raw Home Address"
          : "PayPal Vault Direct Relay",
      gatekeeperNotes: [
        `• Agent matched "${selected.name}" ($${selected.price.toFixed(2)}).`,
        mode === "standard_bot"
          ? "• Warning: Unverified bot carries full personal identity in prompt."
          : "• Blindfolded VIP session active — 0% PII shared with agent.",
      ],
      agentContextPreview:
        mode === "standard_bot" ? standardBotPreview : ghostPassPreview,
    });

    await sleep(450);

    // Standard Bot Mode -> Blocked by Store (403)
    if (mode === "standard_bot") {
      setSimulation((prev) => ({
        ...prev,
        stage: "merchant_checking",
        merchantBadge: "Checking Bot Session Headers...",
      }));
      await sleep(400);

      const tx: AuditTransaction = {
        id: `tx-${Date.now()}`,
        timestamp: new Date().toISOString(),
        mode: "standard_bot",
        prompt: activePrompt,
        requestedProductId: selected.id,
        requestedProductName: selected.name,
        cartItems: [
          {
            id: selected.id,
            name: selected.name,
            price: selected.price,
            category: selected.category,
          },
        ],
        totalAmount: selected.price,
        verdict: "403_REJECTED",
        riskScore: 86,
        piiExposedPct: 100,
        merchantStatusCode: 403,
        paypalOrderId: null,
        reason:
          "403 Forbidden: Store blocked unverified scraper bot (No Human Mandate + PII leaked).",
      };

      const nextList = await appendTransaction(tx);
      setTransactions(nextList);

      setSimulation((prev) => ({
        ...prev,
        stage: "complete",
        verdict: "403_REJECTED",
        riskScore: 86,
        piiExposedPct: 100,
        merchantStatusCode: 403,
        merchantBadge: "403 Blocked by Store · CAPTCHA Wall",
        paypalOrderId: null,
        gatekeeperNotes: [
          "✗ Personal name, email & address leaked into bot context.",
          "✗ Merchant flagged AutoShopperBot scraper -> HTTP 403 Forbidden.",
          "✓ PayPal Vault untouched ($0.00 moved).",
        ],
      }));
      setIsRunning(false);
      return;
    }

    // Stage 2: Gatekeeper Auditing (GhostPass Mode)
    setSimulation((prev) => ({
      ...prev,
      stage: "gatekeeper_auditing",
      gatekeeperNotes: [
        `• Auditing "${selected.name}" against rule: "${mandate.ruleText}"`,
        "• Scanning merchant DOM metadata for hidden prompt injections...",
      ],
    }));

    await sleep(500);

    // Check Prompt Injection Trap
    if (selected.hiddenPromptInjection && giftCardTrap) {
      const hijackedTotal = selected.price + giftCardTrap.price;
      const tx: AuditTransaction = {
        id: `tx-${Date.now()}`,
        timestamp: new Date().toISOString(),
        mode: "ghostpass",
        prompt: activePrompt,
        requestedProductId: selected.id,
        requestedProductName: `${selected.name} (+ Injected ${giftCardTrap.name})`,
        cartItems: [
          {
            id: selected.id,
            name: selected.name,
            price: selected.price,
            category: selected.category,
          },
          {
            id: giftCardTrap.id,
            name: giftCardTrap.name,
            price: giftCardTrap.price,
            category: giftCardTrap.category,
          },
        ],
        totalAmount: hijackedTotal,
        verdict: "BLOCKED",
        riskScore: 98,
        piiExposedPct: 0,
        merchantStatusCode: 422,
        paypalOrderId: null,
        reason: `Prompt Injection Blocked: Hidden HTML directive tried to add $${giftCardTrap.price.toFixed(
          2
        )} Steam Gift Card.`,
      };

      const nextList = await appendTransaction(tx);
      setTransactions(nextList);

      setSimulation((prev) => ({
        ...prev,
        stage: "complete",
        verdict: "BLOCKED",
        riskScore: 98,
        piiExposedPct: 0,
        merchantStatusCode: null,
        merchantBadge: "Checkout Aborted Before Merchant",
        injectedProduct: giftCardTrap,
        proposedTotal: hijackedTotal,
        paypalOrderId: null,
        gatekeeperNotes: [
          `🚨 Prompt injection detected inside ${selected.sku} metadata!`,
          `✗ Agent attempted to add "$75.00 Steam Digital Gift Card" (Total $${hijackedTotal.toFixed(
            2
          )}).`,
          "✓ Gatekeeper locked PayPal Vault instantly ($0.00 moved).",
        ],
      }));
      setIsRunning(false);
      return;
    }

    // Check Restricted Categories directly requested
    if (
      (mandate.blockGiftCards && selected.isRestrictedCategory && !selected.isSubscription) ||
      (mandate.blockSubscriptions && selected.isSubscription)
    ) {
      const tx: AuditTransaction = {
        id: `tx-${Date.now()}`,
        timestamp: new Date().toISOString(),
        mode: "ghostpass",
        prompt: activePrompt,
        requestedProductId: selected.id,
        requestedProductName: selected.name,
        cartItems: [
          {
            id: selected.id,
            name: selected.name,
            price: selected.price,
            category: selected.category,
          },
        ],
        totalAmount: selected.price,
        verdict: "BLOCKED",
        riskScore: 82,
        piiExposedPct: 0,
        merchantStatusCode: 422,
        paypalOrderId: null,
        reason: `Policy Blocked: "${selected.category}" violates rule blocking gift cards / subscriptions.`,
      };

      const nextList = await appendTransaction(tx);
      setTransactions(nextList);

      setSimulation((prev) => ({
        ...prev,
        stage: "complete",
        verdict: "BLOCKED",
        riskScore: 82,
        piiExposedPct: 0,
        merchantStatusCode: null,
        merchantBadge: "Blocked by Universal Mandate",
        paypalOrderId: null,
        gatekeeperNotes: [
          `✗ "${selected.name}" violates your Gift Card / Subscription block rule.`,
          "✓ PayPal Vault stayed locked ($0.00 moved).",
        ],
      }));
      setIsRunning(false);
      return;
    }

    // Check Over-Budget Escalation (1-Click Human Override)
    if (
      selected.price > mandate.maxPerTransaction ||
      mandate.dailySpent + selected.price > mandate.dailyLimit
    ) {
      const txId = `tx-${Date.now()}`;
      const tx: AuditTransaction = {
        id: txId,
        timestamp: new Date().toISOString(),
        mode: "ghostpass",
        prompt: activePrompt,
        requestedProductId: selected.id,
        requestedProductName: selected.name,
        cartItems: [
          {
            id: selected.id,
            name: selected.name,
            price: selected.price,
            category: selected.category,
          },
        ],
        totalAmount: selected.price,
        verdict: "NEEDS_APPROVAL",
        riskScore: 28,
        piiExposedPct: 0,
        merchantStatusCode: 200,
        paypalOrderId: null,
        reason: `Paused for 1-Click Human Override ($${selected.price.toFixed(
          2
        )} > $${mandate.maxPerTransaction.toFixed(2)} cap).`,
      };

      const nextList = await appendTransaction(tx);
      setTransactions(nextList);

      setSimulation((prev) => ({
        ...prev,
        stage: "complete",
        verdict: "NEEDS_APPROVAL",
        riskScore: 28,
        piiExposedPct: 0,
        merchantStatusCode: 200,
        merchantBadge: "✓ Mandate Ready · Awaiting Human Tap",
        proposedTotal: selected.price,
        paypalOrderId: null,
        pendingOverrideTransactionId: txId,
        gatekeeperNotes: [
          "✓ Zero prompt-injection threats & 0% PII leaked.",
          `⚠ Price $${selected.price.toFixed(2)} exceeds your $${mandate.maxPerTransaction.toFixed(
            2
          )} per-purchase cap.`,
          "→ Tap Approve below to release scoped PayPal funds.",
        ],
      }));
      setIsRunning(false);
      return;
    }

    // Stage 3 & 4: Merchant Check + PayPal Settlement (Safe Purchase)
    setSimulation((prev) => ({
      ...prev,
      stage: "merchant_checking",
      merchantStatusCode: 200,
      merchantBadge: "✓ Verified PayPal Human Mandate",
    }));
    await sleep(400);

    setSimulation((prev) => ({
      ...prev,
      stage: "paypal_settling",
    }));
    await sleep(400);

    const orderId = buildSimOrderId();
    const updatedMandate = await saveMandate({
      ...mandate,
      dailySpent: Number((mandate.dailySpent + selected.price).toFixed(2)),
    });
    setMandate(updatedMandate);

    const tx: AuditTransaction = {
      id: `tx-${Date.now()}`,
      timestamp: new Date().toISOString(),
      mode: "ghostpass",
      prompt: activePrompt,
      requestedProductId: selected.id,
      requestedProductName: selected.name,
      cartItems: [
        {
          id: selected.id,
          name: selected.name,
          price: selected.price,
          category: selected.category,
        },
      ],
      totalAmount: selected.price,
      verdict: "APPROVED",
      riskScore: 6,
      piiExposedPct: 0,
      merchantStatusCode: 201,
      paypalOrderId: orderId,
      reason: `Approved under Mandate ($${selected.price.toFixed(
        2
      )} <= $${mandate.maxPerTransaction.toFixed(2)}). Settled with 0% PII.`,
    };

    const nextList = await appendTransaction(tx);
    setTransactions(nextList);

    setSimulation((prev) => ({
      ...prev,
      stage: "complete",
      verdict: "APPROVED",
      riskScore: 6,
      piiExposedPct: 0,
      merchantStatusCode: 201,
      merchantBadge: "✓ Verified PayPal Human Mandate",
      proposedTotal: selected.price,
      paypalOrderId: orderId,
      gatekeeperNotes: [
        `✓ Price $${selected.price.toFixed(2)} fits within $${mandate.maxPerTransaction.toFixed(
          2
        )} cap.`,
        `✓ Category "${selected.category}" permitted; 0 injection threats.`,
        `✓ Vaulted shipping address relayed directly from PayPal to Merchant.`,
      ],
    }));

    setIsRunning(false);
  }

  async function handleApproveOverride() {
    if (!simulation.selectedProduct) return;

    const amount = simulation.proposedTotal;
    const orderId = buildSimOrderId();

    const updatedMandate = await saveMandate({
      ...mandate,
      dailySpent: Number((mandate.dailySpent + amount).toFixed(2)),
    });
    setMandate(updatedMandate);

    if (simulation.pendingOverrideTransactionId) {
      const nextList = await updateTransaction(
        simulation.pendingOverrideTransactionId,
        {
          verdict: "APPROVED",
          merchantStatusCode: 201,
          paypalOrderId: orderId,
          reason: `Human 1-Click Override Approved ($${amount.toFixed(
            2
          )}). Settled with 0% PII.`,
        }
      );
      setTransactions(nextList);
    }

    setSimulation((prev) => ({
      ...prev,
      stage: "complete",
      verdict: "APPROVED",
      merchantStatusCode: 201,
      merchantBadge: "✓ Human Override + PayPal Mandate Verified",
      paypalOrderId: orderId,
      pendingOverrideTransactionId: null,
      gatekeeperNotes: [
        "✓ 1-Click Human Override confirmed.",
        `✓ Scoped $${amount.toFixed(2)} order settled via PayPal Vault.`,
        "✓ 0% PII exposed to the AI agent.",
      ],
    }));
  }

  async function handleRejectOverride() {
    if (simulation.pendingOverrideTransactionId) {
      const nextList = await updateTransaction(
        simulation.pendingOverrideTransactionId,
        {
          verdict: "BLOCKED",
          merchantStatusCode: 422,
          paypalOrderId: null,
          reason: "Rejected by Human during 1-Click Over-Budget Confirmation.",
        }
      );
      setTransactions(nextList);
    }

    setSimulation((prev) => ({
      ...prev,
      stage: "complete",
      verdict: "BLOCKED",
      merchantStatusCode: null,
      merchantBadge: "Declined by Human Owner",
      paypalOrderId: null,
      pendingOverrideTransactionId: null,
      gatekeeperNotes: [
        "✓ Purchase declined by human tap.",
        "✓ PayPal Vault stayed locked ($0.00 moved).",
      ],
    }));
  }

  async function handleResetDemo() {
    const fresh = await resetDemoState();
    setMandate(fresh.mandate);
    setTransactions(fresh.transactions);
    setSimulation(INITIAL_SIMULATION);
  }

  return (
    <div className="relative flex min-h-screen flex-col bg-slate-50">
      <PullDownTV
        open={tvOpen}
        onClose={() => setTvOpen(false)}
        simulation={simulation}
        mandate={mandate}
        transactions={transactions}
        onApproveOverride={handleApproveOverride}
        onRejectOverride={handleRejectOverride}
        onResetDemo={handleResetDemo}
      />

      <MandateHeader
        mandate={mandate}
        onUpdateMandate={handleUpdateMandate}
        tvOpen={tvOpen}
        onToggleTv={() => setTvOpen((prev) => !prev)}
        activeVerdict={simulation.verdict}
        isRunning={isRunning}
      />

      <main className="flex-1">
        <ProductGrid
          products={PRODUCT_CATALOG}
          onAskAgentToBuy={handleAskAgentToBuy}
          highlightedProductId={simulation.selectedProduct?.id ?? null}
        />
      </main>

      <FloatingAgentBar
        mode={mode}
        onModeChange={setMode}
        prompt={prompt}
        onPromptChange={setPrompt}
        onRunPrompt={handleRunAgent}
        isRunning={isRunning}
        inputRef={promptInputRef}
      />
    </div>
  );
}
