import * as crypto from "node:crypto";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { asObject, text } from "./parsing.js";
import type { Json } from "./types.js";

type RpcEvents = {
  on(event: string, handler: (data: unknown) => void): (() => void) | void;
  emit(event: string, data: unknown): void;
};

type ReadyState = {
  ready: boolean;
  waiters: Set<() => void>;
};

const rpcRequest = "subagents:rpc:v1:request";
const rpcReady = "subagents:rpc:v1:ready";
const rpcReplyPrefix = "subagents:rpc:v1:reply:";
const rpcVersion = 1;
const readyStates = new WeakMap<object, ReadyState>();

function eventsFor(pi: ExtensionAPI): RpcEvents {
  return pi.events as unknown as RpcEvents;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function record(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

function describe(value: unknown): string {
  return typeof value === "string" ? value : String(value);
}

export function registerRpcReady(pi: ExtensionAPI): void {
  const events = eventsFor(pi);
  if (readyStates.has(events)) return;

  const state: ReadyState = { ready: false, waiters: new Set() };
  readyStates.set(events, state);
  events.on(rpcReady, (raw) => {
    if (record(raw).version !== rpcVersion || state.ready) return;
    state.ready = true;
    const waiters = [...state.waiters];
    state.waiters.clear();
    for (const start of waiters) start();
  });
}

function replyData(raw: unknown, requestId: string, method: string): Json {
  const reply = record(raw);
  if (reply.version !== rpcVersion)
    throw new Error(
      `Subagent RPC ${method} returned unsupported reply version ${describe(reply.version)}.`,
    );
  if (reply.requestId !== requestId)
    throw new Error(
      `Subagent RPC ${method} returned an unexpected request ID.`,
    );
  if (typeof reply.success !== "boolean")
    throw new Error(`Subagent RPC ${method} returned an invalid success flag.`);

  if (!reply.success) {
    const error = record(reply.error);
    const code =
      typeof error.code === "string" && error.code ? error.code : "unknown";
    const message =
      typeof error.message === "string" && error.message
        ? error.message
        : "Subagent RPC failed without a message.";
    if (
      typeof error.code !== "string" ||
      !error.code ||
      typeof error.message !== "string" ||
      !error.message
    )
      throw new Error(
        `Subagent RPC ${method} returned an invalid structured error (${code}): ${message}`,
      );
    throw new Error(`Subagent RPC ${method} failed (${code}): ${message}`);
  }

  if (!("data" in reply))
    throw new Error(`Subagent RPC ${method} succeeded without reply data.`);
  if (!isRecord(reply.data))
    throw new Error(`Subagent RPC ${method} returned invalid reply data.`);
  return reply.data;
}

export function sendRpc(
  pi: ExtensionAPI,
  method: string,
  params: Json,
): Promise<Json> {
  registerRpcReady(pi);
  const events = eventsFor(pi);
  const state = readyStates.get(events)!;
  const source = "brioche-packages-debug-pr-failure";
  const requestId = `${source}-${crypto.randomUUID()}`;
  const replyEvent = `${rpcReplyPrefix}${requestId}`;

  return new Promise((resolve, reject) => {
    let settled = false;
    let unsubscribe: (() => void) | void;
    const finish = (callback: () => void) => {
      if (settled) return;
      settled = true;
      state.waiters.delete(start);
      clearTimeout(timeout);
      unsubscribe?.();
      callback();
    };
    const timeout = setTimeout(
      () =>
        finish(() =>
          reject(
            new Error(`Subagent RPC ${method} timed out after 30 seconds.`),
          ),
        ),
      30_000,
    );
    const start = () => {
      if (settled) return;
      state.waiters.delete(start);
      unsubscribe = events.on(replyEvent, (raw) => {
        try {
          const data = replyData(raw, requestId, method);
          finish(() => resolve(data));
        } catch (error) {
          finish(() =>
            reject(
              error instanceof Error
                ? error
                : new Error(`Subagent RPC ${method} failed: ${String(error)}`),
            ),
          );
        }
      });
      events.emit(rpcRequest, {
        version: rpcVersion,
        requestId,
        method,
        params,
        source: { extension: source },
      });
    };

    if (state.ready) start();
    else state.waiters.add(start);
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
