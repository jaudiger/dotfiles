import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Text } from "@earendil-works/pi-tui";
import { Type } from "typebox";
import { formatUrlLink } from "../pi-extension-infrastructure/links.js";
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
      return new Text(
        theme.fg("toolTitle", theme.bold("fetch_url ")) +
          theme.fg("accent", `[${formatUrlLink(args.url ?? "")}]`),
        0,
        0,
      );
    },
  });
}
