import * as crypto from "node:crypto";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import {
  SUBAGENT_DELEGATION_CANCEL_EVENT,
  SUBAGENT_DELEGATION_REQUEST_EVENT,
  SUBAGENT_DELEGATION_RESPONSE_EVENT,
  type SubagentDelegationRequest,
  type SubagentDelegationResponse,
  type SubagentDelegationResultRequest,
  type SubagentDelegationValue,
} from "pi-subagents/delegation";
import {
  spawnWithCapabilityCeiling,
  type CapabilityCeiling,
} from "./capability-spawn.js";

const defaultTimeoutMs = 30 * 60 * 1000;

type DelegationIdentity = Pick<
  SubagentDelegationRequest,
  "requestId" | "ownerRunId" | "nodeId"
>;

export type DelegationCapabilityScope = {
  sessionId: string;
  source: string;
  ceiling: CapabilityCeiling;
};

/** Fields supplied by a caller for one owned delegation request. */
export type DelegationRequestInput = Omit<
  SubagentDelegationRequest,
  "requestId" | "ownerRunId" | "nodeId" | "timeoutMs" | "result" | "context"
> & {
  context?: SubagentDelegationRequest["context"];
};

/** Transport and lifecycle controls for one delegation request. */
export type DelegationOptions = {
  sourcePrefix: string;
  nodeId: string;
  result: SubagentDelegationResultRequest;
  timeoutMs?: number;
  signal?: AbortSignal;
  ownerRunId?: string;
  capabilityScope?: DelegationCapabilityScope;
};

type ActiveDelegation = {
  pi: ExtensionAPI;
  request: DelegationIdentity;
  cancel: () => void;
};

const activeDelegations = new Map<string, ActiveDelegation>();

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function emitCancellation(pi: ExtensionAPI, request: DelegationIdentity): void {
  try {
    pi.events.emit(SUBAGENT_DELEGATION_CANCEL_EVENT, request);
  } catch {
    // Cancellation is best effort when the host is already shutting down.
  }
}

function matchesIdentity(
  value: Partial<DelegationIdentity>,
  request: DelegationIdentity,
): boolean {
  return (
    value.requestId === request.requestId &&
    value.ownerRunId === request.ownerRunId &&
    value.nodeId === request.nodeId
  );
}

function responseResult(
  response: Partial<SubagentDelegationResponse>,
): SubagentDelegationValue | undefined {
  const result = (response as { result?: unknown }).result;
  if (!result || typeof result !== "object" || Array.isArray(result))
    return undefined;
  const value = result as Record<string, unknown>;
  if (value.kind === "text" && typeof value.text === "string")
    return { kind: "text", text: value.text };
  if (value.kind === "structured" && "value" in value)
    return { kind: "structured", value: value.value };
  return undefined;
}

async function runDelegation(
  pi: ExtensionAPI,
  input: DelegationRequestInput,
  options: DelegationOptions,
): Promise<SubagentDelegationValue> {
  const requestId = `${options.sourcePrefix}-${crypto.randomUUID()}`;
  const request: SubagentDelegationRequest = {
    ...input,
    requestId,
    ownerRunId: options.ownerRunId ?? requestId,
    nodeId: options.nodeId,
    context: input.context ?? "fresh",
    timeoutMs: options.timeoutMs ?? defaultTimeoutMs,
    result: options.result,
    artifacts: input.artifacts ?? false,
  };
  const identity: DelegationIdentity = {
    requestId,
    ownerRunId: request.ownerRunId,
    nodeId: request.nodeId,
  };

  return await new Promise<SubagentDelegationValue>((resolve, reject) => {
    let settled = false;
    let unsubscribe: (() => void) | void;
    let abortHandler: (() => void) | undefined;
    let resolveCapability: (value: SubagentDelegationValue) => void = () => {};
    let rejectCapability: (error: unknown) => void = () => {};
    const capabilityCompletion = new Promise<SubagentDelegationValue>(
      (resolve, reject) => {
        resolveCapability = resolve;
        rejectCapability = reject;
      },
    );
    // A cancellation can happen before capability spawning starts, so ensure
    // settling this promise cannot produce an unhandled rejection.
    void capabilityCompletion.catch(() => {});
    const cancellationController = new AbortController();
    const timeout = setTimeout(() => {
      const error = new Error(
        `Delegated ${options.nodeId} timed out after ${options.timeoutMs ?? defaultTimeoutMs} milliseconds.`,
      );
      finish(() => {
        rejectCapability(error);
        reject(error);
      });
      emitCancellation(pi, identity);
    }, options.timeoutMs ?? defaultTimeoutMs);

    const finish = (callback: () => void): void => {
      if (settled) return;
      settled = true;
      cancellationController.abort();
      clearTimeout(timeout);
      try {
        unsubscribe?.();
      } catch {
        // Listener cleanup is best effort when the host is shutting down.
      }
      if (abortHandler)
        options.signal?.removeEventListener("abort", abortHandler);
      activeDelegations.delete(requestId);
      callback();
    };

    const cancel = (message: string): void => {
      const error = new Error(message);
      finish(() => {
        rejectCapability(error);
        reject(error);
      });
      emitCancellation(pi, identity);
    };

    // Register before waiting for the capability lock so shutdown can cancel
    // delegations queued behind another temporary capability ceiling.
    activeDelegations.set(requestId, {
      pi,
      request: identity,
      cancel: () => cancel("Delegation was cancelled."),
    });

    const dispatch = (): void => {
      if (settled) return;
      try {
        unsubscribe = pi.events.on(
          SUBAGENT_DELEGATION_RESPONSE_EVENT,
          (raw) => {
            const response = raw as Partial<SubagentDelegationResponse>;
            if (!matchesIdentity(response, identity)) return;
            if (response.status !== "completed") {
              const error = new Error(
                response.error ||
                  `Delegated ${options.nodeId} ${response.status}.`,
              );
              finish(() => {
                rejectCapability(error);
                reject(error);
              });
              return;
            }
            const result = responseResult(response);
            if (!result || result.kind !== options.result.kind) {
              const error = new Error(
                `Delegated ${options.nodeId} returned an unexpected result kind.`,
              );
              finish(() => {
                rejectCapability(error);
                reject(error);
              });
              return;
            }
            finish(() => {
              resolveCapability(result);
              resolve(result);
            });
          },
        );
      } catch (error) {
        const failure = new Error(
          `Delegated ${options.nodeId} failed: ${errorMessage(error)}`,
        );
        finish(() => {
          rejectCapability(failure);
          reject(failure);
        });
        return;
      }

      if (settled) return;
      try {
        pi.events.emit(SUBAGENT_DELEGATION_REQUEST_EVENT, request);
      } catch (error) {
        const failure = new Error(
          `Delegated ${options.nodeId} failed: ${errorMessage(error)}`,
        );
        finish(() => {
          rejectCapability(failure);
          reject(failure);
        });
      }
    };

    abortHandler = () => cancel(`Delegated ${options.nodeId} was cancelled.`);
    if (options.signal?.aborted) {
      abortHandler();
      return;
    }
    options.signal?.addEventListener("abort", abortHandler, { once: true });

    if (options.capabilityScope) {
      void spawnWithCapabilityCeiling({
        ...options.capabilityScope,
        signal: cancellationController.signal,
        spawn: async () => {
          dispatch();
          return await capabilityCompletion;
        },
      }).catch((error: unknown) => {
        if (settled) return;
        const failure = new Error(
          `Delegated ${options.nodeId} failed: ${errorMessage(error)}`,
        );
        finish(() => {
          rejectCapability(failure);
          reject(failure);
        });
      });
    } else {
      dispatch();
    }
  });
}

/** Run one owned delegation and return its explicitly requested result value. */
function runDelegated(
  pi: ExtensionAPI,
  input: DelegationRequestInput,
  options: DelegationOptions,
): Promise<SubagentDelegationValue> {
  return runDelegation(pi, input, options);
}

/** Run one owned delegation that requests a literal text result. */
export async function runDelegatedText(
  pi: ExtensionAPI,
  input: DelegationRequestInput,
  options: Omit<DelegationOptions, "result">,
): Promise<string> {
  const result = await runDelegated(pi, input, {
    ...options,
    result: { kind: "text" },
  });
  if (result.kind !== "text")
    throw new Error("Delegation returned no text result.");
  return result.text;
}

/** Run one owned delegation that requests a schema-validated structured result. */
export async function runDelegatedStructured(
  pi: ExtensionAPI,
  input: DelegationRequestInput & { schema: Record<string, unknown> },
  options: Omit<DelegationOptions, "result">,
): Promise<unknown> {
  const { schema, ...requestInput } = input;
  const result = await runDelegated(pi, requestInput, {
    ...options,
    result: { kind: "structured", schema },
  });
  if (result.kind !== "structured")
    throw new Error("Delegation returned no structured result.");
  return result.value;
}

/** Cancel all active delegations owned by the supplied extension instance. */
export function cancelDelegatedRequests(pi: ExtensionAPI): void {
  for (const active of activeDelegations.values()) {
    if (active.pi === pi) active.cancel();
  }
}
