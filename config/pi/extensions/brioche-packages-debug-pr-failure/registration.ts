import { rm } from "node:fs/promises";
import { basename, join } from "node:path";
import { homedir } from "node:os";
import type {
  ExtensionAPI,
  ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import { spawnWithCapabilityCeiling } from "../pi-extension-infrastructure/subagents/capability-spawn.js";
import {
  completionArtifactPaths,
  completionChildArtifacts,
  completionAsyncDir,
  completionRunId,
  completionSessionFile,
  completionStatus,
  completionSuccess,
  completionText,
  discoverCompletion,
  processTerminalRunId,
  processTerminalState,
  registerRpcReady,
  rpcErrorMessage,
  sendRpc,
  spawnedRunId,
} from "../pi-extension-infrastructure/subagents/rpc-v1.js";
import type { Json } from "../pi-extension-infrastructure/subagents/rpc-v1.js";
import { prepareContext, removeDirectory } from "./evidence.js";
import { parsePr, text } from "./parsing.js";
import type { PendingRun, PreparedContext } from "./types.js";

const source = "brioche-packages-debug-pr-failure";

const repositoriesRoot = join(homedir(), "Development", "git-repositories");
const briochePackagesRepository = join(
  repositoriesRoot,
  "brioche-dev",
  "brioche-packages",
);
const briocheSourceRepository = join(
  repositoriesRoot,
  "brioche-dev",
  "brioche",
);
const briocheRuntimeUtilsRepository = join(
  repositoriesRoot,
  "brioche-dev",
  "brioche-runtime-utils",
);

const investigationInstructions = `Identify the root cause of the supplied Brioche package pull request merge queue failure. Use the supplied temporary evidence and read-only repository context. When the failure may involve Brioche behavior, runtime utilities, or a bundled executable, trace the relevant implementation and configuration in the supplied source context instead of guessing from the package repository alone. Distinguish package changes from upstream Brioche or runtime utility behavior, and cite relevant file paths and line ranges in the report. Do not download artifacts, decode logs, commit, or push changes. Report the pull request, package and version change, failure classification, root cause, relevant evidence, proposed fix, and validation commands. Treat network, registry, runner, resource, and sandbox glitches as transient. Treat assertions, build errors, test failures, and Brioche process failures as code-related. Search the package repository for prior fixes with the same error before proposing a change.`;

function completionLabel(status: string, success: boolean | undefined): string {
  const normalized = status.toLowerCase();
  if (success === false || ["failed", "error"].includes(normalized))
    return "Investigation failed";
  if (["cancelled", "canceled"].includes(normalized))
    return "Investigation cancelled";
  if (["timed_out", "timeout"].includes(normalized))
    return "Investigation timed out";
  if (["stopped", "interrupted"].includes(normalized))
    return "Investigation stopped";
  return "Investigation completed";
}

export function registerDebugPrFailure(pi: ExtensionAPI) {
  registerRpcReady(pi);
  const pending = new Map<string, PendingRun>();
  const trackedRuns = new Map<string, PendingRun>();
  const earlyCompletions = new Map<string, unknown>();
  const processingPromises = new Set<Promise<unknown>>();
  const spawningPromises = new Set<Promise<void>>();
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

  const complete = async (payload: unknown): Promise<boolean> => {
    const runId = completionRunId(payload);
    const item = pending.get(runId);
    if (!item) return false;
    pending.delete(runId);
    if (shuttingDown) return false;
    const terminalObserved = await waitForProcessTerminal(runId);
    if (shuttingDown) return false;
    const result = completionText(payload);
    const artifacts = completionArtifactPaths(payload);
    const childArtifacts = completionChildArtifacts(payload);
    const asyncDir = completionAsyncDir(payload);
    const sessionFile = completionSessionFile(payload);
    const status = completionStatus(payload);
    const success = completionSuccess(payload);
    const label = completionLabel(status, success);
    const cleanupSucceeded = terminalObserved
      ? await removeDirectory(item.directory)
      : false;
    const cleanupNotice = cleanupSucceeded
      ? ""
      : "\n\nTemporary debug artifacts could not be removed automatically.";
    if (shuttingDown) return terminalObserved;
    const artifactLines = [
      ...artifacts,
      ...childArtifacts.flatMap(({ artifactPath, sessionPath }) => [
        ...(artifactPath ? [`artifactPath: ${artifactPath}`] : []),
        ...(sessionPath ? [`sessionPath: ${sessionPath}`] : []),
      ]),
    ];
    const artifactNotice = artifactLines.length
      ? `\n\nSubagent artifacts:\n${[...new Set(artifactLines)].join("\n")}`
      : "";
    pi.sendMessage(
      {
        customType: "brioche-debug-pr-failure",
        content: `${label} for PR ${item.pr}.\n\n${result || "The subagent returned no report."}${artifactNotice}${cleanupNotice}`,
        details: {
          pr: item.pr,
          runId,
          ...(status ? { status } : {}),
          ...(success !== undefined ? { success } : {}),
          ...(asyncDir ? { asyncDir } : {}),
          ...(sessionFile ? { sessionFile } : {}),
          ...(artifacts.length ? { artifactPaths: artifacts } : {}),
          ...(childArtifacts.length ? { childArtifacts } : {}),
        },
        display: true,
      },
      { triggerTurn: false, deliverAs: "followUp" },
    );
    return terminalObserved;
  };

  const trackCompletion = (payload: unknown): void => {
    const runId = completionRunId(payload);
    const promise = complete(payload);
    processingPromises.add(promise);
    void promise.then(
      (terminalObserved) => {
        processingPromises.delete(promise);
        if (!shuttingDown && terminalObserved) trackedRuns.delete(runId);
      },
      () => {
        processingPromises.delete(promise);
      },
    );
  };

  const trackSpawning = (promise: Promise<void>): Promise<void> => {
    spawningPromises.add(promise);
    void promise.then(
      () => spawningPromises.delete(promise),
      () => spawningPromises.delete(promise),
    );
    return promise;
  };

  const subscribeToCompletion = (event: string) => {
    if (subscribedEvents.has(event)) return;
    subscribedEvents.add(event);
    pi.events.on(event, (payload) => {
      const runId = completionRunId(payload);
      if (pending.has(runId)) {
        trackCompletion(payload);
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
      if (shuttingDown && state === "observed") {
        const item = trackedRuns.get(runId);
        if (item) {
          void removeDirectory(item.directory).then((removed) => {
            if (removed) trackedRuns.delete(runId);
          });
        }
      }
    });
  };

  const discoverCompletionEvent = async () => {
    const events = await discoverCompletion(pi, source);
    subscribeToCompletion(events.asyncComplete);
    subscribeToProcessTerminal(events.processTerminal);
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
      if (shuttingDown) return;
      let prepared: PreparedContext | undefined;
      try {
        ctx.ui.notify(`Preparing failure artifacts for PR ${pr}...`, "info");
        prepared = await prepareContext(pr, briochePackagesRepository);
        if (shuttingDown) {
          await removeDirectory(prepared.directory);
          return;
        }
        const packageName = text(prepared.metadata.package) || "unknown";
        const task = `${investigationInstructions}

Investigate Brioche package PR ${pr} for package ${packageName}. The temporary evidence and package, Brioche, and runtime utility repositories are supplied as read-only context. Return your findings for the parent agent.`;
        await discoverCompletionEvent();
        if (shuttingDown) {
          await removeDirectory(prepared.directory);
          return;
        }
        await trackSpawning(
          (async () => {
            spawning += 1;
            try {
              if (shuttingDown) {
                await removeDirectory(prepared.directory);
                return;
              }
              const rpc = await spawnWithCapabilityCeiling<Json | undefined>({
                sessionId: ctx.sessionManager.getSessionId(),
                source: "brioche-packages-debug-pr-failure",
                ceiling: {
                  allowedAgents: ["oracle"],
                  allowedTools: ["read", "grep", "find", "ls"],
                },
                spawn: async () =>
                  shuttingDown
                    ? undefined
                    : sendRpc(pi, source, "spawn", {
                        cwd: briochePackagesRepository,
                        context: "fresh",
                        agent: "oracle",
                        task,
                        reads: [
                          prepared.directory,
                          briochePackagesRepository,
                          briocheSourceRepository,
                          briocheRuntimeUtilsRepository,
                        ],
                        intercomBridge: { mode: "off" },
                        mission: false,
                        async: true,
                      }),
              });
              if (!rpc) {
                await removeDirectory(prepared.directory);
                return;
              }
              const runId = spawnedRunId(rpc);
              if (!runId)
                throw new Error("Subagent started without a run identifier.");
              const item = { directory: prepared.directory, pr };
              trackedRuns.set(runId, item);
              if (shuttingDown) {
                try {
                  await sendRpc(pi, source, "stop", { runId });
                } catch {
                  // The run may have reached a terminal state before shutdown.
                }
                if (await waitForProcessTerminal(runId))
                  await removeDirectory(prepared.directory);
                return;
              }
              pending.set(runId, item);
              const completion = earlyCompletions.get(runId);
              if (completion) {
                earlyCompletions.delete(runId);
                trackCompletion(completion);
              }
            } finally {
              spawning -= 1;
            }
          })(),
        );
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
    await Promise.allSettled([...spawningPromises]);
    const runs = [...trackedRuns.entries()];
    await Promise.all(
      runs.map(async ([runId, item]) => {
        try {
          await sendRpc(pi, source, "stop", { runId });
        } catch {
          // The run may have reached a terminal state before shutdown.
        }
        if (await waitForProcessTerminal(runId))
          await removeDirectory(item.directory);
        return undefined;
      }),
    );
    await Promise.allSettled([...processingPromises]);
    pending.clear();
    for (const [runId] of trackedRuns) {
      if (terminalStates.get(runId) === "observed") trackedRuns.delete(runId);
    }
    earlyCompletions.clear();
  });
}
