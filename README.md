# PayPal GhostPass

> **The Blindfolded VIP Checkout Pass for the Agentic Web**
> Built for the PayPal AI Hackathon · Next.js 16 + Gemini 2.5 Flash + HMAC-SHA256 + AG Grid + Hybrid Neon/Memory Storage

---

## What It Solves

AI shopping agents break down at **"Checkout / Pay Now"** because of a two-sided trust failure:
1. **Users lose privacy & control** if they hand raw PayPal credentials, home addresses, and unlimited wallets to a bot vulnerable to hallucinations or hidden webpage **prompt injections**.
2. **Online stores block AI bots** (`403 Forbidden` / CAPTCHAs) because unverified scrapers look identical to fraudsters and carry zero proof of human authorization.

**PayPal GhostPass** fixes both sides with a **Double-Blind Agentic Handshake**:
- The **AI Shopping Agent** shops blindfolded (**0% PII** in its context window).
- An independent **Gatekeeper Airlock** audits the cart and raw merchant HTML metadata against your plain-English **Universal Mandate**, blocking prompt injections (`$0` moved) and pausing over-budget purchases for a **1-click Human Override**.
- Approved checkouts receive a single-use **HMAC-SHA256 `X-PayPal-GhostPass-Signature`** scoped to exact `{ productId, maxAmount, sessionId, expiresAt }` that clears the merchant's anti-bot firewall while PayPal relays your vaulted shipping address directly to the store.

```mermaid
flowchart LR
    Ext["External Browser Extension (Mandate + 0% PII)"] -->|"POST /api/agent/execute"| Shop["Blind Shopping Agent (Gemini 2.5 Flash)"]
    Shop -->|"Proposed Cart + hiddenHtmlMetadata"| Gate["Gatekeeper Airlock (Deterministic + Gemini)"]
    Gate -->|"Injection / Cap Breach"| Block["BLOCK ($0 Moved)"]
    Gate -->|"Over Auto-Approve Cap"| Tap["1-Click Human Override"]
    Gate -->|"Verified Mandate"| Sign["HMAC-SHA256 Signature"]
    Sign -->|"POST /api/store/checkout"| Store["NovaTech Anti-Bot Firewall (200 OK vs 403)"]
```

---

## Key Architecture & Files

| Layer | Files | Responsibility |
| :--- | :--- | :--- |
| **Browser Frame & X-Ray TV** | `src/components/BrowserChromeBar.tsx`, `PullDownTV.tsx`, `AuditLedgerGrid.tsx` | Top browser bar (`demo-browser://novatech.store`), 3 Live Security Cameras, and `ag-grid-react` Audit Ledger |
| **Pure Merchant Storefront** | `src/components/StoreNavbar.tsx`, `ProductGrid.tsx`, `StoreCheckoutModal.tsx`, `src/data/catalog.ts` | Authentic NovaTech electronics & book store with zero AI/GhostPass leaks + `hiddenHtmlMetadata` injection trap |
| **External Browser Extension** | `src/components/AgentExtensionWidget.tsx` | Floating bottom-right companion hosting Mandate settings, `Standard AI Bot` vs. `PayPal GhostPass` toggle, and 3 demo scenarios |
| **Two-Brain Pipeline & Crypto** | `src/lib/agents/shoppingAgent.ts`, `gatekeeperAgent.ts`, `src/lib/crypto/mandateSigner.ts` | Blind Gemini 2.5 Flash catalog selection, deterministic + LLM security audit, and HMAC-SHA256 signature verification |
| **Next.js API Routes** | `src/app/api/agent/execute/route.ts`, `src/app/api/store/checkout/route.ts`, `src/app/api/state/route.ts` | Server orchestration, 403 vs. 200 merchant firewall, and persistence API |
| **Hybrid Storage & SQL** | `src/lib/db.ts`, `src/lib/clientStorage.ts`, `migrations/001_init.sql` | Zero-config In-Memory + `localStorage` default; automatic Neon PostgreSQL HTTP SQL mode when `DATABASE_URL` is set |

---

## Documentation (`docs/`)

- [01-PRODUCT-VISION-AND-NOVELTY.md](docs/01-PRODUCT-VISION-AND-NOVELTY.md) — Problem statement, Double-Blind handshake, and novelty comparison
- [02-SYSTEM-ARCHITECTURE-AND-PATTERNS.md](docs/02-SYSTEM-ARCHITECTURE-AND-PATTERNS.md) — Architecture Reference Document (ARD), Mermaid diagrams, patterns, and IPO specs
- [03-UI-UX-AND-DEMO-BLUEPRINT.md](docs/03-UI-UX-AND-DEMO-BLUEPRINT.md) — Storefront vs. External Extension UI blueprint
- [04-THREE-SPLIT-EXECUTION-PLAN.md](docs/04-THREE-SPLIT-EXECUTION-PLAN.md) — Split 1, Split 2, and Split 3 roadmap

---

## Getting Started

### 1. Configure Environment
Copy `.env.example` to `.env.local` and configure:
```bash
GEMINI_API_KEY=your_gemini_api_key
GEMINI_MODEL=gemini-2.5-flash
GHOSTPASS_HMAC_SECRET=your_random_hmac_secret
# Optional: enables Neon PostgreSQL persistence instead of In-Memory + localStorage
# DATABASE_URL=postgresql://user:pass@ep-xxx.aws.neon.tech/neondb?sslmode=require
```

### 2. Optional Neon PostgreSQL Setup
If `DATABASE_URL` is set, apply `migrations/001_init.sql` to create `mandates` and `audit_transactions` tables and seed the default mandate row:
```bash
psql "$DATABASE_URL" -f migrations/001_init.sql
```

### 3. Run Development Server & Quality Checks
```bash
npm run dev      # Start Next.js 16 dev server at http://localhost:3000
npm test         # Run Vitest unit + integration tests (0 Gemini API quota used)
npm run lint     # Run ESLint
npm run build    # Production TypeScript + Turbopack build
```

---

## Demo Scenarios (Bottom-Right Extension Widget)

1. **Standard AI Bot (`$48` Keyboard):** Bot attaches raw PII and hits `/api/store/checkout` without a GhostPass signature → **HTTP 403 `BOT_SCRAPER_BLOCKED`** (TV Cameras 1 & 2 flash Red).
2. **GhostPass Safe Buy (`$48` Keyboard):** `0% PII`, Gatekeeper approves & signs `X-PayPal-GhostPass-Signature` → **HTTP 200 `APPROVED_BY_MERCHANT`** (All 3 Cameras Green).
3. **Prompt Injection Trap (`$19` Anker USB-C Cable):** Hidden HTML comment attempts to add a `$75` Steam Digital Gift Card → **Gatekeeper `BLOCK` (`Risk 98/100`, `$0` moved)**.
4. **Over-Budget Escalation (`$115` Sony WH-1000XM5):** Clean audio item exceeds `$60` cap → **`REQUIRE_HUMAN`** pauses for a **1-Click Approve / Reject Override**.
