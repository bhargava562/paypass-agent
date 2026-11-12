import { createHash, randomUUID } from "crypto";
import { NextResponse } from "next/server";
import {
  AuditTransaction,
  DEFAULT_MANDATE,
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
import { PayPalSettleRequest } from "@/types/ghostpass";

async function safeGetMandate(): Promise<SpendingMandate> {
  try {
    return await getMandate();
  } catch (err) {
    console.warn("[/api/paypal/settle] getMandate fallback:", err);
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
    console.warn("[/api/paypal/settle] saveMandate skipped:", err);
  }
}

async function safeAppendTransaction(tx: AuditTransaction): Promise<void> {
  try {
    await appendTransaction(tx);
  } catch (err) {
    console.warn("[/api/paypal/settle] appendTransaction skipped:", err);
  }
}

async function safeUpdateTransaction(
  txId: string,
  patch: Partial<AuditTransaction>
): Promise<void> {
  try {
    await updateTransaction(txId, patch);
  } catch (err) {
    console.warn("[/api/paypal/settle] updateTransaction skipped:", err);
  }
}

export async function POST(request: Request) {
  try {
    let body: Partial<PayPalSettleRequest>;
    try {
      body = (await request.json()) as Partial<PayPalSettleRequest>;
    } catch {
      return NextResponse.json(
        { error: "INVALID_JSON", message: "Malformed JSON payload" },
        { status: 400 }
      );
    }

    if (
      !body ||
      typeof body !== "object" ||
      Array.isArray(body) ||
      typeof body.productId !== "string" ||
      !body.productId.trim()
    ) {
      return NextResponse.json(
        {
          error: "INVALID_SETTLEMENT_REQUEST",
          message: "productId is required",
        },
        { status: 400 }
      );
    }

    const product = resolveCatalogProductById(body.productId);
    if (!product) {
      return NextResponse.json(
        { error: "PRODUCT_NOT_FOUND", message: "Unknown catalog productId" },
        { status: 404 }
      );
    }

    const amount = Number(body.amount ?? product.price);
    if (
      !Number.isFinite(amount) ||
      amount <= 0 ||
      Math.abs(amount - product.price) > 0.005
    ) {
      return NextResponse.json(
        {
          error: "INVALID_AMOUNT",
          message: "Settlement amount must match catalog product price",
        },
        { status: 400 }
      );
    }

    const headerSig =
      request.headers.get("x-paypal-ghostpass-signature") ||
      body.ghostPassHeader;
    const overrideToken =
      request.headers.get("x-paypal-human-override") || body.humanOverrideToken;

    const sigCheck = headerSig
      ? verifyGhostPassMandate(headerSig, amount, product.id)
      : { valid: false };
    const overrideCheck =
      !sigCheck.valid && overrideToken
        ? verifyHumanOverrideToken(overrideToken, amount, product.id)
        : { valid: false };

    if (!sigCheck.valid && !overrideCheck.valid) {
      return NextResponse.json(
        {
          error: "UNAUTHORIZED_SETTLEMENT",
          message:
            "Missing or invalid X-PayPal-GhostPass-Signature or Human Override token",
        },
        { status: 403 }
      );
    }

    const usedToken = (sigCheck.valid ? headerSig : overrideToken) || "";
    const tokenClaims = sigCheck.valid ? sigCheck.payload : overrideCheck.payload;

    if (
      body.sessionId &&
      tokenClaims?.sessionId &&
      body.sessionId !== tokenClaims.sessionId
    ) {
      return NextResponse.json(
        {
          error: "SESSION_MISMATCH",
          message: "sessionId does not match signed mandate token",
        },
        { status: 403 }
      );
    }

    const currentMandate = await safeGetMandate();
    if (currentMandate.dailySpent + amount > currentMandate.dailyLimit) {
      return NextResponse.json(
        {
          error: "DAILY_CAP_EXCEEDED",
          message: "Daily spending mandate limit exceeded",
        },
        { status: 403 }
      );
    }

    if (!consumeMandateToken(usedToken, tokenClaims?.expiresAt)) {
      return NextResponse.json(
        {
          error: "TOKEN_REPLAY_REJECTED",
          message: "Single-use mandate token has already been redeemed",
        },
        { status: 403 }
      );
    }

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

    if (body.auditEventId) {
      await safeUpdateTransaction(body.auditEventId, {
        verdict: "APPROVED",
        riskScore: overrideCheck.valid ? 15 : 8,
        merchantStatusCode: 200,
        paypalOrderId: settled.paypalOrderId,
        reason: `Settled $${amount.toFixed(2)} via PayPal Orders v2 (${settled.paypalOrderId}).`,
      });
    } else {
      const tx: AuditTransaction = {
        id: `tx-${randomUUID()}`,
        timestamp: new Date().toISOString(),
        mode: "ghostpass",
        prompt: body.prompt || `Settle ${product.name}`,
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
        riskScore: overrideCheck.valid ? 15 : 8,
        piiExposedPct: 0,
        merchantStatusCode: 200,
        paypalOrderId: settled.paypalOrderId,
        reason: `Settled $${amount.toFixed(2)} via PayPal Orders v2 (${settled.paypalOrderId}).`,
      };
      await safeAppendTransaction(tx);
    }

    return NextResponse.json({
      status: "SETTLED_VIA_PAYPAL",
      ...settled,
      verificationHash,
    });
  } catch (err) {
    console.error("[/api/paypal/settle] Error:", err);
    return NextResponse.json(
      {
        error: "PAYPAL_SETTLEMENT_ERROR",
        message: "PayPal Sandbox settlement failed",
      },
      { status: 500 }
    );
  }
}
