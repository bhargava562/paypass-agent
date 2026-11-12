import { describe, expect, it } from "vitest";
import {
  consumeMandateToken,
  resetConsumedTokens,
  signGhostPassMandate,
  signHumanOverrideToken,
  verifyGhostPassMandate,
  verifyHumanOverrideToken,
} from "@/lib/crypto/mandateSigner";

describe("mandateSigner (HMAC-SHA256)", () => {
  it("verifies a valid GhostPass mandate signature with matching productId and amount", () => {
    const signature = signGhostPassMandate({
      productId: "prod-kbd-q1",
      maxAmount: 48.0,
      sessionId: "sess_blind_1234",
    });

    const result = verifyGhostPassMandate(signature, 48.0, "prod-kbd-q1");
    expect(result.valid).toBe(true);
    expect(result.payload?.productId).toBe("prod-kbd-q1");
    expect(result.payload?.maxAmount).toBe(48.0);
  });

  it("rejects a signature when the checkout dollar amount is tampered", () => {
    const signature = signGhostPassMandate({
      productId: "prod-kbd-q1",
      maxAmount: 48.0,
      sessionId: "sess_blind_1234",
    });

    const result = verifyGhostPassMandate(signature, 99.0, "prod-kbd-q1");
    expect(result.valid).toBe(false);
    expect(result.reason).toContain("Amount mismatch");
  });

  it("rejects a signature when the productId does not match the scoped mandate", () => {
    const signature = signGhostPassMandate({
      productId: "prod-kbd-q1",
      maxAmount: 48.0,
      sessionId: "sess_blind_1234",
    });

    const result = verifyGhostPassMandate(signature, 48.0, "prod-gift-steam75");
    expect(result.valid).toBe(false);
    expect(result.reason).toContain("Product mismatch");
  });

  it("rejects an expired mandate signature", () => {
    const pastExpiry = Date.now() - 10_000;
    const signature = signGhostPassMandate({
      productId: "prod-kbd-q1",
      maxAmount: 48.0,
      sessionId: "sess_blind_1234",
      expiresAt: pastExpiry,
    });

    const result = verifyGhostPassMandate(signature, 48.0, "prod-kbd-q1");
    expect(result.valid).toBe(false);
    expect(result.reason).toContain("expired");
  });

  it("rejects a tampered signature MAC string", () => {
    const signature = signGhostPassMandate({
      productId: "prod-kbd-q1",
      maxAmount: 48.0,
      sessionId: "sess_blind_1234",
    });

    const [payload] = signature.split(".");
    const tampered = `${payload}.tamperedmacvalue123456`;

    const result = verifyGhostPassMandate(tampered, 48.0, "prod-kbd-q1");
    expect(result.valid).toBe(false);
    expect(result.reason).toContain("verification failed");
  });

  it("distinguishes human override tokens from standard mandate signatures", () => {
    const overrideToken = signHumanOverrideToken({
      productId: "prod-headphones-xm5",
      maxAmount: 115.0,
      sessionId: "sess_blind_5678",
    });

    const validOverride = verifyHumanOverrideToken(
      overrideToken,
      115.0,
      "prod-headphones-xm5"
    );
    expect(validOverride.valid).toBe(true);

    const rejectedOverrideAsMandate = verifyGhostPassMandate(
      overrideToken,
      115.0,
      "prod-headphones-xm5"
    );
    expect(rejectedOverrideAsMandate.valid).toBe(false);

    const standardMandate = signGhostPassMandate({
      productId: "prod-headphones-xm5",
      maxAmount: 115.0,
      sessionId: "sess_blind_5678",
    });
    const rejectedAsOverride = verifyHumanOverrideToken(
      standardMandate,
      115.0,
      "prod-headphones-xm5"
    );
    expect(rejectedAsOverride.valid).toBe(false);
  });

  it("enforces single-use replay protection via consumeMandateToken", () => {
    resetConsumedTokens();
    const signature = signGhostPassMandate({
      productId: "prod-kbd-q1",
      maxAmount: 48.0,
      sessionId: "sess_replay",
    });

    expect(consumeMandateToken(signature)).toBe(true);
    expect(consumeMandateToken(signature)).toBe(false);
  });
});
