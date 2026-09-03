import { basename, join } from "node:path";
import { homedir } from "node:os";
import type {
  ExtensionAPI,
  ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import { spawnWithCapabilityCeiling } from "../pi-extension-infrastructure/subagents/capability-spawn.js";
import {
  createAsyncRunSupervisor,
  type AsyncRunSupervisor,
} from "../pi-extension-infrastructure/subagents/async-run-supervisor.js";
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
  rpcErrorMessage,
  sendRpc,
  spawnedRunId,
} from "../pi-extension-infrastructure/subagents/rpc-v1.js";
import type { Json } from "../pi-extension-infrastructure/subagents/rpc-v1.js";
import { prepareContext, removeDirectory } from "./evidence.js";
import { parsePr, text } from "./parsing.js";
import type { PendingRun, PreparedContext } from "./types.js";

const source = "brioche-packages-debug-pr-failure";
// Keep prepared evidence owned until it is removed, even when no run was
// attached to the supervisor.
const ownedDirectories = new Set<string>();
const cleanupPromises = new Map<string, Promise<boolean>>();

function cleanupDirectory(directory: string): Promise<boolean> {
  const existing = cleanupPromises.get(directory);
  if (existing) return existing;
  const operation = removeDirectory(directory).finally(() =>
    cleanupPromises.delete(directory),
  );
  cleanupPromises.set(directory, operation);
  void operation.then((cleaned) => {
    if (cleaned) ownedDirectories.delete(directory);
  });
  return operation;
}

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
  let supervisor: AsyncRunSupervisor<PendingRun>;
  const cleanupUnstarted = async (): Promise<void> => {
    const runDirectories = new Set(
      [...supervisor.runs.values()].map((run) => run.owner.directory),
    );
    await Promise.all(
      [...ownedDirectories]
        .filter((directory) => !runDirectories.has(directory))
        .map((directory) => cleanupDirectory(directory)),
    );
  };

  supervisor = createAsyncRunSupervisor<PendingRun>({
    pi,
    discoverEvents: async () => discoverCompletion(pi, source),
    runId: spawnedRunId,
    completionRunId,
    processTerminalRunId,
    processTerminalState,
    stop: (runId) => sendRpc(pi, source, "stop", { runId }),
    // A failed cleanup must retain both the run and its evidence for a later
    // retry, including the shutdown retry path.
    retainCompletedRuns: true,
    cleanupUnstarted,
    cleanup: async (run) => {
      const cleaned = await cleanupDirectory(run.owner.directory);
      run.cleaned = cleaned;
      return cleaned;
    },
    onStopFailure: async (run, error) => {
      pi.sendMessage(
        {
          customType: "brioche-debug-pr-failure",
          content: `Shutdown could not confirm investigation completion for PR ${run.owner.pr}: ${String(error)}`,
          details: { pr: run.owner.pr, runId: run.id, error: String(error) },
          display: true,
        },
        { triggerTurn: false, deliverAs: "followUp" },
      );
    },
    onCompletion: async (run, payload) => {
      const item = run.owner;
      const result = completionText(payload);
      const artifacts = completionArtifactPaths(payload);
      const childArtifacts = completionChildArtifacts(payload);
      const asyncDir = completionAsyncDir(payload);
      const sessionFile = completionSessionFile(payload);
      const status = completionStatus(payload);
      const success = completionSuccess(payload);
      const label = completionLabel(status, success);
      const cleanupSucceeded = await cleanupDirectory(item.directory);
      run.cleaned = cleanupSucceeded;
      const cleanupNotice = cleanupSucceeded
        ? ""
        : "\n\nTemporary debug artifacts could not be removed automatically.";
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
            runId: run.id,
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
    },
  });

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
      if (supervisor.shuttingDown) return;
      let prepared: PreparedContext | undefined;
      try {
        ctx.ui.notify(`Preparing failure artifacts for PR ${pr}...`, "info");
        prepared = await prepareContext(pr, briochePackagesRepository);
        ownedDirectories.add(prepared.directory);
        if (supervisor.shuttingDown) {
          await cleanupDirectory(prepared.directory);
          return;
        }
        const context = prepared;
        const packageName = text(context.metadata.package) || "unknown";
        const task = `${investigationInstructions}

Investigate Brioche package PR ${pr} for package ${packageName}. The temporary evidence and package, Brioche, and runtime utility repositories are supplied as read-only context. Return your findings for the parent agent.`;
        await supervisor.discoverEvents();
        if (supervisor.shuttingDown) {
          await cleanupDirectory(context.directory);
          return;
        }
        const item = { directory: context.directory, pr };
        const run = await supervisor.start(item, () =>
          spawnWithCapabilityCeiling<Json | undefined>({
            sessionId: ctx.sessionManager.getSessionId(),
            source,
            ceiling: {
              allowedAgents: ["oracle"],
              allowedTools: ["read", "grep", "find", "ls"],
            },
            spawn: async () =>
              supervisor.shuttingDown
                ? undefined
                : sendRpc(pi, source, "spawn", {
                    cwd: briochePackagesRepository,
                    context: "fresh",
                    agent: "oracle",
                    task,
                    reads: [
                      context.directory,
                      briochePackagesRepository,
                      briocheSourceRepository,
                      briocheRuntimeUtilsRepository,
                    ],
                    intercomBridge: { mode: "off" },
                    mission: false,
                    async: true,
                  }),
          }),
        );
        if (!run) {
          await cleanupDirectory(context.directory);
          return;
        }
        ctx.ui.notify(
          `Prepared ${context.summary}. Started investigation for PR ${pr} in ${basename(context.directory)}.`,
          "info",
        );
      } catch (error) {
        if (prepared) await cleanupDirectory(prepared.directory);
        ctx.ui.notify(rpcErrorMessage(error), "error");
      }
    },
  });

  pi.on("session_shutdown", async () => {
    await supervisor.shutdown();
  });
}
