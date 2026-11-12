"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  AgentMode,
  AuditTransaction,
  DEFAULT_MANDATE,
  PRODUCT_CATALOG,
  Product,
  ProductCategory,
  SimulationRunState,
  SpendingMandate,
} from "@/data/catalog";
import {
  readClientMandate,
  readClientTransactions,
  resetClientStorage,
  writeClientMandate,
  writeClientTransactions,
} from "@/lib/clientStorage";
import { MandateHeader } from "@/components/MandateHeader";
import { ProductGrid } from "@/components/ProductGrid";
import { AIShopperDrawer } from "@/components/AIShopperDrawer";
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

function makeUniqueId(prefix: string): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function buildSimOrderId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `SBX-GP-${crypto.randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase()}`;
  }
  return `SBX-GP-${Math.random().toString(36).slice(2, 10).toUpperCase().padEnd(8, "0")}`;
}

function matchProductFromPrompt(promptText: string): Product {
  const q = promptText.toLowerCase();

  // 1. Exact product name, SKU, or ID match first
  const exact = PRODUCT_CATALOG.find(
    (item) =>
      q.includes(item.name.toLowerCase()) ||
      q.includes(item.sku.toLowerCase()) ||
      q.includes(item.id.toLowerCase())
  );
  if (exact) return exact;

  // 2. Specific disambiguating keywords before generic ones
  if (q.includes("hub") || q.includes("caldigit") || q.includes("thunderbolt")) {
    return (
      PRODUCT_CATALOG.find((p) => p.id === "prod-hub-ts4") ??
      PRODUCT_CATALOG[1]
    );
  }
  if (q.includes("cable") || q.includes("braided") || /\b19\b/.test(q) || q.includes("usb-c")) {
    return (
      PRODUCT_CATALOG.find((p) => p.id === "prod-cable-trap") ??
      PRODUCT_CATALOG[3]
    );
  }
  if (
    q.includes("headphone") ||
    q.includes("xm5") ||
    q.includes("sony") ||
    /\b115\b/.test(q) ||
    q.includes("audio")
  ) {
    return (
      PRODUCT_CATALOG.find((p) => p.id === "prod-headphones-xm5") ??
      PRODUCT_CATALOG[2]
    );
  }
  if (q.includes("gift") || q.includes("steam") || /\b75\b/.test(q)) {
    return (
      PRODUCT_CATALOG.find((p) => p.id === "prod-gift-steam75") ??
      PRODUCT_CATALOG[7]
    );
  }
  if (q.includes("nvidia") || q.includes("h100") || q.includes("gpu") || q.includes("compute")) {
    return (
      PRODUCT_CATALOG.find((p) => p.id === "prod-gpu-h100") ??
      PRODUCT_CATALOG[4]
    );
  }
  if (q.includes("ddia") || q.includes("data-intensive") || q.includes("book")) {
    return (
      PRODUCT_CATALOG.find((p) => p.id === "prod-book-ddia") ??
      PRODUCT_CATALOG[5]
    );
  }
  if (q.includes("mouse") || q.includes("mx master") || q.includes("logitech")) {
    return (
      PRODUCT_CATALOG.find((p) => p.id === "prod-mouse-mx3s") ??
      PRODUCT_CATALOG[6]
    );
  }

  return (
    PRODUCT_CATALOG.find((p) => p.id === "prod-kbd-q1") ?? PRODUCT_CATALOG[0]
  );
}

async function syncServerState(payload: Record<string, unknown>) {
  try {
    await fetch("/api/state", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch {
    // Non-fatal fallback: clientStorage remains authoritative in local zero-config demos
  }
}

export default function GhostPassStorefrontPage() {
  const [mandate, setMandate] = useState<SpendingMandate>(DEFAULT_MANDATE);
  const [transactions, setTransactions] = useState<AuditTransaction[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<
    "All" | ProductCategory
  >("All");
  const [cartItems, setCartItems] = useState<Product[]>([]);
  const [mode, setMode] = useState<AgentMode>("ghostpass");
  const [prompt, setPrompt] = useState(
    "Buy Keychron Q1 Pro Wireless Mechanical Keyboard under $60"
  );
  const [aiDrawerOpen, setAiDrawerOpen] = useState(false);
  const [tvOpen, setTvOpen] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [isSettlingOverride, setIsSettlingOverride] = useState(false);
  const [simulation, setSimulation] =
    useState<SimulationRunState>(INITIAL_SIMULATION);

  const promptInputRef = useRef<HTMLInputElement | null>(null);
  const mandateRef = useRef<SpendingMandate>(mandate);
  const transactionsRef = useRef<AuditTransaction[]>(transactions);
  const runIdRef = useRef(0);

  useEffect(() => {
    mandateRef.current = mandate;
  }, [mandate]);

  useEffect(() => {
    transactionsRef.current = transactions;
  }, [transactions]);

  useEffect(() => {
    let active = true;
    async function hydrate() {
      const localMandate = readClientMandate();
      const localTxs = readClientTransactions();
      if (localMandate) setMandate(localMandate);
      if (localTxs) setTransactions(localTxs);

      try {
        const res = await fetch("/api/state", { cache: "no-store" });
        if (!res.ok || !active) return;
        const data = (await res.json()) as {
          backend?: string;
          mandate?: SpendingMandate;
          transactions?: AuditTransaction[];
        };
        if (!active) return;

        if (data.backend === "neon-postgres") {
          if (data.mandate) {
            setMandate(data.mandate);
            writeClientMandate(data.mandate);
          }
          if (Array.isArray(data.transactions)) {
            setTransactions(data.transactions);
            writeClientTransactions(data.transactions);
          }
        } else {
          if (!localMandate && data.mandate) {
            setMandate(data.mandate);
          }
          if (!localTxs && Array.isArray(data.transactions)) {
            setTransactions(data.transactions);
          }
        }
      } catch {
        // Offline / localStorage fallback already applied above
      }
    }
    hydrate();
    return () => {
      active = false;
    };
  }, []);

  async function persistMandate(next: SpendingMandate): Promise<SpendingMandate> {
    const saved: SpendingMandate = {
      ...next,
      updatedAt: new Date().toISOString(),
    };
    setMandate(saved);
    mandateRef.current = saved;
    writeClientMandate(saved);
    void syncServerState({ action: "save_mandate", mandate: saved });
    return saved;
  }

  async function persistTransaction(
    tx: AuditTransaction
  ): Promise<AuditTransaction[]> {
    const next = [
      tx,
      ...transactionsRef.current.filter((item) => item.id !== tx.id),
    ].slice(0, 100);
    setTransactions(next);
    transactionsRef.current = next;
    writeClientTransactions(next);
    void syncServerState({ action: "append_tx", tx });
    return next;
  }

  async function patchTransaction(
    txId: string,
    patch: Partial<AuditTransaction>
  ): Promise<AuditTransaction[]> {
    const target = transactionsRef.current.find((item) => item.id === txId);
    if (!target) return transactionsRef.current;
    const updated: AuditTransaction = { ...target, ...patch };
    const next = transactionsRef.current.map((item) =>
      item.id === txId ? updated : item
    );
    setTransactions(next);
    transactionsRef.current = next;
    writeClientTransactions(next);
    void syncServerState({ action: "update_tx", txId, patch });
    return next;
  }

  function handleAddToCart(product: Product) {
    setCartItems((prev) => [...prev, product]);
  }

  function handleRemoveFromCart(index: number) {
    setCartItems((prev) => prev.filter((_, idx) => idx !== index));
  }

  function handleClearCart() {
    setCartItems([]);
  }

  function handleCheckoutCartWithAi() {
    if (cartItems.length === 0) return;
    const first = cartItems[0];
    const buyPrompt = `Buy ${first.name} ($${first.price.toFixed(2)})`;
    setPrompt(buyPrompt);
    setAiDrawerOpen(true);
    void handleRunAgent(buyPrompt);
  }

  function handleAiBuyProduct(product: Product) {
    const buyPrompt = `Buy ${product.name} ($${product.price.toFixed(2)})`;
    setPrompt(buyPrompt);
    setAiDrawerOpen(true);
    void handleRunAgent(buyPrompt);
  }

  async function handleRunAgent(promptOverride?: string) {
    const activePrompt = (promptOverride ?? prompt).trim();
    if (!activePrompt || isRunning) return;

    const currentRunId = ++runIdRef.current;
    setIsRunning(true);
    setAiDrawerOpen(false);
    setTvOpen(true);

    try {
      const currentMandate = mandateRef.current;
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
        authToken: `gp_mandate_${currentMandate.id.slice(-4)}_0pii`,
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
      if (runIdRef.current !== currentRunId) return;

      // Standard Bot Mode -> Blocked by Store (403)
      if (mode === "standard_bot") {
        setSimulation((prev) => ({
          ...prev,
          stage: "merchant_checking",
          merchantBadge: "Checking Bot Session Headers...",
        }));
        await sleep(400);
        if (runIdRef.current !== currentRunId) return;

        const tx: AuditTransaction = {
          id: makeUniqueId("tx"),
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

        await persistTransaction(tx);

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
        return;
      }

      // Stage 2: Gatekeeper Auditing (GhostPass Mode)
      setSimulation((prev) => ({
        ...prev,
        stage: "gatekeeper_auditing",
        gatekeeperNotes: [
          `• Auditing "${selected.name}" against rule: "${currentMandate.ruleText}"`,
          "• Scanning merchant DOM metadata for hidden prompt injections...",
        ],
      }));

      await sleep(500);
      if (runIdRef.current !== currentRunId) return;

      // Check Prompt Injection Trap
      if (selected.hiddenPromptInjection && giftCardTrap) {
        const hijackedTotal = selected.price + giftCardTrap.price;
        const tx: AuditTransaction = {
          id: makeUniqueId("tx"),
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

        await persistTransaction(tx);

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
            `Prompt injection detected inside ${selected.sku} metadata!`,
            `✗ Agent attempted to add "$75.00 Steam Digital Gift Card" (Total $${hijackedTotal.toFixed(
              2
            )}).`,
            "✓ Gatekeeper locked PayPal Vault instantly ($0.00 moved).",
          ],
        }));
        return;
      }

      // Check Restricted Categories (Gift Cards, Subscriptions, & allowedCategories)
      const blockedAsGiftCard =
        currentMandate.blockGiftCards && Boolean(selected.isGiftCard);
      const blockedAsSubscription =
        currentMandate.blockSubscriptions && Boolean(selected.isSubscription);
      const blockedByCategoryPolicy =
        !currentMandate.allowedCategories.includes(selected.category);

      if (blockedAsGiftCard || blockedAsSubscription || blockedByCategoryPolicy) {
        const policyReason = blockedAsGiftCard
          ? `Policy Blocked: Gift Card "${selected.name}" violates rule blocking gift cards.`
          : blockedAsSubscription
          ? `Policy Blocked: Subscription "${selected.name}" violates rule blocking subscriptions.`
          : `Policy Blocked: Category "${selected.category}" is not in allowed categories.`;

        const tx: AuditTransaction = {
          id: makeUniqueId("tx"),
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
          reason: policyReason,
        };

        await persistTransaction(tx);

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
            `✗ ${policyReason}`,
            "✓ PayPal Vault stayed locked ($0.00 moved).",
          ],
        }));
        return;
      }

      // Check Over-Budget or Daily-Limit Escalation (1-Click Human Override)
      const latestMandate = mandateRef.current;
      const exceedsPerTx = selected.price > latestMandate.maxPerTransaction;
      const exceedsDailyLimit =
        latestMandate.dailySpent + selected.price > latestMandate.dailyLimit;

      if (exceedsPerTx || exceedsDailyLimit) {
        const txId = makeUniqueId("tx");
        const limitDetail = exceedsPerTx
          ? `$${selected.price.toFixed(2)} > $${latestMandate.maxPerTransaction.toFixed(2)} per-purchase cap`
          : `Projected daily spend $${(
              latestMandate.dailySpent + selected.price
            ).toFixed(2)} > $${latestMandate.dailyLimit.toFixed(2)} daily limit`;

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
          reason: `Paused for 1-Click Human Override (${limitDetail}).`,
        };

        await persistTransaction(tx);

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
            `⚠ ${limitDetail}.`,
            "→ Tap Approve below to release scoped PayPal funds.",
          ],
        }));
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
      if (runIdRef.current !== currentRunId) return;

      setSimulation((prev) => ({
        ...prev,
        stage: "paypal_settling",
      }));
      await sleep(400);
      if (runIdRef.current !== currentRunId) return;

      const orderId = buildSimOrderId();
      const freshMandate = mandateRef.current;
      await persistMandate({
        ...freshMandate,
        dailySpent: Number((freshMandate.dailySpent + selected.price).toFixed(2)),
      });

      const tx: AuditTransaction = {
        id: makeUniqueId("tx"),
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
        )} <= $${freshMandate.maxPerTransaction.toFixed(2)}). Settled with 0% PII.`,
      };

      await persistTransaction(tx);

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
          `✓ Price $${selected.price.toFixed(2)} fits within $${freshMandate.maxPerTransaction.toFixed(
            2
          )} cap.`,
          `✓ Category "${selected.category}" permitted; 0 injection threats.`,
          "✓ Vaulted shipping address relayed directly from PayPal to Merchant.",
        ],
      }));
    } finally {
      if (runIdRef.current === currentRunId) {
        setIsRunning(false);
      }
    }
  }

  async function handleApproveOverride() {
    if (!simulation.selectedProduct || isSettlingOverride) return;

    setIsSettlingOverride(true);
    try {
      const amount = simulation.proposedTotal;
      const orderId = buildSimOrderId();
      const freshMandate = mandateRef.current;

      await persistMandate({
        ...freshMandate,
        dailySpent: Number((freshMandate.dailySpent + amount).toFixed(2)),
      });

      if (simulation.pendingOverrideTransactionId) {
        await patchTransaction(simulation.pendingOverrideTransactionId, {
          verdict: "APPROVED",
          merchantStatusCode: 201,
          paypalOrderId: orderId,
          reason: `Human 1-Click Override Approved ($${amount.toFixed(
            2
          )}). Settled with 0% PII.`,
        });
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
    } finally {
      setIsSettlingOverride(false);
    }
  }

  async function handleRejectOverride() {
    if (isSettlingOverride) return;

    setIsSettlingOverride(true);
    try {
      if (simulation.pendingOverrideTransactionId) {
        await patchTransaction(simulation.pendingOverrideTransactionId, {
          verdict: "BLOCKED",
          merchantStatusCode: 422,
          paypalOrderId: null,
          reason: "Rejected by Human during 1-Click Over-Budget Confirmation.",
        });
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
    } finally {
      setIsSettlingOverride(false);
    }
  }

  async function handleResetDemo() {
    if (isRunning) return;
    runIdRef.current += 1;
    const freshMandate = resetClientStorage();
    setMandate(freshMandate);
    mandateRef.current = freshMandate;
    setTransactions([]);
    transactionsRef.current = [];
    setSimulation(INITIAL_SIMULATION);
    void syncServerState({ action: "reset" });
  }

  return (
    <div className="relative flex min-h-screen flex-col bg-[#FAFAFA]">
      <PullDownTV
        open={tvOpen}
        onClose={() => setTvOpen(false)}
        simulation={simulation}
        mandate={mandate}
        transactions={transactions}
        isRunning={isRunning}
        isSettlingOverride={isSettlingOverride}
        onApproveOverride={handleApproveOverride}
        onRejectOverride={handleRejectOverride}
        onResetDemo={handleResetDemo}
      />

      <MandateHeader
        mandate={mandate}
        onUpdateMandate={persistMandate}
        selectedCategory={selectedCategory}
        onSelectCategory={setSelectedCategory}
        aiDrawerOpen={aiDrawerOpen}
        onToggleAiDrawer={() => setAiDrawerOpen((prev) => !prev)}
        tvOpen={tvOpen}
        onToggleTv={() => setTvOpen((prev) => !prev)}
        activeVerdict={simulation.verdict}
        isRunning={isRunning}
        cartItems={cartItems}
        onRemoveFromCart={handleRemoveFromCart}
        onClearCart={handleClearCart}
        onCheckoutCartWithAi={handleCheckoutCartWithAi}
      />

      <main className="flex-1">
        <ProductGrid
          products={PRODUCT_CATALOG}
          selectedCategory={selectedCategory}
          onSelectCategory={setSelectedCategory}
          onAddToCart={handleAddToCart}
          onAiBuyProduct={handleAiBuyProduct}
          onOpenAiShopper={() => setAiDrawerOpen(true)}
          highlightedProductId={simulation.selectedProduct?.id ?? null}
        />
      </main>

      <AIShopperDrawer
        open={aiDrawerOpen}
        onClose={() => setAiDrawerOpen(false)}
        mode={mode}
        onModeChange={setMode}
        prompt={prompt}
        onPromptChange={setPrompt}
        onRunPrompt={handleRunAgent}
        isRunning={isRunning}
        mandate={mandate}
        simulation={simulation}
        onOpenTv={() => {
          setAiDrawerOpen(false);
          setTvOpen(true);
        }}
        inputRef={promptInputRef}
      />
    </div>
  );
}
