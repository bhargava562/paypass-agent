"use client";

import React, { useState } from "react";
import {
  Bot,
  Check,
  ChevronDown,
  ChevronUp,
  Loader2,
  Puzzle,
  Send,
  ShieldCheck,
  SlidersHorizontal,
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

interface AgentExtensionWidgetProps {
  mandate: SpendingMandate;
  onUpdateMandate: (next: SpendingMandate) => void;
  mode: AgentMode;
  onModeChange: (mode: AgentMode) => void;
  prompt: string;
  onPromptChange: (value: string) => void;
  onRunPrompt: (promptOverride?: string) => void;
  isRunning: boolean;
  simulation: SimulationRunState;
  onOpenTv: () => void;
  inputRef?: React.RefObject<HTMLInputElement | null>;
}

export function AgentExtensionWidget({
  mandate,
  onUpdateMandate,
  mode,
  onModeChange,
  prompt,
  onPromptChange,
  onRunPrompt,
  isRunning,
  simulation,
  onOpenTv,
  inputRef,
}: AgentExtensionWidgetProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [editingMandate, setEditingMandate] = useState(false);
  const [draftRule, setDraftRule] = useState(mandate.ruleText);
  const [draftMaxTx, setDraftMaxTx] = useState(String(mandate.maxPerTransaction));
  const [draftDaily, setDraftDaily] = useState(String(mandate.dailyLimit));
  const [draftBlockGift, setDraftBlockGift] = useState(mandate.blockGiftCards);
  const [draftBlockSub, setDraftBlockSub] = useState(mandate.blockSubscriptions);

  const isGhostPass = mode === "ghostpass";
  const isMandateEditorOpen = editingMandate && !isRunning;
  const dailyPct = Math.min(
    100,
    Math.round((mandate.dailySpent / Math.max(1, mandate.dailyLimit)) * 100)
  );

  function openMandateEditor() {
    if (isRunning) return;
    setDraftRule(mandate.ruleText);
    setDraftMaxTx(String(mandate.maxPerTransaction));
    setDraftDaily(String(mandate.dailyLimit));
    setDraftBlockGift(mandate.blockGiftCards);
    setDraftBlockSub(mandate.blockSubscriptions);
    setEditingMandate(true);
  }

  function handleSaveMandate(e: React.FormEvent) {
    e.preventDefault();
    const parsedMax = Number(draftMaxTx);
    const maxTx = Number.isFinite(parsedMax)
      ? Math.min(1000, Math.max(5, parsedMax))
      : 60;
    const parsedDaily = Number(draftDaily);
    const dailyLim = Number.isFinite(parsedDaily)
      ? Math.min(2000, Math.max(maxTx, parsedDaily))
      : Math.max(maxTx, 150);

    onUpdateMandate({
      ...mandate,
      ruleText: draftRule.trim() || `Max $${maxTx} · Hardware & books only`,
      maxPerTransaction: maxTx,
      dailyLimit: dailyLim,
      blockGiftCards: draftBlockGift,
      blockSubscriptions: draftBlockSub,
    });
    setEditingMandate(false);
  }

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

  if (collapsed) {
    return (
      <div className="fixed bottom-5 right-5 z-30">
        <button
          type="button"
          onClick={() => setCollapsed(false)}
          className="inline-flex cursor-pointer items-center gap-2.5 rounded-full border border-zinc-700 bg-zinc-950 px-4 py-2.5 text-xs font-semibold text-white shadow-2xl transition hover:bg-zinc-900"
        >
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#0070E0] text-white">
            <Puzzle className="h-3.5 w-3.5" />
          </span>
          <span>PayPal GhostPass Extension</span>
          <ChevronUp className="h-4 w-4 text-zinc-400" />
        </button>
      </div>
    );
  }

  return (
    <aside
      aria-label="External Browser Extension: PayPal GhostPass Personal AI Agent"
      className="fixed bottom-4 right-4 z-30 w-[390px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-zinc-700/90 bg-zinc-950 text-zinc-100 shadow-[0_24px_70px_-12px_rgba(9,9,11,0.55)]"
    >
      {/* Distinct Chrome Browser Extension Titlebar */}
      <div className="flex items-center justify-between border-b border-zinc-800 bg-zinc-900 px-3.5 py-2.5">
        <div className="flex items-center gap-2 min-w-0">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-[#0070E0] text-white">
            <Puzzle className="h-3.5 w-3.5" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold text-white">
              PayPal GhostPass
            </p>
            <p className="truncate text-[10px] text-zinc-400">
              Personal AI Agent Extension (External)
            </p>
          </div>
        </div>

        <button
          type="button"
          aria-label="Minimize extension widget"
          onClick={() => setCollapsed(true)}
          className="cursor-pointer rounded-lg p-1 text-zinc-400 transition hover:bg-zinc-800 hover:text-white"
        >
          <ChevronDown className="h-4 w-4" />
        </button>
      </div>

      {/* Extension Body */}
      <div className="max-h-[75vh] space-y-3.5 overflow-y-auto p-3.5">
        {/* 1. User's PayPal GhostPass Mandate Settings */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/80 p-3">
          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-sky-400">
              <SlidersHorizontal className="h-3 w-3" />
              Your GhostPass Mandate
            </span>
            <button
              type="button"
              disabled={isRunning}
              onClick={() =>
                isMandateEditorOpen
                  ? setEditingMandate(false)
                  : openMandateEditor()
              }
              className="cursor-pointer text-[11px] font-medium text-zinc-300 underline-offset-2 hover:text-white hover:underline disabled:opacity-50"
            >
              {isMandateEditorOpen ? "Cancel" : "Edit Rule"}
            </button>
          </div>

          {!isMandateEditorOpen ? (
            <>
              <p className="mt-1.5 text-xs font-medium leading-snug text-zinc-100">
                &ldquo;{mandate.ruleText}&rdquo;
              </p>
              <div className="mt-2.5 flex items-center justify-between text-[11px] text-zinc-400">
                <span className="font-mono">
                  Cap ${mandate.maxPerTransaction}/tx
                </span>
                <span className="font-mono">
                  Daily ${mandate.dailySpent.toFixed(0)} / ${mandate.dailyLimit}
                </span>
              </div>
              <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
                <div
                  className="h-full rounded-full bg-[#0070E0] transition-all duration-500"
                  style={{ width: `${dailyPct}%` }}
                />
              </div>
            </>
          ) : (
            <form onSubmit={handleSaveMandate} className="mt-2.5 space-y-2.5">
              <div>
                <label
                  htmlFor="ext-mandate-rule"
                  className="mb-1 block text-[11px] text-zinc-400"
                >
                  Plain-English Mandate
                </label>
                <input
                  id="ext-mandate-rule"
                  type="text"
                  value={draftRule}
                  onChange={(e) => setDraftRule(e.target.value)}
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-2.5 py-1.5 text-xs text-white outline-none focus:border-[#0070E0]"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label
                    htmlFor="ext-mandate-max"
                    className="mb-1 block text-[11px] text-zinc-400"
                  >
                    Max / Tx ($)
                  </label>
                  <input
                    id="ext-mandate-max"
                    type="number"
                    min={5}
                    max={1000}
                    value={draftMaxTx}
                    onChange={(e) => setDraftMaxTx(e.target.value)}
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-2.5 py-1.5 font-mono text-xs text-white outline-none focus:border-[#0070E0]"
                  />
                </div>
                <div>
                  <label
                    htmlFor="ext-mandate-daily"
                    className="mb-1 block text-[11px] text-zinc-400"
                  >
                    Daily Limit ($)
                  </label>
                  <input
                    id="ext-mandate-daily"
                    type="number"
                    min={10}
                    max={2000}
                    value={draftDaily}
                    onChange={(e) => setDraftDaily(e.target.value)}
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-2.5 py-1.5 font-mono text-xs text-white outline-none focus:border-[#0070E0]"
                  />
                </div>
              </div>
              <div className="flex flex-wrap gap-3 text-[11px] text-zinc-300">
                <label className="flex cursor-pointer items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={draftBlockGift}
                    onChange={(e) => setDraftBlockGift(e.target.checked)}
                    className="h-3.5 w-3.5 rounded"
                  />
                  Block Gift Cards
                </label>
                <label className="flex cursor-pointer items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={draftBlockSub}
                    onChange={(e) => setDraftBlockSub(e.target.checked)}
                    className="h-3.5 w-3.5 rounded"
                  />
                  Block Subscriptions
                </label>
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingMandate(false)}
                  className="inline-flex cursor-pointer items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] text-zinc-400 hover:text-white"
                >
                  <X className="h-3 w-3" />
                  Cancel
                </button>
                <button
                  type="submit"
                  className="inline-flex cursor-pointer items-center gap-1 rounded-lg bg-[#0070E0] px-3 py-1 text-[11px] font-semibold text-white hover:bg-[#005bb5]"
                >
                  <Check className="h-3 w-3" />
                  Save
                </button>
              </div>
            </form>
          )}
        </div>

        {/* 2. Agent Identity Mode Toggle */}
        <div
          role="group"
          aria-label="External agent mode"
          className="grid grid-cols-2 gap-1.5 rounded-xl border border-zinc-800 bg-zinc-900 p-1"
        >
          <button
            type="button"
            disabled={isRunning}
            aria-pressed={!isGhostPass}
            onClick={() => onModeChange("standard_bot")}
            className={`flex cursor-pointer items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-[11px] font-semibold transition disabled:opacity-50 ${
              !isGhostPass
                ? "bg-zinc-100 text-zinc-950 shadow-xs"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <Bot className="h-3.5 w-3.5" />
            <span>Standard AI Bot</span>
          </button>

          <button
            type="button"
            disabled={isRunning}
            aria-pressed={isGhostPass}
            onClick={() => onModeChange("ghostpass")}
            className={`flex cursor-pointer items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-[11px] font-semibold transition disabled:opacity-50 ${
              isGhostPass
                ? "bg-[#0070E0] text-white shadow-xs"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <ShieldCheck className="h-3.5 w-3.5" />
            <span>PayPal GhostPass</span>
          </button>
        </div>

        {/* 3. Prompt Input */}
        <form onSubmit={handleSubmit} className="flex items-center gap-2">
          <input
            ref={inputRef}
            type="text"
            aria-label="External AI agent shopping instruction"
            value={prompt}
            onChange={(e) => onPromptChange(e.target.value)}
            placeholder="Tell your AI agent what to buy..."
            className="min-w-0 flex-1 rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs text-white outline-none placeholder:text-zinc-500 focus:border-[#0070E0]"
          />
          <button
            type="submit"
            disabled={isRunning || !prompt.trim()}
            aria-label="Run external AI agent"
            className="inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-xl bg-[#0070E0] px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-[#005bb5] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isRunning ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Send className="h-3.5 w-3.5" />
            )}
            <span>Go</span>
          </button>
        </form>

        {/* 4. Three Quick-Test Scenarios */}
        <div>
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
            Quick Cross-Boundary Scenarios
          </p>
          <div className="grid grid-cols-1 gap-1.5">
            {DEMO_SCENARIOS.map((scenario) => {
              const toneClass =
                scenario.badgeTone === "emerald"
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/20"
                  : scenario.badgeTone === "rose"
                  ? "border-rose-500/30 bg-rose-500/10 text-rose-200 hover:bg-rose-500/20"
                  : "border-amber-500/30 bg-amber-500/10 text-amber-200 hover:bg-amber-500/20";

              return (
                <button
                  key={scenario.id}
                  type="button"
                  disabled={isRunning}
                  onClick={() => handleScenarioClick(scenario)}
                  title={scenario.description}
                  className={`flex cursor-pointer items-center justify-between rounded-xl border px-3 py-2 text-left text-[11px] font-medium transition disabled:opacity-50 ${toneClass}`}
                >
                  <span className="truncate">{scenario.label}</span>
                  <span className="ml-2 shrink-0 font-mono text-[10px] opacity-80">
                    Run →
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 5. Quick Link to Top X-Ray TV */}
        {simulation.verdict !== "IDLE" && (
          <button
            type="button"
            onClick={onOpenTv}
            className="flex w-full cursor-pointer items-center justify-between rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-xs text-zinc-200 transition hover:border-zinc-700 hover:bg-zinc-800"
          >
            <span className="inline-flex items-center gap-1.5 font-medium">
              <Tv className="h-3.5 w-3.5 text-sky-400" />
              View X-Ray Cameras ({simulation.verdict})
            </span>
            <span className="font-mono text-[10px] text-sky-400">Open TV</span>
          </button>
        )}
      </div>
    </aside>
  );
}
