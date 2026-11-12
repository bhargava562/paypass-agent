import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import {
  AuditTransaction,
  DEFAULT_MANDATE,
  PRODUCT_CATALOG,
  Product,
} from "@/data/catalog";
import { runGatekeeperAudit } from "@/lib/agents/gatekeeperAgent";
import {
  resolveCatalogProductById,
  runBlindShoppingAgent,
} from "@/lib/agents/shoppingAgent";
import { appendTransaction, getMandate } from "@/lib/db";
import {
  AgentExecuteRequest,
  AgentExecuteResponse,
  AgentExecutionMode,
  MandateConfig,
} from "@/types/ghostpass";

export const maxDuration = 30;

function normalizeMode(
  raw: AgentExecuteRequest["mode"] | undefined
): AgentExecutionMode {
  if (raw === "STANDARD_BOT" || raw === "standard_bot") {
    return "STANDARD_BOT";
  }
  return "GHOSTPASS";
}

function finiteOr(raw: unknown, fallback: number): number {
  const num = Number(raw);
  return Number.isFinite(num) ? num : fallback;
}

function normalizeMandate(
  input: AgentExecuteRequest["mandate"],
  fallback: Awaited<ReturnType<typeof getMandate>>
): MandateConfig {
  return {
    id: input?.id ?? fallback.id ?? DEFAULT_MANDATE.id,
    ruleText: input?.ruleText ?? fallback.ruleText,
    dailyCap: finiteOr(input?.dailyCap ?? input?.dailyLimit, fallback.dailyLimit),
    spentToday: Math.max(
      fallback.dailySpent,
      finiteOr(input?.spentToday ?? input?.dailySpent, fallback.dailySpent)
    ),
    autoApproveLimit: finiteOr(
      input?.autoApproveLimit ?? input?.maxPerTransaction,
      fallback.maxPerTransaction
    ),
    blockGiftCards: input?.blockGiftCards ?? fallback.blockGiftCards,
    blockSubscriptions:
      input?.blockSubscriptions ?? fallback.blockSubscriptions,
    allowedCategories: input?.allowedCategories ?? fallback.allowedCategories,
  };
}

async function safeGetMandate() {
  try {
    return await getMandate();
  } catch (err) {
    console.warn("[/api/agent/execute] getMandate fallback:", err);
    return { ...DEFAULT_MANDATE, allowedCategories: [...DEFAULT_MANDATE.allowedCategories] };
  }
}

async function safeAppendTransaction(tx: AuditTransaction) {
  try {
    await appendTransaction(tx);
  } catch (err) {
    console.warn("[/api/agent/execute] appendTransaction skipped:", err);
  }
}

export async function POST(request: Request) {
  try {
    let body: Partial<AgentExecuteRequest>;
    try {
      body = (await request.json()) as Partial<AgentExecuteRequest>;
    } catch {
      return NextResponse.json(
        { error: "INVALID_JSON", message: "Malformed JSON payload" },
        { status: 400 }
      );
    }

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json(
        { error: "INVALID_REQUEST", message: "JSON object body is required" },
        { status: 400 }
      );
    }
    const customItem =
      body.customItem &&
      typeof body.customItem.title === "string" &&
      body.customItem.title.trim() &&
      Number.isFinite(Number(body.customItem.price)) &&
      Number(body.customItem.price) > 0
        ? {
            title: body.customItem.title.trim(),
            price: Number(body.customItem.price),
            category: body.customItem.category,
            merchant: body.customItem.merchant,
            hiddenInjection: body.customItem.hiddenInjection,
          }
        : undefined;

    const prompt =
      (typeof body.prompt === "string" ? body.prompt.trim() : "") ||
      (customItem
        ? `Buy ${customItem.title} ($${customItem.price.toFixed(2)})`
        : "");

    if (!prompt) {
      return NextResponse.json(
        { error: "INVALID_REQUEST", message: "prompt or customItem is required" },
        { status: 400 }
      );
    }

    const mode = normalizeMode(body.mode);
    const sessionId =
      body.sessionId || `sess_blind_${randomUUID().slice(0, 8)}`;

    // Stage 1: Blind Shopping Agent (zero PII in function scope)
    const cart = await runBlindShoppingAgent({
      prompt,
      sessionId,
      mode,
      customItem,
      skipLlm: Boolean(body.skipLlm),
    });

    const selectedProduct =
      resolveCatalogProductById(cart.productId) ?? cart.customProduct;
    if (!selectedProduct) {
      return NextResponse.json(
        { error: "PRODUCT_NOT_FOUND", message: "No catalog item matched" },
        { status: 404 }
      );
    }

    const injectedCartFirst = cart.injectedCartItems[0];
    const injectedProduct: Product | null = injectedCartFirst
      ? resolveCatalogProductById(injectedCartFirst.productId) ?? {
          id: injectedCartFirst.productId,
          sku: "CUS-INJ-01",
          name: injectedCartFirst.title,
          brand: selectedProduct.brand,
          category: injectedCartFirst.category,
          price: injectedCartFirst.price,
          rating: 0,
          reviewsCount: 0,
          description: "Injected adversarial item",
          specs: [],
          imageUrl: PRODUCT_CATALOG[0].imageUrl,
          imageAlt: injectedCartFirst.title,
          isGiftCard: true,
        }
      : null;

    // Standard Unverified Bot skips Gatekeeper protection and attaches raw PII
    if (mode === "STANDARD_BOT") {
      const exposedPiiContext = {
        buyerName: "Bhargava A.",
        buyerEmail: "sb-buyer@personal.example.com",
        shippingAddr: "123 Main St, Austin, TX 78701",
        authToken: "raw_paypal_session_9f8a21c4",
      };

      const payload: AgentExecuteResponse = {
        sessionId,
        mode,
        decision: "UNVERIFIED_BOT_READY",
        riskScore: 86,
        piiExposedPct: 100,
        reason:
          "Unverified AI bot attached raw user PII and skipped GhostPass Gatekeeper.",
        selectedProduct,
        injectedProduct: null,
        proposedCartTotal: selectedProduct.price,
        redactedContext: exposedPiiContext,
        exposedPiiContext,
        gatekeeperNotes: [
          `• Bot matched "${selectedProduct.name}" ($${selectedProduct.price.toFixed(
            2
          )}).`,
          "✗ Personal name, email & street address exposed in bot payload.",
          "→ Submitting unverified checkout request to NovaTech Store...",
        ],
        usedModel: cart.usedModel,
      };

      return NextResponse.json(payload);
    }

    // Stage 2: GhostPass Gatekeeper Audit
    const storedMandate = await safeGetMandate();
    const mandate = normalizeMandate(body.mandate, storedMandate);

    const verdict = await runGatekeeperAudit({
      mandate,
      cart,
      skipLlm: Boolean(body.skipLlm),
    });

    if (verdict.decision === "BLOCK") {
      const auditId = `tx-${randomUUID()}`;
      const tx: AuditTransaction = {
        id: auditId,
        timestamp: new Date().toISOString(),
        mode: "ghostpass",
        prompt,
        requestedProductId: selectedProduct.id,
        requestedProductName: injectedProduct
          ? `${selectedProduct.name} (+ Injected ${injectedProduct.name})`
          : selectedProduct.name,
        cartItems: [
          {
            id: selectedProduct.id,
            name: selectedProduct.name,
            price: selectedProduct.price,
            category: selectedProduct.category,
          },
          ...(injectedProduct
            ? [
                {
                  id: injectedProduct.id,
                  name: injectedProduct.name,
                  price: injectedProduct.price,
                  category: injectedProduct.category,
                },
              ]
            : []),
        ],
        totalAmount: cart.proposedCartTotal,
        verdict: "BLOCKED",
        riskScore: verdict.riskScore,
        piiExposedPct: 0,
        merchantStatusCode: 422,
        paypalOrderId: null,
        reason: verdict.reason,
      };
      await safeAppendTransaction(tx);

      const payload: AgentExecuteResponse = {
        sessionId,
        mode,
        decision: "BLOCK",
        riskScore: verdict.riskScore,
        piiExposedPct: 0,
        reason: verdict.reason,
        selectedProduct,
        injectedProduct,
        proposedCartTotal: cart.proposedCartTotal,
        redactedContext: verdict.redactedContext,
        gatekeeperNotes: [
          `✗ ${verdict.reason}`,
          "✓ Gatekeeper locked PayPal Vault instantly ($0.00 moved).",
          "✓ 0% PII leaked to external agent or storefront.",
        ],
        auditEventId: auditId,
        usedModel: verdict.usedModel,
      };

      return NextResponse.json(payload);
    }

    if (verdict.decision === "REQUIRE_HUMAN") {
      const auditId = `tx-${randomUUID()}`;
      const tx: AuditTransaction = {
        id: auditId,
        timestamp: new Date().toISOString(),
        mode: "ghostpass",
        prompt,
        requestedProductId: selectedProduct.id,
        requestedProductName: selectedProduct.name,
        cartItems: [
          {
            id: selectedProduct.id,
            name: selectedProduct.name,
            price: selectedProduct.price,
            category: selectedProduct.category,
          },
        ],
        totalAmount: cart.proposedCartTotal,
        verdict: "NEEDS_APPROVAL",
        riskScore: verdict.riskScore,
        piiExposedPct: 0,
        merchantStatusCode: 200,
        paypalOrderId: null,
        reason: verdict.reason,
      };
      await safeAppendTransaction(tx);

      const payload: AgentExecuteResponse = {
        sessionId,
        mode,
        decision: "REQUIRE_HUMAN",
        riskScore: verdict.riskScore,
        piiExposedPct: 0,
        reason: verdict.reason,
        selectedProduct,
        injectedProduct: null,
        proposedCartTotal: cart.proposedCartTotal,
        approvalToken: verdict.approvalToken,
        redactedContext: verdict.redactedContext,
        gatekeeperNotes: [
          "✓ Zero prompt-injection threats & 0% PII leaked.",
          `⚠ ${verdict.reason}`,
          "→ Tap Approve below to mint 1-click Human Override.",
        ],
        auditEventId: auditId,
        usedModel: verdict.usedModel,
      };

      return NextResponse.json(payload);
    }

    const payload: AgentExecuteResponse = {
      sessionId,
      mode,
      decision: "AUTO_APPROVE",
      riskScore: verdict.riskScore,
      piiExposedPct: 0,
      reason: verdict.reason,
      selectedProduct,
      injectedProduct: null,
      proposedCartTotal: cart.proposedCartTotal,
      signature: verdict.signature,
      redactedContext: verdict.redactedContext,
      gatekeeperNotes: [
        `✓ ${verdict.reason}`,
        "✓ Minted single-use HMAC-SHA256 X-PayPal-GhostPass-Signature.",
        "→ Presenting cryptographic human mandate to NovaTech Store...",
      ],
      usedModel: verdict.usedModel,
    };

    return NextResponse.json(payload);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Agent execution failed";
    return NextResponse.json(
      { error: "AGENT_EXECUTION_ERROR", message },
      { status: 500 }
    );
  }
}
