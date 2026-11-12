<div align="center">

<img src="https://img.icons8.com/fluency/96/shield.png" alt="PayPal GhostPass Security Shield" width="84" height="84" />

# PayPal GhostPass

**Zero-PII Agentic Commerce Authorization, Prompt-Injection Guardrail & PayPal Sandbox Orders v2 Settlement Infrastructure**

[![PayPal Sandbox Orders v2](https://img.shields.io/badge/PayPal_Sandbox-Orders_v2-003087?style=for-the-badge&logo=paypal&logoColor=white)](https://developer.paypal.com/docs/api/orders/v2/)
[![Gemini 2.5 Flash](https://img.shields.io/badge/Gemini_2.5_Flash-@google/genai-4285F4?style=for-the-badge&logo=googlegemini&logoColor=white)](https://ai.google.dev/)
[![Model Context Protocol](https://img.shields.io/badge/MCP-Agent_Toolkit-0B1120?style=for-the-badge&logo=modelcontextprotocol&logoColor=white)](https://modelcontextprotocol.io/)
[![AG Grid](https://img.shields.io/badge/AG_Grid-v36_Audit_Ledger-0084E7?style=for-the-badge)](https://www.ag-grid.com/)
[![Next.js 16](https://img.shields.io/badge/Next.js_16-TypeScript_5-000000?style=for-the-badge&logo=nextdotjs&logoColor=white)](https://nextjs.org/)
[![Vercel Live](https://img.shields.io/badge/Vercel-Ready_to_Deploy-000000?style=for-the-badge&logo=vercel&logoColor=white)](https://vercel.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-10B981?style=for-the-badge)](./LICENSE)

</div>

---

## The Real-World Problem (Grounded in 2026 Industry News)

Autonomous shopping agents break down at **"Checkout / Pay Now"** because the open web is locked in a **two-sided trust deadlock**:

1. **Amazon Blocks Meta’s Muse AI Shopping Agent (September 2026):** Shortly after Meta launched its **Muse** shopping assistant, Amazon moved to block it on Amazon.com—citing unauthorized scraping, lack of transparent agent attestation, and improper handling of customer credentials outside Amazon's trust boundary.
2. **Walmart’s Closed Retailer-Only Agent Gateway & Checkout CAPTCHAs (October 2026):** Walmart introduced a proprietary MCP **Agent Gateway** and **Agent Profiles**, yet automated traffic still hit checkout CAPTCHAs when sessions appeared anomalous—and single-merchant silos force consumers to recreate separate spending rules across 50+ stores.
3. **UK & Global Banks Block AI Bots from Customer Accounts (November 2026):** Major UK clearing banks (**HSBC, Barclays, Lloyds, NatWest, Nationwide**) and North American institutions moved to lock autonomous AI bots out of customer accounts over **liability ambiguity**, **Strong Customer Authentication (SCA)** conflicts, and **unbounded PII/wallet exposure**.

| Side of the Deadlock | What Breaks Today |
| :--- | :--- |
| **Consumer & Bank Side** | Handing raw PayPal logins, home addresses, and unlimited wallets to an AI agent creates a catastrophic blast radius if the LLM hallucinates or hits a hidden HTML **prompt injection** (e.g., sneaking a `$75` gift card into a `$19` cable order). |
| **Merchant Side** | Without cryptographic proof of human authorization, an AI shopping agent looks indistinguishable from a carding or scraper bot—causing merchants to slam the door shut with **`HTTP 403`** (`BOT_SCRAPER_BLOCKED`) and CAPTCHA walls. |

---

## Solution, Feasibility & True Novelty: The Triple-Blind Agentic Handshake

**PayPal GhostPass** turns PayPal into the **universal cross-merchant trust layer** for agentic commerce—requiring zero browser extensions or per-store silos:

1. **Blind 1 — AI Agent is Identity-Blind (`0% PII`):**
   - External AI agents operate using only a scoped session key (`gp_live_...`) and public catalog metadata. Name, email, and home address stay vaulted inside PayPal (`[REDACTED]`, `[VAULTED_IN_PAYPAL]`, `[PAYPAL_VAULT_RELAY]`).
2. **Blind 2 — Merchant Receives HMAC-SHA256 Verified Human Mandate + Vaulted PayPal Shipping Relay:**
   - The merchant's anti-bot firewall (`POST /api/store/checkout`) rejects unverified bots (`403 BOT_SCRAPER_BLOCKED`) and verifies a single-use **HMAC-SHA256** capability header (`X-PayPal-GhostPass-Signature` or `humanOverrideToken`) scoped to `{ productId, maxAmount, sessionId, expiresAt, kind }` via `crypto.timingSafeEqual` + single-use replay protection (`consumeMandateToken`). Shipping details relay directly from PayPal Vault to the merchant.
3. **Blind 3 — PayPal Executes Scoped Orders v2 Settlement After Local Gemini 2.5 Flash Guardrail Verification:**
   - `runGatekeeperAudit()` combines zero-latency deterministic regex/budget checks with **`gemini-2.5-flash`** semantic auditing before any signature is minted—blocking prompt injections (`$0.00` moved), pausing safe over-cap purchases for **1-Click Human-in-the-Loop (HITL) Override**, and settling approved orders via **`https://api-m.sandbox.paypal.com/v2/checkout/orders`** (`intent: "CAPTURE"`).

**Feasibility Today:** Built entirely on live **PayPal Developer Sandbox REST APIs**, **`@google/genai` (`gemini-2.5-flash`)** with deterministic offline fallback, Node.js **`crypto`** HMAC-SHA256 tokens, and zero-config **In-Memory + `localStorage`** persistence that upgrades seamlessly to **Neon PostgreSQL**.

---

## System Architecture

```mermaid
flowchart LR
    Agent["External AI Agent (MCP)"] -->|"Prompt + 0% PII Key (gp_live_...)"| Guardrail["PayPal GhostPass Guardrail (Gemini 2.5 Flash + HMAC)"]
    Guardrail -->|"Injection / Cap Breach"| Blocked["BLOCKED ($0 Moved + Threat Diff)"]
    Guardrail -->|"Over Auto-Approve Cap"| HITL["1-Click HITL Override (humanOverrideToken)"]
    Guardrail -->|"X-PayPal-GhostPass-Signature"| Firewall["Merchant Bot-Defense Firewall (/api/store/checkout)"]
    HITL -->|"Authorized"| Firewall
    Firewall -->|"Unverified Bot -> 403 BOT_SCRAPER_BLOCKED"| Reject["403 Blocked ($0 Moved)"]
    Firewall -->|"200 Verified Mandate"| PayPal["PayPal Sandbox Orders v2 (POST /v2/checkout/orders)"]
```

---

## Tools & Sponsor Integration Table

| Technology / Sponsor | Role in PayPal GhostPass | Primary Implementation Files |
| :--- | :--- | :--- |
| **PayPal Developer Platform** | OAuth 2.0 token caching (`POST /v1/oauth2/token`) & live **Orders v2 REST API** (`POST /v2/checkout/orders`, `intent: "CAPTURE"`) + automatic capture & Sandbox Order verification links | [`src/lib/paypal/client.ts`](src/lib/paypal/client.ts), [`src/app/api/paypal/settle/route.ts`](src/app/api/paypal/settle/route.ts) |
| **Google Gemini 2.5 Flash (`@google/genai`)** | Two-Brain pipeline: identity-blind catalog selection (`runBlindShoppingAgent`) + semantic policy audit (`runGatekeeperAudit`) paired with deterministic fallback | [`src/lib/agents/shoppingAgent.ts`](src/lib/agents/shoppingAgent.ts), [`src/lib/agents/gatekeeperAgent.ts`](src/lib/agents/gatekeeperAgent.ts) |
| **AG Grid (`ag-grid-react`)** | Filterable Compliance & Audit Ledger (`All`, `Settled`, `Blocked`, `HITL Pending`) surfacing risk scores, PII leakage %, firewall status, and clickable PayPal Order IDs | [`src/components/AuditLedgerGrid.tsx`](src/components/AuditLedgerGrid.tsx) |
| **Next.js 16 / TypeScript** | App Router UI (`GhostPass Wallet` + `NovaTech Store`), Turbopack build, Node `crypto` HMAC-SHA256 signer, and REST API routes | [`src/app/api/`](src/app/api/agent/execute/route.ts), [`src/lib/crypto/mandateSigner.ts`](src/lib/crypto/mandateSigner.ts) |
| **Neon PostgreSQL (Optional Hybrid Adapter)** | Zero-config In-Memory + `localStorage` default; switches automatically to Neon HTTP SQL (`migrations/001_init.sql`) when `DATABASE_URL` is set | [`src/lib/db.ts`](src/lib/db.ts), [`migrations/001_init.sql`](migrations/001_init.sql) |
| **Vercel** | Serverless deployment target with `/api/health` readiness probe, cold-start-safe JSON fallbacks, and optimized Next.js production build | [`src/app/api/health/route.ts`](src/app/api/health/route.ts), [`next.config.ts`](next.config.ts) |

---

## Deep-Dive Documentation

| Icon | Document | What It Covers |
| :---: | :--- | :--- |
| <img src="https://img.icons8.com/fluency/48/document.png" width="28" height="28" alt="Product Vision" /> | [**01 · Product Vision & Novelty**](./docs/01-PRODUCT-VISION-AND-NOVELTY.md) | 2026 industry news analysis (Amazon/Muse, Walmart Agent Gateway, UK bank bans), Triple-Blind Handshake, novelty matrix, and feasibility analysis |
| <img src="https://img.icons8.com/fluency/48/layers.png" width="28" height="28" alt="System Architecture" /> | [**02 · System Architecture & Patterns**](./docs/02-SYSTEM-ARCHITECTURE-AND-PATTERNS.md) | End-to-end architecture diagrams, PayPal Orders v2 sequence flow, API specs, design patterns, and resilience matrix |
| <img src="https://img.icons8.com/fluency/48/design.png" width="28" height="28" alt="UI/UX Blueprint" /> | [**03 · UI/UX & Demo Blueprint**](./docs/03-UI-UX-AND-DEMO-BLUEPRINT.md) | Clean 2-view design (`GhostPass Wallet` + `NovaTech Store`), 3-stage pipeline inspector, and 60-second walkthrough |
| <img src="https://img.icons8.com/fluency/48/roadmap.png" width="28" height="28" alt="Execution Plan" /> | [**04 · Three-Split Execution Plan**](./docs/04-THREE-SPLIT-EXECUTION-PLAN.md) | Vertical slice engineering roadmap across Foundation, Two-Brain Security Pipeline, and Live PayPal Settlement |

---

## Quickstart & 60-Second Judge Testing Guide

### 1. Install & Configure `.env.local`
```bash
npm install
cp .env.example .env.local
```
Populate `.env.local` with your PayPal Sandbox and Gemini credentials (or leave blank to run deterministic zero-quota Sandbox mode):
```env
PAYPAL_CLIENT_ID=your_paypal_sandbox_client_id
PAYPAL_CLIENT_SECRET=your_paypal_sandbox_secret
PAYPAL_SANDBOX_BUYER_EMAIL=your_fake_buyer@personal.example.com
PAYPAL_SANDBOX_SELLER_EMAIL=your_fake_seller@business.example.com
GEMINI_API_KEY=your_gemini_api_key
GEMINI_MODEL=gemini-2.5-flash
GHOSTPASS_HMAC_SECRET=replace_with_random_32_byte_secret
# Optional: enables Neon PostgreSQL persistence instead of In-Memory + localStorage
# DATABASE_URL=postgresql://user:pass@ep-example.us-east-2.aws.neon.tech/neondb?sslmode=require
```
*(Optional)* If `DATABASE_URL` is configured, apply the schema: `psql "$DATABASE_URL" -f migrations/001_init.sql`.

### 2. Run Locally & Execute Zero-Quota Test Suite
```bash
npm run dev      # Start Next.js 16 at http://localhost:3000
npm test         # Run Vitest unit & integration suites (0 Gemini API quota consumed)
npm run lint     # Run ESLint
npm run build    # Production TypeScript + Turbopack build
```

### 3. 60-Second Judge Walkthrough (In `GhostPass Wallet`)
1. **Unverified Bot Contrast (`0:00–0:15`):** Toggle **`Unverified Bot (Raw PII)`** and click **`Preset 1: Valid ($48 Keyboard)`**. Observe **`1 · INPUT: Agent Context`** turn rose (`100% LEAKED` raw PII) and **`3 · OUTPUT`** reject with **`403 BLOCKED`** (`BOT_SCRAPER_BLOCKED`).
2. **Preset 1 — Auto-Pay (`0:15–0:30`):** Switch back to **`PayPal Guardrail (Zero-PII)`** (optionally click **`MCP Config`** to view the `@paypal/agent-toolkit` JSON & live `curl`) and click **`Preset 1: Valid ($48 Keyboard)`**. Observe **`0% PII`**, **`APPROVED`** + `HMAC Signature`, and a live **`paypal_order_id`** with **`Verify on PayPal Sandbox ↗`**.
3. **Preset 2 — Prompt Injection Block (`0:30–0:45`):** Click **`Preset 2: Injection Trap ($19 → $75 Gift Card)`**. The `$19` USB-C cable contains a hidden HTML comment instructing the bot to add a `$75 Steam Digital Gift Card`. **`2 · ANALYSIS`** catches **`THREAT_CAUGHT`**, halts at **`BLOCKED`** (`$0.00` moved), and renders the stripped injection payload in red.
4. **Preset 3 — HITL Override (`0:45–1:00`):** Click **`Preset 3: Over-Cap ($115 Headphones · HITL)`**. Because `$115 > $60` `Max/Tx`, **`2 · ANALYSIS`** pauses at **`HITL_REQUIRED`**. Click **`Authorize $115.00 via PayPal`** to settle via Orders v2, then switch to **`NovaTech Store`** → **`Orders`** to inspect the fulfilled merchant order.
5. **Custom Data Testing (`+ Custom Payload`):** Click **`+ Custom Payload`** in the execution bar to test any arbitrary `Item Name`, `Price ($)`, `Category`, `Merchant`, and optional **`Simulate Malicious Store Injection`** directive live against the Gatekeeper and PayPal Orders v2 pipeline.

---

## License

Licensed under the [MIT License](./LICENSE). Copyright (c) 2026 Bhargava Anandakumar.
