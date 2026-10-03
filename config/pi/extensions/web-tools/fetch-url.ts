import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const FETCHER_PATH = fileURLToPath(new URL("./fetch-url.py", import.meta.url));
const PYTHON_PATH = process.env.PI_WEB_TOOLS_PYTHON ?? "python3";
const MAX_OUTPUT_CHARS = 8192;
const MAX_CACHED_TEXT_BYTES = 16 * 1024 * 1024;
const MAX_CACHED_TEXT_ENTRIES = 256;
const MAX_STDERR_BYTES = 8192;
export const MAX_MATCHES = 128;
export const MAX_FIND_TEXT_LENGTH = 1024;
export const MAX_FIND_TEXT_QUERIES = 16;
const DEFAULT_RANGE_END = MAX_OUTPUT_CHARS;
const CONTEXT_CHARS = 256;

const FIND_MODES = ["exact", "case-insensitive", "fuzzy"] as const;
type FindMode = (typeof FIND_MODES)[number];

export interface FetchUrlParams {
  url: string;
  findText?: string | string[];
  findMode?: FindMode;
  range?: {
    start: number;
    end: number;
  };
}

interface Match {
  query: string;
  start: number;
  end: number;
}

type Range = { start: number; end: number };

interface CachedText {
  text: string;
  size: number;
}

const extractedTextCache = new Map<string, CachedText>();
let cachedTextBytes = 0;

function runFetcher(url: string, signal: AbortSignal): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(PYTHON_PATH, [FETCHER_PATH, url], {
      shell: false,
      signal,
      stdio: ["ignore", "pipe", "pipe"],
    });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    let stderrBytes = 0;

    // The Python fetcher owns the stdout size limit.
    child.stdout.on("data", (chunk: Buffer) => stdout.push(chunk));
    child.stderr.on("data", (chunk: Buffer) => {
      const remaining = MAX_STDERR_BYTES - stderrBytes;
      if (remaining <= 0) return;
      const captured = chunk.subarray(0, remaining);
      stderr.push(captured);
      stderrBytes += captured.length;
    });
    child.once("error", reject);
    child.once("close", (code) => {
      if (code !== 0) {
        const message = Buffer.concat(stderr).toString("utf8").trim();
        reject(
          new Error(
            message || `URL fetch failed with exit code ${code ?? "unknown"}`,
          ),
        );
        return;
      }
      resolve(Buffer.concat(stdout).toString("utf8"));
    });
  });
}

function getCachedText(url: string): string | undefined {
  const cached = extractedTextCache.get(url);
  if (cached === undefined) return undefined;
  extractedTextCache.delete(url);
  extractedTextCache.set(url, cached);
  return cached.text;
}

function cacheExtractedText(url: string, text: string): void {
  const size =
    Buffer.byteLength(url, "utf8") + Buffer.byteLength(text, "utf8") + 64;
  if (size > MAX_CACHED_TEXT_BYTES) return;

  const previous = extractedTextCache.get(url);
  if (previous !== undefined) {
    cachedTextBytes -= previous.size;
    extractedTextCache.delete(url);
  }

  while (
    cachedTextBytes + size > MAX_CACHED_TEXT_BYTES ||
    extractedTextCache.size >= MAX_CACHED_TEXT_ENTRIES
  ) {
    const oldest = extractedTextCache.entries().next().value;
    if (oldest === undefined) break;
    const [oldestUrl, oldestText] = oldest;
    extractedTextCache.delete(oldestUrl);
    cachedTextBytes -= oldestText.size;
  }

  extractedTextCache.set(url, { text, size });
  cachedTextBytes += size;
}

async function getExtractedText(url: string, signal: AbortSignal) {
  const cached = getCachedText(url);
  if (cached !== undefined) return cached;

  const text = await runFetcher(url, signal);
  const cachedDuringFetch = getCachedText(url);
  if (cachedDuringFetch !== undefined) return cachedDuringFetch;
  cacheExtractedText(url, text);
  return text;
}

function asCharacters(text: string): string[] {
  return Array.from(text);
}

function createCharacterOffsetCounter(
  text: string,
): (target: number) => number {
  let codeUnitOffset = 0;
  let characterOffset = 0;

  return (target) => {
    while (codeUnitOffset < target) {
      const codePoint = text.codePointAt(codeUnitOffset);
      if (codePoint === undefined) break;
      const nextOffset = codeUnitOffset + (codePoint > 0xffff ? 2 : 1);
      if (nextOffset > target) return characterOffset + 1;
      codeUnitOffset = nextOffset;
      characterOffset++;
    }
    return characterOffset;
  };
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function findLiteralMatches(
  text: string,
  query: string,
  caseInsensitive: boolean,
  maxMatches: number,
): Match[] {
  if (!query) return [];
  const characterOffset = createCharacterOffsetCounter(text);
  if (caseInsensitive) {
    const matches: Match[] = [];
    const pattern = new RegExp(escapeRegExp(query), "giu");

    for (const match of text.matchAll(pattern)) {
      const start = match.index ?? 0;
      const end = start + match[0].length;
      matches.push({
        query,
        start: characterOffset(start),
        end: characterOffset(end),
      });
      if (matches.length >= maxMatches) break;
    }

    return matches;
  }

  const matches: Match[] = [];
  let offset = 0;

  while (offset <= text.length - query.length) {
    const codeUnitOffset = text.indexOf(query, offset);
    if (codeUnitOffset < 0) break;

    const sourceEnd = codeUnitOffset + query.length;
    matches.push({
      query,
      start: characterOffset(codeUnitOffset),
      end: characterOffset(sourceEnd),
    });
    if (matches.length >= maxMatches) break;
    offset = sourceEnd;
  }

  return matches;
}

function fuzzyText(value: string): string {
  return fuzzyTextWithMap(value).characters.join("");
}

function fuzzyTextWithMap(value: string): {
  characters: string[];
  characterOffsets: number[];
} {
  const normalized: string[] = [];
  const characterOffsets: number[] = [];
  let sourceOffset = 0;
  let separatorPending = false;

  for (const character of value) {
    if (/^[\p{Letter}\p{Number}]$/u.test(character)) {
      if (separatorPending && normalized.length > 0) {
        normalized.push(" ");
        characterOffsets.push(sourceOffset);
      }
      for (const normalizedCharacter of Array.from(
        character.toLocaleLowerCase(),
      )) {
        normalized.push(normalizedCharacter);
        characterOffsets.push(sourceOffset);
      }
      separatorPending = false;
    } else if (normalized.length > 0) {
      separatorPending = true;
    }
    sourceOffset++;
  }

  while (normalized.at(-1) === " ") {
    normalized.pop();
    characterOffsets.pop();
  }

  return { characters: normalized, characterOffsets };
}

function findFuzzyMatches(
  text: string,
  query: string,
  maxMatches: number,
): Match[] {
  const normalizedQuery = Array.from(fuzzyText(query));
  if (normalizedQuery.length === 0) return [];

  const normalized = fuzzyTextWithMap(text);
  const matches: Match[] = [];

  for (
    let searchOffset = 0;
    searchOffset <= normalized.characters.length - normalizedQuery.length;
    searchOffset++
  ) {
    let matchesQuery = true;
    for (
      let queryOffset = 0;
      queryOffset < normalizedQuery.length;
      queryOffset++
    ) {
      if (
        normalized.characters[searchOffset + queryOffset] !==
        normalizedQuery[queryOffset]
      ) {
        matchesQuery = false;
        break;
      }
    }
    if (!matchesQuery) continue;

    const normalizedEnd = searchOffset + normalizedQuery.length;
    const start = normalized.characterOffsets[searchOffset];
    const end = normalized.characterOffsets[normalizedEnd - 1] + 1;
    matches.push({ query, start, end });
    if (matches.length >= maxMatches) break;
  }

  return matches;
}

function findMatches(
  text: string,
  findText: string | string[],
  findMode: FindMode,
): { matches: Match[]; truncated: boolean } {
  const queries = typeof findText === "string" ? [findText] : findText;
  const matches: Match[] = [];

  for (const query of queries) {
    const remaining = MAX_MATCHES - matches.length;
    const limit = remaining + 1;
    const found =
      findMode === "fuzzy"
        ? findFuzzyMatches(text, query, limit)
        : findLiteralMatches(
            text,
            query,
            findMode === "case-insensitive",
            limit,
          );
    if (found.length > remaining) {
      matches.push(...found.slice(0, remaining));
      return {
        matches: matches.sort((left, right) => left.start - right.start),
        truncated: true,
      };
    }
    matches.push(...found);
  }

  return {
    matches: matches.sort((left, right) => left.start - right.start),
    truncated: false,
  };
}

function mergeRanges(
  ranges: Array<{ start: number; end: number }>,
): Array<{ start: number; end: number }> {
  const merged: Array<{ start: number; end: number }> = [];

  for (const range of ranges.sort((left, right) => left.start - right.start)) {
    const previous = merged.at(-1);
    if (!previous || range.start > previous.end) {
      merged.push({ ...range });
    } else {
      previous.end = Math.max(previous.end, range.end);
    }
  }

  return merged;
}

function formatMetadata(
  pageSize: number,
  ranges: Array<{ start: number; end: number }>,
  requestedRange?: { start: number; end: number },
): string {
  const formattedRanges = ranges
    .map(({ start, end }) => `[${start},${end})`)
    .join(", ");
  const formattedRequestedRange = requestedRange
    ? `; requested range: [${requestedRange.start},${requestedRange.end})`
    : "";
  return `[page size: ${pageSize} characters${formattedRequestedRange}; returned ranges: ${formattedRanges || "none"}]`;
}

function renderRange(
  text: string,
  start: number,
  end: number,
  requestedRange?: { start: number; end: number },
): string {
  const characters = asCharacters(text);
  const content = characters.slice(start, end).join("");
  return `${formatMetadata(
    characters.length,
    [{ start, end }],
    requestedRange,
  )}\n${content}`;
}

function renderMatches(
  text: string,
  matches: Match[],
): { text: string; ranges: Range[] } {
  const characters = asCharacters(text);
  if (matches.length === 0) return { text: "No matches found.", ranges: [] };

  const candidateRanges = matches.map((match) => ({
    start: Math.max(0, match.start - CONTEXT_CHARS),
    end: Math.min(characters.length, match.end + CONTEXT_CHARS),
  }));
  const ranges = mergeRanges(candidateRanges);
  const selected: Range[] = [];
  let usedChars = 0;

  for (const range of ranges) {
    if (usedChars >= MAX_OUTPUT_CHARS) break;
    const remaining = MAX_OUTPUT_CHARS - usedChars;
    const end = Math.min(range.end, range.start + remaining);
    selected.push({ start: range.start, end });
    usedChars += end - range.start;
  }

  return {
    text: selected
      .map(({ start, end }) => characters.slice(start, end).join(""))
      .join("\n\n[... omitted ...]\n\n"),
    ranges: selected,
  };
}

function validateParams(params: FetchUrlParams): void {
  if (
    params.findMode !== undefined &&
    !FIND_MODES.includes(params.findMode as FindMode)
  )
    throw new Error("findMode must be exact, case-insensitive, or fuzzy");
  if (params.findMode !== undefined && params.findText === undefined)
    throw new Error("findMode requires findText");
  if (params.findText !== undefined && params.range !== undefined)
    throw new Error("findText and range cannot be used together");
  if (params.findText !== undefined) {
    const findText = params.findText as unknown;
    let queries: string[];
    if (typeof findText === "string") {
      queries = [findText];
    } else if (
      Array.isArray(findText) &&
      findText.every((query) => typeof query === "string")
    ) {
      queries = findText as string[];
    } else {
      throw new Error("findText must be a string or an array of strings");
    }
    if (queries.length > MAX_FIND_TEXT_QUERIES)
      throw new Error(
        `findText cannot contain more than ${MAX_FIND_TEXT_QUERIES} queries`,
      );
    if (queries.some((query) => query.length > MAX_FIND_TEXT_LENGTH))
      throw new Error(
        `findText queries cannot exceed ${MAX_FIND_TEXT_LENGTH} characters`,
      );
  }
  if (params.range === undefined) return;

  const { start, end } = params.range;
  if (!Number.isInteger(start) || !Number.isInteger(end))
    throw new Error("range start and end must be integers");
  if (start < 0 || end < 0 || start > end)
    throw new Error("range must contain non-negative start and end values");
  if (end - start > MAX_OUTPUT_CHARS)
    throw new Error(`range cannot exceed ${MAX_OUTPUT_CHARS} characters`);
}

export async function executeFetchUrl(
  params: FetchUrlParams,
  signal: AbortSignal,
) {
  validateParams(params);
  const text = await getExtractedText(params.url, signal);
  const pageSize = asCharacters(text).length;

  if (params.findText !== undefined) {
    const result = findMatches(
      text,
      params.findText,
      params.findMode ?? "exact",
    );
    const rendered = renderMatches(text, result.matches);
    return {
      content: [
        {
          type: "text" as const,
          text: `${formatMetadata(pageSize, rendered.ranges)}\n${rendered.text}${
            result.truncated ? "\n[Additional matches omitted.]" : ""
          }`,
        },
      ],
      details: { pageSize },
      structuredContent: {
        url: params.url,
        text: rendered.text,
        pageSize,
        matches: result.matches,
        matchesTruncated: result.truncated,
        ranges: rendered.ranges,
      },
      isError: false,
    };
  }

  const requestedRange = params.range;
  const range = requestedRange ?? {
    start: 0,
    end: Math.min(DEFAULT_RANGE_END, pageSize),
  };
  const returnedRange = {
    start: Math.min(range.start, pageSize),
    end: Math.min(range.end, pageSize),
  };
  const wasClamped =
    requestedRange !== undefined &&
    (returnedRange.start !== requestedRange.start ||
      returnedRange.end !== requestedRange.end);

  return {
    content: [
      {
        type: "text" as const,
        text: renderRange(
          text,
          returnedRange.start,
          returnedRange.end,
          wasClamped ? requestedRange : undefined,
        ),
      },
    ],
    details: {
      pageSize,
      range: returnedRange,
      ...(wasClamped ? { requestedRange } : {}),
    },
    structuredContent: {
      url: params.url,
      text: asCharacters(text)
        .slice(returnedRange.start, returnedRange.end)
        .join(""),
      pageSize,
      matches: [],
      matchesTruncated: false,
      ranges: [returnedRange],
      ...(requestedRange ? { requestedRange } : {}),
    },
    isError: false,
  };
}
