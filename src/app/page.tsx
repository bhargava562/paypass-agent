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
import {
  AgentExecuteResponse,
  CheckoutResponse,
} from "@/types/ghostpass";
import { BrowserChromeBar } from "@/components/BrowserChromeBar";
import { StoreNavbar } from "@/components/StoreNavbar";
import { ProductGrid } from "@/components/ProductGrid";
import {
  CheckoutDriver,
  StoreCheckoutModal,
} from "@/components/StoreCheckoutModal";
import { AgentExtensionWidget } from "@/components/AgentExtensionWidget";
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

export default function NovaTechStoreWithGhostPassPage() {
  const [mandate, setMandate] = useState<SpendingMandate>(DEFAULT_MANDATE);
  const [transactions, setTransactions] = useState<AuditTransaction[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<
    "All" | ProductCategory
  >("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [cartItems, setCartItems] = useState<Product[]>([]);
  const [checkoutDriver, setCheckoutDriver] = useState<CheckoutDriver | null>(
    null
  );

  const [mode, setMode] = useState<AgentMode>("ghostpass");
  const [prompt, setPrompt] = useState("Buy wireless keyboard under $60");
  const [tvOpen, setTvOpen] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [isSettlingOverride, setIsSettlingOverride] = useState(false);
  const [simulation, setSimulation] =
    useState<SimulationRunState>(INITIAL_SIMULATION);

  const promptInputRef = useRef<HTMLInputElement | null>(null);
  const mandateRef = useRef<SpendingMandate>(mandate);
  const runIdRef = useRef(0);

  useEffect(() => {
    mandateRef.current = mandate;
  }, [mandate]);

  async function refreshFromServerState() {
    try {
      const res = await fetch("/api/state", { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as {
        backend?: string;
        mandate?: SpendingMandate;
        transactions?: AuditTransaction[];
      };
      if (data.mandate) {
        setMandate(data.mandate);
        mandateRef.current = data.mandate;
        writeClientMandate(data.mandate);
      }
      if (Array.isArray(data.transactions)) {
        setTransactions(data.transactions);
        writeClientTransactions(data.transactions);
      }
    } catch {
      // Fallback gracefully to current state
    }
  }

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
          // If clientStorage already has local edits/history, sync them up once to server memory
          if (localMandate && (!data.transactions || data.transactions.length === 0)) {
            void syncServerState({ action: "save_mandate", mandate: localMandate });
          } else if (!localMandate && data.mandate) {
            setMandate(data.mandate);
          }
          if (!localTxs && Array.isArray(data.transactions)) {
            setTransactions(data.transactions);
          } else if (Array.isArray(data.transactions) && data.transactions.length > 0) {
            setTransactions(data.transactions);
            writeClientTransactions(data.transactions);
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
    await syncServerState({ action: "save_mandate", mandate: saved });
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
    setCheckoutDriver({ type: "human", items: [product] });
  }

  function handleOpenCartCheckout() {
    if (cartItems.length === 0) return;
    setCheckoutDriver({ type: "human", items: cartItems });
  }

  function handleHumanPaySuccess(items: Product[]) {
    if (items[0]) {
      void fetch("/api/store/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: items[0].id,
          amount: items.reduce((s, item) => s + item.price, 0),
          mode: "GHOSTPASS",
          isManualHumanCheckout: true,
        }),
      }).catch(() => undefined);
    }
    if (items.length === cartItems.length && items.length > 0) {
      setCartItems([]);
    }
  }

  function updateAgentSimulation(next: SimulationRunState) {
    setSimulation(next);
    setCheckoutDriver({ type: "agent", simulation: next });
  }

  async function handleRunAgent(promptOverride?: string) {
    const activePrompt = (promptOverride ?? prompt).trim();
    if (!activePrompt || isRunning) return;

    const currentRunId = ++runIdRef.current;
    setIsRunning(true);

    try {
      const currentMandate = mandateRef.current;

      // Stage 1: Trigger Blind Shopping Agent + Gatekeeper via /api/agent/execute
      updateAgentSimulation({
        ...INITIAL_SIMULATION,
        stage: "agent_browsing",
        mode,
        prompt: activePrompt,
        piiExposedPct: mode === "standard_bot" ? 100 : 0,
        merchantBadge: "Agent Scanning NovaTech Catalog...",
        shippingRelayLabel:
          mode === "standard_bot"
            ? "Bot Typing Raw Home Address"
            : "PayPal Vault Direct Relay",
        gatekeeperNotes: [
          `• Running "${activePrompt}" via Two-Brain Pipeline...`,
          mode === "standard_bot"
            ? "• Warning: Unverified bot attaches raw user PII."
            : "• Blindfolded VIP session active — 0% PII shared with agent.",
        ],
      });

      const execResRaw = await fetch("/api/agent/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: activePrompt,
          mode: mode === "standard_bot" ? "STANDARD_BOT" : "GHOSTPASS",
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

      // Branch 1: Gatekeeper BLOCKED (Prompt Injection or Restricted Policy / Daily Cap)
      if (execData.decision === "BLOCK") {
        updateAgentSimulation({
          ...INITIAL_SIMULATION,
          stage: "complete",
          mode,
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
          shippingRelayLabel: "PayPal Vault Locked ($0 Moved)",
          gatekeeperNotes: execData.gatekeeperNotes,
          agentContextPreview: execData.redactedContext,
          pendingOverrideTransactionId: execData.auditEventId ?? null,
        });
        await refreshFromServerState();
        return;
      }

      // Branch 2: Gatekeeper Paused for 1-Click Human Override
      if (execData.decision === "REQUIRE_HUMAN") {
        updateAgentSimulation({
          ...INITIAL_SIMULATION,
          stage: "complete",
          mode,
          prompt: activePrompt,
          verdict: "NEEDS_APPROVAL",
          riskScore: execData.riskScore,
          piiExposedPct: 0,
          merchantStatusCode: 200,
          merchantBadge: "✓ Mandate Ready · Awaiting Human Tap",
          selectedProduct: execData.selectedProduct,
          injectedProduct: null,
          proposedTotal: execData.proposedCartTotal,
          paypalOrderId: null,
          approvalToken: execData.approvalToken ?? null,
          shippingRelayLabel: "PayPal Vault Direct Relay (On Hold)",
          gatekeeperNotes: execData.gatekeeperNotes,
          agentContextPreview: execData.redactedContext,
          pendingOverrideTransactionId: execData.auditEventId ?? null,
        });
        await refreshFromServerState();
        return;
      }

      // Branch 3: Submit to NovaTech Merchant Anti-Bot Firewall (/api/store/checkout)
      const checkingSim: SimulationRunState = {
        ...INITIAL_SIMULATION,
        stage: "merchant_checking",
        mode,
        prompt: activePrompt,
        piiExposedPct: execData.piiExposedPct,
        selectedProduct: execData.selectedProduct,
        injectedProduct: null,
        proposedTotal: execData.proposedCartTotal,
        merchantBadge:
          mode === "standard_bot"
            ? "NovaTech Anti-Bot Firewall Checking..."
            : "Verifying X-PayPal-GhostPass-Signature...",
        shippingRelayLabel:
          mode === "standard_bot"
            ? "Bot Typing Raw Home Address"
            : "PayPal Vault Direct Relay",
        gatekeeperNotes: execData.gatekeeperNotes,
        agentContextPreview:
          execData.exposedPiiContext ?? execData.redactedContext,
      };
      updateAgentSimulation(checkingSim);

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
        }),
      });

      if (runIdRef.current !== currentRunId) return;

      const checkoutData = (await checkoutResRaw.json()) as CheckoutResponse;

      if (checkoutResRaw.status === 403 || checkoutData.httpStatus === 403) {
        updateAgentSimulation({
          ...checkingSim,
          stage: "complete",
          verdict: "403_REJECTED",
          riskScore: 86,
          piiExposedPct: checkoutData.piiExposedPct,
          merchantStatusCode: 403,
          merchantBadge: "403 Forbidden: Unverified AI Scraper Blocked",
          paypalOrderId: null,
          gatekeeperNotes: [
            "✗ Personal name, email & address leaked into bot payload.",
            `✗ ${checkoutData.message}`,
            "✓ PayPal Vault untouched ($0.00 moved).",
          ],
        });
        await refreshFromServerState();
        return;
      }

      updateAgentSimulation({
        ...checkingSim,
        stage: "complete",
        verdict: "APPROVED",
        riskScore: execData.riskScore,
        piiExposedPct: 0,
        merchantStatusCode: 200,
        merchantBadge: "✓ Verified PayPal Human Mandate Accepted",
        paypalOrderId: checkoutData.receiptToken ?? null,
        verificationHash: checkoutData.verificationHash ?? null,
        gatekeeperNotes: [
          ...execData.gatekeeperNotes,
          `✓ ${checkoutData.message}`,
          `✓ Verification Hash: ${checkoutData.verificationHash ?? "VERIFIED"}`,
        ],
      });
      await refreshFromServerState();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Pipeline error";
      updateAgentSimulation({
        ...INITIAL_SIMULATION,
        stage: "complete",
        mode,
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
        }),
      });

      const data = (await resRaw.json()) as CheckoutResponse;

      if (!resRaw.ok) {
        const failedSim: SimulationRunState = {
          ...simulation,
          stage: "complete",
          verdict: "403_REJECTED",
          merchantStatusCode: 403,
          merchantBadge: "Override Verification Failed",
          gatekeeperNotes: [`✗ ${data.message}`],
        };
        setSimulation(failedSim);
        if (checkoutDriver?.type === "agent") {
          setCheckoutDriver({ type: "agent", simulation: failedSim });
        }
        await refreshFromServerState();
        return;
      }

      const nextSim: SimulationRunState = {
        ...simulation,
        stage: "complete",
        verdict: "APPROVED",
        riskScore: 15,
        merchantStatusCode: 200,
        merchantBadge: "✓ Human Override + PayPal Mandate Verified",
        paypalOrderId: data.receiptToken ?? null,
        verificationHash: data.verificationHash ?? null,
        approvalToken: null,
        pendingOverrideTransactionId: null,
        gatekeeperNotes: [
          "✓ 1-Click Human Override cryptographically verified.",
          `✓ ${data.message}`,
          "✓ 0% PII exposed to the AI agent.",
        ],
      };
      setSimulation(nextSim);
      if (checkoutDriver?.type === "agent") {
        setCheckoutDriver({ type: "agent", simulation: nextSim });
      }
      await refreshFromServerState();
    } finally {
      setIsSettlingOverride(false);
    }
  }

  async function handleRejectOverride() {
    if (isSettlingOverride) return;

    setIsSettlingOverride(true);
    try {
      if (simulation.pendingOverrideTransactionId) {
        await syncServerState({
          action: "update_tx",
          txId: simulation.pendingOverrideTransactionId,
          patch: {
            verdict: "BLOCKED",
            merchantStatusCode: 422,
            paypalOrderId: null,
            reason: "Rejected by Human during 1-Click Over-Budget Confirmation.",
          },
        });
      }

      const nextSim: SimulationRunState = {
        ...simulation,
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
      };
      setSimulation(nextSim);
      if (checkoutDriver?.type === "agent") {
        setCheckoutDriver({ type: "agent", simulation: nextSim });
      }
      await refreshFromServerState();
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
    setSimulation(INITIAL_SIMULATION);
    setCheckoutDriver(null);
    await syncServerState({ action: "reset" });
    await refreshFromServerState();
  }

  return (
    <div className="relative flex min-h-screen flex-col bg-[#FAFAFA]">
      {/* Browser Frame Pull-Down X-Ray TV */}
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

      {/* Slim Top Browser Chrome Bar */}
      <BrowserChromeBar
        tvOpen={tvOpen}
        onToggleTv={() => setTvOpen((prev) => !prev)}
        activeVerdict={simulation.verdict}
        isRunning={isRunning}
      />

      {/* Layer 1: Independent Merchant Storefront (NovaTech — 100% Pure E-Commerce) */}
      <StoreNavbar
        selectedCategory={selectedCategory}
        onSelectCategory={setSelectedCategory}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        cartItems={cartItems}
        onRemoveFromCart={handleRemoveFromCart}
        onClearCart={handleClearCart}
        onOpenCartCheckout={handleOpenCartCheckout}
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

      {/* NovaTech Standard Store Checkout Modal */}
      <StoreCheckoutModal
        driver={checkoutDriver}
        onClose={() => setCheckoutDriver(null)}
        onHumanPaySuccess={handleHumanPaySuccess}
        isSettlingOverride={isSettlingOverride}
        onApproveOverride={handleApproveOverride}
        onRejectOverride={handleRejectOverride}
      />

      {/* Layer 2: External Browser Extension Companion (Bottom-Right) */}
      <AgentExtensionWidget
        mandate={mandate}
        onUpdateMandate={persistMandate}
        mode={mode}
        onModeChange={setMode}
        prompt={prompt}
        onPromptChange={setPrompt}
        onRunPrompt={handleRunAgent}
        isRunning={isRunning}
        simulation={simulation}
        onOpenTv={() => {
          setCheckoutDriver(null);
          setTvOpen(true);
        }}
        inputRef={promptInputRef}
      />
    </div>
  );
}
