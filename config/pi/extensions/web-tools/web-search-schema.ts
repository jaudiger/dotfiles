import { Type } from "typebox";

export const webSearchParameters = Type.Object(
  { query: Type.String() },
  { additionalProperties: false },
);

export const webSearchOutputSchema = Type.Object(
  {
    results: Type.Array(
      Type.Object(
        {
          title: Type.String(),
          url: Type.String(),
          snippet: Type.Optional(Type.String()),
        },
        { additionalProperties: false },
      ),
      { maxItems: 10 },
    ),
  },
  { additionalProperties: false },
);
