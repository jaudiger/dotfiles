import type { Json } from "./types.js";

export function object(value: unknown): Json {
  return value && typeof value === "object" ? (value as Json) : {};
}

export function string(value: unknown): string {
  return typeof value === "string" ? value : "";
}

export function number(value: unknown): number | undefined {
  return typeof value === "number" && Number.isInteger(value)
    ? value
    : undefined;
}
