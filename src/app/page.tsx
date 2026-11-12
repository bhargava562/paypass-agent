"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
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
import {
  AgentExecuteResponse,
  CheckoutResponse,
  CustomItemInput,
} from "@/types/ghostpass";
import { AppShellHeader, AppViewMode } from "@/components/AppShellHeader";
import { ControlPlaneView } from "@/components/ControlPlaneView";
import { LandingHero } from "@/components/LandingHero";
import { StoreNavbar } from "@/components/StoreNavbar";
import { ProductGrid } from "@/components/ProductGrid";
import {
  CheckoutDriver,
  StoreCheckoutModal,
} from "@/components/StoreCheckoutModal";

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
  paypalStatus: null,
  sandboxActivityUrl: null,
  approveUrl: null,
  liveSandbox: false,
  verificationHash: null,
  approvalToken: null,
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

async function safeParseJson<T>(res: Response): Promise<T | null> {
  try {
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

async function syncServerState(payload: Record<string, unknown>): Promise<boolean> {
  try {
    const res = await fetch("/api/state", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export default function PayPalGhostPassApp() {
  const [activeView, setActiveView] = useState<AppViewMode>("overview");
  const [mcpModalOpen, setMcpModalOpen] = useState(false);
  const [mandate, setMandate] = useState<SpendingMandate>(DEFAULT_MANDATE);
  const [transactions, setTransactions] = useState<AuditTransaction[]>([]);
  const [manualOrders, setManualOrders] = useState<AuditTransaction[]>([]);
  const [paypalConfigured, setPaypalConfigured] = useState(false);
  const [sandboxBuyerLabel, setSandboxBuyerLabel] = useState(
    "sandbox-buyer@personal.example.com"
  );
  const [storageBackend, setStorageBackend] = useState("memory-localstorage");
  const [sessionApiKey] = useState("gp_live_0pii_sandbox_v2");

  // Control Plane Agent Runner State
  const [mode, setMode] = useState<AgentMode>("ghostpass");
  const [prompt, setPrompt] = useState(
    "Buy Keychron Q1 Pro Wireless Mechanical Keyboard under $60"
  );
  const [isRunning, setIsRunning] = useState(false);
  const [isSettlingOverride, setIsSettlingOverride] = useState(false);
  const [simulation, setSimulation] =
    useState<SimulationRunState>(INITIAL_SIMULATION);

  // NovaTech Storefront View State
  const [selectedCategory, setSelectedCategory] = useState<
    "All" | ProductCategory
  >("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [cartItems, setCartItems] = useState<Product[]>([]);
  const [checkoutDriver, setCheckoutDriver] = useState<CheckoutDriver | null>(
    null
  );

  const mandateRef = useRef<SpendingMandate>(mandate);
  const runIdRef = useRef(0);

  useEffect(() => {
    mandateRef.current = mandate;
  }, [mandate]);

  const merchantOrders = useMemo(
    () => [
      ...manualOrders,
      ...transactions.filter((tx) => tx.verdict === "APPROVED"),
    ],
    [manualOrders, transactions]
  );

  async function refreshFromServerState() {
    try {
      const res = await fetch("/api/state", { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as {
        backend?: string;
        paypalConfigured?: boolean;
        sandboxBuyerLabel?: string;
        mandate?: SpendingMandate;
        transactions?: AuditTransaction[];
      };
      if (data.backend) setStorageBackend(data.backend);
      if (typeof data.paypalConfigured === "boolean") {
        setPaypalConfigured(data.paypalConfigured);
      }
      if (data.sandboxBuyerLabel) {
        setSandboxBuyerLabel(data.sandboxBuyerLabel);
      }
      if (data.mandate) {
        setMandate(data.mandate);
        mandateRef.current = data.mandate;
        writeClientMandate(data.mandate);
      }
      if (Array.isArray(data.transactions)) {
        const localTxs = readClientTransactions();
        const resolvedTxs =
          data.backend !== "neon-postgres" &&
          data.transactions.length === 0 &&
          localTxs &&
          localTxs.length > 0
            ? localTxs
            : data.transactions;
        setTransactions(resolvedTxs);
        writeClientTransactions(resolvedTxs);
      }
    } catch {
      // Offline / localStorage fallback
    }
  }

  useEffect(() => {
    let active = true;
    async function hydrate() {
      const localMandate = readClientMandate();
      const localTxs = readClientTransactions();

      try {
        const res = await fetch("/api/state", { cache: "no-store" });
        if (!active) return;

        if (!res.ok) {
          if (localMandate) setMandate(localMandate);
          if (localTxs) setTransactions(localTxs);
          return;
        }

        const data = (await res.json()) as {
          backend?: string;
          paypalConfigured?: boolean;
          sandboxBuyerLabel?: string;
          mandate?: SpendingMandate;
          transactions?: AuditTransaction[];
        };
        if (!active) return;

        if (data.backend) setStorageBackend(data.backend);
        if (typeof data.paypalConfigured === "boolean") {
          setPaypalConfigured(data.paypalConfigured);
        }
        if (data.sandboxBuyerLabel) {
          setSandboxBuyerLabel(data.sandboxBuyerLabel);
        }

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
          if (Array.isArray(data.transactions) && data.transactions.length > 0) {
            setTransactions(data.transactions);
            writeClientTransactions(data.transactions);
            if (data.mandate) {
              setMandate(data.mandate);
              writeClientMandate(data.mandate);
            }
          } else {
            if (localMandate) {
              setMandate(localMandate);
              void syncServerState({ action: "save_mandate", mandate: localMandate });
            } else if (data.mandate) {
              setMandate(data.mandate);
            }
            if (localTxs) {
              setTransactions(localTxs);
            }
          }
        }
      } catch {
        if (!active) return;
        if (localMandate) setMandate(localMandate);
        if (localTxs) setTransactions(localTxs);
      }
    }
    void hydrate();
    return () => {
      active = false;
    };
  }, []);

  async function persistMandate(next: SpendingMandate): Promise<SpendingMandate> {
    const ok = await syncServerState({ action: "save_mandate", mandate: next });
    if (!ok) {
      throw new Error("Failed to save mandate");
    }
    const saved: SpendingMandate = {
      ...next,
      updatedAt: new Date().toISOString(),
    };
    setMandate(saved);
    mandateRef.current = saved;
    writeClientMandate(saved);
    return saved;
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

  function handleHumanBuyNow(product: Product) {
    setCheckoutDriver({ type: "human", items: [product], source: "buy_now" });
  }

  function handleOpenCartCheckout() {
    if (cartItems.length === 0) return;
    setCheckoutDriver({ type: "human", items: cartItems, source: "cart" });
  }

  async function handleHumanPaySuccess(
    items: Product[],
    method: "paypal" | "card",
    source: "cart" | "buy_now",
    orderId: string
  ) {
    const total = items.reduce((s, item) => s + item.price, 0);
    const label =
      items.length === 1
        ? items[0].name
        : `${items[0]?.name ?? "NovaTech Item"} (+${items.length - 1} more)`;

    if (items[0]) {
      try {
        await fetch("/api/store/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            productId: items[0].id,
            amount: total,
            mode: "GHOSTPASS",
            isManualHumanCheckout: true,
          }),
        });
      } catch {
        // Non-blocking manual storefront receipt
      }
    }

    const manualOrder: AuditTransaction = {
      id: `tx-human-${Date.now()}`,
      timestamp: new Date().toISOString(),
      mode: "ghostpass",
      prompt: `Direct Customer ${method.toUpperCase()} Checkout`,
      requestedProductId: items[0]?.id,
      requestedProductName: label,
      cartItems: items.map((i) => ({
        id: i.id,
        name: i.name,
        price: i.price,
        category: i.category,
      })),
      totalAmount: total,
      verdict: "APPROVED",
      riskScore: 0,
      piiExposedPct: 0,
      merchantStatusCode: 200,
      paypalOrderId: orderId,
      reason: `Direct storefront checkout (${method}).`,
    };
    setManualOrders((prev) => [manualOrder, ...prev]);

    if (source === "cart") {
      setCartItems([]);
    }
  }

  async function handleRunAgent(
    promptOverride?: string,
    customItem?: CustomItemInput,
    modeOverride?: AgentMode
  ) {
    const activeMode = modeOverride ?? mode;
    const fallbackCustomPrompt =
      customItem && customItem.title.trim()
        ? `Buy ${customItem.title.trim()} ($${Number(customItem.price).toFixed(
            2
          )})`
        : "";
    const activePrompt = (
      promptOverride ??
      (fallbackCustomPrompt || prompt)
    ).trim();
    if (!activePrompt || isRunning || isSettlingOverride) return;

    const currentRunId = ++runIdRef.current;
    setIsRunning(true);

    try {
      const currentMandate = mandateRef.current;

      setSimulation({
        ...INITIAL_SIMULATION,
        stage: "agent_browsing",
        mode: activeMode,
        prompt: activePrompt,
        piiExposedPct: activeMode === "standard_bot" ? 100 : 0,
        merchantBadge: "Agent Scanning NovaTech Catalog...",
        gatekeeperNotes: [
          `• Running "${activePrompt}" via Two-Brain Pipeline...`,
          activeMode === "standard_bot"
            ? "• Warning: Unverified bot attaches raw user PII."
            : "• Blindfolded VIP session active — 0% PII shared with agent.",
        ],
      });

      const execResRaw = await fetch("/api/agent/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: activePrompt,
          mode: activeMode === "standard_bot" ? "STANDARD_BOT" : "GHOSTPASS",
          sessionId: sessionApiKey,
          customItem,
          mandate: {
            id: currentMandate.id,
            ruleText: currentMandate.ruleText,
            dailyCap: currentMandate.dailyLimit,
            spentToday: currentMandate.dailySpent,
            autoApproveLimit: currentMandate.maxPerTransaction,
            blockGiftCards: currentMandate.blockGiftCards,
            blockSubscriptions: currentMandate.blockSubscriptions,
            allowedCategories: currentMandate.allowedCategories,
          },
        }),
      });

      if (runIdRef.current !== currentRunId) return;

      if (!execResRaw.ok) {
        throw new Error(`Agent execution failed (${execResRaw.status})`);
      }

      const execData = (await execResRaw.json()) as AgentExecuteResponse;

      if (execData.decision === "BLOCK") {
        setSimulation({
          ...INITIAL_SIMULATION,
          stage: "complete",
          mode: activeMode,
          prompt: activePrompt,
          verdict: "BLOCKED",
          riskScore: execData.riskScore,
          piiExposedPct: 0,
          merchantStatusCode: null,
          merchantBadge: "Checkout Aborted Before Merchant",
          selectedProduct: execData.selectedProduct,
          injectedProduct: execData.injectedProduct,
          proposedTotal: execData.proposedCartTotal,
          paypalOrderId: null,
          gatekeeperNotes: execData.gatekeeperNotes,
          agentContextPreview: execData.redactedContext,
          pendingOverrideTransactionId: execData.auditEventId ?? null,
        });
        await refreshFromServerState();
        return;
      }

      if (execData.decision === "REQUIRE_HUMAN") {
        setSimulation({
          ...INITIAL_SIMULATION,
          stage: "complete",
          mode: activeMode,
          prompt: activePrompt,
          verdict: "NEEDS_APPROVAL",
          riskScore: execData.riskScore,
          piiExposedPct: 0,
          merchantStatusCode: 200,
          merchantBadge: "Mandate Ready · Awaiting Human Approval",
          selectedProduct: execData.selectedProduct,
          injectedProduct: null,
          proposedTotal: execData.proposedCartTotal,
          paypalOrderId: null,
          approvalToken: execData.approvalToken ?? null,
          gatekeeperNotes: execData.gatekeeperNotes,
          agentContextPreview: execData.redactedContext,
          pendingOverrideTransactionId: execData.auditEventId ?? null,
        });
        await refreshFromServerState();
        return;
      }

      // Stage 3 & 4: Submit to NovaTech Merchant Firewall -> Settle via PayPal Orders v2
      setSimulation({
        ...INITIAL_SIMULATION,
        stage: "paypal_settling",
        mode: activeMode,
        prompt: activePrompt,
        piiExposedPct: execData.piiExposedPct,
        selectedProduct: execData.selectedProduct,
        proposedTotal: execData.proposedCartTotal,
        merchantBadge:
          activeMode === "standard_bot"
            ? "NovaTech Anti-Bot Firewall Checking..."
            : "Settling via PayPal Sandbox Orders v2...",
        gatekeeperNotes: execData.gatekeeperNotes,
        agentContextPreview:
          execData.exposedPiiContext ?? execData.redactedContext,
      });

      const checkoutHeaders: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (execData.signature) {
        checkoutHeaders["X-PayPal-GhostPass-Signature"] = execData.signature;
      }

      const checkoutResRaw = await fetch("/api/store/checkout", {
        method: "POST",
        headers: checkoutHeaders,
        body: JSON.stringify({
          productId: execData.selectedProduct.id,
          amount: execData.proposedCartTotal,
          mode: execData.mode,
          sessionId: execData.sessionId,
          prompt: activePrompt,
          ghostPassHeader: execData.signature,
          agentContextPayload:
            execData.exposedPiiContext ?? execData.redactedContext,
          customProduct: execData.selectedProduct.id.startsWith("custom-")
            ? {
                title: execData.selectedProduct.name,
                price: execData.selectedProduct.price,
                category: execData.selectedProduct.category,
                merchant: execData.selectedProduct.brand,
              }
            : undefined,
        }),
      });

      if (runIdRef.current !== currentRunId) return;

      const checkoutData = await safeParseJson<CheckoutResponse>(checkoutResRaw);
      if (!checkoutData) {
        throw new Error(`Checkout failed (${checkoutResRaw.status})`);
      }

      if (checkoutResRaw.status === 403 || checkoutData.httpStatus === 403) {
        setSimulation({
          ...INITIAL_SIMULATION,
          stage: "complete",
          mode: activeMode,
          prompt: activePrompt,
          verdict: "403_REJECTED",
          riskScore: 86,
          piiExposedPct: checkoutData.piiExposedPct,
          merchantStatusCode: 403,
          merchantBadge: "403 Forbidden: Unverified AI Scraper Blocked",
          selectedProduct: execData.selectedProduct,
          proposedTotal: execData.proposedCartTotal,
          paypalOrderId: null,
          agentContextPreview:
            execData.exposedPiiContext ?? execData.redactedContext,
          gatekeeperNotes: [
            "✗ Personal name, email & address leaked into bot payload.",
            `✗ ${checkoutData.message}`,
            "✓ PayPal Vault untouched ($0.00 moved).",
          ],
        });
        await refreshFromServerState();
        return;
      }

      if (!checkoutResRaw.ok) {
        throw new Error(
          checkoutData.message || `Checkout failed (${checkoutResRaw.status})`
        );
      }

      setSimulation({
        ...INITIAL_SIMULATION,
        stage: "complete",
        mode: activeMode,
        prompt: activePrompt,
        verdict: "APPROVED",
        riskScore: execData.riskScore,
        piiExposedPct: 0,
        merchantStatusCode: 200,
        merchantBadge: "Verified PayPal Human Mandate Accepted",
        selectedProduct: execData.selectedProduct,
        proposedTotal: execData.proposedCartTotal,
        paypalOrderId:
          checkoutData.paypalOrderId ?? checkoutData.receiptToken ?? null,
        paypalStatus: checkoutData.paypalStatus ?? null,
        sandboxActivityUrl: checkoutData.sandboxActivityUrl ?? null,
        approveUrl: checkoutData.approveUrl ?? null,
        liveSandbox: Boolean(checkoutData.liveSandbox),
        verificationHash: checkoutData.verificationHash ?? null,
        agentContextPreview: execData.redactedContext,
        gatekeeperNotes: [
          ...execData.gatekeeperNotes,
          `✓ ${checkoutData.message}`,
        ],
      });
      await refreshFromServerState();
    } catch (err) {
      if (runIdRef.current !== currentRunId) return;
      const msg = err instanceof Error ? err.message : "Pipeline error";
      setSimulation({
        ...INITIAL_SIMULATION,
        stage: "complete",
        mode: activeMode,
        prompt: activePrompt,
        verdict: "BLOCKED",
        riskScore: 90,
        merchantBadge: "Execution Error",
        gatekeeperNotes: [`✗ ${msg}`],
      });
    } finally {
      if (runIdRef.current === currentRunId) {
        setIsRunning(false);
      }
    }
  }

  async function handleApproveOverride() {
    if (
      !simulation.selectedProduct ||
      !simulation.approvalToken ||
      isSettlingOverride
    ) {
      return;
    }

    const activeRunId = runIdRef.current;
    setIsSettlingOverride(true);
    try {
      const resRaw = await fetch("/api/store/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-PayPal-Human-Override": simulation.approvalToken,
        },
        body: JSON.stringify({
          productId: simulation.selectedProduct.id,
          amount: simulation.proposedTotal,
          mode: "GHOSTPASS",
          prompt: simulation.prompt,
          humanOverrideToken: simulation.approvalToken,
          auditEventId: simulation.pendingOverrideTransactionId ?? undefined,
          agentContextPayload: simulation.agentContextPreview,
          customProduct: simulation.selectedProduct.id.startsWith("custom-")
            ? {
                title: simulation.selectedProduct.name,
                price: simulation.selectedProduct.price,
                category: simulation.selectedProduct.category,
                merchant: simulation.selectedProduct.brand,
              }
            : undefined,
        }),
      });

      if (runIdRef.current !== activeRunId) return;

      const data = await safeParseJson<CheckoutResponse>(resRaw);
      if (!data) {
        throw new Error(`Override failed (${resRaw.status})`);
      }

      if (!resRaw.ok) {
        setSimulation((prev) => ({
          ...prev,
          stage: "complete",
          verdict: "403_REJECTED",
          merchantStatusCode: resRaw.status === 403 ? 403 : 500,
          merchantBadge: "Override Settlement Failed",
          gatekeeperNotes: [`✗ ${data.message || "Override failed"}`],
        }));
        await refreshFromServerState();
        return;
      }

      setSimulation((prev) => ({
        ...prev,
        stage: "complete",
        verdict: "APPROVED",
        riskScore: 15,
        merchantStatusCode: 200,
        merchantBadge: "Human Override + PayPal Orders v2 Settled",
        paypalOrderId: data.paypalOrderId ?? data.receiptToken ?? null,
        paypalStatus: data.paypalStatus ?? null,
        sandboxActivityUrl: data.sandboxActivityUrl ?? null,
        approveUrl: data.approveUrl ?? null,
        liveSandbox: Boolean(data.liveSandbox),
        verificationHash: data.verificationHash ?? null,
        approvalToken: null,
        pendingOverrideTransactionId: null,
        gatekeeperNotes: [
          "✓ 1-Click Human Override cryptographically verified.",
          `✓ ${data.message}`,
          "✓ 0% PII exposed to the AI agent.",
        ],
      }));
      await refreshFromServerState();
    } catch (err) {
      if (runIdRef.current !== activeRunId) return;
      const msg = err instanceof Error ? err.message : "Override failed";
      setSimulation((prev) => ({
        ...prev,
        stage: "complete",
        verdict: "BLOCKED",
        merchantBadge: "Override Error",
        gatekeeperNotes: [`✗ ${msg}`],
      }));
    } finally {
      setIsSettlingOverride(false);
    }
  }

  async function handleRejectOverride() {
    if (isSettlingOverride) return;

    const activeRunId = runIdRef.current;
    setIsSettlingOverride(true);
    try {
      if (simulation.pendingOverrideTransactionId) {
        await syncServerState({
          action: "decline_override",
          txId: simulation.pendingOverrideTransactionId,
        });
      }

      if (runIdRef.current !== activeRunId) return;

      setSimulation((prev) => ({
        ...prev,
        stage: "complete",
        verdict: "BLOCKED",
        merchantStatusCode: null,
        merchantBadge: "Declined by Human Owner",
        paypalOrderId: null,
        approvalToken: null,
        pendingOverrideTransactionId: null,
        gatekeeperNotes: [
          "✓ Purchase declined by human tap.",
          "✓ PayPal Vault stayed locked ($0.00 moved).",
        ],
      }));
      await refreshFromServerState();
    } catch {
      // Keep UI unlocked even if network fails
    } finally {
      setIsSettlingOverride(false);
    }
  }

  async function handleResetDemo() {
    if (isRunning || isSettlingOverride) return;
    runIdRef.current += 1;
    const freshMandate = resetClientStorage();
    setMandate(freshMandate);
    mandateRef.current = freshMandate;
    setTransactions([]);
    setManualOrders([]);
    setSimulation(INITIAL_SIMULATION);
    setCheckoutDriver(null);
    await syncServerState({ action: "reset" });
    await refreshFromServerState();
  }

  function handleChangeView(nextView: AppViewMode) {
    setActiveView(nextView);
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  function handleOpenMcpConfig() {
    setActiveView("console");
    setMcpModalOpen(true);
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  return (
    <div
      className={`relative flex min-h-screen flex-col ${
        activeView === "overview" ? "bg-[#060B19]" : "bg-[#FAFAFA]"
      }`}
    >
      <AppShellHeader
        activeView={activeView}
        onChangeView={handleChangeView}
        onOpenMcpConfig={handleOpenMcpConfig}
        onOpenControlPlane={() => handleChangeView("console")}
        paypalConfigured={paypalConfigured}
        merchantOrdersCount={merchantOrders.length}
      />

      {activeView === "overview" ? (
        <main className="flex-1">
          <LandingHero
            onLaunchControlPlane={() => handleChangeView("console")}
            onExploreStore={() => handleChangeView("storefront")}
            sessionApiKey={sessionApiKey}
            maxPerTx={mandate.maxPerTransaction}
            simulation={simulation}
          />
        </main>
      ) : activeView === "console" ? (
        <main className="flex-1">
          <ControlPlaneView
            mandate={mandate}
            onUpdateMandate={persistMandate}
            sandboxBuyerLabel={sandboxBuyerLabel}
            sessionApiKey={sessionApiKey}
            mode={mode}
            onModeChange={setMode}
            prompt={prompt}
            onPromptChange={setPrompt}
            onRunAgent={handleRunAgent}
            isRunning={isRunning}
            isSettlingOverride={isSettlingOverride}
            simulation={simulation}
            transactions={transactions}
            onApproveOverride={handleApproveOverride}
            onRejectOverride={handleRejectOverride}
            mcpOpen={mcpModalOpen}
            onMcpOpenChange={setMcpModalOpen}
            storageBackend={storageBackend}
            isBusy={isRunning || isSettlingOverride}
            onResetDemo={handleResetDemo}
          />
        </main>
      ) : (
        <>
          <StoreNavbar
            selectedCategory={selectedCategory}
            onSelectCategory={setSelectedCategory}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            cartItems={cartItems}
            onRemoveFromCart={handleRemoveFromCart}
            onClearCart={handleClearCart}
            onOpenCartCheckout={handleOpenCartCheckout}
            merchantOrders={merchantOrders}
          />

          <main className="flex-1">
            <ProductGrid
              products={PRODUCT_CATALOG}
              selectedCategory={selectedCategory}
              onSelectCategory={setSelectedCategory}
              searchQuery={searchQuery}
              onResetFilters={() => {
                setSelectedCategory("All");
                setSearchQuery("");
              }}
              onAddToCart={handleAddToCart}
              onBuyNow={handleHumanBuyNow}
              highlightedProductId={simulation.selectedProduct?.id ?? null}
            />
          </main>

          <StoreCheckoutModal
            driver={checkoutDriver}
            onClose={() => setCheckoutDriver(null)}
            onHumanPaySuccess={handleHumanPaySuccess}
            isSettlingOverride={isSettlingOverride}
            onApproveOverride={handleApproveOverride}
            onRejectOverride={handleRejectOverride}
          />
        </>
      )}
    </div>
  );
}
