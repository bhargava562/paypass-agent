"use client";

import React from "react";
import { Bot, Loader2, Send, ShieldCheck } from "lucide-react";
import {
  AgentMode,
  DEMO_SCENARIOS,
  DemoScenario,
} from "@/data/catalog";

interface FloatingAgentBarProps {
  mode: AgentMode;
  onModeChange: (mode: AgentMode) => void;
  prompt: string;
  onPromptChange: (value: string) => void;
  onRunPrompt: (promptOverride?: string) => void;
  isRunning: boolean;
  inputRef?: React.RefObject<HTMLInputElement | null>;
}

export function FloatingAgentBar({
  mode,
  onModeChange,
  prompt,
  onPromptChange,
  onRunPrompt,
  isRunning,
  inputRef,
}: FloatingAgentBarProps) {
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
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-30 flex justify-center px-3 sm:px-6">
      <div className="pointer-events-auto w-full max-w-4xl rounded-3xl border border-slate-200/90 bg-white/92 p-3 shadow-[0_20px_50px_-12px_rgba(15,23,42,0.22)] backdrop-blur-xl sm:p-4">
        {/* Top Row: Mode Switch + Quick Demo Scenario Pills */}
        <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
          {/* Mode Switch */}
          <div
            role="group"
            aria-label="Agent checkout mode"
            className="inline-flex items-center rounded-full border border-slate-200 bg-slate-100 p-0.5"
          >
            <button
              type="button"
              onClick={() => onModeChange("standard_bot")}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition ${
                !isGhostPass
                  ? "bg-white text-slate-900 shadow-xs"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              <span className="h-2 w-2 rounded-full border border-slate-400 bg-slate-200" />
              <Bot className="h-3.5 w-3.5" />
              <span>Standard AI Bot (Unverified)</span>
            </button>

            <button
              type="button"
              onClick={() => onModeChange("ghostpass")}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition ${
                isGhostPass
                  ? "bg-gradient-to-r from-[#003087] to-[#0070BA] text-white shadow-xs"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              <span
                className={`h-2 w-2 rounded-full ${
                  isGhostPass ? "bg-sky-300" : "bg-[#0070BA]"
                }`}
              />
              <ShieldCheck className="h-3.5 w-3.5" />
              <span>PayPal GhostPass (Zero-PII Verified)</span>
            </button>
          </div>

          {/* 3 Quick-Demo Scenario Pills */}
          <div className="flex flex-wrap items-center gap-1.5">
            {DEMO_SCENARIOS.map((scenario) => {
              const toneClass =
                scenario.badgeTone === "emerald"
                  ? "border-emerald-200 bg-emerald-50/90 text-emerald-800 hover:bg-emerald-100"
                  : scenario.badgeTone === "rose"
                  ? "border-rose-200 bg-rose-50/90 text-rose-800 hover:bg-rose-100"
                  : "border-amber-200 bg-amber-50/90 text-amber-800 hover:bg-amber-100";
              return (
                <button
                  key={scenario.id}
                  type="button"
                  disabled={isRunning}
                  onClick={() => handleScenarioClick(scenario)}
                  title={scenario.description}
                  className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition disabled:opacity-50 ${toneClass}`}
                >
                  {scenario.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Prompt Form */}
        <form onSubmit={handleSubmit} className="flex items-center gap-2">
          <div className="relative flex-1">
            <input
              ref={inputRef}
              type="text"
              value={prompt}
              onChange={(e) => onPromptChange(e.target.value)}
              placeholder={
                isGhostPass
                  ? 'Ask GhostPass AI (0% PII): e.g., "Buy a wireless keyboard under $60"'
                  : 'Ask Standard AI Bot (Unverified): e.g., "Buy a wireless keyboard under $60"'
              }
              className="w-full rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#0070BA] focus:bg-white"
            />
          </div>

          <button
            type="submit"
            disabled={isRunning || !prompt.trim()}
            className={`inline-flex shrink-0 items-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition disabled:cursor-not-allowed disabled:opacity-50 ${
              isGhostPass
                ? "bg-[#0070BA] hover:bg-[#003087]"
                : "bg-slate-800 hover:bg-slate-900"
            }`}
          >
            {isRunning ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="hidden sm:inline">Running...</span>
              </>
            ) : (
              <>
                <Send className="h-4 w-4" />
                <span className="hidden sm:inline">Send Agent</span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
