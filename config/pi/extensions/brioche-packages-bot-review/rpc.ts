import { type ExtensionAPI } from "@earendil-works/pi-coding-agent";
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
  const requestId = `brioche-packages-bot-review-${Date.now()}-${Math.random().toString(36).slice(2)}`;
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
      source: { extension: "brioche-packages-bot-review" },
    });
  });
}

export async function discoverCompletion(pi: ExtensionAPI): Promise<string> {
  const ping = await sendRpc(pi, "ping", {});
  const event = string(object(object(ping).events).asyncComplete);
  if (!event)
    throw new Error(
      "Subagent RPC did not advertise an async completion event.",
    );
  return event;
}

export function runId(value: unknown): string {
  const details = object(object(value).details);
  return string(details.runId) || string(details.asyncId);
}
