-- PayPal GhostPass — PostgreSQL Schema Migration (Neon Compatible)
-- Run when DATABASE_URL is configured; otherwise src/lib/db.ts uses zero-config In-Memory + localStorage.

CREATE TABLE IF NOT EXISTS mandates (
  id TEXT PRIMARY KEY,
  rule_text TEXT NOT NULL,
  max_per_transaction NUMERIC(10, 2) NOT NULL DEFAULT 60.00,
  daily_limit NUMERIC(10, 2) NOT NULL DEFAULT 150.00,
  daily_spent NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  block_gift_cards BOOLEAN NOT NULL DEFAULT TRUE,
  block_subscriptions BOOLEAN NOT NULL DEFAULT TRUE,
  allowed_categories JSONB NOT NULL DEFAULT '["Dev Gear", "Books", "Audio", "Accessories"]'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_transactions (
  id TEXT PRIMARY KEY,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  mode TEXT NOT NULL CHECK (mode IN ('standard_bot', 'ghostpass')),
  prompt TEXT NOT NULL,
  requested_product_id TEXT,
  requested_product_name TEXT NOT NULL,
  cart_items JSONB NOT NULL DEFAULT '[]'::jsonb,
  total_amount NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  verdict TEXT NOT NULL CHECK (verdict IN ('APPROVED', 'BLOCKED', 'NEEDS_APPROVAL', '403_REJECTED')),
  risk_score INTEGER NOT NULL CHECK (risk_score >= 0 AND risk_score <= 100),
  pii_exposed_pct INTEGER NOT NULL CHECK (pii_exposed_pct >= 0 AND pii_exposed_pct <= 100),
  merchant_status_code INTEGER NOT NULL,
  paypal_order_id TEXT,
  reason TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_audit_transactions_timestamp
  ON audit_transactions (timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_audit_transactions_verdict
  ON audit_transactions (verdict);
