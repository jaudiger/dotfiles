import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Text } from "@earendil-works/pi-tui";
import { Type } from "typebox";
import {
  executeFetchUrl,
  MAX_FIND_TEXT_LENGTH,
  MAX_FIND_TEXT_QUERIES,
  MAX_MATCHES,
} from "./fetch-url";

const rangeSchema = Type.Object(
  {
    start: Type.Integer({ minimum: 0 }),
    end: Type.Integer({ minimum: 0 }),
  },
  { additionalProperties: false },
);
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
    ranges: Type.Array(rangeSchema, { maxItems: MAX_MATCHES }),
    requestedRange: Type.Optional(rangeSchema),
  },
  { additionalProperties: false },
);

export default function registerWebTools(pi: ExtensionAPI): void {
  pi.registerTool({
    name: "fetch_url",
    label: "Fetch URL",
    description: "Fetch a URL and return relevant content.",
    promptSnippet: "Use to fetch URL content.",
    outputSchema: fetchUrlOutputSchema,
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
