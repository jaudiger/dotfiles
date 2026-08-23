import * as crypto from "node:crypto";
import {
  type ExtensionAPI,
  type ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import { resolveSubagentLaunchContract } from "pi-subagents/preflight";
import { resolveCurrentSubagentCapabilityCeiling } from "pi-subagents/capability-ceiling";
import type { Json, RpcCompletion } from "./types.js";
import { object, string } from "./utils.js";

const rpcRequest = "subagents:rpc:v1:request";
const rpcReplyPrefix = "subagents:rpc:v1:reply:";

export function completion(value: unknown): RpcCompletion {
  const data = object(value);
  const results = Array.isArray(data.results) ? data.results : [];
  const first = object(results[0]);
  return {
    runId: string(data.runId) || string(data.id),
    output:
      string(data.finalOutput) ||
      string(data.output) ||
      string(data.summary) ||
      string(first.finalOutput) ||
      string(first.output) ||
      string(data.error),
    status: string(data.status) || string(data.state) || string(first.status),
    success: typeof data.success === "boolean" ? data.success : undefined,
  };
}

function rpcError(value: unknown): Error {
  const error = object(value);
  return new Error(string(error.message) || "Subagent RPC failed.");
}

export function sendRpc(
  pi: ExtensionAPI,
  method: string,
  params: Json,
): Promise<Json> {
  const requestId = `github-dependabot-review-${crypto.randomUUID()}`;
  const replyEvent = `${rpcReplyPrefix}${requestId}`;
  return new Promise((resolve, reject) => {
    let settled = false;
    let unsubscribe: (() => void) | void;
    const finish = (callback: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      unsubscribe?.();
      callback();
    };
    const timeout = setTimeout(
      () =>
        finish(() =>
          reject(new Error("Subagent RPC timed out after 30 seconds.")),
        ),
      30_000,
    );
    unsubscribe = pi.events.on(replyEvent, (raw) => {
      const reply = object(raw);
      if (reply.success !== true) {
        finish(() => reject(rpcError(reply.error)));
      } else {
        finish(() => resolve(object(reply.data)));
      }
    });
    pi.events.emit(rpcRequest, {
      version: 1,
      requestId,
      method,
      params,
      source: { extension: "github-dependabot-review" },
    });
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

export async function preflightLaunch(
  ctx: ExtensionContext,
  agent: string,
  task: string,
): Promise<void> {
  const availableModels =
    typeof ctx.modelRegistry?.getAvailable === "function"
      ? ctx.modelRegistry.getAvailable().map((model) => {
          const value = model as unknown as {
            provider: string;
            id: string;
            fullId?: string;
            reasoning?: boolean;
          };
          return value;
        })
      : undefined;
  const result = await resolveSubagentLaunchContract({
    agent,
    task,
    context: "fresh",
    cwd: ctx.cwd,
    availableModels,
    parentSessionFile: ctx.sessionManager.getSessionFile() ?? null,
    artifactDir: "session",
    capabilityCeiling: resolveCurrentSubagentCapabilityCeiling(
      ctx.sessionManager.getSessionId() ?? undefined,
    ),
    output: false,
  });
  if (!result.ok)
    throw new Error(
      `Subagent ${agent} launch preflight failed (${result.code}): ${result.message}`,
    );
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
