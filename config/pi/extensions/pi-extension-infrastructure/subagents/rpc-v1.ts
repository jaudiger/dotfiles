import * as crypto from "node:crypto";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export type Json = Record<string, unknown>;

type RpcEvents = {
  on(event: string, handler: (data: unknown) => void): (() => void) | void;
  emit(event: string, data: unknown): void;
};

type ReadyState = {
  ready: boolean;
  waiters: Set<() => void>;
};

type RpcCompletion = {
  runId: string;
  output: string;
  status: string;
  success?: boolean;
};

type CompletionChildArtifacts = {
  artifactPath?: string;
  sessionPath?: string;
};

type CompletionResult = CompletionChildArtifacts & {
  output?: string;
  artifactPaths?: Json;
};

type CompletionPayload = {
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

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
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

/** Send one versioned subagent RPC request for the named extension source. */
export function sendRpc(
  pi: ExtensionAPI,
  source: string,
  method: string,
  params: Json,
): Promise<Json> {
  registerRpcReady(pi);
  const events = eventsFor(pi);
  const state = readyStates.get(events)!;
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
      try {
        unsubscribe = events.on(replyEvent, (raw) => {
          try {
            const data = replyData(raw, requestId, method);
            finish(() => resolve(data));
          } catch (error) {
            finish(() =>
              reject(
                error instanceof Error
                  ? error
                  : new Error(
                      `Subagent RPC ${method} failed: ${String(error)}`,
                    ),
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
      } catch (error) {
        finish(() =>
          reject(
            error instanceof Error
              ? error
              : new Error(`Subagent RPC ${method} failed: ${String(error)}`),
          ),
        );
      }
    };

    if (state.ready) start();
    else state.waiters.add(start);
  });
}

export async function discoverCompletion(
  pi: ExtensionAPI,
  source: string,
): Promise<{ asyncComplete: string; processTerminal: string }> {
  const ping = await sendRpc(pi, source, "ping", {});
  const events = record(ping).events;
  const asyncComplete = text(record(events).asyncComplete);
  const processTerminal = text(record(events).processTerminal);
  if (!asyncComplete || !processTerminal)
    throw new Error(
      "Subagent RPC did not advertise the required completion events.",
    );
  return { asyncComplete, processTerminal };
}

export function spawnedRunId(payload: unknown): string {
  const details = record(record(payload).details);
  return text(details.runId) || text(details.asyncId);
}

type AsyncCapacity = { used: number; limit: number };

function asyncCapacity(value: unknown): AsyncCapacity {
  return (value as { fleet: { topLevelAsyncCapacity: AsyncCapacity } }).fleet
    .topLevelAsyncCapacity;
}

export function requireAsyncCapacity(
  value: unknown,
  requested: number,
  label: string,
): AsyncCapacity {
  const capacity = asyncCapacity(value);
  if (capacity.limit > 0 && capacity.used + requested > capacity.limit)
    throw new Error(
      `Cannot start ${label}: top-level async capacity is ${capacity.used}/${capacity.limit}; ${requested} run${requested === 1 ? "" : "s"} requested.`,
    );
  return capacity;
}

/** Parse a completion payload into the compact shape used by review clients. */
export function completion(value: unknown): RpcCompletion {
  const data = record(value);
  return {
    runId: text(data.runId) || text(data.id),
    output: text(data.output) || text(data.summary) || text(data.error),
    status: text(data.state) || text(data.status),
    success: typeof data.success === "boolean" ? data.success : undefined,
  };
}

function optionalObject(value: unknown): Json | undefined {
  const object = record(value);
  return Object.keys(object).length > 0 ? object : undefined;
}

function completionResult(value: unknown): CompletionResult | undefined {
  if (!isRecord(value)) return undefined;
  const result = record(value);
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

function completionPayload(value: unknown): CompletionPayload {
  const data = record(value);
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
  return completionPayload(payload).runId;
}

export function completionText(payload: unknown): string {
  const data = completionPayload(payload);
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
  const object = record(value);
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
  return (completionPayload(payload).results ?? [])
    .map(({ artifactPath, sessionPath }) => ({
      ...(artifactPath ? { artifactPath } : {}),
      ...(sessionPath ? { sessionPath } : {}),
    }))
    .filter(({ artifactPath, sessionPath }) => artifactPath || sessionPath);
}

export function completionArtifactPaths(payload: unknown): string[] {
  const data = completionPayload(payload);
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
  const data = completionPayload(payload);
  return data.status || data.state || "";
}

export function completionAsyncDir(payload: unknown): string {
  return completionPayload(payload).asyncDir || "";
}

export function completionSessionFile(payload: unknown): string {
  return completionPayload(payload).sessionFile || "";
}

export function completionSuccess(payload: unknown): boolean | undefined {
  return completionPayload(payload).success;
}

export function rpcErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function processTerminalRunId(payload: unknown): string {
  const data = record(payload);
  return text(data.runId) || text(record(data.processTerminal).runId);
}

export function processTerminalState(payload: unknown): string {
  const data = record(payload);
  return text(data.state) || text(record(data.processTerminal).state);
}
