import { rm } from "node:fs/promises";
import { basename, join } from "node:path";
import type {
  ExtensionAPI,
  ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import { registerSubagentCapabilityCeiling } from "pi-subagents/capability-ceiling";
import { prepareContext, removeDirectory } from "./evidence.js";
import { asObject, parsePr, text } from "./parsing.js";
import {
  asyncCompletionEvent,
  completionArtifactPaths,
  completionAsyncDir,
  completionRunId,
  completionSessionFile,
  completionStatus,
  completionSuccess,
  completionText,
  processTerminalRunId,
  processTerminalState,
  rpcErrorMessage,
  sendRpc,
  spawnedRunId,
} from "./rpc.js";
import type { Json, PendingRun, PreparedContext } from "./types.js";

const investigationInstructions = `Identify the root cause of the supplied Brioche package pull request merge queue failure. Use the prepared metadata and decoded logs in the temporary context directory. Use the Brioche source repository at /Users/jaudiger/Development/git-repositories/brioche-dev/brioche and the Brioche runtime utilities repository at /Users/jaudiger/Development/git-repositories/brioche-dev/brioche-runtime-utils as read-only source context. When the failure may involve Brioche behavior, runtime utilities, or a bundled executable, trace the relevant implementation and configuration in those repositories instead of guessing from the package repository alone. Distinguish package changes from upstream Brioche or runtime utility behavior, and cite relevant file paths and line ranges in the report. Do not download artifacts, decode logs, commit, or push changes. Report the pull request, package and version change, failure classification, root cause, relevant evidence, proposed fix, and validation commands. Treat network, registry, runner, resource, and sandbox glitches as transient. Treat assertions, build errors, test failures, and Brioche process failures as code-related. Search the package repository for prior fixes with the same error before proposing a change.`;

const briocheSourceRepository =
  "/Users/jaudiger/Development/git-repositories/brioche-dev/brioche";
const briocheRuntimeUtilsRepository =
  "/Users/jaudiger/Development/git-repositories/brioche-dev/brioche-runtime-utils";

const singleChildWorkflow = (agent: string, task: string) =>
  `return runs.run("main", ${JSON.stringify({ agent, task })})`;

export function registerDebugPrFailure(pi: ExtensionAPI) {
  const pending = new Map<string, PendingRun>();
  const earlyCompletions = new Map<string, unknown>();
  const subscribedEvents = new Set<string>();
  const terminalStates = new Map<string, string>();
  const terminalWaiters = new Map<string, Set<(observed: boolean) => void>>();
  let spawning = 0;
  let shuttingDown = false;

  const waitForProcessTerminal = (runId: string): Promise<boolean> => {
    const state = terminalStates.get(runId);
    if (state === "observed") return Promise.resolve(true);
    if (state === "unknown") return Promise.resolve(false);
    return new Promise((resolve) => {
      const waiters = terminalWaiters.get(runId) ?? new Set();
      let settled = false;
      const finish = (observed: boolean) => {
        if (settled) return;
        settled = true;
        waiters.delete(finish);
        if (waiters.size === 0) terminalWaiters.delete(runId);
        clearTimeout(timeout);
        resolve(observed);
      };
      const timeout = setTimeout(() => finish(false), 5_000);
      waiters.add(finish);
      terminalWaiters.set(runId, waiters);
    });
  };

  const complete = async (payload: unknown) => {
    const runId = completionRunId(payload);
    const item = pending.get(runId);
    if (!item) return;
    pending.delete(runId);
    if (shuttingDown) return;
    const result = completionText(payload);
    const artifacts = completionArtifactPaths(payload);
    const asyncDir = completionAsyncDir(payload);
    const sessionFile = completionSessionFile(payload);
    const status = completionStatus(payload);
    const success = completionSuccess(payload);
    const cleanupSucceeded = await removeDirectory(item.directory);
    const cleanupNotice = cleanupSucceeded
      ? ""
      : "\n\nTemporary debug artifacts could not be removed automatically.";
    const artifactNotice = artifacts.length
      ? `\n\nSubagent artifacts:\n${artifacts.join("\n")}`
      : "";
    pi.sendMessage(
      {
        customType: "brioche-debug-pr-failure",
        content: `Investigation completed for PR ${item.pr}.\n\n${result || "The subagent returned no report."}${artifactNotice}${cleanupNotice}`,
        details: {
          pr: item.pr,
          runId,
          ...(status ? { status } : {}),
          ...(success !== undefined ? { success } : {}),
          ...(asyncDir ? { asyncDir } : {}),
          ...(sessionFile ? { sessionFile } : {}),
          ...(artifacts.length ? { artifactPaths: artifacts } : {}),
        },
        display: true,
      },
      { triggerTurn: true, deliverAs: "followUp" },
    );
  };

  const subscribeToCompletion = (event: string) => {
    if (subscribedEvents.has(event)) return;
    subscribedEvents.add(event);
    pi.events.on(event, (payload) => {
      const runId = completionRunId(payload);
      if (pending.has(runId)) {
        void complete(payload);
        return;
      }
      if (spawning && runId) earlyCompletions.set(runId, payload);
    });
  };

  const subscribeToProcessTerminal = (event: string) => {
    if (subscribedEvents.has(event)) return;
    subscribedEvents.add(event);
    pi.events.on(event, (payload) => {
      const runId = processTerminalRunId(payload);
      const state = processTerminalState(payload);
      if (!runId || !state) return;
      terminalStates.set(runId, state);
      const waiters = terminalWaiters.get(runId);
      if (waiters) {
        for (const finish of waiters) finish(state === "observed");
      }
    });
  };

  const discoverCompletionEvent = async () => {
    let ping;
    try {
      ping = await sendRpc(pi, "ping", {});
    } catch (error) {
      throw error instanceof Error
        ? error
        : new Error(
            `Could not discover the subagent completion event: ${String(error)}`,
          );
    }
    const event = asyncCompletionEvent(ping);
    const terminalEvent = text(asObject(ping.events).processTerminal);
    if (!event || !terminalEvent)
      throw new Error(
        "Subagent RPC did not advertise the required completion events.",
      );
    subscribeToCompletion(event);
    subscribeToProcessTerminal(terminalEvent);
  };

  pi.registerCommand("brioche-packages:debug-pr-failure", {
    description: "Investigate a Brioche package PR merge queue failure",
    handler: async (args, ctx: ExtensionContext) => {
      const pr = parsePr(args);
      if (!pr) {
        ctx.ui.notify(
          "Usage: /brioche-packages:debug-pr-failure <PR number or URL>",
          "warning",
        );
        return;
      }
      let prepared: PreparedContext | undefined;
      try {
        ctx.ui.notify(`Preparing failure artifacts for PR ${pr}...`, "info");
        prepared = await prepareContext(pr, ctx.cwd);
        const packageName = text(prepared.metadata.package) || "unknown";
        const task = `${investigationInstructions}

Investigate Brioche package PR ${pr} for package ${packageName}. Evidence directory: ${prepared.directory}. Package repository: ${ctx.cwd}. Brioche source repository: ${briocheSourceRepository}. Brioche runtime utilities repository: ${briocheRuntimeUtilsRepository}. Read decoded .log files when they contain process output or when the failed job log points to them. Consult manifest.txt only when needed to resolve missing or ambiguous evidence. Inspect the two source repositories when the logs identify a Brioche component, runtime utility, executable, or configuration path, and include the relevant source path and line range in your reasoning. This is an evidence-only investigation: do not use commands, do not download or decode artifacts, and do not apply a proposed fix. Return a concise evidence-based root cause, failure classification, and proposed fix for the parent agent.`;
        await discoverCompletionEvent();
        spawning += 1;
        try {
          const capabilityCeiling = registerSubagentCapabilityCeiling({
            sessionId: ctx.sessionManager.getSessionId(),
            source: "brioche-packages-debug-pr-failure",
            ceiling: {
              allowedAgents: ["oracle"],
              allowedTools: ["read", "grep", "find", "ls"],
            },
          });
          let rpc: Json;
          try {
            rpc = await sendRpc(pi, "spawn", {
              cwd: ctx.cwd,
              context: "fresh",
              workflowScript: singleChildWorkflow("oracle", task),
              reads: [
                join(prepared.directory, "metadata.json"),
                join(prepared.directory, "pr.diff"),
                join(prepared.directory, "failed-jobs.log"),
                briocheSourceRepository,
                briocheRuntimeUtilsRepository,
              ],
              intercomBridge: { mode: "off" },
              mission: false,
              async: true,
            });
          } finally {
            capabilityCeiling.dispose();
          }
          const runId = spawnedRunId(rpc);
          if (!runId)
            throw new Error("Subagent started without a run identifier.");
          if (shuttingDown) {
            try {
              await sendRpc(pi, "stop", { runId });
            } catch {
              // The run may have reached a terminal state before shutdown.
            }
            if (await waitForProcessTerminal(runId))
              await removeDirectory(prepared.directory);
            return;
          }
          pending.set(runId, { directory: prepared.directory, pr });
          const completion = earlyCompletions.get(runId);
          if (completion) {
            earlyCompletions.delete(runId);
            void complete(completion);
          }
        } finally {
          spawning -= 1;
        }
        ctx.ui.notify(
          `Prepared ${prepared.summary}. Started investigation for PR ${pr} in ${basename(prepared.directory)}.`,
          "info",
        );
      } catch (error) {
        if (prepared)
          await rm(prepared.directory, { recursive: true, force: true });
        ctx.ui.notify(rpcErrorMessage(error), "error");
      }
    },
  });

  pi.on("session_shutdown", async () => {
    shuttingDown = true;
    const runs = [...pending.entries()];
    await Promise.all(
      runs.map(async ([runId, item]) => {
        try {
          await sendRpc(pi, "stop", { runId });
        } catch {
          // The run may have reached a terminal state before shutdown.
        }
        if (await waitForProcessTerminal(runId))
          await removeDirectory(item.directory);
        return undefined;
      }),
    );
    pending.clear();
    earlyCompletions.clear();
  });
}
