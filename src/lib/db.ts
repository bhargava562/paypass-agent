import {
  AuditTransaction,
  DEFAULT_MANDATE,
  SpendingMandate,
} from "@/data/catalog";
import { resetConsumedTokens } from "@/lib/crypto/mandateSigner";

export type StorageBackendMode = "memory-localstorage" | "neon-postgres";

interface MemoryStoreState {
  mandate: SpendingMandate;
  transactions: AuditTransaction[];
}

interface MandateRow {
  id: string;
  rule_text: string;
  max_per_transaction: string | number;
  daily_limit: string | number;
  daily_spent: string | number;
  block_gift_cards: boolean;
  block_subscriptions: boolean;
  allowed_categories: SpendingMandate["allowedCategories"] | string | null;
  updated_at: string;
}

interface AuditTransactionRow {
  id: string;
  timestamp: string;
  mode: AuditTransaction["mode"];
  prompt: string;
  requested_product_id: string | null;
  requested_product_name: string;
  cart_items: AuditTransaction["cartItems"] | string | null;
  total_amount: string | number;
  verdict: AuditTransaction["verdict"];
  risk_score: string | number;
  pii_exposed_pct: string | number;
  merchant_status_code: AuditTransaction["merchantStatusCode"];
  paypal_order_id: string | null;
  reason: string;
}

declare global {
  var __ghostpassMemoryStore: MemoryStoreState | undefined;
}

function cloneMandate(mandate: SpendingMandate): SpendingMandate {
  return {
    ...mandate,
    allowedCategories: [...mandate.allowedCategories],
  };
}

function cloneTransaction(tx: AuditTransaction): AuditTransaction {
  return {
    ...tx,
    cartItems: tx.cartItems.map((item) => ({ ...item })),
  };
}

function getServerMemoryState(): MemoryStoreState {
  if (!globalThis.__ghostpassMemoryStore) {
    globalThis.__ghostpassMemoryStore = {
      mandate: cloneMandate(DEFAULT_MANDATE),
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

function parseJsonArray<T>(value: T[] | string | null | undefined, fallback: T[]): T[] {
  if (Array.isArray(value)) return value;
  if (typeof value === "string") {
    try {
      const parsed: unknown = JSON.parse(value);
      return Array.isArray(parsed) ? (parsed as T[]) : fallback;
    } catch {
      return fallback;
    }
  }
  return fallback;
}

function mapTransactionRow(row: AuditTransactionRow): AuditTransaction {
  return {
    id: row.id,
    timestamp: row.timestamp,
    mode: row.mode,
    prompt: row.prompt,
    requestedProductId: row.requested_product_id ?? undefined,
    requestedProductName: row.requested_product_name,
    cartItems: parseJsonArray(row.cart_items, []),
    totalAmount: Number(row.total_amount),
    verdict: row.verdict,
    riskScore: Number(row.risk_score),
    piiExposedPct: Number(row.pii_exposed_pct),
    merchantStatusCode: Number(
      row.merchant_status_code
    ) as AuditTransaction["merchantStatusCode"],
    paypalOrderId: row.paypal_order_id,
    reason: row.reason,
  };
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
    const rows = await runNeonSql<MandateRow>(
      "SELECT * FROM mandates WHERE id = $1 LIMIT 1",
      [DEFAULT_MANDATE.id]
    );

    if (rows.length > 0) {
      const row = rows[0];
      const categories = parseJsonArray(
        row.allowed_categories,
        DEFAULT_MANDATE.allowedCategories
      );
      return {
        id: row.id,
        ruleText: row.rule_text,
        maxPerTransaction: Number(row.max_per_transaction),
        dailyLimit: Number(row.daily_limit),
        dailySpent: Number(row.daily_spent),
        blockGiftCards: Boolean(row.block_gift_cards),
        blockSubscriptions: Boolean(row.block_subscriptions),
        allowedCategories:
          categories.length > 0 ? categories : [...DEFAULT_MANDATE.allowedCategories],
        updatedAt: row.updated_at,
      };
    }
  }

  return cloneMandate(getServerMemoryState().mandate);
}

export async function saveMandate(
  mandate: SpendingMandate
): Promise<SpendingMandate> {
  const updated: SpendingMandate = {
    ...cloneMandate(mandate),
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

  getServerMemoryState().mandate = cloneMandate(updated);
  return updated;
}

export async function listTransactions(): Promise<AuditTransaction[]> {
  if (getStorageBackendMode() === "neon-postgres") {
    const rows = await runNeonSql<AuditTransactionRow>(
      "SELECT * FROM audit_transactions ORDER BY timestamp DESC LIMIT 100"
    );
    return rows.map(mapTransactionRow);
  }

  return [...getServerMemoryState().transactions]
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
    .slice(0, 100)
    .map(cloneTransaction);
}

export async function appendTransaction(
  tx: AuditTransaction
): Promise<AuditTransaction[]> {
  const cleanTx = cloneTransaction(tx);

  if (getStorageBackendMode() === "neon-postgres") {
    await runNeonSql(
      `INSERT INTO audit_transactions (
        id, timestamp, mode, prompt, requested_product_id, requested_product_name,
        cart_items, total_amount, verdict, risk_score, pii_exposed_pct,
        merchant_status_code, paypal_order_id, reason
      ) VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9,$10,$11,$12,$13,$14)
      ON CONFLICT (id) DO UPDATE SET
        requested_product_name = EXCLUDED.requested_product_name,
        cart_items = EXCLUDED.cart_items,
        total_amount = EXCLUDED.total_amount,
        verdict = EXCLUDED.verdict,
        risk_score = EXCLUDED.risk_score,
        merchant_status_code = EXCLUDED.merchant_status_code,
        paypal_order_id = EXCLUDED.paypal_order_id,
        reason = EXCLUDED.reason`,
      [
        cleanTx.id,
        cleanTx.timestamp,
        cleanTx.mode,
        cleanTx.prompt,
        cleanTx.requestedProductId ?? null,
        cleanTx.requestedProductName,
        JSON.stringify(cleanTx.cartItems),
        cleanTx.totalAmount,
        cleanTx.verdict,
        cleanTx.riskScore,
        cleanTx.piiExposedPct,
        cleanTx.merchantStatusCode,
        cleanTx.paypalOrderId,
        cleanTx.reason,
      ]
    );
    return listTransactions();
  }

  const state = getServerMemoryState();
  const next = [
    cleanTx,
    ...state.transactions.filter((item) => item.id !== cleanTx.id),
  ]
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
    .slice(0, 100);
  state.transactions = next;
  return next.map(cloneTransaction);
}

export async function updateTransaction(
  txId: string,
  patch: Partial<AuditTransaction>
): Promise<AuditTransaction[]> {
  const current = await listTransactions();
  let target = current.find((item) => item.id === txId);

  if (!target && getStorageBackendMode() === "neon-postgres") {
    const rows = await runNeonSql<AuditTransactionRow>(
      "SELECT * FROM audit_transactions WHERE id = $1 LIMIT 1",
      [txId]
    );
    if (rows.length > 0) {
      target = mapTransactionRow(rows[0]);
    }
  }

  if (!target) return current;

  const updated: AuditTransaction = { ...target, ...patch };
  return appendTransaction(updated);
}

export async function resetDemoState(): Promise<{
  mandate: SpendingMandate;
  transactions: AuditTransaction[];
}> {
  const freshMandate: SpendingMandate = {
    ...cloneMandate(DEFAULT_MANDATE),
    updatedAt: new Date().toISOString(),
  };

  if (getStorageBackendMode() === "neon-postgres") {
    await runNeonSql("DELETE FROM audit_transactions");
    await saveMandate(freshMandate);
  }

  getServerMemoryState().mandate = cloneMandate(freshMandate);
  getServerMemoryState().transactions = [];
  resetConsumedTokens();

  return {
    mandate: cloneMandate(freshMandate),
    transactions: [],
  };
}
