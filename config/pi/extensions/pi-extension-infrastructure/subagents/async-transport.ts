import * as crypto from "node:crypto";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { spawnWithCapabilityCeiling } from "./capability-spawn.js";

export type Json = Record<string, unknown>;
export type Launch = {
  cwd: string;
  reads?: readonly string[];
  structuredOutputSchema?: Json;
  timeoutMs?: number;
  capabilities: {
    sessionId: string;
    readonly allowedAgents: readonly string[];
    readonly allowedTools: readonly string[];
  };
  agent?: string;
  task?: string;
  workflowScript?: string;
};

type Events = {
  on(event: string, handler: (value: unknown) => void): (() => void) | void;
  emit(event: string, value: unknown): void;
};
type Ready = { ready: boolean; waiters: Set<() => void> };
type DispatchState = "not-dispatched" | "uncertain";
export type SpawnOutcome =
  | { state: "started"; runId: string }
  | { state: DispatchState; error: unknown };
export type Completion = {
  runId: string;
  text: string;
  status: string;
  success?: boolean;
  value?: unknown;
  artifacts: string[];
};

const requestEvent = "subagents:rpc:v1:request";
const readyEvent = "subagents:rpc:v1:ready";
const replyPrefix = "subagents:rpc:v1:reply:";
const wireVersion = 1;
const readyStates = new WeakMap<object, Ready>();
const requestTimeoutMs = 30_000;

function eventsFor(pi: ExtensionAPI): Events {
  return pi.events as unknown as Events;
}
function object(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
function string(value: unknown): string {
  return typeof value === "string" ? value : "";
}
function id(value: unknown): string {
  const result = string(value).trim();
  return result && !/[\u0000-\u001f\u007f]/.test(result) ? result : "";
}
function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
function dispatchError(message: string, state: DispatchState, cause?: unknown) {
  const error = new Error(message) as Error & { dispatchState: DispatchState };
  error.name = "SubagentTransportError";
  error.dispatchState = state;
  if (cause !== undefined) (error as Error & { cause?: unknown }).cause = cause;
  return error;
}

export function registerReady(pi: ExtensionAPI): void {
  const events = eventsFor(pi);
  if (readyStates.has(events)) return;
  const state: Ready = { ready: false, waiters: new Set() };
  readyStates.set(events, state);
  events.on(readyEvent, (raw) => {
    if (object(raw).version !== wireVersion || state.ready) return;
    state.ready = true;
    for (const waiter of state.waiters) waiter();
    state.waiters.clear();
  });
}

function reply(raw: unknown, requestId: string, method: string): Json {
  const value = object(raw);
  if (value.version !== wireVersion || value.requestId !== requestId)
    throw new Error(`Subagent transport ${method} returned an invalid reply.`);
  if (typeof value.success !== "boolean")
    throw new Error(
      `Subagent transport ${method} returned an invalid success flag.`,
    );
  if (!value.success) {
    const error = object(value.error);
    throw new Error(
      `Subagent transport ${method} failed (${string(error.code) || "unknown"}): ${string(error.message) || "no message"}`,
    );
  }
  if (!object(value.data) || !("data" in value))
    throw new Error(`Subagent transport ${method} returned no data.`);
  return value.data as Json;
}

function request(
  pi: ExtensionAPI,
  source: string,
  method: string,
  params: Json,
  signal?: AbortSignal,
): Promise<Json> {
  registerReady(pi);
  const events = eventsFor(pi);
  const state = readyStates.get(events)!;
  const requestId = `${source}-${crypto.randomUUID()}`;
  const responseEvent = `${replyPrefix}${requestId}`;
  return new Promise((resolve, reject) => {
    let settled = false;
    let emitted = false;
    let unsubscribe: (() => void) | void;
    let abortHandler: (() => void) | undefined;
    const finish = (callback: () => void) => {
      if (settled) return;
      settled = true;
      state.waiters.delete(start);
      clearTimeout(timeout);
      try {
        if (typeof unsubscribe === "function") unsubscribe();
      } catch {
        /* host may be shutting down */
      }
      if (abortHandler) signal?.removeEventListener("abort", abortHandler);
      callback();
    };
    const fail = (error: unknown, forced?: DispatchState) =>
      dispatchError(
        describe(error),
        forced ?? (emitted ? "uncertain" : "not-dispatched"),
        error,
      );
    const timeout = setTimeout(
      () =>
        finish(() =>
          reject(fail(new Error(`Subagent transport ${method} timed out.`))),
        ),
      requestTimeoutMs,
    );
    const start = () => {
      if (settled) return;
      state.waiters.delete(start);
      try {
        unsubscribe = events.on(responseEvent, (raw) => {
          try {
            finish(() => resolve(reply(raw, requestId, method)));
          } catch (error) {
            finish(() => reject(fail(error, "uncertain")));
          }
        });
      } catch (error) {
        finish(() => reject(fail(error, "not-dispatched")));
        return;
      }
      if (settled) return;
      emitted = true;
      try {
        events.emit(requestEvent, {
          version: wireVersion,
          requestId,
          method,
          params,
          source: { extension: source },
        });
      } catch (error) {
        finish(() => reject(fail(error)));
      }
    };
    abortHandler = () =>
      finish(() =>
        reject(fail(new Error(`Subagent transport ${method} was cancelled.`))),
      );
    if (signal?.aborted) {
      abortHandler();
      return;
    }
    signal?.addEventListener("abort", abortHandler, { once: true });
    if (state.ready) start();
    else state.waiters.add(start);
  });
}

function spawnedRunId(value: unknown): string {
  const details = object(object(value).details);
  return id(details.runId) || id(details.asyncId);
}

export async function spawn(
  pi: ExtensionAPI,
  source: string,
  launch: Launch,
  signal?: AbortSignal,
): Promise<SpawnOutcome> {
  const { capabilities, ...params } = launch;
  const requestParams: Json = {
    ...params,
    context: "fresh",
    intercomBridge: { mode: "off" },
    mission: false,
    async: true,
  };
  try {
    const data = await spawnWithCapabilityCeiling({
      sessionId: capabilities.sessionId,
      ceiling: {
        allowedAgents: [...capabilities.allowedAgents],
        allowedTools: [...capabilities.allowedTools],
      },
      signal,
      source,
      spawn: async (spawnSignal) =>
        request(pi, source, "spawn", requestParams, spawnSignal),
    });
    const runId = spawnedRunId(data);
    return runId
      ? { state: "started", runId }
      : {
          state: "uncertain",
          error: new Error("Spawn acknowledgement omitted a run identifier."),
        };
  } catch (error) {
    const state =
      (error as { dispatchState?: unknown }).dispatchState === "not-dispatched"
        ? "not-dispatched"
        : "uncertain";
    return { state, error };
  }
}

export async function discover(
  pi: ExtensionAPI,
  source: string,
): Promise<{ completionEvent: string; terminalEvent: string }> {
  const data = await request(pi, source, "ping", {});
  const events = object(data.events);
  const completionEvent = string(events.asyncComplete);
  const terminalEvent = string(events.processTerminal);
  if (!completionEvent || !terminalEvent)
    throw new Error(
      "Subagent transport did not advertise completion and terminal events.",
    );
  return { completionEvent, terminalEvent };
}

function paths(value: unknown): string[] {
  const item = object(value);
  return [
    "outputPath",
    "transcriptPath",
    "sessionFile",
    "artifactPath",
    "sessionPath",
  ]
    .map((key) => string(item[key]))
    .filter(Boolean);
}
function structured(value: unknown): unknown {
  const item = object(value);
  if ("structuredOutput" in item) return item.structuredOutput;
  return undefined;
}
export function parseCompletion(raw: unknown): Completion {
  const value = object(raw);
  const results = Array.isArray(value.results) ? value.results.map(object) : [];
  const structuredValues = [
    structured(value),
    ...results.map(structured),
  ].filter((item) => item !== undefined);
  const artifacts = [
    ...paths(value.artifactPaths),
    ...paths(value),
    ...results.flatMap((item) => [
      ...paths(item.artifactPaths),
      ...paths(item),
    ]),
  ];
  const runId = id(value.runId) || id(value.id);
  const status = string(value.state) || string(value.status);
  if (!runId || !status)
    throw new Error("Completion payload omitted its run identifier or status.");
  return {
    runId,
    text:
      string(value.output) ||
      string(value.summary) ||
      results
        .map((item) => string(item.output))
        .filter(Boolean)
        .join("\n\n") ||
      string(value.error),
    status,
    ...(typeof value.success === "boolean" ? { success: value.success } : {}),
    ...(structuredValues.length === 1
      ? { value: structuredValues[0] }
      : structuredValues.length > 1
        ? { value: structuredValues }
        : {}),
    artifacts: [...new Set(artifacts)],
  };
}
export function terminal(
  raw: unknown,
): { runId: string; observed: boolean } | undefined {
  const value = object(raw);
  const nested = object(value.processTerminal);
  const runId = id(value.runId) || id(nested.runId);
  const state = string(value.state) || string(nested.state);
  return runId && state ? { runId, observed: state === "observed" } : undefined;
}

export function capacity(
  value: unknown,
  requested: number,
  label: string,
): void {
  const fleet = object(value).fleet;
  const available = object(object(fleet).topLevelAsyncCapacity);
  const used = available.used;
  const limit = available.limit;
  if (
    typeof used !== "number" ||
    typeof limit !== "number" ||
    !Number.isInteger(used) ||
    used < 0 ||
    !Number.isInteger(limit) ||
    limit < 0 ||
    (limit > 0 && used > limit)
  )
    throw new Error("Subagent transport returned invalid async capacity.");
  if (limit > 0 && used + requested > limit)
    throw new Error(
      `Cannot start ${label}: top-level async capacity is ${used}/${limit}; ${requested} run${requested === 1 ? "" : "s"} requested.`,
    );
}

export function status(pi: ExtensionAPI, source: string): Promise<Json> {
  return request(pi, source, "status", {});
}
export function stop(
  pi: ExtensionAPI,
  source: string,
  runId: string,
): Promise<void> {
  return request(pi, source, "stop", { runId }).then(() => undefined);
}
export function errorMessage(error: unknown): string {
  return describe(error);
}
