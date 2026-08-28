import * as crypto from "node:crypto";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import {
  SUBAGENT_DELEGATION_CANCEL_EVENT,
  SUBAGENT_DELEGATION_REQUEST_EVENT,
  SUBAGENT_DELEGATION_RESPONSE_EVENT,
  type SubagentDelegationRequest,
  type SubagentDelegationResponse,
} from "pi-subagents/delegation";

export type Json = Record<string, unknown>;

type ActiveDelegation = Pick<
  SubagentDelegationRequest,
  "requestId" | "ownerRunId" | "nodeId"
>;

const activeDelegations = new Map<string, ActiveDelegation>();

export async function runDelegatedText(
  pi: ExtensionAPI,
  input: { agent: string; task: string; cwd: string },
): Promise<string> {
  const requestId = `brioche-submit-${crypto.randomUUID()}`;
  const request: SubagentDelegationRequest = {
    requestId,
    ownerRunId: requestId,
    nodeId: "researcher",
    agent: input.agent,
    task: input.task,
    context: "fresh",
    cwd: input.cwd,
    result: { kind: "text" },
    artifacts: false,
  };
  activeDelegations.set(requestId, request);
  try {
    const response = await new Promise<SubagentDelegationResponse>(
      (resolve, reject) => {
        let unsubscribe: (() => void) | void;
        const timeout = setTimeout(
          () => {
            unsubscribe?.();
            try {
              pi.events.emit(SUBAGENT_DELEGATION_CANCEL_EVENT, request);
            } catch {
              // The delegation may already have ended while the timeout fired.
            }
            reject(
              new Error("Delegated researcher timed out after 30 minutes."),
            );
          },
          30 * 60 * 1000,
        );
        const finish = (callback: () => void) => {
          clearTimeout(timeout);
          unsubscribe?.();
          callback();
        };
        unsubscribe = pi.events.on(
          SUBAGENT_DELEGATION_RESPONSE_EVENT,
          (raw) => {
            const value = raw as Partial<SubagentDelegationResponse>;
            if (
              value.requestId !== requestId ||
              value.ownerRunId !== request.ownerRunId ||
              value.nodeId !== request.nodeId
            )
              return;
            finish(() => resolve(raw as SubagentDelegationResponse));
          },
        );
        try {
          pi.events.emit(SUBAGENT_DELEGATION_REQUEST_EVENT, request);
        } catch (error) {
          finish(() => reject(error));
        }
      },
    );
    if (response.status !== "completed")
      throw new Error(
        response.error || `Delegated researcher ${response.status}.`,
      );
    if (!response.result || response.result.kind !== "text")
      throw new Error("Delegated researcher returned no text result.");
    return response.result.text;
  } finally {
    activeDelegations.delete(requestId);
  }
}

export function cancelDelegatedRequests(pi: ExtensionAPI): void {
  for (const request of activeDelegations.values()) {
    try {
      pi.events.emit(SUBAGENT_DELEGATION_CANCEL_EVENT, request);
    } catch {
      // The runtime may already be shutting down.
    }
  }
}
