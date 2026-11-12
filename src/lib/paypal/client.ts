import { randomUUID } from "crypto";
import { PayPalSettleResult } from "@/types/ghostpass";

const PAYPAL_SANDBOX_BASE_URL = "https://api-m.sandbox.paypal.com";
const TOKEN_REFRESH_BUFFER_MS = 60_000;
const PAYPAL_TIMEOUT_MS = 15_000;

interface CachedPayPalToken {
  accessToken: string;
  expiresAtMs: number;
}

declare global {
  var __ghostpassPayPalTokenCache: CachedPayPalToken | undefined;
  var __ghostpassPayPalTokenInFlight: Promise<string> | undefined;
}

export function resetPayPalTokenCache(): void {
  globalThis.__ghostpassPayPalTokenCache = undefined;
  globalThis.__ghostpassPayPalTokenInFlight = undefined;
}

export function isPayPalSandboxConfigured(): boolean {
  const clientId = process.env.PAYPAL_CLIENT_ID?.trim();
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET?.trim();
  return Boolean(
    clientId &&
      clientSecret &&
      clientId !== "your_paypal_sandbox_client_id" &&
      clientSecret !== "your_paypal_sandbox_secret"
  );
}

class PayPalTransientError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PayPalTransientError";
  }
}

async function fetchNewPayPalAccessToken(): Promise<string> {
  const clientId = process.env.PAYPAL_CLIENT_ID?.trim();
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET?.trim();

  if (!isPayPalSandboxConfigured() || !clientId || !clientSecret) {
    throw new Error(
      "PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET must be configured for Sandbox OAuth2"
    );
  }

  const basicCreds = Buffer.from(`${clientId}:${clientSecret}`, "utf8").toString(
    "base64"
  );

  let res: Response;
  try {
    res = await fetch(`${PAYPAL_SANDBOX_BASE_URL}/v1/oauth2/token`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${basicCreds}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
      cache: "no-store",
      signal: AbortSignal.timeout(PAYPAL_TIMEOUT_MS),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Network error";
    throw new PayPalTransientError(`PayPal OAuth2 unreachable: ${msg}`);
  }

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    if (res.status === 429 || res.status >= 500) {
      throw new PayPalTransientError(
        `PayPal OAuth2 transient error (${res.status}): ${errText}`
      );
    }
    throw new Error(`PayPal OAuth2 failed (${res.status}): ${errText}`);
  }

  const data = (await res.json().catch(() => null)) as {
    access_token?: string;
    expires_in?: number | string;
  } | null;

  if (!data?.access_token) {
    throw new PayPalTransientError(
      "PayPal OAuth2 response missing access_token"
    );
  }

  const parsedExpires = Number(data.expires_in);
  const ttlSec = Number.isFinite(parsedExpires)
    ? Math.max(60, parsedExpires)
    : 3200;

  globalThis.__ghostpassPayPalTokenCache = {
    accessToken: data.access_token,
    expiresAtMs: Date.now() + ttlSec * 1000,
  };

  return data.access_token;
}

export async function getPayPalAccessToken(): Promise<string> {
  if (!isPayPalSandboxConfigured()) {
    throw new Error(
      "PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET must be configured for Sandbox OAuth2"
    );
  }

  const cached = globalThis.__ghostpassPayPalTokenCache;
  if (cached && cached.expiresAtMs - TOKEN_REFRESH_BUFFER_MS > Date.now()) {
    return cached.accessToken;
  }

  if (!globalThis.__ghostpassPayPalTokenInFlight) {
    globalThis.__ghostpassPayPalTokenInFlight =
      fetchNewPayPalAccessToken().finally(() => {
        globalThis.__ghostpassPayPalTokenInFlight = undefined;
      });
  }

  return globalThis.__ghostpassPayPalTokenInFlight;
}

interface CreateOrderOptions {
  amount: number;
  productId: string;
  productName: string;
  sessionId: string;
  verificationHash: string;
}

interface PayPalOrderApiResponse {
  id: string;
  status: "CREATED" | "APPROVED" | "PAYER_ACTION_REQUIRED" | "COMPLETED";
  links?: Array<{ href: string; rel: string; method?: string }>;
}

function buildOrderPayload(
  opts: CreateOrderOptions,
  includeAccountsMetadata: boolean
): Record<string, unknown> {
  const sellerEmail = process.env.PAYPAL_SANDBOX_SELLER_EMAIL;
  const buyerEmail = process.env.PAYPAL_SANDBOX_BUYER_EMAIL;
  const validSeller =
    includeAccountsMetadata &&
    sellerEmail &&
    sellerEmail !== "your_fake_seller@business.example.com";
  const validBuyer =
    includeAccountsMetadata &&
    buyerEmail &&
    buyerEmail !== "your_fake_buyer@personal.example.com";

  const purchaseUnit: Record<string, unknown> = {
    reference_id: opts.productId,
    description: opts.productName.slice(0, 127),
    custom_id: opts.verificationHash,
    amount: {
      currency_code: "USD",
      value: opts.amount.toFixed(2),
    },
  };

  if (validSeller) {
    purchaseUnit.payee = { email_address: sellerEmail };
  }

  const body: Record<string, unknown> = {
    intent: "CAPTURE",
    purchase_units: [purchaseUnit],
  };

  if (validBuyer) {
    body.payment_source = {
      paypal: {
        email_address: buyerEmail,
        experience_context: {
          brand_name: "NovaTech Store (via PayPal GhostPass)",
          locale: "en-US",
          shipping_preference: "GET_FROM_FILE",
          user_action: "PAY_NOW",
          return_url: "https://novatech.example.com/ghostpass/return",
          cancel_url: "https://novatech.example.com/ghostpass/cancel",
        },
      },
    };
  }

  return body;
}

async function postPayPalOrder(
  accessToken: string,
  requestId: string,
  payload: Record<string, unknown>
): Promise<Response> {
  return fetch(`${PAYPAL_SANDBOX_BASE_URL}/v2/checkout/orders`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "PayPal-Request-Id": requestId,
    },
    body: JSON.stringify(payload),
    cache: "no-store",
    signal: AbortSignal.timeout(PAYPAL_TIMEOUT_MS),
  });
}

function buildSimulatedOrder(
  opts: CreateOrderOptions,
  shippingRelay: string
): PayPalSettleResult {
  const simId = `SBX-GP-${randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase()}`;
  return {
    paypalOrderId: simId,
    paypalStatus: "SIMULATED_SANDBOX",
    amount: Number(opts.amount.toFixed(2)),
    currency: "USD",
    sandboxActivityUrl: `https://www.sandbox.paypal.com/activity/payment/${simId}`,
    approveUrl: null,
    liveSandbox: false,
    shippingRelay,
  };
}

export async function createAndSettleSandboxOrder(
  opts: CreateOrderOptions
): Promise<PayPalSettleResult> {
  if (!isPayPalSandboxConfigured()) {
    return buildSimulatedOrder(
      opts,
      "PayPal Vault Shipping Relay (Configure PAYPAL_CLIENT_ID for live Sandbox)"
    );
  }

  try {
    let accessToken = await getPayPalAccessToken();
    const requestId = `gp-${opts.verificationHash}-${opts.sessionId}`.slice(
      0,
      108
    );

    let res = await postPayPalOrder(
      accessToken,
      requestId,
      buildOrderPayload(opts, true)
    );

    // Retry once with fresh token if cached OAuth2 token expired or was revoked
    if (res.status === 401) {
      resetPayPalTokenCache();
      accessToken = await getPayPalAccessToken();
      res = await postPayPalOrder(
        accessToken,
        requestId,
        buildOrderPayload(opts, true)
      );
    }

    // Fallback on 422 if sandbox payee/buyer account metadata mismatches app sandbox
    if (res.status === 422) {
      res = await postPayPalOrder(
        accessToken,
        `${requestId}-base`.slice(0, 108),
        buildOrderPayload(opts, false)
      );
    }

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      if (res.status === 429 || res.status >= 500) {
        throw new PayPalTransientError(
          `PayPal Orders v2 transient error (${res.status}): ${errText}`
        );
      }
      throw new Error(`PayPal Orders v2 failed (${res.status}): ${errText}`);
    }

    let order = (await res.json().catch(() => null)) as PayPalOrderApiResponse | null;
    if (!order?.id) {
      throw new PayPalTransientError(
        "PayPal Orders v2 response missing order id"
      );
    }

    if (order.status === "APPROVED") {
      const capRes = await fetch(
        `${PAYPAL_SANDBOX_BASE_URL}/v2/checkout/orders/${encodeURIComponent(order.id)}/capture`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
            "PayPal-Request-Id": `${requestId}-cap`.slice(0, 108),
          },
          body: "{}",
          cache: "no-store",
          signal: AbortSignal.timeout(PAYPAL_TIMEOUT_MS),
        }
      );
      if (!capRes.ok) {
        const capErr = await capRes.text().catch(() => "");
        if (capRes.status === 429 || capRes.status >= 500) {
          throw new PayPalTransientError(
            `PayPal Order capture transient error (${capRes.status}): ${capErr}`
          );
        }
        throw new Error(
          `PayPal Order capture failed (${capRes.status}): ${capErr}`
        );
      }
      const captured = (await capRes.json().catch(() => null)) as
        | PayPalOrderApiResponse
        | null;
      if (captured?.id) {
        order = captured;
      }
    }

    const approveLink =
      order.links?.find(
        (link) => link.rel === "payer-action" || link.rel === "approve"
      )?.href ?? null;

    return {
      paypalOrderId: order.id,
      paypalStatus: order.status,
      amount: Number(opts.amount.toFixed(2)),
      currency: "USD",
      sandboxActivityUrl: `https://www.sandbox.paypal.com/activity/payment/${encodeURIComponent(order.id)}`,
      approveUrl: approveLink,
      liveSandbox: true,
      shippingRelay: "Direct PayPal Vault Shipping Relay (0% PII shared with AI)",
    };
  } catch (err) {
    // Graceful simulated fallback if PayPal Sandbox is rate-limited, timed out, or unreachable
    const isNetworkOrTimeout =
      err instanceof PayPalTransientError ||
      (err instanceof Error &&
        (err.name === "TimeoutError" ||
          err.name === "AbortError" ||
          err.name === "TypeError"));
    if (isNetworkOrTimeout) {
      console.warn(
        "[paypal/client] PayPal Sandbox transient failure, using simulated fallback:",
        err instanceof Error ? err.message : err
      );
      return buildSimulatedOrder(
        opts,
        "PayPal Vault Shipping Relay (Sandbox rate-limited/unavailable — simulated fallback)"
      );
    }
    throw err;
  }
}
