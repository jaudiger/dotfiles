import * as crypto from "node:crypto";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export type Json = Record<string, unknown>;

function asObject(value: unknown): Json {
  return value && typeof value === "object" ? (value as Json) : {};
}

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

const rpcRequest = "subagents:rpc:v1:request";
const rpcReplyPrefix = "subagents:rpc:v1:reply:";

export function sendRpc(
  pi: ExtensionAPI,
  method: string,
  params: Json,
): Promise<Json> {
  const requestId = `brioche-submit-${crypto.randomUUID()}`;
  return new Promise((resolve, reject) => {
    const replyEvent = `${rpcReplyPrefix}${requestId}`;
    let unsubscribe: (() => void) | void;
    let settled = false;
    const finish = (callback: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      unsubscribe?.();
      callback();
    };
    const timeout = setTimeout(() => {
      finish(() =>
        reject(new Error("Subagent RPC timed out after 30 seconds.")),
      );
    }, 30_000);
    unsubscribe = pi.events.on(replyEvent, (raw) => {
      const reply = asObject(raw);
      if (reply.success !== true) {
        finish(() =>
          reject(
            new Error(
              text(asObject(reply.error).message) || "Subagent RPC failed",
            ),
          ),
        );
        return;
      }
      finish(() => resolve(asObject(reply.data)));
    });
    pi.events.emit(rpcRequest, {
      version: 1,
      requestId,
      method,
      params,
      source: { extension: "brioche-packages-submit-package" },
    });
  });
}

export function asyncCompletionEvent(payload: unknown): string {
  return text(asObject(asObject(payload).events).asyncComplete);
}

export function processTerminalEvent(payload: unknown): string {
  return text(asObject(asObject(payload).events).processTerminal);
}

export function processTerminalRunId(payload: unknown): string {
  const data = asObject(payload);
  const terminal = asObject(data.processTerminal);
  return text(data.runId) || text(terminal.runId);
}

export function processTerminalState(payload: unknown): string {
  const data = asObject(payload);
  return text(data.state) || text(asObject(data.processTerminal).state);
}

export function spawnedRunId(payload: unknown): string {
  const details = asObject(asObject(payload).details);
  return text(details.runId) || text(details.asyncId);
}

type CompletionResult = {
  output?: string;
  artifactPaths?: Json;
};

type Completion = {
  runId: string;
  summary?: string;
  output?: string;
  error?: string;
  state?: string;
  status?: string;
  success?: boolean;
  artifactPaths?: Json;
  results?: CompletionResult[];
};

function optionalObject(value: unknown): Json | undefined {
  const object = asObject(value);
  return Object.keys(object).length > 0 ? object : undefined;
}

function completionResult(value: unknown): CompletionResult | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value))
    return undefined;
  const result = asObject(value);
  return {
    output: text(result.output) || undefined,
    artifactPaths: optionalObject(result.artifactPaths),
  };
}

function completionResults(value: unknown): CompletionResult[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value
    .map(completionResult)
    .filter((result): result is CompletionResult => result !== undefined);
}

function completion(payload: unknown): Completion {
  const data = asObject(payload);
  return {
    runId: text(data.runId) || text(data.id),
    summary: text(data.summary) || undefined,
    output: text(data.output) || undefined,
    error: text(data.error) || undefined,
    state: text(data.state) || undefined,
    status: text(data.status) || undefined,
    success: typeof data.success === "boolean" ? data.success : undefined,
    artifactPaths: optionalObject(data.artifactPaths),
    results: completionResults(data.results),
  };
}

export function completionRunId(payload: unknown): string {
  return completion(payload).runId;
}

export function completionText(payload: unknown): string {
  const data = completion(payload);
  return (
    data.output ||
    data.summary ||
    data.results
      ?.map((result) => result.output || "")
      .filter(Boolean)
      .join("\n\n") ||
    data.error ||
    ""
  );
}

function pathsFrom(value: unknown): string[] {
  const object = asObject(value);
  return [
    text(object.outputPath),
    text(object.transcriptPath),
    text(object.sessionFile),
  ].filter(Boolean);
}

export function completionArtifactPaths(payload: unknown): string[] {
  const data = completion(payload);
  const paths = [
    ...pathsFrom(data.artifactPaths),
    ...(data.results ?? []).flatMap((result) =>
      pathsFrom(result.artifactPaths),
    ),
  ];
  return [...new Set(paths)];
}

export function completionStatus(payload: unknown): string {
  const data = completion(payload);
  return data.status || data.state || "";
}

export function completionSuccess(payload: unknown): boolean | undefined {
  return completion(payload).success;
}
