import * as crypto from "node:crypto";
import { type ExtensionAPI } from "@earendil-works/pi-coding-agent";
import type { Json, RpcCompletion } from "./types.js";
import { object, string } from "./utils.js";

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

export function completion(value: unknown): RpcCompletion {
  const data = object(value);
  return {
    runId: string(data.runId) || string(data.id),
    output: string(data.output) || string(data.summary) || string(data.error),
    status: string(data.state) || string(data.status),
    success: typeof data.success === "boolean" ? data.success : undefined,
  };
}

export function sendRpc(
  pi: ExtensionAPI,
  method: string,
  params: Json,
): Promise<Json> {
  registerRpcReady(pi);
  const events = eventsFor(pi);
  const state = readyStates.get(events)!;
  const source = "github-dependabot-review";
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

export async function discoverCompletion(
  pi: ExtensionAPI,
): Promise<{ asyncComplete: string; processTerminal: string }> {
  const ping = await sendRpc(pi, "ping", {});
  const events = object(ping).events;
  const asyncComplete = string(object(events).asyncComplete);
  const processTerminal = string(object(events).processTerminal);
  if (!asyncComplete || !processTerminal)
    throw new Error(
      "Subagent RPC did not advertise the required completion events.",
    );
  return { asyncComplete, processTerminal };
}

export function processTerminalRunId(value: unknown): string {
  const data = object(value);
  const terminal = object(data.processTerminal);
  return string(data.runId) || string(terminal.runId);
}

export function processTerminalState(value: unknown): string {
  const data = object(value);
  return string(data.state) || string(object(data.processTerminal).state);
}

export function runId(value: unknown): string {
  const details = object(object(value).details);
  return string(details.runId) || string(details.asyncId);
}

export type AsyncCapacity = { used: number; limit: number };

export function asyncCapacity(value: unknown): AsyncCapacity {
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
