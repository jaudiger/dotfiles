import type { Json } from "./types.js";

export function parsePr(value: string): string | undefined {
  const match = value.trim().match(/(?:pull\/|^)(\d+)(?:[/?#].*)?$/);
  return match?.[1];
}

export function asObject(value: unknown): Json {
  return value && typeof value === "object" ? (value as Json) : {};
}

export function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

export function workflowRunId(url: string): string | undefined {
  return url.match(/actions\/runs\/(\d+)/)?.[1];
}

export function packageFromFiles(files: unknown[]): string | undefined {
  for (const item of files) {
    const path = text(asObject(item).path);
    const match = path.match(/^packages\/([^/]+)\//);
    if (match) return match[1];
  }
  return undefined;
}
