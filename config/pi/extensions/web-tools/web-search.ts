import type { PiExec } from "../pi-extension-infrastructure/pi-exec.js";
import { runPythonTool } from "./python-process.js";
import { fileURLToPath } from "node:url";
import {
  isWebSearchProvider,
  isWebSearchResult,
  type WebSearchProvider,
  type WebSearchResult,
} from "./web-search-results.js";

const SEARCH_PATH = fileURLToPath(new URL("./web-search.py", import.meta.url));
const PYTHON_PATH = process.env.PI_WEB_TOOLS_PYTHON ?? "python3";

export async function executeWebSearch(
  query: string,
  signal: AbortSignal,
  exec: PiExec,
  cwd: string,
) {
  const stdout = await runPythonTool(
    exec,
    PYTHON_PATH,
    SEARCH_PATH,
    [query],
    cwd,
    signal,
    "Web search",
    "Web search was cancelled.",
    "Web search",
  );
  let parsed: unknown;
  try {
    parsed = JSON.parse(stdout);
  } catch {
    throw new Error("Web search returned invalid data");
  }
  if (
    typeof parsed !== "object" ||
    parsed === null ||
    !isWebSearchProvider((parsed as { provider?: unknown }).provider) ||
    !Array.isArray((parsed as { results?: unknown }).results)
  ) {
    throw new Error("Web search returned invalid provider or results data");
  }
  const rawResults = (parsed as { results: unknown[] }).results;
  if (rawResults.length > 10) {
    throw new Error("Web search returned more than 10 results");
  }
  const invalidResultIndex = rawResults.findIndex(
    (item) => !isWebSearchResult(item),
  );
  if (invalidResultIndex !== -1) {
    throw new Error(
      `Web search returned an invalid result at index ${invalidResultIndex}`,
    );
  }
  const results = (rawResults as WebSearchResult[]).map((result) => ({
    title: result.title,
    url: result.url,
    ...(result.snippet === undefined ? {} : { snippet: result.snippet }),
  }));
  const provider = (parsed as { provider: WebSearchProvider }).provider;
  const text = results.length
    ? results
        .map(
          (item, index) =>
            `${index + 1}. ${item.title}\n   ${item.url}${item.snippet ? `\n   ${item.snippet}` : ""}`,
        )
        .join("\n\n")
    : "No results found.";
  return {
    content: [{ type: "text" as const, text }],
    details: { provider, results },
    structuredContent: { results },
    isError: false,
  };
}
