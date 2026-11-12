import { GoogleGenAI, Type } from "@google/genai";
import { PRODUCT_CATALOG, Product, ProductCategory } from "@/data/catalog";
import {
  AgentCartItem,
  AgentExecutionMode,
  CustomItemInput,
  ShoppingAgentResult,
} from "@/types/ghostpass";

export interface ShoppingAgentInput {
  prompt: string;
  sessionId: string;
  mode: AgentExecutionMode;
  customItem?: CustomItemInput;
  skipLlm?: boolean;
}

const GEMINI_TIMEOUT_MS = 8_000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("LLM_TIMEOUT")), ms);
    promise.then(
      (val) => {
        clearTimeout(timer);
        resolve(val);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
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
    const data: unknown = await res.json();
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

  // Extract custom adversarial injected gift card / add-on items
  const looksMalicious =
    /gift card|system override|ignore|directive|inject|silently add|external_attacker/i.test(
      metadata
    );
  if (looksMalicious) {
    const dollarMatch = metadata.match(/\$\s*(\d+(?:\.\d{1,2})?)/);
    const injectedPrice = dollarMatch ? Number(dollarMatch[1]) : 75;
    return [
      {
        productId: "custom-injected-item",
        title: lower.includes("gift card")
          ? "Injected Gift Card"
          : "Injected Adversarial Item",
        category: "Accessories",
        price: Number.isFinite(injectedPrice) && injectedPrice > 0 ? injectedPrice : 75,
        quantity: 1,
      },
    ];
  }

  return [];
}

export function normalizeCustomCategory(
  rawCategory: string | undefined,
  title: string
): ProductCategory {
  const combined = `${rawCategory ?? ""} ${title}`.toLowerCase();
  if (
    combined.includes("keyboard") ||
    combined.includes("mouse") ||
    combined.includes("mice") ||
    combined.includes("numpad") ||
    combined.includes("monitor")
  ) {
    return "Keyboards & Mice";
  }
  if (
    combined.includes("audio") ||
    combined.includes("headphone") ||
    combined.includes("earbud") ||
    combined.includes("speaker") ||
    combined.includes("mic")
  ) {
    return "Audio";
  }
  if (
    combined.includes("book") ||
    combined.includes("cloud") ||
    combined.includes("gpu") ||
    combined.includes("compute")
  ) {
    return "Cloud & Books";
  }
  return "Accessories";
}

function toTitleCase(raw: string): string {
  return raw
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function buildCustomProduct(input: {
  title: string;
  price: number;
  category?: string;
  merchant?: string;
  hiddenInjection?: string;
}): Product {
  const cleanTitle = input.title.trim() || "Custom Hardware Item";
  const cleanPrice = Number(Math.max(0.01, Number(input.price)).toFixed(2));
  const lower = `${cleanTitle} ${input.category ?? ""}`.toLowerCase();
  const slug =
    cleanTitle
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 28) || "item";
  const productId = `custom-${slug}-${Math.round(cleanPrice * 100)}`;

  return {
    id: productId,
    sku: `CUS-${Math.round(cleanPrice * 100)}`,
    name: cleanTitle,
    brand: input.merchant?.trim() || "Custom Merchant",
    category: normalizeCustomCategory(input.category, cleanTitle),
    price: cleanPrice,
    rating: 4.8,
    reviewsCount: 1,
    description: `Custom evaluation item from ${
      input.merchant?.trim() || "Custom Merchant"
    }.`,
    specs: ["Custom Input Payload"],
    imageUrl: PRODUCT_CATALOG[0].imageUrl,
    imageAlt: cleanTitle,
    isGiftCard: lower.includes("gift card"),
    isSubscription: lower.includes("subscription"),
    hiddenHtmlMetadata: input.hiddenInjection?.trim() || undefined,
  };
}

/**
 * Parses arbitrary judge natural-language prompts that specify an explicit price
 * for a custom product (e.g. "Buy a $35 mechanical numpad", "Buy a $90 gift card").
 * Returns null if the prompt uses a budget ceiling ("under $60") or matches a canonical catalog SKU price.
 */
export function parseExplicitCustomPrompt(promptText: string): Product | null {
  const priceMatch = promptText.match(
    /(?:\$\s*(\d+(?:\.\d{1,2})?))|(?:(\d+(?:\.\d{1,2})?)\s*dollars?)/i
  );
  if (!priceMatch) return null;

  const matchedIndex = priceMatch.index ?? 0;
  const prefixWindow = promptText
    .slice(Math.max(0, matchedIndex - 18), matchedIndex)
    .toLowerCase();
  if (/(under|below|max|less than|within|up to)\s*$/.test(prefixWindow)) {
    return null;
  }

  const parsedPrice = Number(priceMatch[1] ?? priceMatch[2]);
  if (!Number.isFinite(parsedPrice) || parsedPrice <= 0) return null;

  // Preserve exact canonical catalog matches at their exact catalog price
  const catalogMatch = deterministicMatchProduct(promptText);
  const lowerPrompt = promptText.toLowerCase();
  if (
    Math.abs(catalogMatch.price - parsedPrice) < 0.01 &&
    (lowerPrompt.includes("cable") ||
      lowerPrompt.includes("keychron") ||
      lowerPrompt.includes("caldigit") ||
      lowerPrompt.includes("sony") ||
      lowerPrompt.includes("xm5") ||
      lowerPrompt.includes("mx master") ||
      lowerPrompt.includes("steam") ||
      lowerPrompt.includes("ddia"))
  ) {
    return null;
  }

  const withoutPrice = promptText
    .replace(priceMatch[0], " ")
    .replace(/\b(buy|purchase|order|get|me|a|an|the|for|please|usd|from)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

  const title = withoutPrice ? toTitleCase(withoutPrice) : "Custom Item";
  return buildCustomProduct({ title, price: parsedPrice });
}

/**
 * Blind Shopping Agent (Stage 1).
 * Intentionally accepts ZERO user PII or PayPal credentials.
 */
export async function runBlindShoppingAgent(
  input: ShoppingAgentInput
): Promise<ShoppingAgentResult> {
  // Priority 1: Explicit structured customItem payload from UI / API test
  if (input.customItem && input.customItem.title.trim()) {
    const customProduct = buildCustomProduct(input.customItem);
    const extracted = customProduct.hiddenHtmlMetadata ?? null;
    const injectedCartItems = buildInjectedItemsFromMetadata(extracted);
    const injectedSum = injectedCartItems.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0
    );

    return {
      sessionId: input.sessionId,
      productId: customProduct.id,
      title: customProduct.name,
      category: customProduct.category,
      price: customProduct.price,
      quantity: 1,
      proposedCartTotal: Number((customProduct.price + injectedSum).toFixed(2)),
      extractedMetadataPayload: extracted,
      injectedCartItems,
      reasoning: `Custom payload "${customProduct.name}" ($${customProduct.price.toFixed(
        2
      )}) from ${customProduct.brand}.`,
      usedModel: "custom-payload-parser",
      customProduct,
    };
  }

  // Priority 2: Arbitrary custom prompt with explicit dollar amount (e.g. "$35 mechanical numpad")
  const explicitCustom = parseExplicitCustomPrompt(input.prompt);
  if (explicitCustom) {
    return {
      sessionId: input.sessionId,
      productId: explicitCustom.id,
      title: explicitCustom.name,
      category: explicitCustom.category,
      price: explicitCustom.price,
      quantity: 1,
      proposedCartTotal: explicitCustom.price,
      extractedMetadataPayload: null,
      injectedCartItems: [],
      reasoning: `Parsed custom request "${explicitCustom.name}" ($${explicitCustom.price.toFixed(
        2
      )}).`,
      usedModel: "custom-prompt-parser",
      customProduct: explicitCustom,
    };
  }
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

      const response = await withTimeout(
        ai.models.generateContent({
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
        }),
        GEMINI_TIMEOUT_MS
      );

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
