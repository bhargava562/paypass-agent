import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock @google/genai globally so integration tests consume ZERO live Gemini API quota
const generateContentMock = vi.fn();

vi.mock("@google/genai", () => {
  return {
    Type: {
      OBJECT: "OBJECT",
      STRING: "STRING",
      NUMBER: "NUMBER",
      BOOLEAN: "BOOLEAN",
    },
    GoogleGenAI: vi.fn().mockImplementation(() => ({
      models: {
        generateContent: generateContentMock,
      },
    })),
  };
});

import { POST as executePost } from "@/app/api/agent/execute/route";
import { POST as checkoutPost } from "@/app/api/store/checkout/route";
import { getMandate, listTransactions, resetDemoState } from "@/lib/db";
import { resetPayPalTokenCache } from "@/lib/paypal/client";

const originalFetch = globalThis.fetch;
const originalEnv = { ...process.env };

function mockPayPalSandboxFetch(orderId = "5O190127TN364715T") {
  process.env.PAYPAL_CLIENT_ID = "sb-client-id";
  process.env.PAYPAL_CLIENT_SECRET = "sb-client-secret";
  globalThis.fetch = vi.fn(async (input) => {
    const url = String(input);
    if (url.endsWith("/v1/oauth2/token")) {
      return new Response(
        JSON.stringify({ access_token: "A21AAIntegrationToken", expires_in: 3600 }),
        { status: 200 }
      );
    }
    if (url.endsWith("/v2/checkout/orders")) {
      return new Response(
        JSON.stringify({
          id: orderId,
          status: "CREATED",
          links: [
            {
              rel: "approve",
              href: `https://www.sandbox.paypal.com/checkoutnow?token=${orderId}`,
            },
          ],
        }),
        { status: 201 }
      );
    }
    return new Response("Unexpected fetch URL", { status: 500 });
  }) as unknown as typeof fetch;
}

describe("Full End-to-End GhostPass Pipeline + PayPal Sandbox Settlement (Zero Gemini Quota)", () => {
  beforeEach(async () => {
    generateContentMock.mockReset();
    resetPayPalTokenCache();
    globalThis.fetch = originalFetch;
    await resetDemoState();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    globalThis.fetch = originalFetch;
    resetPayPalTokenCache();
  });

  it("Scenario 1: Standard AI Bot exposes PII and is blocked with HTTP 403 at /api/store/checkout", async () => {
    const execReq = new Request("http://localhost:3000/api/agent/execute", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt: "Buy wireless keyboard under $60",
        mode: "STANDARD_BOT",
        skipLlm: true,
      }),
    });

    const execRes = await executePost(execReq);
    const execData = await execRes.json();

    expect(execRes.status).toBe(200);
    expect(execData.piiExposedPct).toBe(100);
    expect(execData.exposedPiiContext.buyerEmail).toContain("@");

    const checkoutReq = new Request("http://localhost:3000/api/store/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        productId: execData.selectedProduct.id,
        amount: execData.proposedCartTotal,
        mode: "STANDARD_BOT",
        agentContextPayload: execData.exposedPiiContext,
      }),
    });

    const checkoutRes = await checkoutPost(checkoutReq);
    const checkoutData = await checkoutRes.json();

    expect(checkoutRes.status).toBe(403);
    expect(checkoutData.error).toBe("BOT_SCRAPER_BLOCKED");

    const ledger = await listTransactions();
    expect(ledger).toHaveLength(1);
    expect(ledger[0].verdict).toBe("403_REJECTED");
  });

  it("Scenario 2: GhostPass Safe Buy ($48 Keyboard) -> AUTO_APPROVE -> PayPal Orders v2 Settlement -> Persisted in db.ts", async () => {
    mockPayPalSandboxFetch("5O190127TN364715T");

    const execReq = new Request("http://localhost:3000/api/agent/execute", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt: "Buy a wireless mechanical keyboard under $60",
        mode: "GHOSTPASS",
        mandate: {
          ruleText: "Max $60 dev gear",
          dailyCap: 150,
          spentToday: 0,
          autoApproveLimit: 60,
        },
        skipLlm: true,
      }),
    });

    const execRes = await executePost(execReq);
    const execData = await execRes.json();

    expect(execRes.status).toBe(200);
    expect(execData.decision).toBe("AUTO_APPROVE");
    expect(execData.piiExposedPct).toBe(0);
    expect(execData.signature).toBeTruthy();

    const checkoutReq = new Request("http://localhost:3000/api/store/checkout", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-PayPal-GhostPass-Signature": execData.signature,
      },
      body: JSON.stringify({
        productId: execData.selectedProduct.id,
        amount: execData.proposedCartTotal,
        mode: "GHOSTPASS",
        agentContextPayload: execData.redactedContext,
      }),
    });

    const checkoutRes = await checkoutPost(checkoutReq);
    const checkoutData = await checkoutRes.json();

    expect(checkoutRes.status).toBe(200);
    expect(checkoutData.status).toBe("APPROVED_BY_MERCHANT");
    expect(checkoutData.verifiedMandate).toBe(true);
    expect(checkoutData.piiExposedPct).toBe(0);
    expect(checkoutData.paypalOrderId).toBe("5O190127TN364715T");
    expect(checkoutData.liveSandbox).toBe(true);

    const mandate = await getMandate();
    expect(mandate.dailySpent).toBe(48);

    const ledger = await listTransactions();
    expect(ledger).toHaveLength(1);
    expect(ledger[0].verdict).toBe("APPROVED");
    expect(ledger[0].paypalOrderId).toBe("5O190127TN364715T");
    expect(ledger[0].piiExposedPct).toBe(0);
  });

  it("Scenario 3: Prompt Injection Trap ($19 Cable hiding $75 Steam Gift Card) -> BLOCKED & logged ($0 moved)", async () => {
    const execReq = new Request("http://localhost:3000/api/agent/execute", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt: "Buy the $19 braided USB-C cable",
        mode: "GHOSTPASS",
        mandate: {
          ruleText: "Max $60 dev gear, no gift cards",
          dailyCap: 150,
          spentToday: 0,
          autoApproveLimit: 60,
        },
        skipLlm: true,
      }),
    });

    const execRes = await executePost(execReq);
    const execData = await execRes.json();

    expect(execRes.status).toBe(200);
    expect(execData.decision).toBe("BLOCK");
    expect(execData.riskScore).toBeGreaterThanOrEqual(85);
    expect(execData.reason).toContain("Steam Digital Gift Card");

    const mandate = await getMandate();
    expect(mandate.dailySpent).toBe(0);

    const ledger = await listTransactions();
    expect(ledger).toHaveLength(1);
    expect(ledger[0].verdict).toBe("BLOCKED");
    expect(ledger[0].paypalOrderId).toBeNull();
  });

  it("Scenario 4: Over-Budget ($115 Sony Headphones) -> REQUIRE_HUMAN -> 1-Click Human Override -> PayPal Orders v2 Settlement", async () => {
    mockPayPalSandboxFetch("8XY9201OVR115000Z");

    const execReq = new Request("http://localhost:3000/api/agent/execute", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt: "Buy Sony WH-1000XM5 Studio Headphones",
        mode: "GHOSTPASS",
        mandate: {
          ruleText: "Max $60 dev gear",
          dailyCap: 150,
          spentToday: 0,
          autoApproveLimit: 60,
        },
        skipLlm: true,
      }),
    });

    const execRes = await executePost(execReq);
    const execData = await execRes.json();

    expect(execRes.status).toBe(200);
    expect(execData.decision).toBe("REQUIRE_HUMAN");
    expect(execData.approvalToken).toBeTruthy();
    expect(execData.auditEventId).toBeTruthy();

    const checkoutReq = new Request("http://localhost:3000/api/store/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        productId: execData.selectedProduct.id,
        amount: execData.proposedCartTotal,
        mode: "GHOSTPASS",
        humanOverrideToken: execData.approvalToken,
        auditEventId: execData.auditEventId,
      }),
    });

    const checkoutRes = await checkoutPost(checkoutReq);
    const checkoutData = await checkoutRes.json();

    expect(checkoutRes.status).toBe(200);
    expect(checkoutData.status).toBe("APPROVED_BY_MERCHANT");
    expect(checkoutData.paypalOrderId).toBe("8XY9201OVR115000Z");

    const mandate = await getMandate();
    expect(mandate.dailySpent).toBe(115);

    const ledger = await listTransactions();
    expect(ledger).toHaveLength(1);
    expect(ledger[0].id).toBe(execData.auditEventId);
    expect(ledger[0].verdict).toBe("APPROVED");
    expect(ledger[0].paypalOrderId).toBe("8XY9201OVR115000Z");
  });
});
