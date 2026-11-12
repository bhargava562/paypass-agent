"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  CheckCircle2,
  ExternalLink,
  Package,
  Search,
  ShoppingBag,
  Store,
  Trash2,
  X,
} from "lucide-react";
import {
  AuditTransaction,
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
  merchantOrders: AuditTransaction[];
}

function isRealPayPalOrderId(orderId: string): boolean {
  return (
    !orderId.startsWith("SBX-GP-") &&
    !orderId.startsWith("NT-HUMAN-") &&
    !orderId.startsWith("NT-PAY-") &&
    !orderId.startsWith("NT-CRD-")
  );
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
  merchantOrders = [],
}: StoreNavbarProps) {
  const [cartOpen, setCartOpen] = useState(false);
  const [ordersOpen, setOrdersOpen] = useState(false);
  const cartRef = useRef<HTMLDivElement | null>(null);
  const ordersRef = useRef<HTMLDivElement | null>(null);
  const drawerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!cartOpen && !ordersOpen) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setCartOpen(false);
        setOrdersOpen(false);
      }
    }
    function onMouseDown(e: MouseEvent) {
      const target = e.target as Node;
      if (cartRef.current && !cartRef.current.contains(target)) {
        setCartOpen(false);
      }
      const inOrdersButton =
        ordersRef.current && ordersRef.current.contains(target);
      const inOrdersDrawer =
        drawerRef.current && drawerRef.current.contains(target);
      if (!inOrdersButton && !inOrdersDrawer) {
        setOrdersOpen(false);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("mousedown", onMouseDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("mousedown", onMouseDown);
    };
  }, [cartOpen, ordersOpen]);

  const cartTotal = cartItems.reduce((sum, item) => sum + item.price, 0);

  return (
    <>
      <div
        role="region"
        aria-label="NovaTech Store navigation"
        className="z-25 border-b border-zinc-200 bg-white/95 backdrop-blur-md sm:sticky sm:top-[57px]"
      >
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        {/* Left: Pure Merchant Brand + Category Links */}
        <div className="flex items-center gap-7">
          <button
            type="button"
            onClick={() => onSelectCategory("All")}
            className="flex cursor-pointer items-center gap-2.5 text-left"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#09090B] text-white">
              <Store className="h-4 w-4" aria-hidden="true" />
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
                  aria-pressed={active}
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

        {/* Right: Store Search + Merchant Orders + Shopping Cart */}
        <div className="flex flex-1 items-center justify-end gap-2.5">
          <div className="relative hidden w-full max-w-xs sm:block">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400"
              aria-hidden="true"
            />
            <input
              type="text"
              aria-label="Search NovaTech store"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search NovaTech hardware, books..."
              className="w-full rounded-full border border-zinc-200 bg-[#FAFAFA] py-1.5 pl-9 pr-4 text-xs text-[#09090B] outline-none transition placeholder:text-zinc-400 focus:border-zinc-400 focus:bg-white"
            />
          </div>

          {/* Merchant Order History Drawer Trigger */}
          <div ref={ordersRef} className="relative">
            <button
              type="button"
              aria-expanded={ordersOpen}
              aria-label={`NovaTech Orders (${merchantOrders.length})`}
              onClick={() => {
                setCartOpen(false);
                setOrdersOpen((prev) => !prev);
              }}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-[#09090B] transition hover:border-zinc-300 hover:bg-zinc-50"
            >
              <Package className="h-3.5 w-3.5 text-zinc-700" aria-hidden="true" />
              <span className="hidden sm:inline">Orders</span>
              <span className="font-mono">({merchantOrders.length})</span>
            </button>
          </div>

          {/* Shopping Cart */}
          <div ref={cartRef} className="relative">
            <button
              type="button"
              aria-expanded={cartOpen}
              aria-label={`Shopping Cart (${cartItems.length})`}
              onClick={() => {
                setOrdersOpen(false);
                setCartOpen((prev) => !prev);
              }}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-[#09090B] transition hover:border-zinc-300 hover:bg-zinc-50"
            >
              <ShoppingBag className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Cart</span>
              <span className="font-mono">({cartItems.length})</span>
            </button>

            {cartOpen && (
              <div
                role="dialog"
                aria-label="Shopping Bag"
                className="absolute right-0 top-full z-40 mt-2 w-80 max-w-[calc(100vw-2rem)] rounded-2xl border border-zinc-200 bg-white p-4 shadow-xl"
              >
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
                            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
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
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400"
            aria-hidden="true"
          />
          <input
            type="text"
            aria-label="Search NovaTech store mobile"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search NovaTech..."
            className="w-full rounded-full border border-zinc-200 bg-[#FAFAFA] py-1.5 pl-8 pr-4 text-xs text-[#09090B] outline-none"
          />
        </div>
        <nav
          aria-label="Store categories mobile"
          className="flex items-center gap-1.5 overflow-x-auto"
        >
          {STORE_CATEGORIES.map((category) => {
            const active = selectedCategory === category;
            return (
              <button
                key={category}
                type="button"
                aria-pressed={active}
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
        </nav>
      </div>
    </div>

      {/* Live Merchant Orders Slide-Over Drawer */}
      {ordersOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-zinc-950/35 backdrop-blur-[1px]">
          <aside
            ref={drawerRef}
            role="dialog"
            aria-modal="true"
            aria-label="NovaTech Merchant Orders"
            className="flex h-full w-full max-w-md flex-col border-l border-zinc-200 bg-white shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-4">
              <div>
                <h2 className="text-sm font-semibold text-[#09090B]">
                  Merchant Orders ({merchantOrders.length})
                </h2>
                <p className="text-[11px] font-medium text-emerald-700">
                  PayPal Verified Fulfillment
                </p>
              </div>
              <button
                type="button"
                aria-label="Close merchant orders drawer"
                onClick={() => setOrdersOpen(false)}
                className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-zinc-200 text-zinc-600 transition hover:bg-zinc-100 hover:text-zinc-900"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              {merchantOrders.length === 0 ? (
                <div className="rounded-xl border border-dashed border-zinc-200 bg-zinc-50 px-4 py-10 text-center text-xs text-zinc-500">
                  No settled orders yet.
                </div>
              ) : (
                <ul className="space-y-3">
                  {merchantOrders.map((order) => (
                    <li
                      key={order.id}
                      className="rounded-xl border border-zinc-200 bg-zinc-50 p-3.5 text-xs"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-semibold text-[#09090B]">
                          {order.requestedProductName}
                        </span>
                        <span className="font-mono font-bold text-[#09090B]">
                          ${order.totalAmount.toFixed(2)}
                        </span>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-zinc-600">
                        <span className="inline-flex items-center gap-1 text-emerald-700">
                          <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                          {order.id.startsWith("tx-human-")
                            ? "Direct Customer Checkout"
                            : "Buyer PII Shared: None — Fulfilled via PayPal Vault Relay"}
                        </span>
                        {order.paypalOrderId &&
                          (isRealPayPalOrderId(order.paypalOrderId) ? (
                            <a
                              href={`https://www.sandbox.paypal.com/activity/payment/${encodeURIComponent(order.paypalOrderId)}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 font-mono font-semibold text-[#005BB5] hover:underline"
                            >
                              {order.paypalOrderId}
                              <ExternalLink className="h-3 w-3" aria-hidden="true" />
                              <span className="sr-only">
                                (opens in new tab)
                              </span>
                            </a>
                          ) : (
                            <span className="font-mono font-semibold text-zinc-700">
                              {order.paypalOrderId}
                            </span>
                          ))}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
