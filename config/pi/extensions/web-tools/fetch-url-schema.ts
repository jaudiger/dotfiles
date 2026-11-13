import { Type } from "typebox";
import { MAX_FIND_TEXT_LENGTH, MAX_FIND_TEXT_QUERIES } from "./fetch-url.js";

export const fetchUrlRangeSchema = Type.Object(
  {
    start: Type.Integer({ minimum: 0 }),
    end: Type.Integer({ minimum: 0 }),
  },
  { additionalProperties: false },
);

export const fetchUrlParameters = Type.Union([
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
      range: fetchUrlRangeSchema,
    },
    { additionalProperties: false },
  ),
]);
