import * as crypto from "node:crypto";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { asObject, text } from "./parsing.js";
import type { Json } from "./types.js";

const rpcRequest = "subagents:rpc:v1:request";
const rpcReplyPrefix = "subagents:rpc:v1:reply:";

export function sendRpc(
  pi: ExtensionAPI,
  method: string,
  params: Json,
): Promise<Json> {
  const requestId = `brioche-debug-${crypto.randomUUID()}`;
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
      finish(() => resolve((raw as { data: Json }).data));
    });
    pi.events.emit(rpcRequest, {
      version: 1,
      requestId,
      method,
      params,
      source: { extension: "brioche-packages-debug-pr-failure" },
    });
  });
}

export function asyncCompletionEvent(payload: unknown): string {
  return text(asObject(asObject(payload).events).asyncComplete);
}

export function spawnedRunId(payload: unknown): string {
  const details = asObject(asObject(payload).details);
  return text(details.runId) || text(details.asyncId);
}

export type CompletionChildArtifacts = {
  artifactPath?: string;
  sessionPath?: string;
};

type CompletionResult = CompletionChildArtifacts & {
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
  asyncDir?: string;
  sessionFile?: string;
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
    artifactPath: text(result.artifactPath) || undefined,
    sessionPath: text(result.sessionPath) || undefined,
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
    asyncDir: text(data.asyncDir) || undefined,
    sessionFile: text(data.sessionFile) || undefined,
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
    text(object.artifactPath),
    text(object.sessionPath),
  ].filter(Boolean);
}

export function completionChildArtifacts(
  payload: unknown,
): CompletionChildArtifacts[] {
  return (completion(payload).results ?? [])
    .map(({ artifactPath, sessionPath }) => ({
      ...(artifactPath ? { artifactPath } : {}),
      ...(sessionPath ? { sessionPath } : {}),
    }))
    .filter(({ artifactPath, sessionPath }) => artifactPath || sessionPath);
}

export function completionArtifactPaths(payload: unknown): string[] {
  const data = completion(payload);
  const paths = [
    ...pathsFrom(data.artifactPaths),
    ...(data.results ?? []).flatMap((result) => [
      ...pathsFrom(result.artifactPaths),
      ...pathsFrom(result),
    ]),
  ];
  return [...new Set(paths)];
}

export function completionStatus(payload: unknown): string {
  const data = completion(payload);
  return data.status || data.state || "";
}

export function completionAsyncDir(payload: unknown): string {
  return completion(payload).asyncDir || "";
}

export function completionSessionFile(payload: unknown): string {
  return completion(payload).sessionFile || "";
}

export function completionSuccess(payload: unknown): boolean | undefined {
  return completion(payload).success;
}

export function rpcErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function processTerminalRunId(payload: unknown): string {
  const data = asObject(payload);
  return text(data.runId) || text(asObject(data.processTerminal).runId);
}

export function processTerminalState(payload: unknown): string {
  const data = asObject(payload);
  return text(data.state) || text(asObject(data.processTerminal).state);
}
