import { createHash, createHmac, timingSafeEqual } from "crypto";

const DEFAULT_DEV_HMAC_SECRET = "ghostpass-dev-hmac-secret-change-in-prod-2026";
const DEFAULT_TTL_MS = 5 * 60 * 1000;

export interface MandateSignaturePayload {
  productId: string;
  maxAmount: number;
  sessionId: string;
  expiresAt: number;
  kind?: "mandate" | "human_override";
}

export interface MandateVerificationResult {
  valid: boolean;
  reason?: string;
  payload?: MandateSignaturePayload;
}

declare global {
  var __ghostpassConsumedTokens: Map<string, number> | undefined;
}

function getConsumedTokenMap(): Map<string, number> {
  if (!globalThis.__ghostpassConsumedTokens) {
    globalThis.__ghostpassConsumedTokens = new Map<string, number>();
  }
  return globalThis.__ghostpassConsumedTokens;
}

export function resetConsumedTokens(): void {
  globalThis.__ghostpassConsumedTokens?.clear();
}

/**
 * Enforces single-use redemption for a signed GhostPass or Human Override token.
 * Returns true on first use, false if already redeemed.
 */
export function consumeMandateToken(
  token: string,
  expiresAt?: number,
  nowMs: number = Date.now()
): boolean {
  const store = getConsumedTokenMap();
  for (const [key, exp] of store.entries()) {
    if (exp <= nowMs) {
      store.delete(key);
    }
  }
  const digest = createHash("sha256").update(token).digest("hex");
  if (store.has(digest)) {
    return false;
  }
  store.set(digest, expiresAt ?? nowMs + DEFAULT_TTL_MS);
  return true;
}

function getHmacSecret(): string {
  return process.env.GHOSTPASS_HMAC_SECRET || DEFAULT_DEV_HMAC_SECRET;
}

function computeDigest(encodedPayload: string): string {
  return createHmac("sha256", getHmacSecret())
    .update(encodedPayload)
    .digest("base64url");
}

export function signGhostPassMandate(
  input: Omit<MandateSignaturePayload, "expiresAt"> & { expiresAt?: number }
): string {
  const payload: MandateSignaturePayload = {
    productId: input.productId,
    maxAmount: Number(input.maxAmount.toFixed(2)),
    sessionId: input.sessionId,
    expiresAt: input.expiresAt ?? Date.now() + DEFAULT_TTL_MS,
    kind: input.kind ?? "mandate",
  };

  const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString(
    "base64url"
  );
  const mac = computeDigest(encoded);
  return `${encoded}.${mac}`;
}

export function signHumanOverrideToken(
  input: Omit<MandateSignaturePayload, "expiresAt" | "kind"> & {
    expiresAt?: number;
  }
): string {
  return signGhostPassMandate({
    ...input,
    kind: "human_override",
  });
}

export function verifyGhostPassMandate(
  signature: string | undefined | null,
  expectedAmount: number,
  productId: string,
  nowMs: number = Date.now()
): MandateVerificationResult {
  if (!signature || typeof signature !== "string") {
    return { valid: false, reason: "Missing X-PayPal-GhostPass-Signature" };
  }

  const parts = signature.split(".");
  if (parts.length !== 2) {
    return { valid: false, reason: "Malformed GhostPass signature format" };
  }

  const [encodedPayload, providedMac] = parts;
  if (!encodedPayload || !providedMac) {
    return { valid: false, reason: "Incomplete GhostPass signature" };
  }

  const expectedMac = computeDigest(encodedPayload);
  const providedBuf = Buffer.from(providedMac, "utf8");
  const expectedBuf = Buffer.from(expectedMac, "utf8");

  if (
    providedBuf.length !== expectedBuf.length ||
    !timingSafeEqual(providedBuf, expectedBuf)
  ) {
    return {
      valid: false,
      reason: "Cryptographic HMAC-SHA256 verification failed",
    };
  }

  let parsed: MandateSignaturePayload;
  try {
    parsed = JSON.parse(
      Buffer.from(encodedPayload, "base64url").toString("utf8")
    ) as MandateSignaturePayload;
  } catch {
    return { valid: false, reason: "Unreadable GhostPass payload" };
  }

  if (
    typeof parsed.productId !== "string" ||
    typeof parsed.maxAmount !== "number" ||
    typeof parsed.expiresAt !== "number"
  ) {
    return { valid: false, reason: "Incomplete mandate payload claims" };
  }

  if (parsed.expiresAt <= nowMs) {
    return { valid: false, reason: "GhostPass mandate signature expired" };
  }

  if (parsed.productId !== productId) {
    return {
      valid: false,
      reason: `Product mismatch: token scoped to ${parsed.productId}, got ${productId}`,
    };
  }

  if (Math.abs(parsed.maxAmount - expectedAmount) > 0.005) {
    return {
      valid: false,
      reason: `Amount mismatch: mandate capped at $${parsed.maxAmount.toFixed(
        2
      )}, checkout attempted $${expectedAmount.toFixed(2)}`,
    };
  }

  return { valid: true, payload: parsed };
}

export function verifyHumanOverrideToken(
  token: string | undefined | null,
  expectedAmount: number,
  productId: string,
  nowMs: number = Date.now()
): MandateVerificationResult {
  const result = verifyGhostPassMandate(token, expectedAmount, productId, nowMs);
  if (!result.valid) return result;
  if (result.payload?.kind !== "human_override") {
    return { valid: false, reason: "Token is not a human override token" };
  }
  return result;
}
