"use client";

import {
  AuditTransaction,
  DEFAULT_MANDATE,
  SpendingMandate,
} from "@/data/catalog";

const MANDATE_STORAGE_KEY = "ghostpass:mandate:v1";
const LEDGER_STORAGE_KEY = "ghostpass:ledger:v1";

function isValidMandate(value: unknown): value is SpendingMandate {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<SpendingMandate>;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.ruleText === "string" &&
    typeof candidate.maxPerTransaction === "number" &&
    Number.isFinite(candidate.maxPerTransaction) &&
    typeof candidate.dailyLimit === "number" &&
    Number.isFinite(candidate.dailyLimit) &&
    typeof candidate.dailySpent === "number" &&
    Number.isFinite(candidate.dailySpent) &&
    typeof candidate.blockGiftCards === "boolean" &&
    typeof candidate.blockSubscriptions === "boolean" &&
    Array.isArray(candidate.allowedCategories)
  );
}

function isValidTransaction(value: unknown): value is AuditTransaction {
  if (!value || typeof value !== "object") return false;
  const tx = value as Partial<AuditTransaction>;
  return (
    typeof tx.id === "string" &&
    typeof tx.timestamp === "string" &&
    (tx.mode === "standard_bot" || tx.mode === "ghostpass") &&
    typeof tx.requestedProductName === "string" &&
    typeof tx.totalAmount === "number" &&
    Number.isFinite(tx.totalAmount) &&
    typeof tx.verdict === "string"
  );
}

export function readClientMandate(): SpendingMandate | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(MANDATE_STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isValidMandate(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function writeClientMandate(mandate: SpendingMandate): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(MANDATE_STORAGE_KEY, JSON.stringify(mandate));
  } catch {
    // Ignore storage quota or private browsing errors
  }
}

export function readClientTransactions(): AuditTransaction[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(LEDGER_STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    return parsed.filter(isValidTransaction);
  } catch {
    return null;
  }
}

export function writeClientTransactions(
  transactions: AuditTransaction[]
): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      LEDGER_STORAGE_KEY,
      JSON.stringify(transactions.slice(0, 100))
    );
  } catch {
    // Ignore storage quota or private browsing errors
  }
}

export function resetClientStorage(): SpendingMandate {
  const fresh: SpendingMandate = {
    ...DEFAULT_MANDATE,
    updatedAt: new Date().toISOString(),
  };
  writeClientMandate(fresh);
  writeClientTransactions([]);
  return fresh;
}
