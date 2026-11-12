import {
  AuditTransaction,
  DEFAULT_MANDATE,
  SpendingMandate,
} from "@/data/catalog";

const MANDATE_STORAGE_KEY = "ghostpass:mandate:v1";
const LEDGER_STORAGE_KEY = "ghostpass:ledger:v1";

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
  if (typeof process !== "undefined" && process.env?.DATABASE_URL) {
    return "neon-postgres";
  }
  return "memory-localstorage";
}

function parseNeonHttpEndpoint(databaseUrl: string): string | null {
  try {
    const parsed = new URL(databaseUrl);
    if (!parsed.hostname) return null;
    return `https://${parsed.hostname}/sql`;
  } catch {
    return null;
  }
}

async function runNeonSql<T = Record<string, unknown>>(
  query: string,
  params: unknown[] = []
): Promise<T[] | null> {
  const databaseUrl =
    typeof process !== "undefined" ? process.env?.DATABASE_URL : undefined;
  if (!databaseUrl) return null;

  const endpoint = parseNeonHttpEndpoint(databaseUrl);
  if (!endpoint) return null;

  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Neon-Connection-String": databaseUrl,
      },
      body: JSON.stringify({ query, params }),
      cache: "no-store",
    });

    if (!res.ok) return null;
    const data = (await res.json()) as { rows?: T[] };
    return Array.isArray(data.rows) ? data.rows : [];
  } catch {
    return null;
  }
}

function readBrowserStorage<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function writeBrowserStorage<T>(key: string, value: T): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore quota / privacy mode errors cleanly
  }
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
      allowed_categories: SpendingMandate["allowedCategories"];
      updated_at: string;
    }>("SELECT * FROM mandates WHERE id = $1 LIMIT 1", [DEFAULT_MANDATE.id]);

    if (rows && rows.length > 0) {
      const row = rows[0];
      return {
        id: row.id,
        ruleText: row.rule_text,
        maxPerTransaction: Number(row.max_per_transaction),
        dailyLimit: Number(row.daily_limit),
        dailySpent: Number(row.daily_spent),
        blockGiftCards: Boolean(row.block_gift_cards),
        blockSubscriptions: Boolean(row.block_subscriptions),
        allowedCategories: row.allowed_categories,
        updatedAt: row.updated_at,
      };
    }
  }

  const stored = readBrowserStorage<SpendingMandate>(MANDATE_STORAGE_KEY);
  if (stored) {
    getServerMemoryState().mandate = stored;
    return stored;
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
  writeBrowserStorage(MANDATE_STORAGE_KEY, updated);
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
      cart_items: AuditTransaction["cartItems"];
      total_amount: string | number;
      verdict: AuditTransaction["verdict"];
      risk_score: number;
      pii_exposed_pct: number;
      merchant_status_code: AuditTransaction["merchantStatusCode"];
      paypal_order_id: string | null;
      reason: string;
    }>("SELECT * FROM audit_transactions ORDER BY timestamp DESC LIMIT 100");

    if (rows) {
      return rows.map((row) => ({
        id: row.id,
        timestamp: row.timestamp,
        mode: row.mode,
        prompt: row.prompt,
        requestedProductId: row.requested_product_id ?? undefined,
        requestedProductName: row.requested_product_name,
        cartItems: row.cart_items ?? [],
        totalAmount: Number(row.total_amount),
        verdict: row.verdict,
        riskScore: Number(row.risk_score),
        piiExposedPct: Number(row.pii_exposed_pct),
        merchantStatusCode: row.merchant_status_code,
        paypalOrderId: row.paypal_order_id,
        reason: row.reason,
      }));
    }
  }

  const stored = readBrowserStorage<AuditTransaction[]>(LEDGER_STORAGE_KEY);
  if (stored) {
    getServerMemoryState().transactions = stored;
    return stored;
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
  }

  const state = getServerMemoryState();
  const existing = readBrowserStorage<AuditTransaction[]>(LEDGER_STORAGE_KEY) ?? state.transactions;
  const next = [tx, ...existing.filter((item) => item.id !== tx.id)].slice(0, 100);
  state.transactions = next;
  writeBrowserStorage(LEDGER_STORAGE_KEY, next);
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

  writeBrowserStorage(MANDATE_STORAGE_KEY, freshMandate);
  writeBrowserStorage(LEDGER_STORAGE_KEY, []);

  return {
    mandate: freshMandate,
    transactions: [],
  };
}
