# PayPal GhostPass

> **Agentic Commerce Authorization & Settlement Infrastructure (PaaS / MCP Payment Gateway)**
> Built for the PayPal AI Hackathon · Next.js 16 + Gemini 2.5 Flash + PayPal Sandbox Orders v2 + HMAC-SHA256 + AG Grid + Hybrid Neon/Memory Storage

---

## What It Solves

AI shopping agents break down at **"Checkout / Pay Now"** because of a two-sided trust failure:
1. **Users lose privacy & control** if they hand raw PayPal credentials, home addresses, and unlimited wallets to a bot vulnerable to hallucinations or hidden webpage **prompt injections**.
2. **Online stores block AI bots** (`403 Forbidden` / CAPTCHAs) because unverified scrapers look identical to fraudsters and carry zero proof of human authorization.

**PayPal GhostPass** solves both sides as a clean **Developer & User Control Plane + Settlement Gateway**:
- **Zero-PII Agent Key (`gp_live_...`):** Your name, email, home address, and PayPal password remain locked in your PayPal Vault. The AI agent receives **0% PII**.
- **Gatekeeper Airlock:** Deterministic math/regex rules + Gemini 2.5 Flash audit every proposed cart and extracted HTML metadata before a single cent moves—blocking prompt-injection gift card hijacks (`$0` moved) and pausing safe over-budget purchases for a **1-click Human Override**.
- **PayPal Sandbox Orders v2 Settlement:** Approved checkouts mint a single-use **HMAC-SHA256 `X-PayPal-GhostPass-Signature`**, clear the merchant's anti-bot firewall (`200 OK`), and settle directly via **`https://api-m.sandbox.paypal.com/v2/checkout/orders`** (`intent: "CAPTURE"`), returning a verifiable PayPal Sandbox Order ID.

```mermaid
flowchart LR
    CP["GhostPass Control Plane (Mandate + Zero-PII Key)"] -->|"POST /api/agent/execute"| Shop["Blind Shopping Agent (Gemini 2.5 Flash)"]
    Shop -->|"Proposed Cart + hiddenHtmlMetadata"| Gate["Gatekeeper Airlock (Deterministic + Gemini)"]
    Gate -->|"Injection / Cap Breach"| Block["BLOCK ($0 Moved)"]
    Gate -->|"Over Auto-Approve Cap"| Tap["1-Click Human Override"]
    Gate -->|"HMAC-SHA256 Signature"| Store["NovaTech Firewall (/api/store/checkout)"]
    Store -->|"OAuth2 + Orders v2"| PayPal["PayPal Sandbox (Order ID)"]
```

---

## 2-View Product Architecture

1. **GhostPass Control Plane (Default View):**
   - **Left Column:** PayPal Vault & Spending Mandate editor, daily spend meter, copyable Zero-PII session key, and **Live Agent Sandbox Runner** (with `Unverified AI Bot` vs. `PayPal GhostPass` mode toggle, 3 quick-test scenarios, and copyable `cURL` / MCP JSON snippet).
   - **Right Column:** Plain-English 4-step live pipeline (**Privacy Shield**, **Scam & Rule Check**, **Store Checkout Gate**, **PayPal Sandbox Settlement** with `Verify in PayPal Sandbox ↗` and 1-Click Approve/Reject).
   - **Bottom Panel:** KPI summary cards + filterable `ag-grid-react` Compliance & Audit Ledger.
2. **NovaTech Storefront (Tab 2):**
   - 100% unobstructed consumer electronics & technical book e-commerce store with real `4:3` Unsplash photography, `Add to Cart`, manual `Buy Now` checkout, and **`Orders`** fulfillment popover displaying settled agent orders with PayPal Order IDs.

---

## Documentation (`docs/`)

- [01-PRODUCT-VISION-AND-NOVELTY.md](docs/01-PRODUCT-VISION-AND-NOVELTY.md) — Problem statement, Double-Blind handshake, and novelty comparison
- [02-SYSTEM-ARCHITECTURE-AND-PATTERNS.md](docs/02-SYSTEM-ARCHITECTURE-AND-PATTERNS.md) — Architecture Reference Document (ARD), Mermaid diagrams, and IPO specs
- [03-UI-UX-AND-DEMO-BLUEPRINT.md](docs/03-UI-UX-AND-DEMO-BLUEPRINT.md) — Control Plane & Storefront UI blueprint + 90-second demo script
- [04-THREE-SPLIT-EXECUTION-PLAN.md](docs/04-THREE-SPLIT-EXECUTION-PLAN.md) — Split 1, Split 2, and Split 3 roadmap

---

## Local Setup & Commands

### 1. Configure `.env.local`
Copy `.env.example` to `.env.local`:
```bash
PAYPAL_CLIENT_ID=your_paypal_sandbox_client_id
PAYPAL_CLIENT_SECRET=your_paypal_sandbox_secret
PAYPAL_SANDBOX_BUYER_EMAIL=your_fake_buyer@personal.example.com
PAYPAL_SANDBOX_SELLER_EMAIL=your_fake_seller@business.example.com
GEMINI_API_KEY=your_gemini_api_key
GEMINI_MODEL=gemini-2.5-flash
GHOSTPASS_HMAC_SECRET=replace_with_random_32_byte_secret
# Optional: enables Neon PostgreSQL persistence instead of In-Memory + localStorage
# DATABASE_URL=postgresql://user:pass@ep-xxx.aws.neon.tech/neondb?sslmode=require
```

### 2. Optional Neon PostgreSQL Migration
If `DATABASE_URL` is configured, apply `migrations/001_init.sql`:
```bash
psql "$DATABASE_URL" -f migrations/001_init.sql
```

### 3. Run & Verify
```bash
npm install
npm run dev      # Start Next.js 16 at http://localhost:3000
npm test         # Run all Vitest unit & integration suites (0 Gemini API quota used)
npm run lint     # Run ESLint
npm run build    # Production TypeScript + Turbopack build
```

---

## Deploy on Render

This repository includes a production-ready [`render.yaml`](render.yaml) Blueprint:
1. Push your fork/repo to GitHub and create a **New Blueprint** (or **Web Service**) on [Render](https://render.com).
2. Render automatically detects `render.yaml` (`runtime: node`, `buildCommand: npm install && npm run build`, `startCommand: npm start`, `healthCheckPath: /api/state`).
3. Set the secret environment variables in the Render Dashboard:
   - `GEMINI_API_KEY`
   - `PAYPAL_CLIENT_ID`
   - `PAYPAL_CLIENT_SECRET`
   - `PAYPAL_SANDBOX_BUYER_EMAIL`
   - `PAYPAL_SANDBOX_SELLER_EMAIL`
   - `DATABASE_URL` (optional; leave unset for zero-config In-Memory + `localStorage` mode)
   - `GHOSTPASS_HMAC_SECRET` (auto-generated by `render.yaml`)

---

## License

Licensed under the [MIT License](LICENSE).
