import { createHash, randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { AuditTransaction } from "@/data/catalog";
import { resolveCatalogProductById } from "@/lib/agents/shoppingAgent";
import {
  verifyGhostPassMandate,
  verifyHumanOverrideToken,
} from "@/lib/crypto/mandateSigner";
import {
  appendTransaction,
  getMandate,
  saveMandate,
  updateTransaction,
} from "@/lib/db";
import {
  AgentExecutionMode,
  CheckoutRequest,
  CheckoutResponse,
} from "@/types/ghostpass";

function normalizeMode(
  raw: CheckoutRequest["mode"] | undefined
): AgentExecutionMode {
  if (raw === "STANDARD_BOT" || raw === "standard_bot") {
    return "STANDARD_BOT";
  }
  return "GHOSTPASS";
}

function containsRawPii(payload?: Record<string, string>): boolean {
  if (!payload) return false;
  const serialized = JSON.stringify(payload);
  // Reject if unredacted email or raw street tokens appear in an automated GhostPass header check
  if (/@/.test(serialized) && !serialized.includes("[VAULTED_EMAIL]")) {
    return true;
  }
  return false;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Partial<CheckoutRequest>;
    const product = body.productId
      ? resolveCatalogProductById(body.productId)
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

    // Standard human storefront checkout bypasses bot-firewall (manual shopper)
    if (body.isManualHumanCheckout === true) {
      const receiptToken = `NT-HUMAN-${randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase()}`;
      const resPayload: CheckoutResponse = {
        status: "HUMAN_ORDER_CONFIRMED",
        httpStatus: 200,
        verifiedMandate: false,
        captchaBypassed: false,
        receiptToken,
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

      await appendTransaction(tx);

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
    const signatureCheck = headerSignature
      ? verifyGhostPassMandate(headerSignature, amount, product.id)
      : { valid: false, reason: "Missing X-PayPal-GhostPass-Signature" };

    const overrideCheck =
      !signatureCheck.valid && overrideToken
        ? verifyHumanOverrideToken(overrideToken, amount, product.id)
        : { valid: false, reason: signatureCheck.reason };

    const isVerified = signatureCheck.valid || overrideCheck.valid;

    if (!isVerified || containsRawPii(body.agentContextPayload)) {
      const failureReason = containsRawPii(body.agentContextPayload)
        ? "Raw PII detected in GhostPass automated checkout payload"
        : signatureCheck.reason || overrideCheck.reason || "Invalid mandate";

      const tx: AuditTransaction = {
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

      await appendTransaction(tx);

      const resPayload: CheckoutResponse = {
        status: "BOT_SCRAPER_BLOCKED",
        httpStatus: 403,
        verifiedMandate: false,
        captchaBypassed: false,
        piiExposedPct: 0,
        error: "BOT_SCRAPER_BLOCKED",
        code: "INVALID_GHOSTPASS_SIGNATURE",
        message: `Store Security Guard rejected checkout: ${failureReason}`,
        auditEvent: tx,
      };

      return NextResponse.json(resPayload, { status: 403 });
    }

    // Cryptographically Verified -> Update dailySpent & record APPROVED_BY_MERCHANT
    const usedToken = headerSignature || overrideToken || "";
    const verificationHash = createHash("sha256")
      .update(`${product.id}:${amount}:${usedToken}`)
      .digest("hex")
      .slice(0, 16)
      .toUpperCase();
    const receiptToken = `READY-CAP-${verificationHash.slice(0, 8)}`;

    const currentMandate = await getMandate();
    await saveMandate({
      ...currentMandate,
      dailySpent: Number((currentMandate.dailySpent + amount).toFixed(2)),
    });

    const isHumanOverride = Boolean(overrideCheck.valid);
    const approvedReason = isHumanOverride
      ? `Human 1-Click Override Approved ($${amount.toFixed(
          2
        )}). Verified by Merchant with 0% PII.`
      : `Verified PayPal Human Mandate ($${amount.toFixed(
          2
        )}). Captcha bypassed with 0% PII.`;

    let auditEvent: AuditTransaction;
    if (body.auditEventId) {
      const updatedList = await updateTransaction(body.auditEventId, {
        verdict: "APPROVED",
        merchantStatusCode: 200,
        paypalOrderId: receiptToken,
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
        paypalOrderId: receiptToken,
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
        paypalOrderId: receiptToken,
        reason: approvedReason,
      };
      await appendTransaction(auditEvent);
    }

    const resPayload: CheckoutResponse = {
      status: "APPROVED_BY_MERCHANT",
      httpStatus: 200,
      verifiedMandate: true,
      captchaBypassed: true,
      verificationHash,
      readyForPayPalCapture: true,
      receiptToken,
      piiExposedPct: 0,
      message:
        "Verified PayPal Human Mandate accepted by NovaTech Store (ready for PayPal capture).",
      auditEvent,
    };

    return NextResponse.json(resPayload);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Merchant checkout failed";
    return NextResponse.json(
      { error: "CHECKOUT_ERROR", message },
      { status: 500 }
    );
  }
}
