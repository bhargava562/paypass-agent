"use client";

import React from "react";
import { Lock, Tv } from "lucide-react";
import { VerdictStatus } from "@/data/catalog";

interface BrowserChromeBarProps {
  tvOpen: boolean;
  onToggleTv: () => void;
  activeVerdict: VerdictStatus;
  isRunning: boolean;
}

export function BrowserChromeBar({
  tvOpen,
  onToggleTv,
  activeVerdict,
  isRunning,
}: BrowserChromeBarProps) {
  const statusDot = isRunning
    ? "bg-sky-400 animate-ping"
    : activeVerdict === "BLOCKED" || activeVerdict === "403_REJECTED"
    ? "bg-rose-400"
    : activeVerdict === "NEEDS_APPROVAL"
    ? "bg-amber-400 animate-pulse"
    : activeVerdict === "APPROVED"
    ? "bg-emerald-400"
    : "bg-zinc-500";

  return (
    <div className="sticky top-0 z-35 border-b border-zinc-800 bg-zinc-950 text-zinc-200">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-2 sm:px-6">
        {/* Browser Window Controls + Omnibox */}
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <div className="hidden items-center gap-1.5 sm:flex" aria-hidden="true">
            <span className="h-2.5 w-2.5 rounded-full bg-rose-500/80" />
            <span className="h-2.5 w-2.5 rounded-full bg-amber-400/80" />
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/80" />
          </div>

          <div className="flex min-w-0 max-w-md flex-1 items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-1 font-mono text-[11px] text-zinc-300">
            <Lock className="h-3 w-3 shrink-0 text-emerald-400" />
            <span className="truncate">demo-browser://novatech.store</span>
          </div>
        </div>

        {/* Browser-Level Behind the Scenes X-Ray TV Toggle */}
        <button
          type="button"
          aria-expanded={tvOpen}
          onClick={onToggleTv}
          className={`inline-flex shrink-0 cursor-pointer items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold transition ${
            tvOpen
              ? "border-[#0070E0] bg-[#0070E0] text-white"
              : "border-zinc-700 bg-zinc-900 text-zinc-100 hover:border-zinc-500 hover:bg-zinc-800"
          }`}
        >
          <span className="relative flex h-2 w-2">
            <span className={`inline-flex h-2 w-2 rounded-full ${statusDot}`} />
          </span>
          <Tv className="h-3.5 w-3.5" />
          <span>Behind the Scenes (X-Ray View)</span>
        </button>
      </div>
    </div>
  );
}
