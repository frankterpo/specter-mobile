export type SavedSearchProduct =
  | "companies"
  | "people"
  | "investors"
  | "talent"
  | "strategic"
  | "unknown";

const PRODUCT_HINTS: Array<[SavedSearchProduct, string[]]> = [
  ["talent", ["talent"]],
  ["people", ["people", "person"]],
  ["companies", ["company", "companies"]],
  ["investors", ["investor", "investors", "stratintel", "investor-interest"]],
  ["strategic", ["strategic", "strat", "strategy"]],
];

function normalizeCandidate(value: unknown): string | null {
  if (typeof value === "string") return value.toLowerCase();
  if (Array.isArray(value)) return value.map(String).join(" ").toLowerCase();
  return null;
}

export function resolveSavedSearchProduct(search: any): SavedSearchProduct {
  if (!search || typeof search !== "object") return "unknown";
  const candidates = [
    search.product,
    search.product_type,
    search.productType,
    search.searchProduct,
    search.search_product,
    search.searchType,
    search.search_type,
    search.type,
    search.category,
    search.kind,
    search?.queries?.product,
    search?.queries?.query?.product,
    search?.queries?.query?.type,
    search?.searches?.product,
    search?.searches?.query?.product,
    search?.search?.product,
    search?.search?.type,
  ];

  const normalized = candidates.map(normalizeCandidate).find(Boolean) || "";

  for (const [product, hints] of PRODUCT_HINTS) {
    if (hints.some((hint) => normalized.includes(hint))) {
      return product;
    }
  }

  const name = String(search.name || "").toLowerCase();
  for (const [product, hints] of PRODUCT_HINTS) {
    if (product === "talent") continue;
    if (hints.some((hint) => name.includes(hint))) {
      return product;
    }
  }

  return "unknown";
}

function normalizeQueryId(value: unknown): string | undefined {
  if (typeof value === "string" && value.trim().length > 0) return value;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return undefined;
}

export function resolveSavedSearchQueryId(search: any): string | undefined {
  if (!search || typeof search !== "object") return undefined;
  const candidates = [
    search.queryId,
    search.query_id,
    search.queries?.id,
    search.queries?.queryId,
    search.queries?.query_id,
    search.queries?.query?.id,
    search.queries?.query?.queryId,
    search.queries?.query?.query_id,
    search.search?.queryId,
    search.search?.query_id,
  ];

  for (const candidate of candidates) {
    const normalized = normalizeQueryId(candidate);
    if (normalized) return normalized;
  }

  return undefined;
}
