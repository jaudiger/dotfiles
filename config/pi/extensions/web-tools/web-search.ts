// This order follows the instances listed at https://searx.space.
export const SEARXNG_INSTANCES = ["https://search.lumy.live"] as const;

export const REQUEST_TIMEOUT_MS = 10_000;
export const RETRY_DELAY_MS = 500;
export const MAX_RETRIES = 3;
export const MAX_RESULTS = 12;

const REQUEST_HEADERS = {
  Accept:
    "application/json, text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.5",
  "Cache-Control": "no-cache",
  Pragma: "no-cache",
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36",
};

export interface SearchResult {
  url: string;
  title: string;
  content: string;
}

let nextInstanceIndex = 0;

function decodeHtmlEntities(value: string): string {
  const namedEntities: Record<string, string> = {
    amp: "&",
    apos: "'",
    gt: ">",
    nbsp: " ",
    lt: "<",
    quot: '"',
  };

  return value.replace(
    /&(#x[\da-f]+|#\d+|[a-z][\da-z]+);/gi,
    (entity, name: string) => {
      const lowerName = name.toLowerCase();
      if (lowerName.startsWith("#x"))
        return String.fromCodePoint(parseInt(lowerName.slice(2), 16));
      if (lowerName.startsWith("#"))
        return String.fromCodePoint(parseInt(lowerName.slice(1), 10));
      return namedEntities[lowerName] ?? entity;
    },
  );
}

function textFromHtml(value: string): string {
  return decodeHtmlEntities(
    value.replace(/<br\s*\/?\s*>/gi, " ").replace(/<[^>]*>/g, ""),
  )
    .replace(/\s+/g, " ")
    .trim();
}

function attributeValue(tag: string, name: string): string | undefined {
  const match = tag.match(new RegExp(`${name}\\s*=\\s*(["'])(.*?)\\1`, "i"));
  return match ? decodeHtmlEntities(match[2]) : undefined;
}

function isResultArticle(article: string): boolean {
  const openingTag = article.match(/^<article\b[^>]*>/i)?.[0] ?? "";
  const className = attributeValue(openingTag, "class") ?? "";
  return /(?:^|\s)result(?:\s|$)/i.test(className);
}

export function parseSearxngJson(json: string): SearchResult[] {
  let value: unknown;
  try {
    value = JSON.parse(json);
  } catch {
    return [];
  }

  if (!value || typeof value !== "object") return [];

  const results = (value as Record<string, unknown>).results;
  if (!Array.isArray(results)) return [];

  return results.flatMap((result: unknown) => {
    if (!result || typeof result !== "object") return [];

    const candidate = result as Record<string, unknown>;
    const url = typeof candidate.url === "string" ? candidate.url.trim() : "";
    const title = candidate.title;
    const content = candidate.content;
    if (
      !/^https?:\/\//i.test(url) ||
      typeof title !== "string" ||
      typeof content !== "string"
    )
      return [];

    return [{ url, title, content }];
  });
}

export function parseSearxngHtml(html: string): SearchResult[] {
  const results: SearchResult[] = [];
  const articles = html.match(/<article\b[^>]*>[\s\S]*?<\/article>/gi) ?? [];

  for (const article of articles) {
    if (!isResultArticle(article)) continue;

    const heading = article.match(
      /<h3\b[^>]*>[\s\S]*?<a\b([^>]*)>([\s\S]*?)<\/a>/i,
    );
    if (!heading) continue;

    const href = attributeValue(`<a${heading[1]}>`, "href")?.trim();
    if (!href || !/^https?:\/\//i.test(href)) continue;

    const contentMatch = (article.match(/<p\b([^>]*)>([\s\S]*?)<\/p>/gi) ?? [])
      .map((paragraph) => {
        const match = paragraph.match(/^<p\b([^>]*)>([\s\S]*?)<\/p>$/i);
        return (
          match && {
            attributes: match[1],
            text: match[2],
          }
        );
      })
      .find((paragraph) => {
        if (!paragraph) return false;
        const className =
          attributeValue(`<p${paragraph.attributes}>`, "class") ?? "";
        return className.split(/\s+/).includes("content");
      });

    results.push({
      url: href,
      title: textFromHtml(heading[2]),
      content: contentMatch ? textFromHtml(contentMatch.text) : "",
    });
  }

  return results;
}

function parseSearxngResponse(response: SearchResponse): SearchResult[] {
  const isJson = /(?:^|\/)json(?:;|$)/i.test(response.contentType);
  const primary = isJson
    ? parseSearxngJson(response.body)
    : parseSearxngHtml(response.body);
  if (primary.length > 0) return primary;

  return isJson
    ? parseSearxngHtml(response.body)
    : parseSearxngJson(response.body);
}

function waitForRetry(delayMs: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    let timeout: ReturnType<typeof setTimeout>;
    const onAbort = () => {
      clearTimeout(timeout);
      signal.removeEventListener("abort", onAbort);
      reject(new Error("Search was aborted"));
    };
    timeout = setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, delayMs);
    signal.addEventListener("abort", onAbort, { once: true });
    if (signal.aborted) onAbort();
  });
}

interface SearchResponse {
  body: string;
  contentType: string;
}

async function fetchSearchPage(
  url: string,
  signal: AbortSignal,
): Promise<SearchResponse> {
  const timeoutController = new AbortController();
  const onAbort = () => timeoutController.abort();
  const timeout = setTimeout(
    () => timeoutController.abort(),
    REQUEST_TIMEOUT_MS,
  );
  signal.addEventListener("abort", onAbort, { once: true });

  try {
    const response = await fetch(url, {
      headers: REQUEST_HEADERS,
      signal: timeoutController.signal,
    });
    if (!response.ok)
      throw new Error(`Search request failed: ${response.status}`);
    return {
      body: await response.text(),
      contentType: response.headers.get("content-type") ?? "",
    };
  } finally {
    clearTimeout(timeout);
    signal.removeEventListener("abort", onAbort);
  }
}

function searchUrl(instance: string, query: string): string {
  const url = new URL("/search", instance);
  url.searchParams.set("q", query);
  url.searchParams.set("categories", "general");
  url.searchParams.set("language", "en");
  url.searchParams.set("pageno", "1");
  url.searchParams.set("safesearch", "1");
  url.searchParams.set("time_range", "");
  url.searchParams.set("theme", "simple");
  url.searchParams.set("format", "json");
  return url.toString();
}

interface QuerySearchResult {
  results: SearchResult[];
  succeeded: boolean;
}

async function searchQuery(
  query: string,
  signal: AbortSignal,
): Promise<QuerySearchResult> {
  for (let retry = 0; retry <= MAX_RETRIES; retry++) {
    for (let offset = 0; offset < SEARXNG_INSTANCES.length; offset++) {
      const instanceIndex =
        (nextInstanceIndex + offset) % SEARXNG_INSTANCES.length;
      const instance = SEARXNG_INSTANCES[instanceIndex];
      try {
        const response = await fetchSearchPage(
          searchUrl(instance, query),
          signal,
        );
        const results = parseSearxngResponse(response);
        if (results.length === 0) throw new Error("Search returned no results");
        nextInstanceIndex = (instanceIndex + 1) % SEARXNG_INSTANCES.length;
        return { results, succeeded: true };
      } catch (error) {
        if (signal.aborted) throw error;
      }
    }

    if (retry < MAX_RETRIES)
      await waitForRetry(RETRY_DELAY_MS * 2 ** retry, signal);
  }

  return { results: [], succeeded: false };
}

export function mergeSearchResults(groups: SearchResult[][]): SearchResult[] {
  const merged: SearchResult[] = [];
  const seenUrls = new Set<string>();
  const maxGroupLength = Math.max(0, ...groups.map((group) => group.length));

  for (
    let rank = 0;
    rank < maxGroupLength && merged.length < MAX_RESULTS;
    rank++
  ) {
    for (const group of groups) {
      const result = group[rank];
      if (!result || seenUrls.has(result.url)) continue;
      seenUrls.add(result.url);
      merged.push(result);
      if (merged.length >= MAX_RESULTS) break;
    }
  }

  return merged;
}

export async function executeWebSearch(queries: string[], signal: AbortSignal) {
  const groups: SearchResult[][] = [];
  let failedQueries = 0;

  for (const query of queries) {
    const result = await searchQuery(query, signal);
    groups.push(result.results);
    if (!result.succeeded) failedQueries++;
  }

  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(mergeSearchResults(groups)),
      },
    ],
    details: {},
    isError: failedQueries > 0,
  };
}
