# PayPal GhostPass — System Architecture & Software Design Patterns (ARD)

> Technical Architecture Reference Document (ARD): Clean 2-View Infrastructure App (Control Plane + Live Merchant Storefront), Two-Brain Gemini 2.5 Flash pipeline, HMAC-SHA256 mandate attestation, and live PayPal Sandbox Orders v2 settlement.

---

## 1. Real-World Infrastructure Architecture

**PayPal GhostPass** is structured as a real **Agentic Payment Infrastructure Control Plane** alongside an independent **NovaTech Demo Merchant Storefront**, connected via standardized REST APIs:

1. **App Shell & View Switcher (`src/components/AppShellHeader.tsx`)**
   - Brand: **PayPal GhostPass** (`Agentic Commerce Authorization & Settlement Infrastructure`) + live `PayPal Sandbox Connected` status badge.
   - Clean 2-View Switcher: **`GhostPass Control Plane`** ⟷ **`NovaTech Storefront`**.
2. **View 1 — PayPal GhostPass Control Plane (`src/components/ControlPlaneView.tsx` + `AuditLedgerGrid.tsx`)**
   - **Left Column:** PayPal Vault & Spending Mandate editor (connected Sandbox buyer, plain-English rule, auto-approve cap, daily budget progress bar, copyable Zero-PII session key `gp_live_...`) + **Live Agent Sandbox Runner** (mode toggle, prompt input, 3 quick-test scenarios, copyable `curl`/MCP JSON payload).
   - **Right Column:** Plain-English 4-Step Live Execution Pipeline (**1. Privacy Shield**, **2. Scam & Rule Check**, **3. Store Checkout Gate**, **4. PayPal Sandbox Settlement** with 1-Click Human Approve/Reject and `Verify in PayPal Sandbox ↗`).
   - **Bottom Panel:** KPI summary cards + filterable `ag-grid-react` Compliance & Audit Ledger.
3. **View 2 — Independent Merchant Storefront (`NovaTech` — `StoreNavbar.tsx`, `ProductGrid.tsx`, `StoreCheckoutModal.tsx`)**
   - 100% pure consumer e-commerce store (zero floating popups, zero AI/Mandate branding).
   - Features **NovaTech Order Fulfillment (`Orders`)** showing agent-placed PayPal orders arriving live with their PayPal Sandbox Order IDs and Direct Shipping Relay confirmation.
4. **Server Pipeline (`shoppingAgent.ts`, `gatekeeperAgent.ts`, `mandateSigner.ts`, `paypal/client.ts`, `db.ts`)**
   - **Stage 1 (`src/lib/agents/shoppingAgent.ts`):** Blind `gemini-2.5-flash` catalog selection (`0% PII`) + `hiddenHtmlMetadata` extraction.
   - **Stage 2 (`src/lib/agents/gatekeeperAgent.ts`):** Deterministic math/regex security checks + `gemini-2.5-flash` semantic audit → `BLOCK`, `REQUIRE_HUMAN` (`approvalToken`), or `AUTO_APPROVE` (`X-PayPal-GhostPass-Signature`).
   - **Stage 3 (`POST /api/store/checkout`):** Merchant anti-bot firewall rejecting unverified bots (`HTTP 403 BOT_SCRAPER_BLOCKED`) and verifying HMAC-SHA256 signatures before settling via PayPal.
   - **Stage 4 (`src/lib/paypal/client.ts` & `POST /api/paypal/settle`):** Exchanges `PAYPAL_CLIENT_ID` + `PAYPAL_CLIENT_SECRET` for a cached OAuth2 bearer token at `https://api-m.sandbox.paypal.com/v1/oauth2/token`, creates/captures a PayPal Sandbox order via `POST /v2/checkout/orders`, and persists the `paypalOrderId` in `src/lib/db.ts`.

```mermaid
flowchart TD
    subgraph ControlPlane["View 1: PayPal GhostPass Control Plane (Infrastructure Console)"]
        Vault["Mandate Vault + Zero-PII Key (gp_live_...)"] --> Runner["Live Agent Sandbox Runner + cURL/MCP Export"]
        Runner -->|"POST /api/agent/execute"| Exec["/api/agent/execute"]
        Pipe["4-Step Plain-English Pipeline"] --> Grid["AG Grid Compliance & Audit Ledger"]
    end

    subgraph TwoBrain["Two-Brain Engine + Crypto Airlock"]
        Exec -->|"Stage 1 (0% PII)"| Shop["shoppingAgent.ts (Gemini 2.5 Flash)"]
        Shop -->|"Cart + hiddenHtmlMetadata"| Gate["gatekeeperAgent.ts (Deterministic + Gemini Audit)"]
        Gate -->|"Injection / Cap / Gift Card"| Block["BLOCK (Risk 85-98, $0 Moved)"]
        Gate -->|"Over Auto-Approve Cap"| Human["REQUIRE_HUMAN (Signed approvalToken)"]
        Gate -->|"Safe & In-Budget"| Sign["mandateSigner.ts (HMAC-SHA256 Signature)"]
        Exec -->|"STANDARD_BOT"| BotPII["100% Raw PII Attached"]
    end

    subgraph MerchantAndPayPal["View 2: NovaTech Merchant Store + PayPal Sandbox Orders v2"]
        BotPII -->|"No Signature"| Firewall["POST /api/store/checkout"]
        Sign -->|"X-PayPal-GhostPass-Signature"| Firewall
        Human -->|"1-Click Approve -> humanOverrideToken"| Firewall
        Firewall -->|"403 Forbidden"| Err403["BOT_SCRAPER_BLOCKED"]
        Firewall -->|"200 Verified Mandate"| PayPal["src/lib/paypal/client.ts (OAuth2 + Orders v2)"]
        PayPal -->|"PayPal Sandbox Order ID"| Orders["NovaTech Merchant Order Fulfillment"]
    end

    Block --> DB["src/lib/db.ts (/api/state + Neon/Memory)"]
    Err403 --> DB
    PayPal --> DB
    DB --> Pipe
    DB --> Grid
```

---

## 2. End-to-End Sequence Diagram (Including PayPal Sandbox Orders v2)

```mermaid
sequenceDiagram
    actor User as Developer / Shopper
    participant CP as GhostPass Control Plane
    participant Exec as POST /api/agent/execute
    participant Gate as gatekeeperAgent + mandateSigner
    participant Store as POST /api/store/checkout
    participant PP as PayPal Sandbox (api-m.sandbox.paypal.com)
    participant DB as db.ts (/api/state)

    User->>CP: Sets Mandate ("Max $60") & Runs Prompt
    CP->>Exec: POST { prompt, mode, mandate }

    alt mode == STANDARD_BOT
        Exec-->>CP: UNVERIFIED_BOT_READY (100% PII exposed)
        CP->>Store: POST { productId, amount, mode: "STANDARD_BOT" }
        Store->>DB: Log 403_REJECTED
        Store-->>CP: 403 Forbidden (BOT_SCRAPER_BLOCKED)
    else mode == GHOSTPASS
        Exec->>Gate: Blind shoppingAgent (0% PII) -> gatekeeperAgent
        alt BLOCK (Prompt Injection / Gift Card / Daily Cap)
            Gate-->>Exec: BLOCK (Risk 88-98)
            Exec->>DB: Log BLOCKED ($0 moved)
            Exec-->>CP: 200 { decision: "BLOCK" }
        else REQUIRE_HUMAN ($115 > $60 Auto-Approve)
            Gate-->>Exec: REQUIRE_HUMAN + signed approvalToken
            Exec->>DB: Log NEEDS_APPROVAL
            Exec-->>CP: 200 { decision: "REQUIRE_HUMAN", approvalToken }
            User->>CP: Clicks "Approve $115 & Pay via PayPal"
            CP->>Store: POST { humanOverrideToken, auditEventId }
            Store->>PP: OAuth2 Token + POST /v2/checkout/orders
            PP-->>Store: 201 Created (PayPal Order ID)
            Store->>DB: Update audit row -> APPROVED + paypalOrderId
            Store-->>CP: 200 APPROVED_BY_MERCHANT + PayPal Order ID
        else AUTO_APPROVE ($48 <= $60)
            Gate-->>Exec: AUTO_APPROVE + HMAC-SHA256 signature
            Exec-->>CP: 200 { decision: "AUTO_APPROVE", signature }
            CP->>Store: POST with X-PayPal-GhostPass-Signature
            Store->>PP: OAuth2 Token + POST /v2/checkout/orders
            PP-->>Store: 201 Created (PayPal Order ID)
            Store->>DB: Log APPROVED + paypalOrderId + dailySpent
            Store-->>CP: 200 APPROVED_BY_MERCHANT + PayPal Order ID
        end
    end
```

---

## 3. Software Design Patterns Used

1. **Mediator / Airlock Pattern (`gatekeeperAgent.ts`):** Separates untrusted catalog/HTML reading (`shoppingAgent.ts`) from cryptographic authorization (`mandateSigner.ts`) and financial settlement (`paypal/client.ts`).
2. **Cryptographic Capability Token Pattern (`mandateSigner.ts`):** Single-use HMAC-SHA256 tokens (`X-PayPal-GhostPass-Signature` & `humanOverrideToken`) bound to `{ productId, maxAmount, sessionId, expiresAt, kind }` verified with `timingSafeEqual`.
3. **Token-Cached Gateway Client Pattern (`src/lib/paypal/client.ts`):** Caches PayPal Sandbox OAuth2 access tokens in memory with a 60-second safety buffer, retries Orders v2 cleanly if sandbox account metadata mismatches (`422`), and captures `APPROVED` orders automatically.
4. **Strategy / Adapter Pattern (`src/lib/db.ts` + `src/lib/clientStorage.ts`):** Zero-config In-Memory + `localStorage` by default; seamless **Neon PostgreSQL** HTTP SQL persistence when `DATABASE_URL` is configured.
