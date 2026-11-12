"use client";

import React, { useEffect } from "react";
import {
  Bot,
  Loader2,
  Send,
  ShieldCheck,
  Sparkles,
  Tv,
  X,
} from "lucide-react";
import {
  AgentMode,
  DEMO_SCENARIOS,
  DemoScenario,
  SimulationRunState,
  SpendingMandate,
} from "@/data/catalog";

interface AIShopperDrawerProps {
  open: boolean;
  onClose: () => void;
  mode: AgentMode;
  onModeChange: (mode: AgentMode) => void;
  prompt: string;
  onPromptChange: (value: string) => void;
  onRunPrompt: (promptOverride?: string) => void;
  isRunning: boolean;
  mandate: SpendingMandate;
  simulation: SimulationRunState;
  onOpenTv: () => void;
  inputRef?: React.RefObject<HTMLInputElement | null>;
}

export function AIShopperDrawer({
  open,
  onClose,
  mode,
  onModeChange,
  prompt,
  onPromptChange,
  onRunPrompt,
  isRunning,
  mandate,
  simulation,
  onOpenTv,
  inputRef,
}: AIShopperDrawerProps) {
  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!prompt.trim() || isRunning) return;
    onRunPrompt();
  }

  function handleScenarioClick(scenario: DemoScenario) {
    onPromptChange(scenario.prompt);
    if (!isRunning) {
      onRunPrompt(scenario.prompt);
    }
  }

  const isGhostPass = mode === "ghostpass";

  return (
    <aside
      aria-label="AI Shopper Autopilot Drawer"
      aria-hidden={!open}
      inert={!open}
      className={`fixed inset-y-0 right-0 z-30 flex w-full max-w-md flex-col border-l border-zinc-200 bg-white shadow-2xl transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
        open ? "visible translate-x-0" : "invisible translate-x-full pointer-events-none"
      }`}
    >
      {/* Drawer Header */}
      <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#0070E0] text-white">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <h2 className="font-display text-sm font-bold text-[#09090B]">
              AI Shopper Autopilot
            </h2>
            <p className="text-[11px] text-zinc-500">
              Active Cap: ${mandate.maxPerTransaction}/tx · Daily $
              {mandate.dailySpent.toFixed(0)}/${mandate.dailyLimit}
            </p>
          </div>
        </div>

        <button
          type="button"
          aria-label="Close AI Shopper drawer"
          onClick={onClose}
          className="cursor-pointer rounded-xl p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Drawer Body */}
      <div className="flex-1 space-y-5 overflow-y-auto p-5">
        {/* Checkout Mode Switch */}
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Checkout Passport Mode
          </p>
          <div
            role="group"
            aria-label="Agent checkout mode"
            className="grid grid-cols-1 gap-2"
          >
            <button
              type="button"
              disabled={isRunning}
              aria-pressed={!isGhostPass}
              onClick={() => onModeChange("standard_bot")}
              className={`flex cursor-pointer items-center justify-between rounded-2xl border p-3 text-left transition disabled:cursor-not-allowed disabled:opacity-60 ${
                !isGhostPass
                  ? "border-zinc-900 bg-zinc-900 text-white shadow-xs"
                  : "border-zinc-200 bg-zinc-50 text-zinc-700 hover:border-zinc-300"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Bot className="h-4 w-4 shrink-0" />
                <div>
                  <p className="text-xs font-semibold">
                    Standard AI Bot (Unverified)
                  </p>
                  <p
                    className={`text-[11px] ${
                      !isGhostPass ? "text-zinc-300" : "text-zinc-500"
                    }`}
                  >
                    Leaks raw PII · Triggers store 403 bot-block
                  </p>
                </div>
              </div>
              <span
                className={`h-2.5 w-2.5 rounded-full ${
                  !isGhostPass ? "bg-rose-400" : "bg-zinc-300"
                }`}
              />
            </button>

            <button
              type="button"
              disabled={isRunning}
              aria-pressed={isGhostPass}
              onClick={() => onModeChange("ghostpass")}
              className={`flex cursor-pointer items-center justify-between rounded-2xl border p-3 text-left transition disabled:cursor-not-allowed disabled:opacity-60 ${
                isGhostPass
                  ? "border-[#0070E0] bg-gradient-to-r from-[#003087] to-[#0070E0] text-white shadow-sm"
                  : "border-zinc-200 bg-zinc-50 text-zinc-700 hover:border-zinc-300"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <ShieldCheck className="h-4 w-4 shrink-0" />
                <div>
                  <p className="text-xs font-semibold">
                    PayPal GhostPass (Zero-PII Verified)
                  </p>
                  <p
                    className={`text-[11px] ${
                      isGhostPass ? "text-sky-100" : "text-zinc-500"
                    }`}
                  >
                    0% PII · Gatekeeper defense · Verified mandate
                  </p>
                </div>
              </div>
              <span
                className={`h-2.5 w-2.5 rounded-full ${
                  isGhostPass ? "bg-emerald-300" : "bg-zinc-300"
                }`}
              />
            </button>
          </div>
        </div>

        {/* Prompt Input */}
        <form onSubmit={handleSubmit} className="space-y-2.5">
          <label
            htmlFor="ai-shopper-prompt-input"
            className="block text-xs font-semibold uppercase tracking-wider text-zinc-500"
          >
            What should your agent buy?
          </label>
          <input
            ref={inputRef}
            id="ai-shopper-prompt-input"
            type="text"
            value={prompt}
            onChange={(e) => onPromptChange(e.target.value)}
            placeholder="e.g., Buy Keychron Q1 Pro under $60"
            className="w-full rounded-2xl border border-zinc-200 bg-[#FAFAFA] px-3.5 py-2.5 text-sm text-[#09090B] outline-none transition placeholder:text-zinc-400 focus:border-[#0070E0] focus:bg-white"
          />
          <button
            type="submit"
            disabled={isRunning || !prompt.trim()}
            className={`inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-2xl px-4 py-2.5 text-xs font-semibold text-white shadow-xs transition disabled:cursor-not-allowed disabled:opacity-50 ${
              isGhostPass
                ? "bg-[#0070E0] hover:bg-[#003087]"
                : "bg-zinc-900 hover:bg-zinc-800"
            }`}
          >
            {isRunning ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Running Agent Pipeline...
              </>
            ) : (
              <>
                <Send className="h-4 w-4" />
                Run Shopping Agent
              </>
            )}
          </button>
        </form>

        {/* 3 One-Click Demo Scenarios */}
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
            1-Click Demo Scenarios
          </p>
          <div className="space-y-2">
            {DEMO_SCENARIOS.map((scenario) => {
              const badgeClasses =
                scenario.badgeTone === "emerald"
                  ? "border-emerald-200 bg-emerald-50/70 hover:bg-emerald-50 text-emerald-950"
                  : scenario.badgeTone === "rose"
                  ? "border-rose-200 bg-rose-50/70 hover:bg-rose-50 text-rose-950"
                  : "border-amber-200 bg-amber-50/70 hover:bg-amber-50 text-amber-950";

              return (
                <button
                  key={scenario.id}
                  type="button"
                  disabled={isRunning}
                  onClick={() => handleScenarioClick(scenario)}
                  className={`w-full cursor-pointer rounded-2xl border p-3 text-left transition disabled:cursor-not-allowed disabled:opacity-50 ${badgeClasses}`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold">
                      {scenario.label}
                    </span>
                    <span className="font-mono text-[10px] font-medium opacity-75">
                      Run →
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] opacity-80">
                    {scenario.description}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Latest Run Telemetry Summary */}
        {simulation.verdict !== "IDLE" && (
          <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-3.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[#09090B]">
                Latest Verdict: {simulation.verdict}
              </span>
              <span className="font-mono text-[11px] text-zinc-500">
                PII: {simulation.piiExposedPct}%
              </span>
            </div>
            <p className="mt-1 text-xs text-zinc-600">
              {simulation.merchantBadge}
            </p>
            <button
              type="button"
              onClick={onOpenTv}
              className="mt-3 inline-flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-zinc-900 px-3 py-2 text-xs font-semibold text-white hover:bg-zinc-800"
            >
              <Tv className="h-3.5 w-3.5" />
              Inspect 3 Cameras in Behind the Scenes
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
