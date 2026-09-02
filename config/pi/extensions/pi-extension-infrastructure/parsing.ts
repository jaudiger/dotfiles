import type { Json } from "./github-pr-review/types.js";

export function object(value: unknown): Json {
  return value && typeof value === "object" ? (value as Json) : {};
}

export function string(value: unknown): string {
  return typeof value === "string" ? value : "";
}
