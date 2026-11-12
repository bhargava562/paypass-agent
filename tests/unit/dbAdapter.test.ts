import { readFileSync } from "fs";
import path from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuditTransaction, DEFAULT_MANDATE } from "@/data/catalog";
import {
  appendTransaction,
  getMandate,
  getStorageBackendMode,
  listTransactions,
  resetDemoState,
  saveMandate,
  updateTransaction,
} from "@/lib/db";

const originalDatabaseUrl = process.env.DATABASE_URL;
const originalFetch = globalThis.fetch;

function makeSampleTx(overrides: Partial<AuditTransaction> = {}): AuditTransaction {
  return {
    id: "tx-sample-01",
    timestamp: "2026-11-12T08:00:00.000Z",
    mode: "ghostpass",
    prompt: "Buy wireless keyboard under $60",
    requestedProductId: "prod-kbd-q1",
    requestedProductName: "Keychron Q1 Pro Wireless Mechanical Keyboard",
    cartItems: [
      {
        id: "prod-kbd-q1",
        name: "Keychron Q1 Pro Wireless Mechanical Keyboard",
        price: 48,
        category: "Keyboards & Mice",
      },
    ],
    totalAmount: 48,
    verdict: "APPROVED",
    riskScore: 8,
    piiExposedPct: 0,
    merchantStatusCode: 200,
    paypalOrderId: "READY-CAP-12345678",
    reason: "Verified mandate approved.",
    ...overrides,
  };
}

describe("Hybrid Storage Adapter (src/lib/db.ts) & Migration SQL (migrations/001_init.sql)", () => {
  beforeEach(async () => {
    delete process.env.DATABASE_URL;
    globalThis.fetch = originalFetch;
    await resetDemoState();
  });

  afterEach(() => {
    if (originalDatabaseUrl) {
      process.env.DATABASE_URL = originalDatabaseUrl;
    } else {
      delete process.env.DATABASE_URL;
    }
    globalThis.fetch = originalFetch;
  });

  it("defaults to memory-localstorage when DATABASE_URL is unset and enforces immutability", async () => {
    expect(getStorageBackendMode()).toBe("memory-localstorage");

    const mandate = await getMandate();
    expect(mandate.id).toBe(DEFAULT_MANDATE.id);
    expect(mandate.allowedCategories).toEqual(DEFAULT_MANDATE.allowedCategories);

    // Mutating returned object must not mutate internal memory store
    mandate.allowedCategories.push("Audio");
    mandate.dailySpent = 999;

    const freshRead = await getMandate();
    expect(freshRead.dailySpent).toBe(0);
    expect(freshRead.allowedCategories).toEqual(DEFAULT_MANDATE.allowedCategories);
  });

  it("supports save, append, update, timestamp sorting, and reset in In-Memory mode", async () => {
    const saved = await saveMandate({
      ...DEFAULT_MANDATE,
      maxPerTransaction: 80,
      dailySpent: 48,
    });
    expect(saved.maxPerTransaction).toBe(80);
    expect((await getMandate()).dailySpent).toBe(48);

    await appendTransaction(
      makeSampleTx({ id: "tx-older", timestamp: "2026-11-12T08:00:00.000Z" })
    );
    await appendTransaction(
      makeSampleTx({ id: "tx-newer", timestamp: "2026-11-12T09:00:00.000Z" })
    );

    const listed = await listTransactions();
    expect(listed.map((t) => t.id)).toEqual(["tx-newer", "tx-older"]);

    const patched = await updateTransaction("tx-older", {
      verdict: "BLOCKED",
      reason: "Patched verdict",
    });
    expect(patched.find((t) => t.id === "tx-older")?.verdict).toBe("BLOCKED");

    const reset = await resetDemoState();
    expect(reset.mandate.dailySpent).toBe(0);
    expect(reset.transactions).toEqual([]);
    expect(await listTransactions()).toEqual([]);
  });

  it("switches to neon-postgres when DATABASE_URL is set and executes valid parameterized SQL", async () => {
    process.env.DATABASE_URL =
      "postgresql://user:pass@ep-cool-host.us-east-2.aws.neon.tech/neondb?sslmode=require";
    expect(getStorageBackendMode()).toBe("neon-postgres");

    const sqlCalls: Array<{ url: string; query: string; params: unknown[] }> = [];

    globalThis.fetch = vi.fn(async (input, init) => {
      const parsedBody = JSON.parse(String(init?.body ?? "{}")) as {
        query: string;
        params: unknown[];
      };
      sqlCalls.push({
        url: String(input),
        query: parsedBody.query,
        params: parsedBody.params,
      });

      if (parsedBody.query.includes("FROM mandates")) {
        return new Response(
          JSON.stringify({
            rows: [
              {
                id: "mandate-default-01",
                rule_text: "Max $60",
                max_per_transaction: "60.00",
                daily_limit: "150.00",
                daily_spent: "48.00",
                block_gift_cards: true,
                block_subscriptions: true,
                allowed_categories: JSON.stringify([
                  "Keyboards & Mice",
                  "Audio",
                  "Cloud & Books",
                  "Accessories",
                ]),
                updated_at: "2026-11-12T08:15:00.000Z",
              },
            ],
          }),
          { status: 200 }
        );
      }

      if (parsedBody.query.includes("FROM audit_transactions")) {
        return new Response(
          JSON.stringify({
            rows: [
              {
                id: "tx-neon-01",
                timestamp: "2026-11-12T08:15:00.000Z",
                mode: "ghostpass",
                prompt: "Buy keyboard",
                requested_product_id: "prod-kbd-q1",
                requested_product_name: "Keychron Q1 Pro Wireless Mechanical Keyboard",
                cart_items: JSON.stringify([
                  {
                    id: "prod-kbd-q1",
                    name: "Keychron Q1 Pro Wireless Mechanical Keyboard",
                    price: 48,
                    category: "Keyboards & Mice",
                  },
                ]),
                total_amount: "48.00",
                verdict: "APPROVED",
                risk_score: "8",
                pii_exposed_pct: "0",
                merchant_status_code: 200,
                paypal_order_id: "READY-CAP-AABBCCDD",
                reason: "Verified",
              },
            ],
          }),
          { status: 200 }
        );
      }

      return new Response(JSON.stringify({ rows: [] }), { status: 200 });
    }) as typeof fetch;

    const mandate = await getMandate();
    expect(mandate.dailySpent).toBe(48);
    expect(mandate.maxPerTransaction).toBe(60);
    expect(mandate.allowedCategories).toContain("Keyboards & Mice");

    await saveMandate(mandate);
    const tx = makeSampleTx({ id: "tx-neon-01" });
    const afterAppend = await appendTransaction(tx);

    expect(afterAppend).toHaveLength(1);
    expect(afterAppend[0].totalAmount).toBe(48);
    expect(afterAppend[0].cartItems).toHaveLength(1);

    await resetDemoState();

    expect(sqlCalls[0].url).toBe("https://ep-cool-host.us-east-2.aws.neon.tech/sql");
    expect(sqlCalls.some((c) => c.query.includes("INSERT INTO mandates"))).toBe(true);
    expect(
      sqlCalls.some((c) => c.query.includes("INSERT INTO audit_transactions"))
    ).toBe(true);
    expect(
      sqlCalls.some((c) => c.query.includes("DELETE FROM audit_transactions"))
    ).toBe(true);
  });

  it("throws an explicit error when Neon HTTP SQL returns a non-OK response", async () => {
    process.env.DATABASE_URL =
      "postgresql://user:pass@ep-cool-host.us-east-2.aws.neon.tech/neondb";

    globalThis.fetch = vi.fn(
      async () => new Response("relation mandates does not exist", { status: 400 })
    ) as typeof fetch;

    await expect(getMandate()).rejects.toThrow("Neon SQL error (400)");
  });

  it("keeps migrations/001_init.sql aligned with DEFAULT_MANDATE categories and all db.ts columns", () => {
    const sqlPath = path.resolve(process.cwd(), "migrations/001_init.sql");
    const sql = readFileSync(sqlPath, "utf8");

    // Verify all current storefront categories appear in default allowed_categories
    for (const category of DEFAULT_MANDATE.allowedCategories) {
      expect(sql).toContain(category);
    }

    // Verify all columns queried/inserted by db.ts exist in 001_init.sql
    const expectedMandateCols = [
      "id",
      "rule_text",
      "max_per_transaction",
      "daily_limit",
      "daily_spent",
      "block_gift_cards",
      "block_subscriptions",
      "allowed_categories",
      "updated_at",
    ];
    for (const col of expectedMandateCols) {
      expect(sql).toContain(col);
    }

    const expectedTxCols = [
      "id",
      "timestamp",
      "mode",
      "prompt",
      "requested_product_id",
      "requested_product_name",
      "cart_items",
      "total_amount",
      "verdict",
      "risk_score",
      "pii_exposed_pct",
      "merchant_status_code",
      "paypal_order_id",
      "reason",
    ];
    for (const col of expectedTxCols) {
      expect(sql).toContain(col);
    }

    // Verify CHECK constraints include all supported verdicts and modes
    expect(sql).toContain("'standard_bot'");
    expect(sql).toContain("'ghostpass'");
    expect(sql).toContain("'APPROVED'");
    expect(sql).toContain("'BLOCKED'");
    expect(sql).toContain("'NEEDS_APPROVAL'");
    expect(sql).toContain("'403_REJECTED'");
  });
});
