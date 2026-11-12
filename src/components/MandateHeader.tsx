"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  Check,
  ShieldCheck,
  ShoppingBag,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  Tv,
  X,
} from "lucide-react";
import {
  Product,
  ProductCategory,
  STORE_CATEGORIES,
  SpendingMandate,
  VerdictStatus,
} from "@/data/catalog";

interface MandateHeaderProps {
  mandate: SpendingMandate;
  onUpdateMandate: (next: SpendingMandate) => void;
  selectedCategory: "All" | ProductCategory;
  onSelectCategory: (category: "All" | ProductCategory) => void;
  aiDrawerOpen: boolean;
  onToggleAiDrawer: () => void;
  tvOpen: boolean;
  onToggleTv: () => void;
  activeVerdict: VerdictStatus;
  isRunning: boolean;
  cartItems: Product[];
  onRemoveFromCart: (index: number) => void;
  onClearCart: () => void;
  onCheckoutCartWithAi: () => void;
}

export function MandateHeader({
  mandate,
  onUpdateMandate,
  selectedCategory,
  onSelectCategory,
  aiDrawerOpen,
  onToggleAiDrawer,
  tvOpen,
  onToggleTv,
  activeVerdict,
  isRunning,
  cartItems = [],
  onRemoveFromCart,
  onClearCart,
  onCheckoutCartWithAi,
}: MandateHeaderProps) {
  const [editing, setEditing] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [draftRule, setDraftRule] = useState(mandate.ruleText);
  const [draftMaxTx, setDraftMaxTx] = useState(String(mandate.maxPerTransaction));
  const [draftDaily, setDraftDaily] = useState(String(mandate.dailyLimit));
  const [draftBlockGift, setDraftBlockGift] = useState(mandate.blockGiftCards);
  const [draftBlockSub, setDraftBlockSub] = useState(mandate.blockSubscriptions);

  const mandatePopoverRef = useRef<HTMLDivElement | null>(null);
  const cartPopoverRef = useRef<HTMLDivElement | null>(null);

  const isEditorOpen = editing && !isRunning;

  useEffect(() => {
    if (!isEditorOpen && !cartOpen) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setEditing(false);
        setCartOpen(false);
      }
    }
    function onMouseDown(e: MouseEvent) {
      const target = e.target as Node;
      if (
        isEditorOpen &&
        mandatePopoverRef.current &&
        !mandatePopoverRef.current.contains(target)
      ) {
        setEditing(false);
      }
      if (
        cartOpen &&
        cartPopoverRef.current &&
        !cartPopoverRef.current.contains(target)
      ) {
        setCartOpen(false);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("mousedown", onMouseDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("mousedown", onMouseDown);
    };
  }, [isEditorOpen, cartOpen]);

  function openEditor() {
    if (isRunning) return;
    setCartOpen(false);
    setDraftRule(mandate.ruleText);
    setDraftMaxTx(String(mandate.maxPerTransaction));
    setDraftDaily(String(mandate.dailyLimit));
    setDraftBlockGift(mandate.blockGiftCards);
    setDraftBlockSub(mandate.blockSubscriptions);
    setEditing(true);
  }

  function handleSave(e: React.FormEvent) {
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
      ruleText: draftRule.trim() || `Max $${maxTx} · Hardware & tech books`,
      maxPerTransaction: maxTx,
      dailyLimit: dailyLim,
      blockGiftCards: draftBlockGift,
      blockSubscriptions: draftBlockSub,
    });
    setEditing(false);
  }

  const cartTotal = cartItems.reduce((sum, item) => sum + item.price, 0);

  const tvIndicatorColor = isRunning
    ? "bg-sky-400 animate-ping"
    : activeVerdict === "BLOCKED" || activeVerdict === "403_REJECTED"
    ? "bg-rose-400"
    : activeVerdict === "NEEDS_APPROVAL"
    ? "bg-amber-400 animate-pulse"
    : activeVerdict === "APPROVED"
    ? "bg-emerald-400"
    : "bg-zinc-400";

  return (
    <header className="sticky top-0 z-30 border-b border-zinc-200 bg-white/95 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        {/* Left: Flagship Brand + Category Nav */}
        <div className="flex items-center gap-7">
          <button
            type="button"
            onClick={() => onSelectCategory("All")}
            className="flex cursor-pointer items-center gap-2.5 text-left"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#09090B] text-white">
              <ShieldCheck className="h-4 w-4 text-[#38BDF8]" />
            </div>
            <div className="leading-none">
              <span className="font-display text-base font-bold tracking-tight text-[#09090B]">
                NovaTech
              </span>
              <span className="ml-1.5 hidden rounded border border-zinc-200 bg-zinc-50 px-1.5 py-0.5 font-mono text-[10px] font-medium text-zinc-500 sm:inline-block">
                STORE
              </span>
            </div>
          </button>

          <nav
            aria-label="Storefront categories"
            className="hidden items-center gap-1 lg:flex"
          >
            {STORE_CATEGORIES.map((category) => {
              const active = selectedCategory === category;
              return (
                <button
                  key={category}
                  type="button"
                  onClick={() => onSelectCategory(category)}
                  className={`cursor-pointer rounded-full px-3 py-1.5 text-xs font-medium transition-colors duration-150 ${
                    active
                      ? "bg-[#09090B] text-white"
                      : "text-zinc-600 hover:bg-zinc-100 hover:text-[#09090B]"
                  }`}
                >
                  {category}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Right: Mandate Cap Pill, AI Shopper Drawer Trigger, Behind the Scenes TV, Cart */}
        <div className="flex items-center gap-2">
          {/* Sleek Mandate Cap Pill */}
          <div ref={mandatePopoverRef} className="relative">
            <button
              type="button"
              disabled={isRunning}
              aria-expanded={isEditorOpen}
              onClick={() => (isEditorOpen ? setEditing(false) : openEditor())}
              title={mandate.ruleText}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-xs font-medium text-[#09090B] transition hover:border-[#0070E0]/50 hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              <SlidersHorizontal className="h-3.5 w-3.5 text-[#0070E0]" />
              <span className="hidden sm:inline">Mandate:</span>
              <span className="font-mono font-semibold text-[#003087]">
                ${mandate.maxPerTransaction} Cap
              </span>
            </button>

            {isEditorOpen && (
              <form
                onSubmit={handleSave}
                className="absolute right-0 top-full z-40 mt-2 w-80 rounded-2xl border border-zinc-200 bg-white p-4 shadow-xl sm:w-96"
              >
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-[#09090B]">
                      PayPal GhostPass Mandate
                    </h3>
                    <p className="text-[11px] text-zinc-500">
                      Daily spent: ${mandate.dailySpent.toFixed(2)} / $
                      {mandate.dailyLimit.toFixed(2)}
                    </p>
                  </div>
                  <button
                    type="button"
                    aria-label="Close mandate editor"
                    onClick={() => setEditing(false)}
                    className="cursor-pointer rounded-lg p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="space-y-3">
                  <div>
                    <label
                      htmlFor="mandate-rule-input"
                      className="mb-1 block text-xs font-medium text-zinc-600"
                    >
                      Plain-English Rule
                    </label>
                    <input
                      id="mandate-rule-input"
                      type="text"
                      value={draftRule}
                      onChange={(e) => setDraftRule(e.target.value)}
                      className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-[#09090B] outline-none focus:border-[#0070E0] focus:bg-white"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label
                        htmlFor="mandate-max-tx-input"
                        className="mb-1 block text-xs font-medium text-zinc-600"
                      >
                        Per-Purchase Cap ($)
                      </label>
                      <input
                        id="mandate-max-tx-input"
                        type="number"
                        min={5}
                        max={1000}
                        value={draftMaxTx}
                        onChange={(e) => setDraftMaxTx(e.target.value)}
                        className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 font-mono text-xs text-[#09090B] outline-none focus:border-[#0070E0] focus:bg-white"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="mandate-daily-limit-input"
                        className="mb-1 block text-xs font-medium text-zinc-600"
                      >
                        Daily Cap ($)
                      </label>
                      <input
                        id="mandate-daily-limit-input"
                        type="number"
                        min={10}
                        max={2000}
                        value={draftDaily}
                        onChange={(e) => setDraftDaily(e.target.value)}
                        className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 font-mono text-xs text-[#09090B] outline-none focus:border-[#0070E0] focus:bg-white"
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-4 pt-1">
                    <label className="flex cursor-pointer items-center gap-2 text-xs text-zinc-700">
                      <input
                        type="checkbox"
                        checked={draftBlockGift}
                        onChange={(e) => setDraftBlockGift(e.target.checked)}
                        className="h-4 w-4 rounded border-zinc-300 text-[#0070E0]"
                      />
                      Block Gift Cards
                    </label>
                    <label className="flex cursor-pointer items-center gap-2 text-xs text-zinc-700">
                      <input
                        type="checkbox"
                        checked={draftBlockSub}
                        onChange={(e) => setDraftBlockSub(e.target.checked)}
                        className="h-4 w-4 rounded border-zinc-300 text-[#0070E0]"
                      />
                      Block Subscriptions
                    </label>
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setEditing(false)}
                      className="cursor-pointer rounded-xl px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-100"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-[#0070E0] px-3.5 py-1.5 text-xs font-semibold text-white transition hover:bg-[#003087]"
                    >
                      <Check className="h-3.5 w-3.5" />
                      Save Mandate
                    </button>
                  </div>
                </div>
              </form>
            )}
          </div>

          {/* AI Shopper Slide-Over Trigger */}
          <button
            type="button"
            aria-expanded={aiDrawerOpen}
            onClick={() => {
              setCartOpen(false);
              onToggleAiDrawer();
            }}
            className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
              aiDrawerOpen
                ? "bg-[#003087] text-white ring-2 ring-[#0070E0]/30"
                : "bg-[#0070E0] text-white hover:bg-[#003087]"
            }`}
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span>AI Shopper</span>
          </button>

          {/* Behind the Scenes Pull-Down TV Trigger */}
          <button
            type="button"
            aria-expanded={tvOpen}
            onClick={() => {
              setCartOpen(false);
              onToggleTv();
            }}
            className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
              tvOpen
                ? "border-[#09090B] bg-[#09090B] text-white"
                : "border-zinc-200 bg-white text-[#09090B] hover:border-zinc-300 hover:bg-zinc-50"
            }`}
          >
            <span className="relative flex h-2 w-2">
              <span
                className={`inline-flex h-2 w-2 rounded-full ${tvIndicatorColor}`}
              />
            </span>
            <Tv className="h-3.5 w-3.5" />
            <span className="hidden md:inline">Behind the Scenes</span>
          </button>

          {/* Cart Badge & Popover */}
          <div ref={cartPopoverRef} className="relative">
            <button
              type="button"
              aria-expanded={cartOpen}
              onClick={() => setCartOpen((prev) => !prev)}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-[#09090B] transition hover:border-zinc-300 hover:bg-zinc-50"
            >
              <ShoppingBag className="h-3.5 w-3.5" />
              <span className="font-mono">({cartItems.length})</span>
            </button>

            {cartOpen && (
              <div className="absolute right-0 top-full z-40 mt-2 w-80 rounded-2xl border border-zinc-200 bg-white p-4 shadow-xl">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-[#09090B]">
                    Shopping Bag ({cartItems.length})
                  </h3>
                  {cartItems.length > 0 && (
                    <button
                      type="button"
                      onClick={onClearCart}
                      className="cursor-pointer text-[11px] font-medium text-zinc-500 hover:text-rose-600"
                    >
                      Clear
                    </button>
                  )}
                </div>

                {cartItems.length === 0 ? (
                  <p className="py-4 text-center text-xs text-zinc-500">
                    Your bag is empty. Add items or launch the AI Shopper.
                  </p>
                ) : (
                  <>
                    <ul className="max-h-52 space-y-2 overflow-y-auto">
                      {cartItems.map((item, idx) => (
                        <li
                          key={`${item.id}-${idx}`}
                          className="flex items-center justify-between gap-2 rounded-xl border border-zinc-100 bg-zinc-50 p-2 text-xs"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-medium text-[#09090B]">
                              {item.name}
                            </p>
                            <p className="font-mono text-[11px] text-zinc-500">
                              ${item.price.toFixed(2)}
                            </p>
                          </div>
                          <button
                            type="button"
                            aria-label={`Remove ${item.name}`}
                            onClick={() => onRemoveFromCart(idx)}
                            className="cursor-pointer rounded-lg p-1 text-zinc-400 hover:bg-zinc-200/70 hover:text-rose-600"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </li>
                      ))}
                    </ul>

                    <div className="mt-3 border-t border-zinc-100 pt-3">
                      <div className="mb-3 flex items-center justify-between text-xs font-semibold">
                        <span className="text-zinc-600">Subtotal</span>
                        <span className="font-mono text-sm text-[#09090B]">
                          ${cartTotal.toFixed(2)}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setCartOpen(false);
                          onCheckoutCartWithAi();
                        }}
                        className="w-full cursor-pointer rounded-xl bg-[#0070E0] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[#003087]"
                      >
                        Checkout with PayPal GhostPass
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Category Pills */}
      <div className="flex items-center gap-1.5 overflow-x-auto border-t border-zinc-100 px-4 py-2 lg:hidden">
        {STORE_CATEGORIES.map((category) => {
          const active = selectedCategory === category;
          return (
            <button
              key={category}
              type="button"
              onClick={() => onSelectCategory(category)}
              className={`shrink-0 cursor-pointer rounded-full px-3 py-1 text-xs font-medium transition ${
                active
                  ? "bg-[#09090B] text-white"
                  : "border border-zinc-200 bg-white text-zinc-600"
              }`}
            >
              {category}
            </button>
          );
        })}
      </div>
    </header>
  );
}
