import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { AuditTransaction, DEFAULT_MANDATE } from "@/data/catalog";
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

function normalizeMode(
  raw: AgentExecuteRequest["mode"] | undefined
): AgentExecutionMode {
  if (raw === "STANDARD_BOT" || raw === "standard_bot") {
    return "STANDARD_BOT";
  }
  return "GHOSTPASS";
}

function normalizeMandate(
  input: AgentExecuteRequest["mandate"],
  fallback: Awaited<ReturnType<typeof getMandate>>
): MandateConfig {
  return {
    id: input?.id ?? fallback.id ?? DEFAULT_MANDATE.id,
    ruleText: input?.ruleText ?? fallback.ruleText,
    dailyCap: Number(
      input?.dailyCap ?? input?.dailyLimit ?? fallback.dailyLimit
    ),
    spentToday: Number(
      input?.spentToday ?? input?.dailySpent ?? fallback.dailySpent
    ),
    autoApproveLimit: Number(
      input?.autoApproveLimit ??
        input?.maxPerTransaction ??
        fallback.maxPerTransaction
    ),
    blockGiftCards: input?.blockGiftCards ?? fallback.blockGiftCards,
    blockSubscriptions:
      input?.blockSubscriptions ?? fallback.blockSubscriptions,
    allowedCategories: input?.allowedCategories ?? fallback.allowedCategories,
  };
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Partial<AgentExecuteRequest>;
    const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";

    if (!prompt) {
      return NextResponse.json(
        { error: "INVALID_REQUEST", message: "prompt is required" },
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
      skipLlm: Boolean(body.skipLlm),
    });

    const selectedProduct = resolveCatalogProductById(cart.productId);
    if (!selectedProduct) {
      return NextResponse.json(
        { error: "PRODUCT_NOT_FOUND", message: "No catalog item matched" },
        { status: 404 }
      );
    }

    const injectedProduct =
      cart.injectedCartItems.length > 0
        ? resolveCatalogProductById(cart.injectedCartItems[0].productId) ?? null
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
    const storedMandate = await getMandate();
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
      await appendTransaction(tx);

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
      await appendTransaction(tx);

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
