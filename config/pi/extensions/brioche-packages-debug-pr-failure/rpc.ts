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
  const requestId = `brioche-debug-${Date.now()}-${Math.random().toString(36).slice(2)}`;
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

type CompletionResult = {
  summary?: string;
  output?: string;
  finalOutput?: string;
  error?: string;
  artifactPath?: string;
  sessionPath?: string;
  sessionFile?: string;
  savedOutputPath?: string;
  artifactPaths?: Json;
  status?: string;
  success?: boolean;
};

type Completion = {
  runId: string;
  summary?: string;
  output?: string;
  finalOutput?: string;
  error?: string;
  state?: string;
  status?: string;
  success?: boolean;
  asyncDir?: string;
  sessionFile?: string;
  artifactPath?: string;
  savedOutputPath?: string;
  artifactPaths?: Json;
  results?: CompletionResult[];
};

function booleanValue(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

function optionalObject(value: unknown): Json | undefined {
  const object = asObject(value);
  return Object.keys(object).length > 0 ? object : undefined;
}

function completionResult(value: unknown): CompletionResult | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value))
    return undefined;
  const result = asObject(value);
  return {
    summary: text(result.summary) || undefined,
    output: text(result.output) || undefined,
    finalOutput: text(result.finalOutput) || undefined,
    error: text(result.error) || undefined,
    artifactPath: text(result.artifactPath) || undefined,
    sessionPath: text(result.sessionPath) || undefined,
    sessionFile: text(result.sessionFile) || undefined,
    savedOutputPath: text(result.savedOutputPath) || undefined,
    artifactPaths: optionalObject(result.artifactPaths),
    status: text(result.status) || text(result.state) || undefined,
    success: booleanValue(result.success),
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
    finalOutput: text(data.finalOutput) || undefined,
    error: text(data.error) || undefined,
    state: text(data.state) || undefined,
    status: text(data.status) || undefined,
    success: booleanValue(data.success),
    asyncDir: text(data.asyncDir) || undefined,
    sessionFile: text(data.sessionFile) || undefined,
    artifactPath: text(data.artifactPath) || undefined,
    savedOutputPath: text(data.savedOutputPath) || undefined,
    artifactPaths: optionalObject(data.artifactPaths),
    results: completionResults(data.results),
  };
}

export function completionRunId(payload: unknown): string {
  return completion(payload).runId;
}

function resultText(result: CompletionResult): string {
  return (
    result.finalOutput || result.output || result.summary || result.error || ""
  );
}

export function completionText(payload: unknown): string {
  const data = completion(payload);
  return (
    data.finalOutput ||
    data.output ||
    data.summary ||
    data.results?.map(resultText).filter(Boolean).join("\n\n") ||
    data.error ||
    ""
  );
}

function pathsFrom(value: unknown): string[] {
  if (typeof value === "string" && value) return [value];
  if (Array.isArray(value))
    return value.filter(
      (item): item is string => typeof item === "string" && Boolean(item),
    );
  const object = asObject(value);
  return [
    text(object.outputPath),
    text(object.artifactPath),
    text(object.sessionPath),
    text(object.sessionFile),
    text(object.savedOutputPath),
  ].filter(Boolean);
}

export function completionArtifactPaths(payload: unknown): string[] {
  const data = completion(payload);
  const paths = [
    ...pathsFrom(data.artifactPath),
    ...pathsFrom(data.savedOutputPath),
    ...pathsFrom(data.artifactPaths),
    ...(data.results ?? []).flatMap((result) => [
      ...pathsFrom(result.artifactPath),
      ...pathsFrom(result.sessionPath),
      ...pathsFrom(result.sessionFile),
      ...pathsFrom(result.savedOutputPath),
      ...pathsFrom(result.artifactPaths),
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
