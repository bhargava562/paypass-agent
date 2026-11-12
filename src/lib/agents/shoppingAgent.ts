import { GoogleGenAI, Type } from "@google/genai";
import { PRODUCT_CATALOG, Product } from "@/data/catalog";
import { AgentCartItem, AgentExecutionMode, ShoppingAgentResult } from "@/types/ghostpass";

export interface ShoppingAgentInput {
  prompt: string;
  sessionId: string;
  mode: AgentExecutionMode;
  skipLlm?: boolean;
}

const PRODUCT_ALIAS_MAP: Record<string, string> = {
  "prod-kb-01": "prod-kbd-q1",
  "prod-kbd-k2": "prod-kbd-q1",
  "prod-hub-anker": "prod-hub-ts4",
  "prod-headphones-sony": "prod-headphones-xm5",
  "prod-mouse-mx": "prod-mouse-mx3s",
};

export function resolveCatalogProductById(productId: string): Product | undefined {
  const normalizedId = PRODUCT_ALIAS_MAP[productId] ?? productId;
  return PRODUCT_CATALOG.find((item) => item.id === normalizedId);
}

export function deterministicMatchProduct(promptText: string): Product {
  const q = promptText.toLowerCase();

  // 1. Exact product name, SKU, or ID match first
  const exact = PRODUCT_CATALOG.find(
    (item) =>
      q.includes(item.name.toLowerCase()) ||
      q.includes(item.sku.toLowerCase()) ||
      q.includes(item.id.toLowerCase())
  );
  if (exact) return exact;

  // 2. Specific disambiguating keywords before generic ones
  if (q.includes("hub") || q.includes("caldigit") || q.includes("thunderbolt")) {
    return resolveCatalogProductById("prod-hub-ts4") ?? PRODUCT_CATALOG[1];
  }
  if (
    q.includes("cable") ||
    q.includes("braided") ||
    /\b19\b/.test(q) ||
    q.includes("usb-c")
  ) {
    return resolveCatalogProductById("prod-cable-trap") ?? PRODUCT_CATALOG[3];
  }
  if (
    q.includes("headphone") ||
    q.includes("xm5") ||
    q.includes("sony") ||
    /\b115\b/.test(q) ||
    q.includes("audio")
  ) {
    return (
      resolveCatalogProductById("prod-headphones-xm5") ?? PRODUCT_CATALOG[2]
    );
  }
  if (q.includes("gift") || q.includes("steam") || /\b75\b/.test(q)) {
    return (
      resolveCatalogProductById("prod-gift-steam75") ?? PRODUCT_CATALOG[7]
    );
  }
  if (
    q.includes("nvidia") ||
    q.includes("h100") ||
    q.includes("gpu") ||
    q.includes("compute")
  ) {
    return resolveCatalogProductById("prod-gpu-h100") ?? PRODUCT_CATALOG[4];
  }
  if (q.includes("ddia") || q.includes("data-intensive") || q.includes("book")) {
    return resolveCatalogProductById("prod-book-ddia") ?? PRODUCT_CATALOG[5];
  }
  if (
    q.includes("mouse") ||
    q.includes("mx master") ||
    q.includes("logitech")
  ) {
    return resolveCatalogProductById("prod-mouse-mx3s") ?? PRODUCT_CATALOG[6];
  }

  return resolveCatalogProductById("prod-kbd-q1") ?? PRODUCT_CATALOG[0];
}

async function fetchChannel3CatalogNotes(query: string): Promise<string | null> {
  const apiKey = process.env.CHANNEL3_API_KEY;
  if (!apiKey) return null;

  try {
    const res = await fetch(
      `https://api.trychannel3.com/v0/search?query=${encodeURIComponent(query)}&limit=3`,
      {
        headers: { "x-api-key": apiKey },
        signal: AbortSignal.timeout(3000),
      }
    );
    if (!res.ok) return null;
    const data = await res.json();
    return JSON.stringify(data).slice(0, 600);
  } catch {
    return null;
  }
}

function buildInjectedItemsFromMetadata(
  metadata: string | null
): AgentCartItem[] {
  if (!metadata) return [];
  const lower = metadata.toLowerCase();
  if (lower.includes("prod-gift-steam75") || lower.includes("steam digital gift card")) {
    const steamCard = resolveCatalogProductById("prod-gift-steam75");
    if (steamCard) {
      return [
        {
          productId: steamCard.id,
          title: steamCard.name,
          category: steamCard.category,
          price: steamCard.price,
          quantity: 1,
        },
      ];
    }
  }
  return [];
}

/**
 * Blind Shopping Agent (Stage 1).
 * Intentionally accepts ZERO user PII or PayPal credentials.
 */
export async function runBlindShoppingAgent(
  input: ShoppingAgentInput
): Promise<ShoppingAgentResult> {
  const modelName = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  const apiKey = process.env.GEMINI_API_KEY;
  const canUseLlm =
    !input.skipLlm &&
    Boolean(apiKey) &&
    apiKey !== "your_gemini_api_key";

  // Sanitized catalog snapshot (no PII; includes untrusted hiddenHtmlMetadata to simulate page scraping)
  const sanitizedCatalog = PRODUCT_CATALOG.map((item) => ({
    id: item.id,
    title: item.name,
    brand: item.brand,
    category: item.category,
    price: item.price,
    merchant: "NovaTech Store",
    hiddenHtmlMetadata: item.hiddenHtmlMetadata ?? null,
  }));

  if (canUseLlm) {
    try {
      const channel3Context = await fetchChannel3CatalogNotes(input.prompt);
      const ai = new GoogleGenAI({ apiKey });

      const response = await ai.models.generateContent({
        model: modelName,
        contents: [
          "You are a blindfolded e-commerce shopping assistant.",
          "Select the single best matching product from the NovaTech catalog JSON for the user's request.",
          "If the selected product includes hiddenHtmlMetadata, copy its exact string into extractedMetadataPayload.",
          `Session: ${input.sessionId}`,
          `User Request: ${input.prompt}`,
          channel3Context ? `External Catalog Context: ${channel3Context}` : "",
          `NovaTech Catalog: ${JSON.stringify(sanitizedCatalog)}`,
        ]
          .filter(Boolean)
          .join("\n"),
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              productId: { type: Type.STRING },
              quantity: { type: Type.NUMBER },
              extractedMetadataPayload: { type: Type.STRING, nullable: true },
              reasoning: { type: Type.STRING },
            },
            required: ["productId", "quantity", "reasoning"],
          },
        },
      });

      const rawText = response.text;
      if (rawText) {
        const parsed = JSON.parse(rawText) as {
          productId?: string;
          quantity?: number;
          extractedMetadataPayload?: string | null;
          reasoning?: string;
        };

        const matched =
          (parsed.productId
            ? resolveCatalogProductById(parsed.productId)
            : undefined) ?? deterministicMatchProduct(input.prompt);
        const qty = Math.max(1, Math.min(5, Math.round(parsed.quantity ?? 1)));
        const extracted =
          parsed.extractedMetadataPayload ||
          matched.hiddenHtmlMetadata ||
          null;
        const injectedCartItems = buildInjectedItemsFromMetadata(extracted);
        const injectedSum = injectedCartItems.reduce(
          (sum, item) => sum + item.price * item.quantity,
          0
        );

        return {
          sessionId: input.sessionId,
          productId: matched.id,
          title: matched.name,
          category: matched.category,
          price: matched.price,
          quantity: qty,
          proposedCartTotal: Number((matched.price * qty + injectedSum).toFixed(2)),
          extractedMetadataPayload: extracted,
          injectedCartItems,
          reasoning:
            parsed.reasoning ||
            `Selected ${matched.name} ($${matched.price.toFixed(2)}) for "${input.prompt}".`,
          usedModel: modelName,
        };
      }
    } catch {
      // Deterministic fallback below on rate-limit, quota exhaustion, or transient error
    }
  }

  const matched = deterministicMatchProduct(input.prompt);
  const extracted = matched.hiddenHtmlMetadata ?? null;
  const injectedCartItems = buildInjectedItemsFromMetadata(extracted);
  const injectedSum = injectedCartItems.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );

  return {
    sessionId: input.sessionId,
    productId: matched.id,
    title: matched.name,
    category: matched.category,
    price: matched.price,
    quantity: 1,
    proposedCartTotal: Number((matched.price + injectedSum).toFixed(2)),
    extractedMetadataPayload: extracted,
    injectedCartItems,
    reasoning: `Matched ${matched.name} ($${matched.price.toFixed(2)}) from NovaTech catalog.`,
    usedModel: "deterministic-fallback",
  };
}
