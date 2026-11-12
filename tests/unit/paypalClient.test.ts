import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST as settlePost } from "@/app/api/paypal/settle/route";
import { signGhostPassMandate } from "@/lib/crypto/mandateSigner";
import { listTransactions, resetDemoState } from "@/lib/db";
import {
  createAndSettleSandboxOrder,
  getPayPalAccessToken,
  resetPayPalTokenCache,
} from "@/lib/paypal/client";

const originalFetch = globalThis.fetch;
const originalEnv = { ...process.env };

describe("PayPal Sandbox Orders v2 Client & /api/paypal/settle (Mocked Fetch)", () => {
  beforeEach(async () => {
    resetPayPalTokenCache();
    globalThis.fetch = originalFetch;
    await resetDemoState();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    globalThis.fetch = originalFetch;
    resetPayPalTokenCache();
  });

  it("exchanges client_credentials for an OAuth2 token and caches it in memory", async () => {
    process.env.PAYPAL_CLIENT_ID = "sb-client-id";
    process.env.PAYPAL_CLIENT_SECRET = "sb-client-secret";

    const fetchMock = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          access_token: "A21AAFakeSandboxToken",
          expires_in: 3600,
        }),
        { status: 200 }
      );
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const token1 = await getPayPalAccessToken();
    const token2 = await getPayPalAccessToken();

    expect(token1).toBe("A21AAFakeSandboxToken");
    expect(token2).toBe("A21AAFakeSandboxToken");
    // Second call used in-memory cache
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [url, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toBe("https://api-m.sandbox.paypal.com/v1/oauth2/token");
    expect(init.method).toBe("POST");
    expect(
      (init.headers as Record<string, string>).Authorization
    ).toMatch(/^Basic /);
    expect(init.body).toBe("grant_type=client_credentials");
  });

  it("constructs Orders v2 CAPTURE payload with payee & payment_source and captures APPROVED orders", async () => {
    process.env.PAYPAL_CLIENT_ID = "sb-client-id";
    process.env.PAYPAL_CLIENT_SECRET = "sb-client-secret";
    process.env.PAYPAL_SANDBOX_SELLER_EMAIL = "seller@business.example.com";
    process.env.PAYPAL_SANDBOX_BUYER_EMAIL = "buyer@personal.example.com";

    const calls: Array<{ url: string; body?: Record<string, unknown> }> = [];

    globalThis.fetch = vi.fn(async (input, init) => {
      const url = String(input);
      const body = init?.body && typeof init.body === "string" && url.includes("/v2/checkout/orders") && !url.endsWith("/capture")
        ? (JSON.parse(init.body) as Record<string, unknown>)
        : undefined;
      calls.push({ url, body });

      if (url.endsWith("/v1/oauth2/token")) {
        return new Response(
          JSON.stringify({ access_token: "A21AAOrderToken", expires_in: 3600 }),
          { status: 200 }
        );
      }
      if (url.endsWith("/v2/checkout/orders")) {
        return new Response(
          JSON.stringify({
            id: "5O190127TN364715T",
            status: "APPROVED",
            links: [
              {
                rel: "approve",
                href: "https://www.sandbox.paypal.com/checkoutnow?token=5O190127TN364715T",
              },
            ],
          }),
          { status: 201 }
        );
      }
      if (url.endsWith("/v2/checkout/orders/5O190127TN364715T/capture")) {
        return new Response(
          JSON.stringify({
            id: "5O190127TN364715T",
            status: "COMPLETED",
            links: [],
          }),
          { status: 201 }
        );
      }
      return new Response("Not Found", { status: 404 });
    }) as unknown as typeof fetch;

    const result = await createAndSettleSandboxOrder({
      amount: 48,
      productId: "prod-kbd-q1",
      productName: "Keychron Q1 Pro Wireless Mechanical Keyboard",
      sessionId: "sess_123",
      verificationHash: "HASH1234",
    });

    expect(result.paypalOrderId).toBe("5O190127TN364715T");
    expect(result.paypalStatus).toBe("COMPLETED");
    expect(result.liveSandbox).toBe(true);
    expect(result.sandboxActivityUrl).toBe(
      "https://www.sandbox.paypal.com/activity/payment/5O190127TN364715T"
    );

    const createCall = calls.find((c) => c.url.endsWith("/v2/checkout/orders"));
    expect(createCall?.body?.intent).toBe("CAPTURE");
    const pu = (createCall?.body?.purchase_units as Array<Record<string, unknown>>)[0];
    expect((pu.amount as { value: string; currency_code: string }).value).toBe("48.00");
    expect((pu.payee as { email_address: string }).email_address).toBe(
      "seller@business.example.com"
    );
  });

  it("retries without payee/payment_source emails if PayPal returns 422 on sandbox account metadata", async () => {
    process.env.PAYPAL_CLIENT_ID = "sb-client-id";
    process.env.PAYPAL_CLIENT_SECRET = "sb-client-secret";
    process.env.PAYPAL_SANDBOX_SELLER_EMAIL = "invalid-seller@example.com";
    process.env.PAYPAL_SANDBOX_BUYER_EMAIL = "invalid-buyer@example.com";

    let orderAttempt = 0;
    globalThis.fetch = vi.fn(async (input) => {
      const url = String(input);
      if (url.endsWith("/v1/oauth2/token")) {
        return new Response(
          JSON.stringify({ access_token: "A21AARetryToken", expires_in: 3600 }),
          { status: 200 }
        );
      }
      if (url.endsWith("/v2/checkout/orders")) {
        orderAttempt += 1;
        if (orderAttempt === 1) {
          return new Response(
            JSON.stringify({ name: "UNPROCESSABLE_ENTITY" }),
            { status: 422 }
          );
        }
        return new Response(
          JSON.stringify({
            id: "8XY9201999123456K",
            status: "CREATED",
            links: [],
          }),
          { status: 201 }
        );
      }
      return new Response("Not Found", { status: 404 });
    }) as unknown as typeof fetch;

    const result = await createAndSettleSandboxOrder({
      amount: 115,
      productId: "prod-headphones-xm5",
      productName: "Sony WH-1000XM5 Studio Headphones",
      sessionId: "sess_retry",
      verificationHash: "HASH9999",
    });

    expect(orderAttempt).toBe(2);
    expect(result.paypalOrderId).toBe("8XY9201999123456K");
    expect(result.paypalStatus).toBe("CREATED");
  });

  it("POST /api/paypal/settle verifies mandate signature, creates order, and persists paypalOrderId in db.ts", async () => {
    process.env.PAYPAL_CLIENT_ID = "sb-client-id";
    process.env.PAYPAL_CLIENT_SECRET = "sb-client-secret";

    globalThis.fetch = vi.fn(async (input) => {
      const url = String(input);
      if (url.endsWith("/v1/oauth2/token")) {
        return new Response(
          JSON.stringify({ access_token: "A21AASettleToken", expires_in: 3600 }),
          { status: 200 }
        );
      }
      if (url.endsWith("/v2/checkout/orders")) {
        return new Response(
          JSON.stringify({
            id: "9PP7712345678901X",
            status: "CREATED",
            links: [],
          }),
          { status: 201 }
        );
      }
      return new Response("Not Found", { status: 404 });
    }) as unknown as typeof fetch;

    const signature = signGhostPassMandate({
      productId: "prod-kbd-q1",
      maxAmount: 48,
      sessionId: "sess_settle",
    });

    const req = new Request("http://localhost:3000/api/paypal/settle", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-PayPal-GhostPass-Signature": signature,
      },
      body: JSON.stringify({
        productId: "prod-kbd-q1",
        amount: 48,
        sessionId: "sess_settle",
      }),
    });

    const res = await settlePost(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.status).toBe("SETTLED_VIA_PAYPAL");
    expect(data.paypalOrderId).toBe("9PP7712345678901X");

    const ledger = await listTransactions();
    expect(ledger).toHaveLength(1);
    expect(ledger[0].paypalOrderId).toBe("9PP7712345678901X");
  });

  it("POST /api/paypal/settle rejects unauthenticated verificationHash bypass with HTTP 403", async () => {
    const req = new Request("http://localhost:3000/api/paypal/settle", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        productId: "prod-kbd-q1",
        amount: 48,
        verificationHash: "forged-hash",
      }),
    });

    const res = await settlePost(req);
    const data = await res.json();

    expect(res.status).toBe(403);
    expect(data.error).toBe("UNAUTHORIZED_SETTLEMENT");
  });
});
