"use client";

import React, { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { ArrowRight, Eye, Plus, Star, Truck, X } from "lucide-react";
import { Product, ProductCategory } from "@/data/catalog";

interface ProductGridProps {
  products: Product[];
  selectedCategory: "All" | ProductCategory;
  onSelectCategory: (category: "All" | ProductCategory) => void;
  searchQuery: string;
  onResetFilters: () => void;
  onAddToCart: (product: Product) => void;
  onBuyNow: (product: Product) => void;
  highlightedProductId?: string | null;
}

export function ProductGrid({
  products,
  selectedCategory,
  onSelectCategory,
  searchQuery,
  onResetFilters,
  onAddToCart,
  onBuyNow,
  highlightedProductId,
}: ProductGridProps) {
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

  function handleShopNewArrivals() {
    onSelectCategory("All");
    const grid = document.getElementById("novatech-catalog-grid");
    grid?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <section className="mx-auto w-full max-w-7xl px-4 pb-28 pt-6 sm:px-6">
      {/* Pure Retail Seasonal Banner */}
      <div className="mb-8 flex flex-col justify-between gap-6 rounded-3xl border border-[#E4E4E7] bg-white p-6 shadow-xs sm:flex-row sm:items-center sm:p-8">
        <div className="max-w-2xl">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-[#E4E4E7] bg-zinc-50 px-3 py-1 text-xs font-medium text-zinc-700">
            <Truck className="h-3.5 w-3.5 text-zinc-900" aria-hidden="true" />
            <span>Free 2-Day Express Shipping on Orders Over $35</span>
          </div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-[#09090B] sm:text-3xl">
            Precision Workspace &amp; Studio Hardware
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-zinc-600">
            Shop flagship mechanical keyboards, Thunderbolt 4 docks, studio
            noise-canceling headphones, and cloud compute packs with verified
            manufacturer warranties.
          </p>
        </div>

        <div className="flex shrink-0 flex-col items-start gap-2 sm:items-end">
          <button
            type="button"
            onClick={handleShopNewArrivals}
            className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-full bg-[#09090B] px-5 text-xs font-semibold text-white transition-colors duration-200 hover:bg-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0070E0] focus-visible:ring-offset-2"
          >
            <span>Shop New Arrivals</span>
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
          <span className="text-xs text-zinc-600">
            {filteredProducts.length} items in {selectedCategory}
          </span>
        </div>
      </div>

      {/* Product Grid or Empty State */}
      {filteredProducts.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-zinc-300 bg-white py-16 text-center">
          <p className="text-sm font-semibold text-[#09090B]">
            No products matched &ldquo;{searchQuery}&rdquo;
          </p>
          <p className="mt-1 text-xs text-zinc-600">
            Clear your search or return to All departments.
          </p>
          <button
            type="button"
            onClick={onResetFilters}
            className="mt-4 h-10 cursor-pointer rounded-full bg-[#09090B] px-5 text-xs font-semibold text-white transition-colors duration-200 hover:bg-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0070E0] focus-visible:ring-offset-2"
          >
            Reset Store Filters
          </button>
        </div>
      ) : (
        <div
          id="novatech-catalog-grid"
          className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
        >
          {filteredProducts.map((product, index) => {
            const isHighlighted = highlightedProductId === product.id;

            return (
              <article
                key={product.id}
                className={`group flex flex-col justify-between overflow-hidden rounded-2xl border bg-white transition-all duration-200 hover:border-zinc-300 hover:shadow-md ${
                  isHighlighted
                    ? "border-[#0070E0] ring-2 ring-[#0070E0]/25 shadow-md"
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
                      className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                    />

                    {product.badge && (
                      <span className="absolute left-3 top-3 rounded-full border border-white/60 bg-white/95 px-2.5 py-0.5 text-[11px] font-semibold text-[#09090B] shadow-xs backdrop-blur-xs">
                        {product.badge}
                      </span>
                    )}

                    <button
                      type="button"
                      aria-label={`Quick view ${product.name}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setInspectedProduct(product);
                        setShowRawDom(false);
                      }}
                      className="absolute right-3 top-3 inline-flex cursor-pointer items-center gap-1 rounded-full border border-white/40 bg-zinc-950/80 px-2.5 py-1 text-[11px] font-medium text-white opacity-95 backdrop-blur-xs transition-colors duration-200 hover:bg-zinc-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#38BDF8] group-hover:opacity-100"
                    >
                      <Eye className="h-3 w-3" aria-hidden="true" />
                      Details
                    </button>
                  </div>

                  {/* Product Details */}
                  <div className="p-4 pb-3">
                    <div className="mb-1.5 flex items-center justify-between text-[11px] font-medium text-zinc-600">
                      <span>{product.brand}</span>
                      <span className="inline-flex items-center gap-1 text-zinc-700">
                        <Star
                          className="h-3 w-3 fill-amber-400 text-amber-400"
                          aria-hidden="true"
                        />
                        <span className="font-mono">
                          {product.rating.toFixed(1)}
                        </span>
                        <span className="text-zinc-600">
                          ({product.reviewsCount})
                        </span>
                      </span>
                    </div>

                    <h2 className="line-clamp-2 font-display text-sm font-semibold leading-snug text-[#09090B]">
                      <button
                        type="button"
                        onClick={() => {
                          setInspectedProduct(product);
                          setShowRawDom(false);
                        }}
                        className="cursor-pointer rounded text-left transition-colors duration-200 hover:text-zinc-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0070E0]"
                      >
                        {product.name}
                      </button>
                    </h2>

                    <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-zinc-600">
                      {product.description}
                    </p>
                  </div>
                </div>

                {/* Price + Standard Retail Actions */}
                <div className="border-t border-zinc-100 px-4 pb-4 pt-3">
                  <div className="mb-3 flex items-baseline justify-between gap-2">
                    <span className="font-mono text-lg font-bold tracking-tight text-[#09090B]">
                      ${product.price.toFixed(2)}
                    </span>
                    <span className="text-[11px] font-medium text-zinc-600">
                      {product.category}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => onAddToCart(product)}
                      className="inline-flex h-10 cursor-pointer items-center justify-center gap-1 rounded-xl border border-[#E4E4E7] bg-white px-3 text-xs font-semibold text-[#09090B] transition-colors duration-200 hover:border-zinc-300 hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0070E0] focus-visible:ring-offset-1"
                    >
                      <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                      Add to Cart
                    </button>
                    <button
                      type="button"
                      onClick={() => onBuyNow(product)}
                      className="inline-flex h-10 cursor-pointer items-center justify-center rounded-xl bg-[#09090B] px-3 text-xs font-semibold text-white transition-colors duration-200 hover:bg-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0070E0] focus-visible:ring-offset-1"
                    >
                      Buy Now
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Standard Retail Product Quick-View Modal */}
      {inspectedProduct && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="inspect-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/50 p-4 backdrop-blur-xs"
          onClick={() => setInspectedProduct(null)}
        >
          <div
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl border border-[#E4E4E7] bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative aspect-[4/3] w-full bg-zinc-100">
              <Image
                src={inspectedProduct.imageUrl}
                alt={inspectedProduct.imageAlt}
                fill
                sizes="(max-width: 640px) 100vw, 512px"
                className="object-cover"
              />
              <button
                type="button"
                aria-label="Close product details"
                onClick={() => setInspectedProduct(null)}
                className="absolute right-3 top-3 cursor-pointer rounded-full bg-zinc-950/80 p-2 text-white backdrop-blur-xs transition-colors duration-200 hover:bg-zinc-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#38BDF8]"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            <div className="p-6">
              <div className="flex items-center justify-between text-xs text-zinc-500">
                <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 font-medium text-zinc-700">
                  {inspectedProduct.category} · {inspectedProduct.sku}
                </span>
                <span className="font-mono text-lg font-bold text-[#09090B]">
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
                    Page HTML Source
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowRawDom((prev) => !prev)}
                    className="cursor-pointer text-xs font-semibold text-zinc-700 underline-offset-2 hover:underline"
                  >
                    {showRawDom ? "Hide Source" : "View Page Source"}
                  </button>
                </div>
                {showRawDom && (
                  <pre className="mt-2 overflow-x-auto rounded-xl bg-zinc-950 p-3 font-mono text-[11px] leading-relaxed text-zinc-200">
                    {JSON.stringify(
                      {
                        id: inspectedProduct.id,
                        price: inspectedProduct.price,
                        category: inspectedProduct.category,
                        htmlMetadata:
                          inspectedProduct.hiddenHtmlMetadata ??
                          "<!-- Standard NovaTech product listing markup -->",
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
                  className="h-10 cursor-pointer rounded-xl border border-[#E4E4E7] bg-white px-4 text-xs font-semibold text-[#09090B] transition-colors duration-200 hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0070E0] focus-visible:ring-offset-1"
                >
                  Add to Cart
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const target = inspectedProduct;
                    setInspectedProduct(null);
                    onBuyNow(target);
                  }}
                  className="h-10 cursor-pointer rounded-xl bg-[#09090B] px-4 text-xs font-semibold text-white transition-colors duration-200 hover:bg-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0070E0] focus-visible:ring-offset-1"
                >
                  Buy Now
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
