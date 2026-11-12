"use client";

import React, { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import {
  Eye,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
  Star,
  X,
  Zap,
} from "lucide-react";
import {
  Product,
  ProductCategory,
} from "@/data/catalog";

interface ProductGridProps {
  products: Product[];
  selectedCategory: "All" | ProductCategory;
  onSelectCategory: (category: "All" | ProductCategory) => void;
  onAddToCart: (product: Product) => void;
  onAiBuyProduct: (product: Product) => void;
  onOpenAiShopper: () => void;
  highlightedProductId?: string | null;
}

export function ProductGrid({
  products,
  selectedCategory,
  onSelectCategory,
  onAddToCart,
  onAiBuyProduct,
  onOpenAiShopper,
  highlightedProductId,
}: ProductGridProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [inspectedProduct, setInspectedProduct] = useState<Product | null>(
    null
  );
  const [showRawDom, setShowRawDom] = useState(false);

  useEffect(() => {
    if (!inspectedProduct) return;
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setInspectedProduct(null);
      }
    }
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [inspectedProduct]);

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
    <section className="mx-auto w-full max-w-7xl px-4 pb-16 pt-6 sm:px-6">
      {/* Compact Editorial Seasonal Storefront Banner */}
      <div className="mb-8 flex flex-col justify-between gap-6 rounded-3xl border border-zinc-200 bg-white p-6 shadow-xs sm:flex-row sm:items-center sm:p-8">
        <div className="max-w-2xl">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-[#0070E0]/20 bg-[#0070E0]/5 px-3 py-1 text-xs font-medium text-[#003087]">
            <ShieldCheck className="h-3.5 w-3.5 text-[#0070E0]" />
            <span>Instant PayPal GhostPass Checkout</span>
          </div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-[#09090B] sm:text-3xl">
            Precision Hardware &amp; Cloud Credits
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-zinc-600">
            Curated mechanical keyboards, studio audio, Thunderbolt docks, and
            GPU compute packs. Shop manually or delegate checkout to your{" "}
            <button
              type="button"
              onClick={onOpenAiShopper}
              className="cursor-pointer font-semibold text-[#0070E0] underline-offset-4 hover:underline"
            >
              AI Shopper
            </button>{" "}
            with zero personal data exposed.
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:items-end">
          <div className="relative w-full sm:w-64">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              aria-label="Search store catalog"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search hardware, books..."
              className="w-full rounded-full border border-zinc-200 bg-[#FAFAFA] py-2 pl-9 pr-4 text-xs text-[#09090B] outline-none transition placeholder:text-zinc-400 focus:border-[#0070E0] focus:bg-white"
            />
          </div>
          <div className="flex items-center gap-3 text-[11px] text-zinc-500">
            <span>{filteredProducts.length} items shown</span>
            <span className="h-1 w-1 rounded-full bg-zinc-300" />
            <span className="inline-flex items-center gap-1 font-medium text-[#003087]">
              <Sparkles className="h-3 w-3 text-[#0070E0]" />
              0% PII Agent Protocol
            </span>
          </div>
        </div>
      </div>

      {/* Product Grid or Empty State */}
      {filteredProducts.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-zinc-300 bg-white py-16 text-center">
          <p className="text-sm font-semibold text-[#09090B]">
            No products matched &ldquo;{searchQuery}&rdquo;
          </p>
          <p className="mt-1 text-xs text-zinc-500">
            Clear your search or switch back to All categories.
          </p>
          <button
            type="button"
            onClick={() => {
              onSelectCategory("All");
              setSearchQuery("");
            }}
            className="mt-4 cursor-pointer rounded-full bg-[#09090B] px-4 py-2 text-xs font-semibold text-white hover:bg-zinc-800"
          >
            Reset Store Filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredProducts.map((product, index) => {
            const isHighlighted = highlightedProductId === product.id;

            return (
              <article
                key={product.id}
                className={`group flex flex-col justify-between overflow-hidden rounded-2xl border bg-white transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg ${
                  isHighlighted
                    ? "border-[#0070E0] ring-2 ring-[#0070E0]/20 shadow-md"
                    : "border-[#E4E4E7]"
                }`}
              >
                <div>
                  {/* 4:3 Real Product Photography */}
                  <div
                    onClick={() => {
                      setInspectedProduct(product);
                      setShowRawDom(false);
                    }}
                    className="relative aspect-[4/3] w-full cursor-pointer overflow-hidden bg-zinc-100"
                  >
                    <Image
                      src={product.imageUrl}
                      alt={product.imageAlt}
                      fill
                      priority={index < 4}
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                      className="object-cover transition-transform duration-300 group-hover:scale-103"
                    />

                    {product.badge && (
                      <span className="absolute left-3 top-3 rounded-full border border-white/60 bg-white/92 px-2.5 py-0.5 text-[11px] font-semibold text-[#09090B] shadow-xs backdrop-blur-xs">
                        {product.badge}
                      </span>
                    )}

                    <button
                      type="button"
                      aria-label={`Inspect ${product.name}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setInspectedProduct(product);
                        setShowRawDom(false);
                      }}
                      className="absolute right-3 top-3 inline-flex cursor-pointer items-center gap-1 rounded-full border border-white/50 bg-zinc-950/75 px-2.5 py-1 text-[10px] font-medium text-white opacity-90 backdrop-blur-xs transition hover:bg-zinc-950 group-hover:opacity-100"
                    >
                      <Eye className="h-3 w-3" />
                      Inspect
                    </button>
                  </div>

                  {/* Product Details */}
                  <div className="p-4 pb-3">
                    <div className="mb-1.5 flex items-center justify-between text-[11px] font-medium text-zinc-500">
                      <span>{product.brand}</span>
                      <span className="inline-flex items-center gap-1 text-zinc-700">
                        <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                        <span className="font-mono">
                          {product.rating.toFixed(1)}
                        </span>
                        <span className="text-zinc-400">
                          ({product.reviewsCount})
                        </span>
                      </span>
                    </div>

                    <h2
                      onClick={() => {
                        setInspectedProduct(product);
                        setShowRawDom(false);
                      }}
                      className="line-clamp-2 cursor-pointer font-display text-sm font-semibold leading-snug text-[#09090B] transition-colors group-hover:text-[#0070E0]"
                    >
                      {product.name}
                    </h2>

                    <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-zinc-500">
                      {product.description}
                    </p>
                  </div>
                </div>

                {/* Price + Retail Actions */}
                <div className="border-t border-zinc-100 px-4 pb-4 pt-3">
                  <div className="mb-3 flex items-baseline justify-between">
                    <span className="font-mono text-lg font-bold tracking-tight text-[#09090B]">
                      ${product.price.toFixed(2)}
                    </span>
                    <span className="text-[11px] font-medium text-zinc-400">
                      {product.category}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => onAddToCart(product)}
                      className="inline-flex cursor-pointer items-center justify-center gap-1 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-[#09090B] transition hover:border-zinc-300 hover:bg-zinc-50"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Add to Cart
                    </button>
                    <button
                      type="button"
                      onClick={() => onAiBuyProduct(product)}
                      className="inline-flex cursor-pointer items-center justify-center gap-1 rounded-xl bg-[#0070E0] px-3 py-2 text-xs font-semibold text-white transition hover:bg-[#003087]"
                    >
                      <Zap className="h-3.5 w-3.5" />
                      AI Buy
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Product Inspect & Merchant DOM Metadata Modal */}
      {inspectedProduct && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="inspect-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/50 p-4 backdrop-blur-xs"
          onClick={() => setInspectedProduct(null)}
        >
          <div
            className="w-full max-w-lg overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative aspect-[16/9] w-full bg-zinc-100">
              <Image
                src={inspectedProduct.imageUrl}
                alt={inspectedProduct.imageAlt}
                fill
                sizes="(max-width: 640px) 100vw, 512px"
                className="object-cover"
              />
              <button
                type="button"
                aria-label="Close product inspector"
                onClick={() => setInspectedProduct(null)}
                className="absolute right-3 top-3 cursor-pointer rounded-full bg-zinc-950/75 p-2 text-white backdrop-blur-xs hover:bg-zinc-950"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-6">
              <div className="flex items-center justify-between text-xs text-zinc-500">
                <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 font-medium text-zinc-700">
                  {inspectedProduct.category} · {inspectedProduct.sku}
                </span>
                <span className="font-mono font-bold text-lg text-[#09090B]">
                  ${inspectedProduct.price.toFixed(2)}
                </span>
              </div>

              <h3
                id="inspect-modal-title"
                className="mt-2 font-display text-lg font-bold text-[#09090B]"
              >
                {inspectedProduct.name}
              </h3>

              <p className="mt-2 text-sm leading-relaxed text-zinc-600">
                {inspectedProduct.description}
              </p>

              <div className="mt-4 flex flex-wrap gap-2">
                {inspectedProduct.specs.map((spec) => (
                  <span
                    key={spec}
                    className="rounded-lg border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-xs font-medium text-zinc-700"
                  >
                    {spec}
                  </span>
                ))}
              </div>

              <div className="mt-5 rounded-2xl border border-zinc-200 bg-zinc-50 p-3.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-zinc-800">
                    Merchant Page Source Inspector
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowRawDom((prev) => !prev)}
                    className="cursor-pointer text-xs font-semibold text-[#0070E0] hover:underline"
                  >
                    {showRawDom ? "Hide Raw Metadata" : "Inspect Raw Metadata"}
                  </button>
                </div>
                {showRawDom && (
                  <pre className="mt-2 overflow-x-auto rounded-xl bg-zinc-950 p-3 font-mono text-[11px] leading-relaxed text-zinc-200">
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

              <div className="mt-6 grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => {
                    onAddToCart(inspectedProduct);
                    setInspectedProduct(null);
                  }}
                  className="cursor-pointer rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-xs font-semibold text-[#09090B] hover:bg-zinc-50"
                >
                  Add to Cart
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const target = inspectedProduct;
                    setInspectedProduct(null);
                    onAiBuyProduct(target);
                  }}
                  className="inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-[#0070E0] px-4 py-2.5 text-xs font-semibold text-white hover:bg-[#003087]"
                >
                  <Zap className="h-3.5 w-3.5" />
                  Buy via AI Shopper
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
