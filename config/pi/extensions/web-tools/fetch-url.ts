import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const FETCHER_PATH = fileURLToPath(new URL("./fetch-url.py", import.meta.url));
const PYTHON_PATH = process.env.PI_WEB_TOOLS_PYTHON ?? "python3";
const MAX_OUTPUT_CHARS = 8192;
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

const extractedTextCache = new Map<string, string>();

function runFetcher(url: string, signal: AbortSignal): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(PYTHON_PATH, [FETCHER_PATH, url], {
      shell: false,
      signal,
      stdio: ["ignore", "pipe", "pipe"],
    });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];

    child.stdout.on("data", (chunk: Buffer) => stdout.push(chunk));
    child.stderr.on("data", (chunk: Buffer) => stderr.push(chunk));
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

async function getExtractedText(url: string, signal: AbortSignal) {
  const cached = extractedTextCache.get(url);
  if (cached !== undefined) return cached;

  const text = await runFetcher(url, signal);
  extractedTextCache.set(url, text);
  return text;
}

function asCharacters(text: string): string[] {
  return Array.from(text);
}

function characterOffset(text: string, codeUnitOffset: number): number {
  return Array.from(text.slice(0, codeUnitOffset)).length;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function findLiteralMatches(
  text: string,
  query: string,
  caseInsensitive: boolean,
): Match[] {
  if (!query) return [];
  if (caseInsensitive) {
    const matches: Match[] = [];
    const pattern = new RegExp(escapeRegExp(query), "giu");

    for (const match of text.matchAll(pattern)) {
      const start = match.index ?? 0;
      const end = start + match[0].length;
      matches.push({
        query,
        start: characterOffset(text, start),
        end: characterOffset(text, end),
      });
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
      start: characterOffset(text, codeUnitOffset),
      end: characterOffset(text, sourceEnd),
    });
    offset = sourceEnd;
  }

  return matches;
}

function fuzzyText(value: string): string {
  return value
    .toLocaleLowerCase()
    .replace(/[^\p{Letter}\p{Number}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function fuzzyTextWithMap(value: string): {
  characters: string[];
  characterOffsets: number[];
} {
  const characters = asCharacters(value);
  const normalized: string[] = [];
  const characterOffsets: number[] = [];
  let separatorPending = false;

  for (let index = 0; index < characters.length; index++) {
    const character = characters[index];
    if (/^[\p{Letter}\p{Number}]$/u.test(character)) {
      if (separatorPending && normalized.length > 0) {
        normalized.push(" ");
        characterOffsets.push(index);
      }
      for (const normalizedCharacter of Array.from(
        character.toLocaleLowerCase(),
      )) {
        normalized.push(normalizedCharacter);
        characterOffsets.push(index);
      }
      separatorPending = false;
    } else if (normalized.length > 0) {
      separatorPending = true;
    }
  }

  while (normalized.at(-1) === " ") {
    normalized.pop();
    characterOffsets.pop();
  }

  return { characters: normalized, characterOffsets };
}

function findFuzzyMatches(text: string, query: string): Match[] {
  const normalizedQuery = Array.from(fuzzyText(query));
  if (normalizedQuery.length === 0) return [];

  const normalized = fuzzyTextWithMap(text);
  const matches: Match[] = [];

  for (
    let searchOffset = 0;
    searchOffset <= normalized.characters.length - normalizedQuery.length;
    searchOffset++
  ) {
    const candidate = normalized.characters.slice(
      searchOffset,
      searchOffset + normalizedQuery.length,
    );
    if (candidate.join("") !== normalizedQuery.join("")) continue;

    const normalizedEnd = searchOffset + normalizedQuery.length;
    const start = normalized.characterOffsets[searchOffset];
    const end = normalized.characterOffsets[normalizedEnd - 1] + 1;
    matches.push({ query, start, end });
  }

  return matches;
}

function findMatches(
  text: string,
  findText: string | string[],
  findMode: FindMode,
): Match[] {
  const queries = typeof findText === "string" ? [findText] : findText;
  const matches = queries.flatMap((query) => {
    if (findMode === "fuzzy") return findFuzzyMatches(text, query);
    return findLiteralMatches(text, query, findMode === "case-insensitive");
  });

  return matches.sort((left, right) => left.start - right.start);
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

function renderMatches(text: string, matches: Match[]): string {
  const characters = asCharacters(text);
  if (matches.length === 0) {
    return `${formatMetadata(characters.length, [])}\nNo matches found.`;
  }

  const candidateRanges = matches.map((match) => ({
    start: Math.max(0, match.start - CONTEXT_CHARS),
    end: Math.min(characters.length, match.end + CONTEXT_CHARS),
  }));
  const ranges = mergeRanges(candidateRanges);
  const selected: Array<{ start: number; end: number }> = [];
  let usedChars = 0;

  for (const range of ranges) {
    if (usedChars >= MAX_OUTPUT_CHARS) break;
    const remaining = MAX_OUTPUT_CHARS - usedChars;
    const end = Math.min(range.end, range.start + remaining);
    selected.push({ start: range.start, end });
    usedChars += end - range.start;
  }

  const body = selected
    .map(({ start, end }) => characters.slice(start, end).join(""))
    .join("\n\n[... omitted ...]\n\n");
  return `${formatMetadata(characters.length, selected)}\n${body}`;
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
    return {
      content: [
        {
          type: "text" as const,
          text: renderMatches(
            text,
            findMatches(text, params.findText, params.findMode ?? "exact"),
          ),
        },
      ],
      details: { pageSize },
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
    isError: false,
  };
}
