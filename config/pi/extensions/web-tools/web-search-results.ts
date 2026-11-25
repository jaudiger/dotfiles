export const WEB_SEARCH_PROVIDERS = ["DuckDuckGo", "Startpage"] as const;

export type WebSearchProvider = (typeof WEB_SEARCH_PROVIDERS)[number];

export type WebSearchResult = {
  title: string;
  url: string;
  snippet?: string;
};

export function isWebSearchProvider(
  value: unknown,
): value is WebSearchProvider {
  return WEB_SEARCH_PROVIDERS.includes(value as WebSearchProvider);
}

export function isWebSearchResult(value: unknown): value is WebSearchResult {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { title?: unknown }).title === "string" &&
    typeof (value as { url?: unknown }).url === "string" &&
    ((value as { snippet?: unknown }).snippet === undefined ||
      typeof (value as { snippet?: unknown }).snippet === "string")
  );
}

export function isWebSearchResults(value: unknown): value is WebSearchResult[] {
  return Array.isArray(value) && value.every(isWebSearchResult);
}
