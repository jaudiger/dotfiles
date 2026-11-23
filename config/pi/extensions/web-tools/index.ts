import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Text } from "@earendil-works/pi-tui";
import { Type } from "typebox";
import {
  formatLabeledUrlLink,
  formatUrlLink,
} from "../pi-extension-infrastructure/links.js";
import { createPiExec } from "../pi-extension-infrastructure/pi-exec.js";
import { fetchUrlParameters, fetchUrlRangeSchema } from "./fetch-url-schema.js";
import { executeFetchUrl, MAX_MATCHES, FETCHER_MAX_BUFFER } from "./fetch-url";
import { executeWebSearch } from "./web-search.js";
import {
  webSearchOutputSchema,
  webSearchParameters,
} from "./web-search-schema.js";

const matchSchema = Type.Object(
  {
    query: Type.String(),
    start: Type.Integer({ minimum: 0 }),
    end: Type.Integer({ minimum: 0 }),
  },
  { additionalProperties: false },
);
const fetchUrlOutputSchema = Type.Object(
  {
    url: Type.String(),
    text: Type.String(),
    pageSize: Type.Integer({ minimum: 0 }),
    matches: Type.Array(matchSchema, { maxItems: MAX_MATCHES }),
    matchesTruncated: Type.Boolean(),
    ranges: Type.Array(fetchUrlRangeSchema, { maxItems: MAX_MATCHES }),
    requestedRange: Type.Optional(fetchUrlRangeSchema),
  },
  { additionalProperties: false },
);

export default function registerWebTools(pi: ExtensionAPI): void {
  const exec = createPiExec(pi, FETCHER_MAX_BUFFER);
  pi.registerTool({
    name: "web_search",
    label: "Web Search",
    description: "Search the web for a query.",
    promptSnippet: "Search the web.",
    parameters: webSearchParameters,
    outputSchema: webSearchOutputSchema,
    async execute(_toolCallId, params, signal, _onUpdate, ctx) {
      return executeWebSearch(
        params.query,
        signal ?? new AbortController().signal,
        exec,
        ctx.cwd,
      );
    },
    renderCall(args, theme) {
      return new Text(
        theme.fg("toolTitle", theme.bold("web_search ")) +
          theme.fg("accent", args.query ?? ""),
        0,
        0,
      );
    },
    renderResult(result, { expanded }, theme) {
      const fallback = (result as { content?: unknown }).content;
      const fallbackText = Array.isArray(fallback)
        ? fallback
            .filter(
              (item): item is { type: "text"; text: string } =>
                typeof item === "object" &&
                item !== null &&
                (item as { type?: unknown }).type === "text" &&
                typeof (item as { text?: unknown }).text === "string",
            )
            .map((item) => item.text)
            .join("\n")
        : "";
      const details = (result.details ?? {}) as {
        provider?: unknown;
        results?: unknown;
      };
      const results = details.results;
      if (
        (details.provider !== "DuckDuckGo" &&
          details.provider !== "Startpage") ||
        !Array.isArray(results) ||
        !results.every(
          (item) =>
            typeof item === "object" &&
            item !== null &&
            typeof (item as { title?: unknown }).title === "string" &&
            typeof (item as { url?: unknown }).url === "string" &&
            ((item as { snippet?: unknown }).snippet === undefined ||
              typeof (item as { snippet?: unknown }).snippet === "string"),
        )
      ) {
        return new Text(fallbackText, 0, 0);
      }
      const clean = (value: string) =>
        value
          .replace(/[\u0000-\u001f\u007f-\u009f]/g, " ")
          .replace(/\s+/g, " ")
          .trim();
      const count = results.length;
      const header = theme.fg(
        "success",
        `${clean(details.provider)}: ${count} ${count === 1 ? "result" : "results"}`,
      );
      if (!count) return new Text(header, 0, 0);
      const visible = expanded ? results : results.slice(0, 3);
      const list = visible
        .map((item, index) => {
          const title = clean((item as { title: string }).title);
          const url = (item as { url: string }).url;
          const snippet = (item as { snippet?: string }).snippet;
          const link = formatLabeledUrlLink(url, title, 36);
          const fullSnippet = snippet ? clean(snippet) : "";
          const shortSnippet =
            fullSnippet.length > 180
              ? `${fullSnippet.slice(0, 177)}...`
              : fullSnippet;
          const fullUrl = url.replace(/[\u0000-\u001f\u007f-\u009f]/g, "");
          return expanded
            ? `${index + 1}. ${link}\n   ${fullUrl}${fullSnippet ? `\n   ${fullSnippet}` : ""}`
            : `${index + 1}. ${link}${shortSnippet ? `: ${shortSnippet}` : ""}`;
        })
        .join("\n");
      const more =
        !expanded && count > visible.length
          ? `\n... ${count - visible.length} more results`
          : "";
      return new Text(`${header}\n${list}${more}`, 0, 0);
    },
  });
  pi.registerTool({
    name: "fetch_url",
    label: "Fetch URL",
    description: "Fetch a URL and return relevant content.",
    promptSnippet: "Fetch URL content.",
    outputSchema: fetchUrlOutputSchema,
    parameters: fetchUrlParameters,
    async execute(_toolCallId, params, signal, _onUpdate, ctx) {
      return executeFetchUrl(
        params,
        signal ?? new AbortController().signal,
        exec,
        ctx.cwd,
      );
    },
    renderCall(args, theme) {
      const values = (args && typeof args === "object" ? args : {}) as {
        url?: unknown;
        range?: { start?: unknown; end?: unknown };
        findText?: unknown;
        findMode?: unknown;
      };
      const url = typeof values.url === "string" ? values.url : "";
      const mode = values.findMode;
      const activeMode =
        mode === "case-insensitive" || mode === "fuzzy" ? `, ${mode}` : "";
      const cleanArgument = (value: string) =>
        value
          .replace(/[\u0000-\u001f\u007f-\u009f]/g, " ")
          .replace(/\s+/g, " ")
          .trim();
      const activity =
        values.range &&
        Number.isInteger(values.range.start) &&
        Number.isInteger(values.range.end) &&
        (values.range.start as number) >= 0 &&
        (values.range.end as number) >= 0
          ? ` range [${values.range.start},${values.range.end})`
          : values.findText !== undefined
            ? ` find ${
                Array.isArray(values.findText)
                  ? values.findText
                      .filter((term) => typeof term === "string")
                      .map(cleanArgument)
                      .join(", ")
                  : typeof values.findText === "string"
                    ? cleanArgument(values.findText)
                    : ""
              }${activeMode}`
            : "";
      return new Text(
        theme.fg("toolTitle", theme.bold("fetch_url ")) +
          theme.fg("accent", formatUrlLink(url)) +
          (activity ? theme.fg("muted", activity) : ""),
        0,
        0,
      );
    },
  });
}
