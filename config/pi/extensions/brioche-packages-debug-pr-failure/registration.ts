import { rm } from "node:fs/promises";
import { basename, join } from "node:path";
import type {
  ExtensionAPI,
  ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import { prepareContext, removeDirectory } from "./evidence.js";
import { parsePr, text } from "./parsing.js";
import {
  asyncCompletionEvent,
  completionArtifactPaths,
  completionAsyncDir,
  completionRunId,
  completionSessionFile,
  completionStatus,
  completionSuccess,
  completionText,
  sendRpc,
  spawnedRunId,
} from "./rpc.js";
import type { PendingRun, PreparedContext } from "./types.js";

const investigationInstructions = `Identify the root cause of the supplied Brioche package pull request merge queue failure. Use the prepared metadata and decoded logs in the temporary context directory. Use the Brioche source repository at /Users/jaudiger/Development/git-repositories/brioche-dev/brioche and the Brioche runtime utilities repository at /Users/jaudiger/Development/git-repositories/brioche-dev/brioche-runtime-utils as read-only source context. When the failure may involve Brioche behavior, runtime utilities, or a bundled executable, trace the relevant implementation and configuration in those repositories instead of guessing from the package repository alone. Distinguish package changes from upstream Brioche or runtime utility behavior, and cite relevant file paths and line ranges in the report. Do not download artifacts, decode logs, commit, or push changes. Report the pull request, package and version change, failure classification, root cause, relevant evidence, proposed fix, and validation commands. Treat network, registry, runner, resource, and sandbox glitches as transient. Treat assertions, build errors, test failures, and Brioche process failures as code-related. Search the package repository for prior fixes with the same error before proposing a change.`;

const briocheSourceRepository =
  "/Users/jaudiger/Development/git-repositories/brioche-dev/brioche";
const briocheRuntimeUtilsRepository =
  "/Users/jaudiger/Development/git-repositories/brioche-dev/brioche-runtime-utils";

export function registerDebugPrFailure(pi: ExtensionAPI) {
  const pending = new Map<string, PendingRun>();
  const earlyCompletions = new Map<string, unknown>();
  const subscribedEvents = new Set<string>();
  let spawning = 0;

  const complete = async (payload: unknown) => {
    const runId = completionRunId(payload);
    const item = pending.get(runId);
    if (!item) return;
    pending.delete(runId);
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

  const discoverCompletionEvent = async () => {
    let ping;
    try {
      ping = await sendRpc(pi, "ping", {});
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(
        `Could not discover the subagent completion event: ${message}`,
      );
    }
    const event = asyncCompletionEvent(ping);
    if (!event)
      throw new Error(
        "Subagent RPC ping did not advertise an async completion event. Update pi-subagents to a version that supports the v1 async completion RPC.",
      );
    subscribeToCompletion(event);
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

Investigate Brioche package PR ${pr} for package ${packageName}. Evidence directory: ${prepared.directory}. Package repository: ${ctx.cwd}. Brioche source repository: ${briocheSourceRepository}. Brioche runtime utilities repository: ${briocheRuntimeUtilsRepository}. Read decoded .log files when they contain process output or when the failed job log points to them. Consult manifest.txt only when needed to resolve missing or ambiguous evidence. Inspect the two source repositories when the logs identify a Brioche component, runtime utility, executable, or configuration path, and include the relevant source path and line range in your reasoning. This is a read-only investigation: do not use commands, do not download or decode artifacts, do not edit or write repository files, and do not apply a proposed fix. Return a concise evidence-based root cause, failure classification, and proposed fix for the parent agent.`;
        await discoverCompletionEvent();
        spawning += 1;
        try {
          const rpc = await sendRpc(pi, "spawn", {
            cwd: ctx.cwd,
            context: "fresh",
            agent: "oracle",
            task,
            reads: [
              join(prepared.directory, "metadata.json"),
              join(prepared.directory, "pr.diff"),
              join(prepared.directory, "failed-jobs.log"),
              briocheSourceRepository,
              briocheRuntimeUtilsRepository,
            ],
            intercomBridge: { mode: "off" },
            mission: {
              title: `Brioche PR ${pr} merge queue failure investigation`,
              objective: `Determine the root cause of the merge queue failure for PR ${pr}. Use the prepared metadata and decoded logs during this run. The evidence directory is temporary and cleanup is attempted after completion, so mission state must not treat it as durable evidence.`,
            },
            async: true,
          });
          const runId = spawnedRunId(rpc);
          if (!runId)
            throw new Error("Subagent started without a run identifier.");
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
        ctx.ui.notify(
          error instanceof Error ? error.message : String(error),
          "error",
        );
      }
    },
  });

  pi.on("session_shutdown", async () => {
    await Promise.all(
      [...pending.values()].map((item) => removeDirectory(item.directory)),
    );
    pending.clear();
    earlyCompletions.clear();
  });
}
