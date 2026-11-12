"use client";

import React, { useState } from "react";
import {
  Check,
  Edit3,
  ShieldCheck,
  SlidersHorizontal,
  Tv,
  X,
} from "lucide-react";
import { SpendingMandate, VerdictStatus } from "@/data/catalog";

interface MandateHeaderProps {
  mandate: SpendingMandate;
  onUpdateMandate: (next: SpendingMandate) => void;
  tvOpen: boolean;
  onToggleTv: () => void;
  activeVerdict: VerdictStatus;
  isRunning: boolean;
}

export function MandateHeader({
  mandate,
  onUpdateMandate,
  tvOpen,
  onToggleTv,
  activeVerdict,
  isRunning,
}: MandateHeaderProps) {
  const [editing, setEditing] = useState(false);
  const [draftRule, setDraftRule] = useState(mandate.ruleText);
  const [draftMaxTx, setDraftMaxTx] = useState(String(mandate.maxPerTransaction));
  const [draftDaily, setDraftDaily] = useState(String(mandate.dailyLimit));
  const [draftBlockGift, setDraftBlockGift] = useState(mandate.blockGiftCards);
  const [draftBlockSub, setDraftBlockSub] = useState(mandate.blockSubscriptions);

  const dailyPct = Math.min(
    100,
    Math.round((mandate.dailySpent / Math.max(1, mandate.dailyLimit)) * 100)
  );

  function openEditor() {
    setDraftRule(mandate.ruleText);
    setDraftMaxTx(String(mandate.maxPerTransaction));
    setDraftDaily(String(mandate.dailyLimit));
    setDraftBlockGift(mandate.blockGiftCards);
    setDraftBlockSub(mandate.blockSubscriptions);
    setEditing(true);
  }

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    const maxTx = Math.max(5, Number(draftMaxTx) || 60);
    const dailyLim = Math.max(maxTx, Number(draftDaily) || 150);
    onUpdateMandate({
      ...mandate,
      ruleText: draftRule.trim() || `Max $${maxTx} · Dev gear & books`,
      maxPerTransaction: maxTx,
      dailyLimit: dailyLim,
      blockGiftCards: draftBlockGift,
      blockSubscriptions: draftBlockSub,
    });
    setEditing(false);
  }

  const tvIndicatorColor = isRunning
    ? "bg-sky-400 animate-ping"
    : activeVerdict === "BLOCKED" || activeVerdict === "403_REJECTED"
    ? "bg-rose-400"
    : activeVerdict === "NEEDS_APPROVAL"
    ? "bg-amber-400 animate-pulse"
    : activeVerdict === "APPROVED"
    ? "bg-emerald-400"
    : "bg-slate-400";

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/85 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
        {/* Merchant Brand */}
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#003087] to-[#0070BA] text-white shadow-sm">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-base font-semibold tracking-tight text-slate-900">
                NovaTech &amp; CloudForge
              </span>
              <span className="hidden rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 sm:inline-flex">
                Open-Web Store
              </span>
            </div>
            <p className="text-xs text-slate-500">
              PayPal GhostPass Enabled · Zero-PII Agentic Checkout
            </p>
          </div>
        </div>

        {/* Universal Spending Mandate Pill */}
        <div className="relative order-3 w-full lg:order-2 lg:w-auto lg:flex-1 lg:max-w-xl">
          <button
            type="button"
            onClick={() => (editing ? setEditing(false) : openEditor())}
            className="group flex w-full items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50/90 px-3.5 py-2 text-left transition hover:border-[#0070BA]/50 hover:bg-white hover:shadow-sm"
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded-md bg-[#003087]/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[#003087]">
                  <SlidersHorizontal className="h-3 w-3" />
                  Universal Mandate
                </span>
                <span className="text-[11px] font-medium text-slate-500">
                  Cap ${mandate.maxPerTransaction} · Daily ${mandate.dailySpent.toFixed(0)}/${mandate.dailyLimit}
                </span>
              </div>
              <p className="mt-0.5 truncate text-xs font-medium text-slate-800">
                &ldquo;{mandate.ruleText}&rdquo;
              </p>
            </div>

            <div className="flex shrink-0 items-center gap-2.5">
              <div className="hidden w-16 sm:block">
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
                  <div
                    className="h-full rounded-full bg-[#0070BA] transition-all duration-500"
                    style={{ width: `${dailyPct}%` }}
                  />
                </div>
              </div>
              <span className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-600 group-hover:border-[#0070BA]/40 group-hover:text-[#0070BA]">
                <Edit3 className="h-3 w-3" />
                Edit
              </span>
            </div>
          </button>

          {/* Inline Mandate Editor Popover */}
          {editing && (
            <form
              onSubmit={handleSave}
              className="absolute left-0 right-0 top-full z-40 mt-2 rounded-2xl border border-slate-200 bg-white p-4 shadow-xl"
            >
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-900">
                  Edit Universal Spending Mandate
                </h3>
                <button
                  type="button"
                  onClick={() => setEditing(false)}
                  className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">
                    Plain-English Spending Rule
                  </label>
                  <input
                    type="text"
                    value={draftRule}
                    onChange={(e) => setDraftRule(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 outline-none focus:border-[#0070BA] focus:bg-white"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600">
                      Max Per Purchase ($)
                    </label>
                    <input
                      type="number"
                      min={5}
                      max={1000}
                      value={draftMaxTx}
                      onChange={(e) => setDraftMaxTx(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 outline-none focus:border-[#0070BA] focus:bg-white"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600">
                      Daily Limit ($)
                    </label>
                    <input
                      type="number"
                      min={10}
                      max={2000}
                      value={draftDaily}
                      onChange={(e) => setDraftDaily(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 outline-none focus:border-[#0070BA] focus:bg-white"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap gap-4 pt-1">
                  <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-700">
                    <input
                      type="checkbox"
                      checked={draftBlockGift}
                      onChange={(e) => setDraftBlockGift(e.target.checked)}
                      className="h-4 w-4 rounded border-slate-300 text-[#0070BA]"
                    />
                    Block Gift Cards
                  </label>
                  <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-700">
                    <input
                      type="checkbox"
                      checked={draftBlockSub}
                      onChange={(e) => setDraftBlockSub(e.target.checked)}
                      className="h-4 w-4 rounded border-slate-300 text-[#0070BA]"
                    />
                    Block Subscriptions
                  </label>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setEditing(false)}
                    className="rounded-xl px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="inline-flex items-center gap-1.5 rounded-xl bg-[#0070BA] px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-[#003087]"
                  >
                    <Check className="h-3.5 w-3.5" />
                    Save Mandate
                  </button>
                </div>
              </div>
            </form>
          )}
        </div>

        {/* Pull-Down TV Trigger */}
        <div className="order-2 flex items-center gap-2 lg:order-3">
          <button
            type="button"
            onClick={onToggleTv}
            className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold shadow-sm transition ${
              tvOpen
                ? "bg-[#0070BA] text-white ring-2 ring-[#0070BA]/30"
                : "bg-slate-900 text-white hover:bg-slate-800"
            }`}
          >
            <span className="relative flex h-2 w-2">
              <span className={`inline-flex h-2 w-2 rounded-full ${tvIndicatorColor}`} />
            </span>
            <Tv className="h-4 w-4" />
            <span>📺 Behind the Scenes</span>
          </button>
        </div>
      </div>
    </header>
  );
}
