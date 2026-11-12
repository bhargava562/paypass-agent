import {
  AuditTransaction,
  DEFAULT_MANDATE,
  SpendingMandate,
} from "@/data/catalog";

export type StorageBackendMode = "memory-localstorage" | "neon-postgres";

interface MemoryStoreState {
  mandate: SpendingMandate;
  transactions: AuditTransaction[];
}

declare global {
  var __ghostpassMemoryStore: MemoryStoreState | undefined;
}

function getServerMemoryState(): MemoryStoreState {
  if (!globalThis.__ghostpassMemoryStore) {
    globalThis.__ghostpassMemoryStore = {
      mandate: { ...DEFAULT_MANDATE },
      transactions: [],
    };
  }
  return globalThis.__ghostpassMemoryStore;
}

export function getStorageBackendMode(): StorageBackendMode {
  if (typeof process !== "undefined" && Boolean(process.env?.DATABASE_URL)) {
    return "neon-postgres";
  }
  return "memory-localstorage";
}

function parseNeonHttpEndpoint(databaseUrl: string): string {
  const parsed = new URL(databaseUrl);
  if (!parsed.hostname) {
    throw new Error("Invalid DATABASE_URL: missing hostname");
  }
  return `https://${parsed.hostname}/sql`;
}

async function runNeonSql<T = Record<string, unknown>>(
  query: string,
  params: unknown[] = []
): Promise<T[]> {
  const databaseUrl = process.env?.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not configured");
  }

  const endpoint = parseNeonHttpEndpoint(databaseUrl);
  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Neon-Connection-String": databaseUrl,
    },
    body: JSON.stringify({ query, params }),
    cache: "no-store",
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`Neon SQL error (${res.status}): ${errText}`);
  }

  const data = (await res.json()) as { rows?: T[] };
  return Array.isArray(data.rows) ? data.rows : [];
}

export async function getMandate(): Promise<SpendingMandate> {
  if (getStorageBackendMode() === "neon-postgres") {
    const rows = await runNeonSql<{
      id: string;
      rule_text: string;
      max_per_transaction: string | number;
      daily_limit: string | number;
      daily_spent: string | number;
      block_gift_cards: boolean;
      block_subscriptions: boolean;
      allowed_categories: SpendingMandate["allowedCategories"] | null;
      updated_at: string;
    }>("SELECT * FROM mandates WHERE id = $1 LIMIT 1", [DEFAULT_MANDATE.id]);

    if (rows.length > 0) {
      const row = rows[0];
      return {
        id: row.id,
        ruleText: row.rule_text,
        maxPerTransaction: Number(row.max_per_transaction),
        dailyLimit: Number(row.daily_limit),
        dailySpent: Number(row.daily_spent),
        blockGiftCards: Boolean(row.block_gift_cards),
        blockSubscriptions: Boolean(row.block_subscriptions),
        allowedCategories:
          Array.isArray(row.allowed_categories) &&
          row.allowed_categories.length > 0
            ? row.allowed_categories
            : DEFAULT_MANDATE.allowedCategories,
        updatedAt: row.updated_at,
      };
    }
  }

  return { ...getServerMemoryState().mandate };
}

export async function saveMandate(
  mandate: SpendingMandate
): Promise<SpendingMandate> {
  const updated: SpendingMandate = {
    ...mandate,
    updatedAt: new Date().toISOString(),
  };

  if (getStorageBackendMode() === "neon-postgres") {
    await runNeonSql(
      `INSERT INTO mandates (
        id, rule_text, max_per_transaction, daily_limit, daily_spent,
        block_gift_cards, block_subscriptions, allowed_categories, updated_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9)
      ON CONFLICT (id) DO UPDATE SET
        rule_text = EXCLUDED.rule_text,
        max_per_transaction = EXCLUDED.max_per_transaction,
        daily_limit = EXCLUDED.daily_limit,
        daily_spent = EXCLUDED.daily_spent,
        block_gift_cards = EXCLUDED.block_gift_cards,
        block_subscriptions = EXCLUDED.block_subscriptions,
        allowed_categories = EXCLUDED.allowed_categories,
        updated_at = EXCLUDED.updated_at`,
      [
        updated.id,
        updated.ruleText,
        updated.maxPerTransaction,
        updated.dailyLimit,
        updated.dailySpent,
        updated.blockGiftCards,
        updated.blockSubscriptions,
        JSON.stringify(updated.allowedCategories),
        updated.updatedAt,
      ]
    );
  }

  getServerMemoryState().mandate = updated;
  return updated;
}

export async function listTransactions(): Promise<AuditTransaction[]> {
  if (getStorageBackendMode() === "neon-postgres") {
    const rows = await runNeonSql<{
      id: string;
      timestamp: string;
      mode: AuditTransaction["mode"];
      prompt: string;
      requested_product_id: string | null;
      requested_product_name: string;
      cart_items: AuditTransaction["cartItems"] | null;
      total_amount: string | number;
      verdict: AuditTransaction["verdict"];
      risk_score: number;
      pii_exposed_pct: number;
      merchant_status_code: AuditTransaction["merchantStatusCode"];
      paypal_order_id: string | null;
      reason: string;
    }>("SELECT * FROM audit_transactions ORDER BY timestamp DESC LIMIT 100");

    return rows.map((row) => ({
      id: row.id,
      timestamp: row.timestamp,
      mode: row.mode,
      prompt: row.prompt,
      requestedProductId: row.requested_product_id ?? undefined,
      requestedProductName: row.requested_product_name,
      cartItems: Array.isArray(row.cart_items) ? row.cart_items : [],
      totalAmount: Number(row.total_amount),
      verdict: row.verdict,
      riskScore: Number(row.risk_score),
      piiExposedPct: Number(row.pii_exposed_pct),
      merchantStatusCode: row.merchant_status_code,
      paypalOrderId: row.paypal_order_id,
      reason: row.reason,
    }));
  }

  return [...getServerMemoryState().transactions];
}

export async function appendTransaction(
  tx: AuditTransaction
): Promise<AuditTransaction[]> {
  if (getStorageBackendMode() === "neon-postgres") {
    await runNeonSql(
      `INSERT INTO audit_transactions (
        id, timestamp, mode, prompt, requested_product_id, requested_product_name,
        cart_items, total_amount, verdict, risk_score, pii_exposed_pct,
        merchant_status_code, paypal_order_id, reason
      ) VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9,$10,$11,$12,$13,$14)
      ON CONFLICT (id) DO UPDATE SET
        verdict = EXCLUDED.verdict,
        risk_score = EXCLUDED.risk_score,
        merchant_status_code = EXCLUDED.merchant_status_code,
        paypal_order_id = EXCLUDED.paypal_order_id,
        reason = EXCLUDED.reason`,
      [
        tx.id,
        tx.timestamp,
        tx.mode,
        tx.prompt,
        tx.requestedProductId ?? null,
        tx.requestedProductName,
        JSON.stringify(tx.cartItems),
        tx.totalAmount,
        tx.verdict,
        tx.riskScore,
        tx.piiExposedPct,
        tx.merchantStatusCode,
        tx.paypalOrderId,
        tx.reason,
      ]
    );
    return listTransactions();
  }

  const state = getServerMemoryState();
  const next = [tx, ...state.transactions.filter((item) => item.id !== tx.id)].slice(
    0,
    100
  );
  state.transactions = next;
  return next;
}

export async function updateTransaction(
  txId: string,
  patch: Partial<AuditTransaction>
): Promise<AuditTransaction[]> {
  const current = await listTransactions();
  const target = current.find((item) => item.id === txId);
  if (!target) return current;

  const updated: AuditTransaction = { ...target, ...patch };
  return appendTransaction(updated);
}

export async function resetDemoState(): Promise<{
  mandate: SpendingMandate;
  transactions: AuditTransaction[];
}> {
  const freshMandate: SpendingMandate = {
    ...DEFAULT_MANDATE,
    updatedAt: new Date().toISOString(),
  };

  if (getStorageBackendMode() === "neon-postgres") {
    await runNeonSql("DELETE FROM audit_transactions");
    await saveMandate(freshMandate);
  }

  getServerMemoryState().mandate = freshMandate;
  getServerMemoryState().transactions = [];

  return {
    mandate: freshMandate,
    transactions: [],
  };
}
