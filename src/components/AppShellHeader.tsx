"use client";

import React from "react";
import {
  Database,
  RotateCcw,
  ShieldCheck,
  ShoppingBag,
  Zap,
} from "lucide-react";

export type AppViewMode = "console" | "storefront";

interface AppShellHeaderProps {
  activeView: AppViewMode;
  onChangeView: (view: AppViewMode) => void;
  paypalConfigured: boolean;
  storageBackend: string;
  merchantOrdersCount: number;
  isBusy: boolean;
  onResetDemo: () => void;
}

export function AppShellHeader({
  activeView,
  onChangeView,
  paypalConfigured,
  storageBackend,
  merchantOrdersCount,
  isBusy,
  onResetDemo,
}: AppShellHeaderProps) {
  return (
    <header className="sticky top-0 z-30 border-b border-zinc-200 bg-white/95 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-2.5 sm:px-6">
        {/* Left: Crisp Fintech Brand + Live Sandbox Status */}
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#0B1120] text-white shadow-xs">
            <ShieldCheck className="h-4 w-4 text-[#38BDF8]" aria-hidden="true" />
          </div>
          <span className="font-display text-sm font-bold tracking-tight text-[#09090B] sm:text-base">
            PayPal GhostPass
          </span>
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
              paypalConfigured
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-sky-200 bg-sky-50 text-sky-700"
            }`}
          >
            <span
              aria-hidden="true"
              className={`h-1.5 w-1.5 rounded-full ${
                paypalConfigured ? "bg-emerald-500" : "bg-sky-500"
              }`}
            />
            {paypalConfigured ? "Sandbox Connected" : "Sandbox Ready"}
          </span>
        </div>

        {/* Center: Clean 2-View Switcher */}
        <nav
          aria-label="Application view switcher"
          className="order-3 flex w-full items-center justify-center rounded-full border border-zinc-200 bg-zinc-100 p-0.5 sm:order-2 sm:w-auto"
        >
          <button
            type="button"
            aria-current={activeView === "console" ? "page" : undefined}
            onClick={() => onChangeView("console")}
            className={`inline-flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-semibold transition sm:flex-initial ${
              activeView === "console"
                ? "bg-white text-[#09090B] shadow-xs"
                : "text-zinc-600 hover:text-[#09090B]"
            }`}
          >
            <Zap className="h-3.5 w-3.5 text-[#0070E0]" aria-hidden="true" />
            <span>GhostPass Wallet</span>
          </button>

          <button
            type="button"
            aria-current={activeView === "storefront" ? "page" : undefined}
            onClick={() => onChangeView("storefront")}
            className={`inline-flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-semibold transition sm:flex-initial ${
              activeView === "storefront"
                ? "bg-white text-[#09090B] shadow-xs"
                : "text-zinc-600 hover:text-[#09090B]"
            }`}
          >
            <ShoppingBag className="h-3.5 w-3.5 text-zinc-800" aria-hidden="true" />
            <span>NovaTech Store</span>
            {merchantOrdersCount > 0 && (
              <span className="rounded-full bg-[#0070E0]/10 px-1.5 py-0.5 font-mono text-[10px] font-bold text-[#003087]">
                {merchantOrdersCount}
                <span className="sr-only"> settled orders</span>
              </span>
            )}
          </button>
        </nav>

        {/* Right: Storage Mode + Reset */}
        <div className="order-2 flex items-center gap-2 sm:order-3">
          <span className="hidden items-center gap-1 rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 font-mono text-[10px] font-medium text-zinc-600 md:inline-flex">
            <Database className="h-3 w-3 text-zinc-500" aria-hidden="true" />
            {storageBackend === "neon-postgres" ? "Neon SQL" : "Memory"}
          </span>

          <button
            type="button"
            disabled={isBusy}
            onClick={onResetDemo}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 transition hover:border-zinc-300 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Reset</span>
          </button>
        </div>
      </div>
    </header>
  );
}
