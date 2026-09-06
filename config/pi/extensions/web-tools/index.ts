import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Text } from "@earendil-works/pi-tui";
import { Type } from "typebox";
import {
  executeFetchUrl,
  MAX_FIND_TEXT_LENGTH,
  MAX_FIND_TEXT_QUERIES,
} from "./fetch-url";
import { executeWebSearch } from "./web-search";

export default function registerWebTools(pi: ExtensionAPI): void {
  pi.registerTool({
    name: "web_search",
    label: "Web Search",
    description: "Search the web and return results.",
    promptSnippet: "Use for web research questions.",
    parameters: Type.Object(
      {
        queries: Type.Array(Type.String()),
      },
      { additionalProperties: false },
    ),
    async execute(_toolCallId, params, signal) {
      return executeWebSearch(params.queries, signal);
    },
    renderCall(args, theme) {
      return new Text(
        theme.fg("toolTitle", theme.bold("web_search ")) +
          theme.fg("accent", JSON.stringify(args.queries ?? [])),
        0,
        0,
      );
    },
  });

  pi.registerTool({
    name: "fetch_url",
    label: "Fetch URL",
    description: "Fetch a URL and return relevant content.",
    promptSnippet: "Use to fetch URL content.",
    parameters: Type.Union([
      Type.Object(
        {
          url: Type.String(),
        },
        { additionalProperties: false },
      ),
      Type.Object(
        {
          url: Type.String(),
          findText: Type.Union([
            Type.String({ maxLength: MAX_FIND_TEXT_LENGTH }),
            Type.Array(Type.String({ maxLength: MAX_FIND_TEXT_LENGTH }), {
              maxItems: MAX_FIND_TEXT_QUERIES,
            }),
          ]),
          findMode: Type.Optional(
            Type.Union([
              Type.Literal("exact"),
              Type.Literal("case-insensitive"),
              Type.Literal("fuzzy"),
            ]),
          ),
        },
        { additionalProperties: false },
      ),
      Type.Object(
        {
          url: Type.String(),
          range: Type.Object(
            {
              start: Type.Integer({ minimum: 0 }),
              end: Type.Integer({ minimum: 0 }),
            },
            { additionalProperties: false },
          ),
        },
        { additionalProperties: false },
      ),
    ]),
    async execute(_toolCallId, params, signal) {
      return executeFetchUrl(params, signal);
    },
    renderCall(args, theme) {
      return new Text(
        theme.fg("toolTitle", theme.bold("fetch_url ")) +
          theme.fg("accent", `[${args.url ?? ""}]`),
        0,
        0,
      );
    },
  });
}
