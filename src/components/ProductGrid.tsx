"use client";

import React, { useMemo, useState } from "react";
import {
  BookOpen,
  Cable,
  CreditCard,
  Eye,
  HardDrive,
  Headphones,
  Keyboard,
  Mouse,
  Search,
  Sparkles,
  Star,
  Usb,
  X,
} from "lucide-react";
import {
  Product,
  ProductCategory,
  STORE_CATEGORIES,
} from "@/data/catalog";

interface ProductGridProps {
  products: Product[];
  onAskAgentToBuy: (product: Product) => void;
  highlightedProductId?: string | null;
}

function getProductIcon(product: Product) {
  switch (product.id) {
    case "prod-kbd-k2":
      return Keyboard;
    case "prod-book-ddia":
    case "prod-book-ai":
      return BookOpen;
    case "prod-cable-trap":
      return Cable;
    case "prod-gift-steam75":
    case "prod-cloud-credit":
      return CreditCard;
    case "prod-headphones-sony":
      return Headphones;
    case "prod-hub-anker":
      return Usb;
    case "prod-mouse-mx":
      return Mouse;
    case "prod-ssd-samsung":
      return HardDrive;
    default:
      return Sparkles;
  }
}

export function ProductGrid({
  products,
  onAskAgentToBuy,
  highlightedProductId,
}: ProductGridProps) {
  const [selectedCategory, setSelectedCategory] = useState<
    "All" | ProductCategory
  >("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [inspectedProduct, setInspectedProduct] = useState<Product | null>(
    null
  );
  const [showRawDom, setShowRawDom] = useState(false);

  const filteredProducts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return products.filter((item) => {
      const catMatch =
        selectedCategory === "All" || item.category === selectedCategory;
      const textMatch =
        !q ||
        item.name.toLowerCase().includes(q) ||
        item.brand.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q);
      return catMatch && textMatch;
    });
  }, [products, selectedCategory, searchQuery]);

  return (
    <section className="mx-auto w-full max-w-7xl px-4 pb-44 pt-8 sm:px-6">
      {/* Clean Consumer Hero */}
      <div className="mb-8 flex flex-col justify-between gap-6 rounded-3xl border border-slate-200/80 bg-gradient-to-br from-white via-slate-50 to-sky-50/60 p-6 shadow-sm sm:flex-row sm:items-center sm:p-8">
        <div className="max-w-2xl">
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-[#0070BA]/20 bg-[#0070BA]/5 px-3 py-1 text-xs font-medium text-[#003087]">
            <span>Verified Merchant Catalog</span>
            <span className="h-1 w-1 rounded-full bg-[#0070BA]" />
            <span>10 Products Ready</span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
            Developer hardware, books &amp; workspace essentials.
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            Browse naturally or tell your AI Shopping Bar below what to buy.
            Toggle between a standard unverified bot and{" "}
            <span className="font-semibold text-[#003087]">
              PayPal GhostPass
            </span>{" "}
            to watch the Double-Blind Handshake in action.
          </p>
        </div>

        <div className="flex shrink-0 flex-col gap-2 rounded-2xl border border-slate-200 bg-white/90 p-4 text-xs shadow-sm sm:w-64">
          <div className="flex items-center justify-between text-slate-500">
            <span>Checkout Guard</span>
            <span className="font-semibold text-emerald-600">Active</span>
          </div>
          <div className="flex items-center justify-between text-slate-500">
            <span>Scraper Bot Policy</span>
            <span className="font-mono font-semibold text-rose-600">
              403 Block
            </span>
          </div>
          <div className="flex items-center justify-between text-slate-500">
            <span>GhostPass Mandate</span>
            <span className="font-semibold text-[#0070BA]">Accepted ✓</span>
          </div>
        </div>
      </div>

      {/* Category Filters + Search */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          {STORE_CATEGORIES.map((category) => {
            const active = selectedCategory === category;
            return (
              <button
                key={category}
                type="button"
                onClick={() => setSelectedCategory(category)}
                className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition ${
                  active
                    ? "bg-slate-900 text-white shadow-sm"
                    : "border border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900"
                }`}
              >
                {category}
              </button>
            );
          })}
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search products..."
            className="w-full rounded-full border border-slate-200 bg-white py-2 pl-9 pr-4 text-xs text-slate-900 outline-none transition focus:border-[#0070BA]"
          />
        </div>
      </div>

      {/* Product Grid */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {filteredProducts.map((product) => {
          const Icon = getProductIcon(product);
          const isHighlighted = highlightedProductId === product.id;

          return (
            <article
              key={product.id}
              className={`group flex flex-col justify-between rounded-2xl border bg-white p-5 transition duration-200 hover:-translate-y-0.5 hover:shadow-md ${
                isHighlighted
                  ? "border-[#0070BA] ring-2 ring-[#0070BA]/20 shadow-md"
                  : "border-slate-200/90"
              }`}
            >
              <div>
                {/* Visual Box */}
                <div
                  className="relative mb-4 flex h-36 items-center justify-center overflow-hidden rounded-xl border border-slate-100 bg-gradient-to-br from-slate-50 to-slate-100/70"
                >
                  <div
                    className="flex h-16 w-16 items-center justify-center rounded-2xl text-white shadow-sm transition-transform duration-200 group-hover:scale-105"
                    style={{ backgroundColor: product.accentColor }}
                  >
                    <Icon className="h-8 w-8" />
                  </div>

                  {product.badge && (
                    <span className="absolute left-3 top-3 rounded-full border border-slate-200/80 bg-white/95 px-2.5 py-0.5 text-[11px] font-medium text-slate-700 shadow-xs">
                      {product.badge}
                    </span>
                  )}

                  <span className="absolute right-3 top-3 rounded-full bg-slate-900/5 px-2 py-0.5 text-[10px] font-medium text-slate-600">
                    {product.category}
                  </span>
                </div>

                {/* Title & Brand */}
                <div className="mb-1 flex items-center justify-between text-[11px] font-medium text-slate-500">
                  <span>{product.brand}</span>
                  <span className="inline-flex items-center gap-1 text-amber-600">
                    <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                    {product.rating.toFixed(1)} ({product.reviewsCount})
                  </span>
                </div>

                <h2 className="line-clamp-2 text-sm font-semibold leading-snug text-slate-900">
                  {product.name}
                </h2>
                <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-slate-500">
                  {product.description}
                </p>

                {/* Specs */}
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {product.specs.slice(0, 2).map((spec) => (
                    <span
                      key={spec}
                      className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600"
                    >
                      {spec}
                    </span>
                  ))}
                </div>
              </div>

              {/* Price & Actions */}
              <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-3.5">
                <div>
                  <span className="text-lg font-bold tracking-tight text-slate-900">
                    ${product.price.toFixed(2)}
                  </span>
                  {product.isSubscription && (
                    <span className="ml-1 text-[10px] text-slate-400">/mo</span>
                  )}
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setInspectedProduct(product);
                      setShowRawDom(false);
                    }}
                    title="Inspect product details & page metadata"
                    className="inline-flex items-center gap-1 rounded-xl border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50 hover:text-slate-900"
                  >
                    <Eye className="h-3.5 w-3.5" />
                    Inspect
                  </button>
                  <button
                    type="button"
                    onClick={() => onAskAgentToBuy(product)}
                    className="inline-flex items-center gap-1 rounded-xl bg-[#0070BA] px-3 py-1.5 text-xs font-semibold text-white shadow-xs transition hover:bg-[#003087]"
                  >
                    AI Buy
                  </button>
                </div>
              </div>
            </article>
          );
        })}
      </div>

      {/* Product Inspect Modal */}
      {inspectedProduct && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-xs"
          onClick={() => setInspectedProduct(null)}
        >
          <div
            className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <span className="inline-block rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-medium text-slate-600">
                  {inspectedProduct.category} · {inspectedProduct.sku}
                </span>
                <h3 className="mt-2 text-lg font-semibold text-slate-900">
                  {inspectedProduct.name}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setInspectedProduct(null)}
                className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <p className="mt-3 text-sm leading-relaxed text-slate-600">
              {inspectedProduct.description}
            </p>

            <div className="mt-4 flex flex-wrap gap-2">
              {inspectedProduct.specs.map((spec) => (
                <span
                  key={spec}
                  className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700"
                >
                  {spec}
                </span>
              ))}
            </div>

            <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-3.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-700">
                  Merchant DOM Metadata Inspector
                </span>
                <button
                  type="button"
                  onClick={() => setShowRawDom((prev) => !prev)}
                  className="text-xs font-medium text-[#0070BA] hover:underline"
                >
                  {showRawDom ? "Hide Raw Source" : "View Raw Source"}
                </button>
              </div>
              {showRawDom && (
                <pre className="mt-2 overflow-x-auto rounded-xl bg-slate-900 p-3 font-mono text-[11px] leading-relaxed text-slate-200">
                  {JSON.stringify(
                    {
                      id: inspectedProduct.id,
                      price: inspectedProduct.price,
                      category: inspectedProduct.category,
                      rawHtmlComment:
                        inspectedProduct.hiddenPromptInjection ??
                        "<!-- Clean merchant metadata. No hidden directives. -->",
                    },
                    null,
                    2
                  )}
                </pre>
              )}
            </div>

            <div className="mt-6 flex items-center justify-between">
              <span className="text-2xl font-bold text-slate-900">
                ${inspectedProduct.price.toFixed(2)}
              </span>
              <button
                type="button"
                onClick={() => {
                  const target = inspectedProduct;
                  setInspectedProduct(null);
                  onAskAgentToBuy(target);
                }}
                className="rounded-xl bg-[#0070BA] px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#003087]"
              >
                Send AI Agent to Buy
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
