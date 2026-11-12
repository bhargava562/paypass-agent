import { AuditTransaction, Product, ProductCategory } from "@/data/catalog";

export type AgentExecutionMode = "STANDARD_BOT" | "GHOSTPASS";

export interface MandateConfig {
  id?: string;
  ruleText: string;
  dailyCap: number;
  spentToday: number;
  autoApproveLimit: number;
  blockGiftCards?: boolean;
  blockSubscriptions?: boolean;
  allowedCategories?: ProductCategory[];
}

export interface AgentCartItem {
  productId: string;
  title: string;
  category: ProductCategory;
  price: number;
  quantity: number;
}

export interface ShoppingAgentResult {
  sessionId: string;
  productId: string;
  title: string;
  category: ProductCategory;
  price: number;
  quantity: number;
  proposedCartTotal: number;
  extractedMetadataPayload: string | null;
  injectedCartItems: AgentCartItem[];
  reasoning: string;
  usedModel: string;
}

export type GatekeeperDecision = "AUTO_APPROVE" | "REQUIRE_HUMAN" | "BLOCK";

export interface GatekeeperChecks {
  isDailyCapExceeded: boolean;
  isOverAutoApproveLimit: boolean;
  hasInjectionSignature: boolean;
  isRestrictedPolicyItem: boolean;
  semanticViolation: boolean;
}

export interface GatekeeperVerdict {
  decision: GatekeeperDecision;
  riskScore: number;
  reason: string;
  signature?: string;
  approvalToken?: string;
  redactedContext: Record<string, string>;
  checks: GatekeeperChecks;
  usedModel: string;
}

export interface AgentExecuteRequest {
  prompt: string;
  mode: AgentExecutionMode | "standard_bot" | "ghostpass";
  sessionId?: string;
  mandate?: Partial<MandateConfig> & {
    maxPerTransaction?: number;
    dailyLimit?: number;
    dailySpent?: number;
  };
  /** Test-only flag to skip live Gemini HTTP calls and run deterministic engine */
  skipLlm?: boolean;
}

export interface AgentExecuteResponse {
  sessionId: string;
  mode: AgentExecutionMode;
  decision: GatekeeperDecision | "UNVERIFIED_BOT_READY";
  riskScore: number;
  piiExposedPct: number;
  reason: string;
  selectedProduct: Product;
  injectedProduct: Product | null;
  proposedCartTotal: number;
  signature?: string;
  approvalToken?: string;
  redactedContext: Record<string, string>;
  exposedPiiContext?: Record<string, string>;
  gatekeeperNotes: string[];
  auditEventId?: string;
  usedModel: string;
}

export interface CheckoutRequest {
  productId: string;
  amount: number;
  mode: AgentExecutionMode | "standard_bot" | "ghostpass";
  sessionId?: string;
  prompt?: string;
  ghostPassHeader?: string;
  humanOverrideToken?: string;
  isManualHumanCheckout?: boolean;
  agentContextPayload?: Record<string, string>;
  auditEventId?: string;
}

export interface PayPalSettleRequest {
  productId: string;
  productName?: string;
  amount: number;
  sessionId?: string;
  verificationHash?: string;
  ghostPassHeader?: string;
  humanOverrideToken?: string;
  auditEventId?: string;
  prompt?: string;
}

export interface PayPalSettleResult {
  paypalOrderId: string;
  paypalStatus: "CREATED" | "APPROVED" | "PAYER_ACTION_REQUIRED" | "COMPLETED" | "SIMULATED_SANDBOX";
  amount: number;
  currency: "USD";
  sandboxActivityUrl: string;
  approveUrl: string | null;
  liveSandbox: boolean;
  shippingRelay: string;
}

export interface CheckoutResponse {
  status:
    | "APPROVED_BY_MERCHANT"
    | "SETTLED_VIA_PAYPAL"
    | "BOT_SCRAPER_BLOCKED"
    | "HUMAN_ORDER_CONFIRMED";
  httpStatus: 200 | 403;
  verifiedMandate: boolean;
  captchaBypassed: boolean;
  verificationHash?: string;
  readyForPayPalCapture?: boolean;
  receiptToken?: string;
  paypalOrderId?: string | null;
  paypalStatus?: PayPalSettleResult["paypalStatus"];
  sandboxActivityUrl?: string | null;
  approveUrl?: string | null;
  liveSandbox?: boolean;
  piiExposedPct: number;
  error?: string;
  code?: string;
  message: string;
  auditEvent?: AuditTransaction;
}

export type AuditEvent = AuditTransaction;
