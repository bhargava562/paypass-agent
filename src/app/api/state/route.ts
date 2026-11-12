import { NextResponse, connection } from "next/server";
import {
  DEFAULT_MANDATE,
  ProductCategory,
  SpendingMandate,
} from "@/data/catalog";
import {
  getMandate,
  getStorageBackendMode,
  listTransactions,
  resetDemoState,
  saveMandate,
  updateTransaction,
} from "@/lib/db";
import { isPayPalSandboxConfigured } from "@/lib/paypal/client";

function maskEmail(email?: string): string {
  if (!email || email.includes("your_fake_buyer")) {
    return "sandbox-buyer@personal.example.com";
  }
  const [local, domain] = email.split("@");
  if (!domain) return "vaulted-buyer@paypal.sandbox";
  const prefix = local.slice(0, 3);
  return `${prefix}***@${domain}`;
}

const VALID_CATEGORIES = new Set<ProductCategory>([
  "Keyboards & Mice",
  "Audio",
  "Cloud & Books",
  "Accessories",
]);

export async function GET() {
  await connection();
  try {
    const [mandate, transactions] = await Promise.all([
      getMandate(),
      listTransactions(),
    ]);
    return NextResponse.json({
      backend: getStorageBackendMode(),
      paypalConfigured: isPayPalSandboxConfigured(),
      sandboxBuyerLabel: maskEmail(process.env.PAYPAL_SANDBOX_BUYER_EMAIL),
      mandate,
      transactions,
    });
  } catch (err) {
    console.error("[GET /api/state] Error:", err);
    return NextResponse.json(
      { error: "Failed to load application state" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Malformed JSON request body" },
        { status: 400 }
      );
    }

    if (!body || typeof body !== "object" || !("action" in body)) {
      return NextResponse.json(
        { error: "Missing required action field" },
        { status: 400 }
      );
    }

    const payload = body as {
      action: unknown;
      mandate?: Partial<SpendingMandate>;
      txId?: unknown;
    };

    if (payload.action === "save_mandate") {
      const m = payload.mandate;
      if (!m || typeof m !== "object") {
        return NextResponse.json(
          { error: "mandate object is required" },
          { status: 400 }
        );
      }

      const existing = await getMandate();
      const parsedMax = Number(m.maxPerTransaction);
      const maxPerTransaction = Number.isFinite(parsedMax)
        ? Math.min(1000, Math.max(5, parsedMax))
        : existing.maxPerTransaction;
      const parsedDaily = Number(m.dailyLimit);
      const dailyLimit = Number.isFinite(parsedDaily)
        ? Math.min(2000, Math.max(maxPerTransaction, parsedDaily))
        : Math.max(maxPerTransaction, existing.dailyLimit);

      const allowedCategories = Array.isArray(m.allowedCategories)
        ? m.allowedCategories.filter((c): c is ProductCategory =>
            VALID_CATEGORIES.has(c as ProductCategory)
          )
        : existing.allowedCategories;

      // Preserve server-authoritative dailySpent so client edits cannot zero out spend
      const sanitized: SpendingMandate = {
        id: existing.id || DEFAULT_MANDATE.id,
        ruleText:
          typeof m.ruleText === "string" && m.ruleText.trim()
            ? m.ruleText.trim().slice(0, 240)
            : existing.ruleText,
        maxPerTransaction,
        dailyLimit,
        dailySpent: existing.dailySpent,
        blockGiftCards:
          typeof m.blockGiftCards === "boolean"
            ? m.blockGiftCards
            : existing.blockGiftCards,
        blockSubscriptions:
          typeof m.blockSubscriptions === "boolean"
            ? m.blockSubscriptions
            : existing.blockSubscriptions,
        allowedCategories:
          allowedCategories.length > 0
            ? allowedCategories
            : DEFAULT_MANDATE.allowedCategories,
        updatedAt: new Date().toISOString(),
      };

      const mandate = await saveMandate(sanitized);
      return NextResponse.json({ backend: getStorageBackendMode(), mandate });
    }

    if (payload.action === "decline_override") {
      if (typeof payload.txId !== "string" || !payload.txId.trim()) {
        return NextResponse.json(
          { error: "txId is required" },
          { status: 400 }
        );
      }
      const existing = (await listTransactions()).find(
        (tx) => tx.id === payload.txId
      );
      if (!existing || existing.verdict !== "NEEDS_APPROVAL") {
        return NextResponse.json(
          { error: "Only pending NEEDS_APPROVAL transactions can be declined" },
          { status: 400 }
        );
      }
      const transactions = await updateTransaction(payload.txId, {
        verdict: "BLOCKED",
        merchantStatusCode: 422,
        paypalOrderId: null,
        reason: "Rejected by Human during 1-Click Over-Budget Confirmation.",
      });
      return NextResponse.json({
        backend: getStorageBackendMode(),
        transactions,
      });
    }

    if (payload.action === "reset") {
      const state = await resetDemoState();
      return NextResponse.json({
        backend: getStorageBackendMode(),
        ...state,
      });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (err) {
    console.error("[POST /api/state] Error:", err);
    return NextResponse.json(
      { error: "Failed to persist state" },
      { status: 500 }
    );
  }
}
