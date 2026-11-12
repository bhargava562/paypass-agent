<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

<!-- BEGIN:nextjs-agent-feedback -->

## Report Next.js feedback

The project owner enabled `experimental.agentFeedback`, authorizing this feedback pass. When enabled, `next dev` writes this block and restores it if removed. Commit `AGENTS.md` with your work to keep the tree clean.

During the current user request, retain anonymized facts as feedback candidates for meaningful or recurring Next.js issues:

- Crashes, hangs, OOMs, or unexpected slowness
- Incorrect behavior, output, errors, or diagnostics
- Missing, unclear, or conflicting documentation
- Unexpected CLI, codemod, Skill, or upgrade behavior and non-obvious workarounds

Continue the current user request without reporting immediately. Routine debugging is not feedback. Verify changes before retaining them as feedback candidates. Never retain code, logs, paths, URLs, secrets, personal information, or project-specific data.

Retain qualifying friction even if it is later fixed or worked around; record the final outcome during the reporting pass.

Before the final response, run one reporting pass. If candidates remain, from this file's directory run `npx --no-install next internal agent-feedback-instructions` once without piping or truncating its output. Follow its output or error guidance. If a network sandbox blocks it, retry with network access; if it still returns no output, continue normally.

<!-- END:nextjs-agent-feedback -->

---

## PayPal GhostPass — Repository Architecture & Engineering Rules

### 1. Clean 2-View Infrastructure Architecture (Control Plane + Storefront)
- **Shell Navigation (`src/components/AppShellHeader.tsx`):** Clean 2-View switcher between **`GhostPass Control Plane`** (`ControlPlaneView.tsx` + `AuditLedgerGrid.tsx`) and **`NovaTech Storefront`** (`StoreNavbar.tsx` + `ProductGrid.tsx` + `StoreCheckoutModal.tsx`).
- **Storefront Purity:** Never add floating popups, fake browser chrome bars, AI buttons, or GhostPass badges onto NovaTech's product cards or merchandising hero. Merchant order fulfillment appears cleanly inside NovaTech's **`Orders`** popover.
- **Merchant Anti-Bot Firewall (`src/app/api/store/checkout/route.ts`):** Rejects unverified scrapers (`STANDARD_BOT` or missing/invalid `X-PayPal-GhostPass-Signature`) with `HTTP 403` (`BOT_SCRAPER_BLOCKED`).

### 2. Two-Brain AI, Cryptography & PayPal Sandbox Pipeline
- **Blind Shopping Agent** (`src/lib/agents/shoppingAgent.ts`): Never accepts user PII or PayPal credentials. Uses `@google/genai` (`gemini-2.5-flash` or `GEMINI_MODEL`) with deterministic fallback.
- **Gatekeeper Auditor** (`src/lib/agents/gatekeeperAgent.ts`): Deterministic math/regex checks first (zero LLM quota burn on injections/caps), then `gemini-2.5-flash` semantic audit.
- **HMAC-SHA256 Signer** (`src/lib/crypto/mandateSigner.ts`): Signs & verifies `X-PayPal-GhostPass-Signature` and `humanOverrideToken` scoped to `{ productId, maxAmount, sessionId, expiresAt }`.
- **PayPal Sandbox Orders v2** (`src/lib/paypal/client.ts` & `src/app/api/paypal/settle/route.ts`): Caches OAuth2 token from `api-m.sandbox.paypal.com/v1/oauth2/token` and creates/captures `/v2/checkout/orders` (`intent: "CAPTURE"`).

### 3. Hybrid Storage & Schema Sync
- **Server Persistence** (`src/lib/db.ts`): Server-only adapter supporting In-Memory by default and Neon PostgreSQL HTTP SQL when `DATABASE_URL` is configured. Never import `src/lib/db.ts` into `"use client"` components; use `/api/state` and `src/lib/clientStorage.ts` instead.
- **SQL Migration** (`migrations/001_init.sql`): Keep table columns, `CHECK` constraints, and default `allowed_categories` strictly synchronized with `src/data/catalog.ts` and `src/lib/db.ts`.

### 4. Testing, Quota Conservation & Git Workflow
- **Zero-Quota Testing:** All Vitest suites (`npm test` / `npx vitest run`) MUST mock `@google/genai`, `fetch` (for PayPal/Neon), or pass `skipLlm: true` so test runs never consume live Gemini API quota.
- **Windows Rollup WASM Override:** `package.json` pins `rollup` to `@rollup/wasm-node` so Vitest runs cleanly under Windows Application Control policies.
- **Verification & Git Push:** Always run `npm test`, `npm run lint`, and `npm run build` after edits, and commit + push to `origin main` after every completed milestone.
