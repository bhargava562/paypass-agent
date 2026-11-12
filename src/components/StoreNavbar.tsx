"use client";

import React, { useEffect, useRef, useState } from "react";
import { Search, ShoppingBag, Store, Trash2 } from "lucide-react";
import {
  Product,
  ProductCategory,
  STORE_CATEGORIES,
} from "@/data/catalog";

interface StoreNavbarProps {
  selectedCategory: "All" | ProductCategory;
  onSelectCategory: (category: "All" | ProductCategory) => void;
  searchQuery: string;
  onSearchChange: (value: string) => void;
  cartItems: Product[];
  onRemoveFromCart: (index: number) => void;
  onClearCart: () => void;
  onOpenCartCheckout: () => void;
}

export function StoreNavbar({
  selectedCategory,
  onSelectCategory,
  searchQuery,
  onSearchChange,
  cartItems = [],
  onRemoveFromCart,
  onClearCart,
  onOpenCartCheckout,
}: StoreNavbarProps) {
  const [cartOpen, setCartOpen] = useState(false);
  const cartRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!cartOpen) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setCartOpen(false);
    }
    function onMouseDown(e: MouseEvent) {
      if (cartRef.current && !cartRef.current.contains(e.target as Node)) {
        setCartOpen(false);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("mousedown", onMouseDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("mousedown", onMouseDown);
    };
  }, [cartOpen]);

  const cartTotal = cartItems.reduce((sum, item) => sum + item.price, 0);

  return (
    <header className="sticky top-[41px] z-25 border-b border-zinc-200 bg-white/95 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        {/* Left: Pure Merchant Brand + Category Links */}
        <div className="flex items-center gap-7">
          <button
            type="button"
            onClick={() => onSelectCategory("All")}
            className="flex cursor-pointer items-center gap-2.5 text-left"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#09090B] text-white">
              <Store className="h-4 w-4" />
            </div>
            <span className="font-display text-lg font-bold tracking-tight text-[#09090B]">
              NovaTech
            </span>
          </button>

          <nav
            aria-label="Store categories"
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

        {/* Right: Real Store Search + Shopping Cart */}
        <div className="flex flex-1 items-center justify-end gap-3">
          <div className="relative hidden w-full max-w-xs sm:block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              aria-label="Search NovaTech store"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search NovaTech hardware, books..."
              className="w-full rounded-full border border-zinc-200 bg-[#FAFAFA] py-1.5 pl-9 pr-4 text-xs text-[#09090B] outline-none transition placeholder:text-zinc-400 focus:border-zinc-400 focus:bg-white"
            />
          </div>

          <div ref={cartRef} className="relative">
            <button
              type="button"
              aria-expanded={cartOpen}
              onClick={() => setCartOpen((prev) => !prev)}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-[#09090B] transition hover:border-zinc-300 hover:bg-zinc-50"
            >
              <ShoppingBag className="h-3.5 w-3.5" />
              <span>Cart</span>
              <span className="font-mono">({cartItems.length})</span>
            </button>

            {cartOpen && (
              <div className="absolute right-0 top-full z-40 mt-2 w-80 rounded-2xl border border-zinc-200 bg-white p-4 shadow-xl">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-[#09090B]">
                    Your Bag ({cartItems.length})
                  </h3>
                  {cartItems.length > 0 && (
                    <button
                      type="button"
                      onClick={onClearCart}
                      className="cursor-pointer text-[11px] font-medium text-zinc-500 hover:text-rose-600"
                    >
                      Clear Bag
                    </button>
                  )}
                </div>

                {cartItems.length === 0 ? (
                  <p className="py-5 text-center text-xs text-zinc-500">
                    Your NovaTech bag is empty.
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
                          onOpenCartCheckout();
                        }}
                        className="w-full cursor-pointer rounded-xl bg-[#09090B] px-4 py-2 text-xs font-semibold text-white transition hover:bg-zinc-800"
                      >
                        Proceed to Checkout
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Search & Category Strip */}
      <div className="flex flex-col gap-2 border-t border-zinc-100 px-4 py-2 lg:hidden">
        <div className="relative sm:hidden">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
          <input
            type="text"
            aria-label="Search NovaTech store mobile"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search NovaTech..."
            className="w-full rounded-full border border-zinc-200 bg-[#FAFAFA] py-1.5 pl-8 pr-4 text-xs text-[#09090B] outline-none"
          />
        </div>
        <div className="flex items-center gap-1.5 overflow-x-auto">
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
      </div>
    </header>
  );
}
