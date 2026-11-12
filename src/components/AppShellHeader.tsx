"use client";

import React from "react";
import { ArrowRight, Code2, ShoppingBag, Sparkles, Zap } from "lucide-react";

export type AppViewMode = "overview" | "console" | "storefront";

interface AppShellHeaderProps {
  activeView: AppViewMode;
  onChangeView: (view: AppViewMode) => void;
  onOpenMcpConfig: () => void;
  onOpenControlPlane: () => void;
  paypalConfigured: boolean;
  merchantOrdersCount: number;
}

export function AppShellHeader({
  activeView,
  onChangeView,
  onOpenMcpConfig,
  onOpenControlPlane,
  paypalConfigured,
  merchantOrdersCount,
}: AppShellHeaderProps) {
  return (
    <header className="sticky top-0 z-30 h-16 border-b border-[#E4E4E7] bg-white/90 text-[#09090B] backdrop-blur-md">
      <div className="mx-auto flex h-full max-w-7xl items-center justify-between gap-3 whitespace-nowrap px-4 sm:px-6">
        {/* Left: PayPal GhostPass Shield Emblem + Wordmark + Sandbox Live */}
        <div className="flex shrink-0 items-center gap-2.5">
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
                strokeWidth="1.8"
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

          <span className="font-display text-sm font-bold tracking-tight text-[#09090B]">
            PayPal GhostPass
          </span>

          <span
            className={`hidden items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-mono text-[10px] font-semibold sm:inline-flex ${
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
            {paypalConfigured ? "Sandbox Live" : "Sandbox Ready"}
          </span>
        </div>

        {/* Center: Clean 3-Tab Pill Switcher */}
        <nav
          aria-label="Primary sections"
          className="flex items-center rounded-full border border-[#E4E4E7] bg-zinc-100 p-1"
        >
          <button
            type="button"
            aria-current={activeView === "overview" ? "page" : undefined}
            onClick={() => onChangeView("overview")}
            className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors duration-200 ${
              activeView === "overview"
                ? "bg-white text-[#09090B] shadow-xs"
                : "text-zinc-600 hover:text-[#09090B]"
            }`}
          >
            <Sparkles
              className={`h-3.5 w-3.5 ${
                activeView === "overview" ? "text-[#0070E0]" : ""
              }`}
              aria-hidden="true"
            />
            <span>Overview</span>
          </button>

          <button
            type="button"
            aria-current={activeView === "console" ? "page" : undefined}
            onClick={() => onChangeView("console")}
            className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors duration-200 ${
              activeView === "console"
                ? "bg-white text-[#09090B] shadow-xs"
                : "text-zinc-600 hover:text-[#09090B]"
            }`}
          >
            <Zap
              className={`h-3.5 w-3.5 ${
                activeView === "console" ? "text-[#0070E0]" : ""
              }`}
              aria-hidden="true"
            />
            <span>Control Plane</span>
          </button>

          <button
            type="button"
            aria-current={activeView === "storefront" ? "page" : undefined}
            onClick={() => onChangeView("storefront")}
            className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors duration-200 ${
              activeView === "storefront"
                ? "bg-white text-[#09090B] shadow-xs"
                : "text-zinc-600 hover:text-[#09090B]"
            }`}
          >
            <ShoppingBag className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="hidden md:inline">NovaTech Store</span>
            <span className="md:hidden">Store</span>
            {merchantOrdersCount > 0 && (
              <span className="rounded-full bg-[#0070E0]/12 px-1.5 py-0.5 font-mono text-[10px] font-bold text-[#003087]">
                {merchantOrdersCount}
                <span className="sr-only"> settled orders</span>
              </span>
            )}
          </button>
        </nav>

        {/* Right: MCP Config + Open Control Plane CTA */}
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={onOpenMcpConfig}
            className="hidden h-9 cursor-pointer items-center gap-1.5 rounded-xl border border-[#E4E4E7] bg-white px-3 font-mono text-xs font-semibold text-[#09090B] transition-colors duration-200 hover:bg-zinc-50 lg:inline-flex"
          >
            <Code2 className="h-3.5 w-3.5 text-[#0070E0]" aria-hidden="true" />
            <span>MCP Config</span>
          </button>

          <button
            type="button"
            onClick={onOpenControlPlane}
            className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-xl bg-[#0070E0] px-3.5 text-xs font-semibold text-white shadow-xs transition-colors duration-200 hover:bg-[#005BB5]"
          >
            <span className="hidden sm:inline">Open Control Plane</span>
            <span className="sm:hidden">Demo</span>
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>
      </div>
    </header>
  );
}
