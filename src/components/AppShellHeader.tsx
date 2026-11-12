"use client";

import React from "react";
import {
  ArrowDown,
  Code2,
  Database,
  RotateCcw,
  ShoppingBag,
  Sparkles,
  Zap,
} from "lucide-react";

export type AppViewMode = "overview" | "console" | "storefront";

interface AppShellHeaderProps {
  activeView: AppViewMode;
  onChangeView: (view: AppViewMode) => void;
  onOpenMcpConfig: () => void;
  onLaunchDemo: () => void;
  paypalConfigured: boolean;
  storageBackend: string;
  merchantOrdersCount: number;
  isBusy: boolean;
  onResetDemo: () => void;
}

export function AppShellHeader({
  activeView,
  onChangeView,
  onOpenMcpConfig,
  onLaunchDemo,
  paypalConfigured,
  storageBackend,
  merchantOrdersCount,
  isBusy,
  onResetDemo,
}: AppShellHeaderProps) {
  return (
    <header className="sticky top-0 z-30 border-b border-[#E4E4E7] bg-white/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-2.5 sm:px-6">
        {/* Left: Geometric GhostPass Emblem + Wordmark + PayPal Sandbox Live Pill */}
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => onChangeView("overview")}
            aria-label="PayPal GhostPass Overview"
            className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-xl bg-[#0B1120] text-white shadow-xs transition-colors duration-200 hover:bg-zinc-800"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              className="h-5 w-5"
              aria-hidden="true"
            >
              <path
                d="M12 2.5L4.5 5.8V11.6C4.5 16.4 7.7 20.6 12 22C16.3 20.6 19.5 16.4 19.5 11.6V5.8L12 2.5Z"
                stroke="#38BDF8"
                strokeWidth="1.75"
                strokeLinejoin="round"
              />
              <path
                d="M9.2 12.1L11.1 14L15 9.9"
                stroke="#FFFFFF"
                strokeWidth="1.9"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>

          <div className="leading-tight">
            <div className="flex items-center gap-2">
              <span className="font-display text-sm font-bold tracking-tight text-[#09090B]">
                PayPal GhostPass
              </span>
              <span
                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-mono text-[10px] font-semibold ${
                  paypalConfigured
                    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                    : "border-sky-200 bg-sky-50 text-[#005BB5]"
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`h-1.5 w-1.5 animate-pulse rounded-full ${
                    paypalConfigured ? "bg-emerald-500" : "bg-[#0070E0]"
                  }`}
                />
                {paypalConfigured ? "PayPal Sandbox Live" : "Sandbox Ready"}
              </span>
            </div>
            <p className="hidden font-mono text-[10px] text-zinc-500 lg:block">
              {storageBackend === "neon-postgres"
                ? "Neon PostgreSQL · Orders v2"
                : "MCP Authorization · Orders v2"}
            </p>
          </div>
        </div>

        {/* Center: Segmented Pill Switcher (Overview · Live Control Plane · NovaTech Storefront) */}
        <nav
          aria-label="Primary sections"
          className="order-3 flex w-full items-center justify-center rounded-full border border-[#E4E4E7] bg-zinc-100 p-1 sm:order-2 sm:w-auto"
        >
          <button
            type="button"
            aria-current={activeView === "overview" ? "page" : undefined}
            onClick={() => onChangeView("overview")}
            className={`inline-flex flex-1 cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors duration-200 sm:flex-initial ${
              activeView === "overview"
                ? "bg-white text-[#09090B] shadow-xs"
                : "text-zinc-600 hover:text-[#09090B]"
            }`}
          >
            <Sparkles className="h-3.5 w-3.5 text-[#0070E0]" aria-hidden="true" />
            <span>Overview</span>
          </button>

          <button
            type="button"
            aria-current={activeView === "console" ? "page" : undefined}
            onClick={() => onChangeView("console")}
            className={`inline-flex flex-1 cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors duration-200 sm:flex-initial ${
              activeView === "console"
                ? "bg-white text-[#09090B] shadow-xs"
                : "text-zinc-600 hover:text-[#09090B]"
            }`}
          >
            <Zap className="h-3.5 w-3.5 text-[#0070E0]" aria-hidden="true" />
            <span>Live Control Plane</span>
          </button>

          <button
            type="button"
            aria-current={activeView === "storefront" ? "page" : undefined}
            onClick={() => onChangeView("storefront")}
            className={`inline-flex flex-1 cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors duration-200 sm:flex-initial ${
              activeView === "storefront"
                ? "bg-white text-[#09090B] shadow-xs"
                : "text-zinc-600 hover:text-[#09090B]"
            }`}
          >
            <ShoppingBag className="h-3.5 w-3.5 text-zinc-800" aria-hidden="true" />
            <span>NovaTech Storefront</span>
            {merchantOrdersCount > 0 && (
              <span className="rounded-full bg-[#0070E0]/12 px-1.5 py-0.5 font-mono text-[10px] font-bold text-[#003087]">
                {merchantOrdersCount}
                <span className="sr-only"> settled orders</span>
              </span>
            )}
          </button>
        </nav>

        {/* Right: Get MCP Config + Launch Live Demo CTA + Compact Reset */}
        <div className="order-2 flex items-center gap-2 sm:order-3">
          <span
            title={`Storage: ${storageBackend}`}
            className="hidden items-center gap-1 rounded-full border border-[#E4E4E7] bg-zinc-50 px-2 py-1 font-mono text-[10px] font-medium text-zinc-600 xl:inline-flex"
          >
            <Database className="h-3 w-3 text-zinc-500" aria-hidden="true" />
            {storageBackend === "neon-postgres" ? "Neon" : "Memory"}
          </span>

          <button
            type="button"
            onClick={onOpenMcpConfig}
            className="hidden h-9 cursor-pointer items-center gap-1.5 rounded-xl border border-[#E4E4E7] bg-white px-3 font-mono text-xs font-semibold text-[#09090B] transition-colors duration-200 hover:border-zinc-300 hover:bg-zinc-50 md:inline-flex"
          >
            <Code2 className="h-3.5 w-3.5 text-[#0070E0]" aria-hidden="true" />
            <span>Get MCP Config</span>
          </button>

          <button
            type="button"
            onClick={onLaunchDemo}
            className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-xl bg-[#0070E0] px-3.5 text-xs font-semibold text-white shadow-xs transition-colors duration-200 hover:bg-[#003087]"
          >
            <span>Launch Live Demo</span>
            <ArrowDown className="h-3.5 w-3.5" aria-hidden="true" />
          </button>

          <button
            type="button"
            aria-label="Reset demo state"
            title="Reset demo state"
            disabled={isBusy}
            onClick={onResetDemo}
            className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-xl border border-[#E4E4E7] bg-white text-zinc-600 transition-colors duration-200 hover:border-zinc-300 hover:bg-zinc-50 hover:text-[#09090B] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>
      </div>
    </header>
  );
}
