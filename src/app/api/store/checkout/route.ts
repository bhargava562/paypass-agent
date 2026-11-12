import { createHash, randomUUID } from "crypto";
import { NextResponse } from "next/server";
import {
  AuditTransaction,
  DEFAULT_MANDATE,
  PRODUCT_CATALOG,
  Product,
  SpendingMandate,
} from "@/data/catalog";
import { resolveCatalogProductById } from "@/lib/agents/shoppingAgent";
import {
  consumeMandateToken,
  verifyGhostPassMandate,
  verifyHumanOverrideToken,
} from "@/lib/crypto/mandateSigner";
import {
  appendTransaction,
  getMandate,
  saveMandate,
  updateTransaction,
} from "@/lib/db";
import { createAndSettleSandboxOrder } from "@/lib/paypal/client";
import {
  AgentExecutionMode,
  CheckoutRequest,
  CheckoutResponse,
} from "@/types/ghostpass";

async function safeGetMandate(): Promise<SpendingMandate> {
  try {
    return await getMandate();
  } catch (err) {
    console.warn("[/api/store/checkout] getMandate fallback:", err);
    return {
      ...DEFAULT_MANDATE,
      allowedCategories: [...DEFAULT_MANDATE.allowedCategories],
    };
  }
}

async function safeSaveMandate(mandate: SpendingMandate): Promise<void> {
  try {
    await saveMandate(mandate);
  } catch (err) {
    console.warn("[/api/store/checkout] saveMandate skipped:", err);
  }
}

async function safeAppendTransaction(tx: AuditTransaction): Promise<void> {
  try {
    await appendTransaction(tx);
  } catch (err) {
    console.warn("[/api/store/checkout] appendTransaction skipped:", err);
  }
}

async function safeUpdateTransaction(
  txId: string,
  patch: Partial<AuditTransaction>
): Promise<AuditTransaction[]> {
  try {
    return await updateTransaction(txId, patch);
  } catch (err) {
    console.warn("[/api/store/checkout] updateTransaction skipped:", err);
    return [];
  }
}

function normalizeMode(
  raw: CheckoutRequest["mode"] | undefined
): AgentExecutionMode {
  if (raw === "STANDARD_BOT" || raw === "standard_bot") {
    return "STANDARD_BOT";
  }
  return "GHOSTPASS";
}

const ALLOWED_REDACTED_SENTINELS = new Set([
  "[VAULTED_IN_PAYPAL]",
  "[VAULTED_EMAIL]",
  "[PAYPAL_DIRECT_RELAY]",
]);

function containsRawPii(payload?: Record<string, string>): boolean {
  if (!payload || typeof payload !== "object") return false;
  for (const [key, rawVal] of Object.entries(payload)) {
    if (typeof rawVal !== "string") continue;
    const val = rawVal.trim();
    if (!val) continue;
    if (ALLOWED_REDACTED_SENTINELS.has(val)) continue;
    if (key === "authToken" && /^gp_[a-zA-Z0-9_]+$/.test(val)) continue;

    if (
      val.includes("@") ||
      val.startsWith("raw_") ||
      /\d{1,5}\s+[A-Za-z]+\s+(St|Street|Ave|Avenue|Rd|Road|Blvd|Terrace|Lane|Dr)\b/i.test(
        val
      )
    ) {
      return true;
    }
    if (key === "buyerName" || key === "buyerEmail" || key === "shippingAddr") {
      return true;
    }
  }
  return false;
}

export async function POST(request: Request) {
  try {
    let body: Partial<CheckoutRequest>;
    try {
      body = (await request.json()) as Partial<CheckoutRequest>;
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

    const catalogProduct = body?.productId
      ? resolveCatalogProductById(body.productId)
      : undefined;

    const customBody = body?.customProduct;
    const isCustomProduct =
      !catalogProduct &&
      typeof body?.productId === "string" &&
      body.productId.startsWith("custom-") &&
      customBody &&
      typeof customBody.title === "string" &&
      customBody.title.trim().length > 0 &&
      Number.isFinite(Number(customBody.price)) &&
      Number(customBody.price) > 0;

    const product: Product | undefined = catalogProduct
      ? catalogProduct
      : isCustomProduct
      ? {
          id: body.productId as string,
          sku: "CUSTOM-MCP",
          name: customBody.title.trim(),
          brand: customBody.merchant?.trim() || "Custom Merchant",
          category: "Accessories",
          price: Number(Number(customBody.price).toFixed(2)),
          rating: 4.8,
          reviewsCount: 1,
          description: "Custom checkout item",
          specs: [],
          imageUrl: PRODUCT_CATALOG[0].imageUrl,
          imageAlt: customBody.title.trim(),
        }
      : undefined;

    if (!product) {
      return NextResponse.json(
        { error: "PRODUCT_NOT_FOUND", message: "Unknown productId" },
        { status: 404 }
      );
    }

    const amount = Number(body.amount ?? product.price);
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json(
        { error: "INVALID_AMOUNT", message: "amount must be positive" },
        { status: 400 }
      );
    }

    // Standard human storefront checkout (manual shopper on NovaTech)
    if (body.isManualHumanCheckout === true) {
      const receiptToken = `NT-HUMAN-${randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase()}`;
      const resPayload: CheckoutResponse = {
        status: "HUMAN_ORDER_CONFIRMED",
        httpStatus: 200,
        verifiedMandate: false,
        captchaBypassed: false,
        receiptToken,
        paypalOrderId: receiptToken,
        piiExposedPct: 0,
        message: "Manual human checkout completed on NovaTech Store.",
      };
      return NextResponse.json(resPayload);
    }

    const mode = normalizeMode(body.mode);
    const headerSignature =
      request.headers.get("x-paypal-ghostpass-signature") ||
      body.ghostPassHeader;
    const overrideToken =
      request.headers.get("x-paypal-human-override") || body.humanOverrideToken;

    // Branch A: STANDARD_BOT -> Immediate 403 Bot-Blocker
    if (mode === "STANDARD_BOT") {
      const tx: AuditTransaction = {
        id: `tx-${randomUUID()}`,
        timestamp: new Date().toISOString(),
        mode: "standard_bot",
        prompt: body.prompt || `Buy ${product.name}`,
        requestedProductId: product.id,
        requestedProductName: product.name,
        cartItems: [
          {
            id: product.id,
            name: product.name,
            price: amount,
            category: product.category,
          },
        ],
        totalAmount: amount,
        verdict: "403_REJECTED",
        riskScore: 86,
        piiExposedPct: 100,
        merchantStatusCode: 403,
        paypalOrderId: null,
        reason:
          "403 Forbidden: Store Security Guard blocked unverified AI scraper & raw PII exposure.",
      };

      await safeAppendTransaction(tx);

      const resPayload: CheckoutResponse = {
        status: "BOT_SCRAPER_BLOCKED",
        httpStatus: 403,
        verifiedMandate: false,
        captchaBypassed: false,
        piiExposedPct: 100,
        error: "BOT_SCRAPER_BLOCKED",
        code: "BOT_SCRAPER_PII_EXPOSED",
        message:
          "Store Security Guard blocked unverified AI scraper & raw PII exposure.",
        auditEvent: tx,
      };

      return NextResponse.json(resPayload, { status: 403 });
    }

    // Branch B: GHOSTPASS -> Verify Cryptographic Signature or Human Override Token
    if (Math.abs(amount - product.price) > 0.005) {
      return NextResponse.json(
        {
          error: "PRICE_MISMATCH",
          message: "Checkout amount does not match NovaTech catalog price",
        },
        { status: 400 }
      );
    }

    const signatureCheck = headerSignature
      ? verifyGhostPassMandate(headerSignature, amount, product.id)
      : { valid: false, reason: "Missing X-PayPal-GhostPass-Signature" };

    const overrideCheck =
      !signatureCheck.valid && overrideToken
        ? verifyHumanOverrideToken(overrideToken, amount, product.id)
        : { valid: false, reason: signatureCheck.reason };

    const isVerified = signatureCheck.valid || overrideCheck.valid;
    const tokenClaims = signatureCheck.valid
      ? signatureCheck.payload
      : overrideCheck.payload;
    const usedToken = (signatureCheck.valid ? headerSignature : overrideToken) || "";

    const sessionMismatch =
      isVerified &&
      body.sessionId &&
      tokenClaims?.sessionId &&
      body.sessionId !== tokenClaims.sessionId;

    const piiDetected = containsRawPii(body.agentContextPayload);

    const currentMandate = await safeGetMandate();
    const dailyCapExceeded =
      isVerified && currentMandate.dailySpent + amount > currentMandate.dailyLimit;

    const tokenReplay =
      isVerified &&
      !sessionMismatch &&
      !piiDetected &&
      !dailyCapExceeded &&
      !consumeMandateToken(usedToken, tokenClaims?.expiresAt);

    if (
      !isVerified ||
      sessionMismatch ||
      piiDetected ||
      dailyCapExceeded ||
      tokenReplay
    ) {
      const failureReason = piiDetected
        ? "Raw PII detected in GhostPass automated checkout payload"
        : sessionMismatch
        ? "Session ID does not match signed mandate token"
        : dailyCapExceeded
        ? "Daily spending mandate limit exceeded"
        : tokenReplay
        ? "Single-use mandate token has already been redeemed"
        : overrideToken
        ? overrideCheck.reason || "Invalid human override token"
        : signatureCheck.reason || "Invalid mandate";

      let auditEvent: AuditTransaction;
      if (body.auditEventId) {
        const updatedList = await safeUpdateTransaction(body.auditEventId, {
          verdict: "403_REJECTED",
          riskScore: 90,
          merchantStatusCode: 403,
          paypalOrderId: null,
          reason: `403 Forbidden: ${failureReason}`,
        });
        auditEvent = updatedList.find((t) => t.id === body.auditEventId) ?? {
          id: body.auditEventId,
          timestamp: new Date().toISOString(),
          mode: "ghostpass",
          prompt: body.prompt || `Buy ${product.name}`,
          requestedProductId: product.id,
          requestedProductName: product.name,
          cartItems: [
            {
              id: product.id,
              name: product.name,
              price: amount,
              category: product.category,
            },
          ],
          totalAmount: amount,
          verdict: "403_REJECTED",
          riskScore: 90,
          piiExposedPct: 0,
          merchantStatusCode: 403,
          paypalOrderId: null,
          reason: `403 Forbidden: ${failureReason}`,
        };
      } else {
        auditEvent = {
          id: `tx-${randomUUID()}`,
          timestamp: new Date().toISOString(),
          mode: "ghostpass",
          prompt: body.prompt || `Buy ${product.name}`,
          requestedProductId: product.id,
          requestedProductName: product.name,
          cartItems: [
            {
              id: product.id,
              name: product.name,
              price: amount,
              category: product.category,
            },
          ],
          totalAmount: amount,
          verdict: "403_REJECTED",
          riskScore: 90,
          piiExposedPct: 0,
          merchantStatusCode: 403,
          paypalOrderId: null,
          reason: `403 Forbidden: ${failureReason}`,
        };
        await safeAppendTransaction(auditEvent);
      }

      const resPayload: CheckoutResponse = {
        status: "BOT_SCRAPER_BLOCKED",
        httpStatus: 403,
        verifiedMandate: false,
        captchaBypassed: false,
        piiExposedPct: 0,
        error: "BOT_SCRAPER_BLOCKED",
        code: dailyCapExceeded
          ? "DAILY_CAP_EXCEEDED"
          : tokenReplay
          ? "TOKEN_REPLAY_REJECTED"
          : "INVALID_GHOSTPASS_SIGNATURE",
        message: `Store Security Guard rejected checkout: ${failureReason}`,
        auditEvent,
      };

      return NextResponse.json(resPayload, { status: 403 });
    }

    // Cryptographically Verified -> Settle via PayPal Sandbox Orders v2
    const sessionId =
      tokenClaims?.sessionId || `sess_${randomUUID().slice(0, 8)}`;

    const verificationHash = createHash("sha256")
      .update(`${product.id}:${amount}:${usedToken}`)
      .digest("hex")
      .slice(0, 16)
      .toUpperCase();

    const settled = await createAndSettleSandboxOrder({
      amount,
      productId: product.id,
      productName: product.name,
      sessionId,
      verificationHash,
    });

    await safeSaveMandate({
      ...currentMandate,
      dailySpent: Number((currentMandate.dailySpent + amount).toFixed(2)),
    });

    const isHumanOverride = Boolean(overrideCheck.valid);
    const approvedReason = isHumanOverride
      ? `Human Override Approved ($${amount.toFixed(
          2
        )}). PayPal Orders v2 (${settled.paypalOrderId}) with 0% PII.`
      : `Verified PayPal Human Mandate ($${amount.toFixed(
          2
        )}). PayPal Orders v2 (${settled.paypalOrderId}) with 0% PII.`;

    let auditEvent: AuditTransaction;
    if (body.auditEventId) {
      const updatedList = await safeUpdateTransaction(body.auditEventId, {
        verdict: "APPROVED",
        riskScore: isHumanOverride ? 15 : 8,
        merchantStatusCode: 200,
        paypalOrderId: settled.paypalOrderId,
        reason: approvedReason,
      });
      auditEvent = updatedList.find((t) => t.id === body.auditEventId) ?? {
        id: body.auditEventId,
        timestamp: new Date().toISOString(),
        mode: "ghostpass",
        prompt: body.prompt || `Buy ${product.name}`,
        requestedProductId: product.id,
        requestedProductName: product.name,
        cartItems: [
          {
            id: product.id,
            name: product.name,
            price: amount,
            category: product.category,
          },
        ],
        totalAmount: amount,
        verdict: "APPROVED",
        riskScore: isHumanOverride ? 15 : 8,
        piiExposedPct: 0,
        merchantStatusCode: 200,
        paypalOrderId: settled.paypalOrderId,
        reason: approvedReason,
      };
    } else {
      auditEvent = {
        id: `tx-${randomUUID()}`,
        timestamp: new Date().toISOString(),
        mode: "ghostpass",
        prompt: body.prompt || `Buy ${product.name}`,
        requestedProductId: product.id,
        requestedProductName: product.name,
        cartItems: [
          {
            id: product.id,
            name: product.name,
            price: amount,
            category: product.category,
          },
        ],
        totalAmount: amount,
        verdict: "APPROVED",
        riskScore: isHumanOverride ? 15 : 8,
        piiExposedPct: 0,
        merchantStatusCode: 200,
        paypalOrderId: settled.paypalOrderId,
        reason: approvedReason,
      };
      await safeAppendTransaction(auditEvent);
    }

    const resPayload: CheckoutResponse = {
      status: "APPROVED_BY_MERCHANT",
      httpStatus: 200,
      verifiedMandate: true,
      captchaBypassed: true,
      verificationHash,
      readyForPayPalCapture: false,
      receiptToken: settled.paypalOrderId,
      paypalOrderId: settled.paypalOrderId,
      paypalStatus: settled.paypalStatus,
      sandboxActivityUrl: settled.sandboxActivityUrl,
      approveUrl: settled.approveUrl,
      liveSandbox: settled.liveSandbox,
      piiExposedPct: 0,
      message: settled.liveSandbox
        ? `Verified Human Mandate accepted — PayPal Sandbox Order ${settled.paypalOrderId} (${settled.paypalStatus}).`
        : `Verified Human Mandate accepted — Sandbox Order ${settled.paypalOrderId}.`,
      auditEvent,
    };

    return NextResponse.json(resPayload);
  } catch (err) {
    console.error("[/api/store/checkout] Error:", err);
    return NextResponse.json(
      {
        error: "CHECKOUT_ERROR",
        message: "Merchant checkout processing failed",
      },
      { status: 500 }
    );
  }
}
