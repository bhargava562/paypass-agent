import { beforeEach, describe, expect, it } from "vitest";
import { POST as checkoutPost } from "@/app/api/store/checkout/route";
import {
  signGhostPassMandate,
  signHumanOverrideToken,
} from "@/lib/crypto/mandateSigner";
import { resetDemoState } from "@/lib/db";

describe("POST /api/store/checkout (Merchant Anti-Bot Firewall)", () => {
  beforeEach(async () => {
    await resetDemoState();
  });

  it("blocks STANDARD_BOT with HTTP 403 BOT_SCRAPER_BLOCKED and 100% PII exposed", async () => {
    const req = new Request("http://localhost:3000/api/store/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        productId: "prod-kb-01",
        amount: 48,
        mode: "STANDARD_BOT",
      }),
    });

    const res = await checkoutPost(req);
    const data = await res.json();

    expect(res.status).toBe(403);
    expect(data.error).toBe("BOT_SCRAPER_BLOCKED");
    expect(data.verifiedMandate).toBe(false);
    expect(data.piiExposedPct).toBe(100);
  });

  it("blocks GHOSTPASS without a valid signature with HTTP 403", async () => {
    const req = new Request("http://localhost:3000/api/store/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        productId: "prod-kbd-q1",
        amount: 48,
        mode: "GHOSTPASS",
      }),
    });

    const res = await checkoutPost(req);
    const data = await res.json();

    expect(res.status).toBe(403);
    expect(data.error).toBe("BOT_SCRAPER_BLOCKED");
    expect(data.verifiedMandate).toBe(false);
  });

  it("accepts GHOSTPASS with valid X-PayPal-GhostPass-Signature and returns HTTP 200 APPROVED_BY_MERCHANT", async () => {
    const signature = signGhostPassMandate({
      productId: "prod-kbd-q1",
      maxAmount: 48,
      sessionId: "sess_blind_unit",
    });

    const req = new Request("http://localhost:3000/api/store/checkout", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-PayPal-GhostPass-Signature": signature,
      },
      body: JSON.stringify({
        productId: "prod-kbd-q1",
        amount: 48,
        mode: "GHOSTPASS",
      }),
    });

    const res = await checkoutPost(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.status).toBe("APPROVED_BY_MERCHANT");
    expect(data.verifiedMandate).toBe(true);
    expect(data.captchaBypassed).toBe(true);
    expect(data.piiExposedPct).toBe(0);
    expect(data.verificationHash).toBeTruthy();
  });

  it("accepts GHOSTPASS with valid humanOverrideToken for $115 headphones", async () => {
    const overrideToken = signHumanOverrideToken({
      productId: "prod-headphones-xm5",
      maxAmount: 115,
      sessionId: "sess_blind_override",
    });

    const req = new Request("http://localhost:3000/api/store/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        productId: "prod-headphones-xm5",
        amount: 115,
        mode: "GHOSTPASS",
        humanOverrideToken: overrideToken,
      }),
    });

    const res = await checkoutPost(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.status).toBe("APPROVED_BY_MERCHANT");
    expect(data.verifiedMandate).toBe(true);
    expect(data.piiExposedPct).toBe(0);
  });
});
