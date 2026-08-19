import { rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  isToolCallEventType,
  type ExtensionAPI,
  type ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { registerSubagentCapabilityCeiling } from "pi-subagents/capability-ceiling";
import { checkoutReview, mergeReview, prepareReview } from "./github.js";
import {
  discoverCompletion,
  completion,
  processTerminalRunId,
  processTerminalState,
  runId,
  sendRpc,
} from "./rpc.js";
import { researcherTask, scoutTask } from "./tasks.js";
import type { Json, PendingRun, PreparedReview } from "./types.js";
import { object, string } from "./utils.js";

export default function registerBriochePackagesBotReview(pi: ExtensionAPI) {
  const pending = new Map<string, PendingRun>();
  const earlyCompletions = new Map<string, unknown>();
  const processing = new Set<string>();
  const processingPromises = new Set<Promise<void>>();
  const retainedDirectories = new Set<string>();
  const subscribed = new Set<string>();
  let active: PreparedReview | undefined;
  let spawning = 0;
  let shuttingDown = false;
  const terminalStates = new Map<string, string>();
  const terminalWaiters = new Map<string, Set<(observed: boolean) => void>>();

  const waitForProcessTerminal = (id: string): Promise<boolean> => {
    const state = terminalStates.get(id);
    if (state === "observed") return Promise.resolve(true);
    if (state === "unknown") return Promise.resolve(false);
    return new Promise((resolve) => {
      const waiters = terminalWaiters.get(id) ?? new Set();
      let settled = false;
      const finish = (observed: boolean) => {
        if (settled) return;
        settled = true;
        waiters.delete(finish);
        if (waiters.size === 0) terminalWaiters.delete(id);
        clearTimeout(timeout);
        resolve(observed);
      };
      const timeout = setTimeout(() => finish(false), 5_000);
      waiters.add(finish);
      terminalWaiters.set(id, waiters);
    });
  };

  const stopAndConfirm = async (id: string): Promise<boolean> => {
    try {
      await sendRpc(pi, "stop", { runId: id });
    } catch {
      return waitForProcessTerminal(id);
    }
    return waitForProcessTerminal(id);
  };

  const singleChildWorkflow = (agent: string, task: string) =>
    `return runs.run("main", ${JSON.stringify({ agent, task, output: false })})`;

  const report = (content: string, details: Json = {}, triggerTurn = false) => {
    pi.sendMessage(
      {
        customType: "brioche-packages-bot-review",
        content,
        details,
        display: true,
      },
      { triggerTurn, deliverAs: "followUp" },
    );
  };

  const stopReview = async () => {
    const runs = [...pending.keys()];
    const directory = active?.directory;
    pending.clear();
    earlyCompletions.clear();
    active = undefined;
    const stopped = await Promise.all(runs.map(stopAndConfirm));
    await Promise.all(processingPromises);
    if (
      directory &&
      !retainedDirectories.has(directory) &&
      spawning === 0 &&
      (runs.length === 0 || stopped.every(Boolean))
    )
      await rm(directory, { recursive: true, force: true });
  };

  const spawnScout = async (review: PreparedReview, reportPath: string) => {
    if (shuttingDown || active?.directory !== review.directory) return;
    spawning += 1;
    const capability = registerSubagentCapabilityCeiling({
      sessionId: review.sessionId,
      source: "brioche-packages-bot-review",
      ceiling: {
        allowedAgents: ["scout"],
        allowedTools: ["read", "grep", "find", "ls"],
      },
    });
    try {
      const rpc = await sendRpc(pi, "spawn", {
        cwd: review.cwd,
        context: "fresh",
        workflowScript: singleChildWorkflow(
          "scout",
          scoutTask(review, reportPath),
        ),
        reads: [
          join(review.directory, "pr-metadata.json"),
          join(review.directory, "pr-description.md"),
          join(review.directory, "diff.patch"),
          join(review.directory, "status-checks.txt"),
          reportPath,
          review.cwd,
        ],
        intercomBridge: { mode: "off" },
        mission: {
          title: `Scout Brioche build recipe for package update PR ${review.number}`,
          objective:
            "Determine whether the affected build recipe needs adaptation for the new release.",
        },
        async: true,
      });
      const id = runId(rpc);
      if (!id) throw new Error("Scout started without a run identifier.");
      if (shuttingDown || active?.directory !== review.directory) {
        earlyCompletions.delete(id);
        if (await stopAndConfirm(id))
          await rm(review.directory, { recursive: true, force: true });
        else retainedDirectories.add(review.directory);
        return;
      }
      pending.set(id, { kind: "scout", review });
      const early = earlyCompletions.get(id);
      if (early) {
        earlyCompletions.delete(id);
        startCompletion(id, early);
      }
    } finally {
      capability.dispose();
      spawning -= 1;
    }
  };

  const finishResearcher = async (
    id: string,
    item: PendingRun,
    raw: unknown,
  ) => {
    const result = completion(raw);
    const reportPath = join(item.review.directory, "researcher-report.md");
    await writeFile(reportPath, `${result.output}\n`, { mode: 0o600 });
    if (shuttingDown || active?.directory !== item.review.directory) return;
    if (
      result.success === false ||
      ["failed", "error", "cancelled", "canceled"].includes(
        result.status.toLowerCase(),
      )
    ) {
      report(
        `Brioche package update researcher failed for PR ${item.review.number}. Evidence retained at ${item.review.directory}.`,
        { runId: id, reportPath },
        true,
      );
      return;
    }
    try {
      await spawnScout(item.review, reportPath);
      report(
        `Brioche package update researcher completed for PR ${item.review.number}; repository scout started.`,
        { runId: id, reportPath },
      );
    } catch (error) {
      report(
        `Could not start the Brioche package update repository scout: ${error instanceof Error ? error.message : String(error)}`,
        { runId: id, reportPath },
      );
    }
  };

  const finishScout = async (id: string, item: PendingRun, raw: unknown) => {
    const result = completion(raw);
    const reportPath = join(item.review.directory, "scout-report.md");
    await writeFile(reportPath, `${result.output}\n`, { mode: 0o600 });
    if (shuttingDown || active?.directory !== item.review.directory) return;
    if (
      result.success === false ||
      ["failed", "error", "cancelled", "canceled"].includes(
        result.status.toLowerCase(),
      )
    ) {
      report(
        `Brioche package update repository scout failed for PR ${item.review.number}. Evidence retained at ${item.review.directory}.`,
        { runId: id, reportPath },
        true,
      );
      return;
    }
    report(
      `Brioche package bot review evidence is ready for PR ${item.review.number}. Read the researcher and scout reports, the PR description, diff, and status checks from ${item.review.directory}. Summarize the release notes and build recipe evidence, then classify the recommendation as safe to merge, follow-up needed, wait, or cannot recommend. Ask the end user to explicitly choose merge, checkout, wait, or follow-up. Do not execute any PR mutation based only on the recommendation.`,
      {
        pr: item.review.number,
        directory: item.review.directory,
        researcherReport: join(item.review.directory, "researcher-report.md"),
        scoutReport: reportPath,
        statusChecks: join(item.review.directory, "status-checks.txt"),
        diff: join(item.review.directory, "diff.patch"),
        scoutRunId: id,
        scoutStatus: result.status,
      },
      true,
    );
  };

  const startCompletion = (id: string, raw: unknown) => {
    if (processing.has(id)) return;
    const item = pending.get(id);
    if (!item) return;
    processing.add(id);
    pending.delete(id);
    const promise = (
      item.kind === "researcher"
        ? finishResearcher(id, item, raw)
        : finishScout(id, item, raw)
    )
      .catch((error: unknown) => {
        report(
          `Brioche package bot review run ${id} failed: ${error instanceof Error ? error.message : String(error)}`,
          { runId: id, directory: item.review.directory },
        );
      })
      .finally(() => processing.delete(id));
    processingPromises.add(promise);
    void promise.then(
      () => processingPromises.delete(promise),
      () => processingPromises.delete(promise),
    );
  };

  const subscribeCompletion = (event: string) => {
    if (subscribed.has(event)) return;
    subscribed.add(event);
    pi.events.on(event, (raw) => {
      const id = completion(raw).runId;
      if (pending.has(id)) startCompletion(id, raw);
      else if (spawning > 0 && id) earlyCompletions.set(id, raw);
    });
  };

  const subscribeProcessTerminal = (event: string) => {
    if (subscribed.has(event)) return;
    subscribed.add(event);
    pi.events.on(event, (raw) => {
      const id = processTerminalRunId(raw);
      const state = processTerminalState(raw);
      if (!id || !state) return;
      terminalStates.set(id, state);
      const waiters = terminalWaiters.get(id);
      if (waiters) for (const finish of waiters) finish(state === "observed");
    });
  };

  const spawnResearcher = async (review: PreparedReview) => {
    const capability = registerSubagentCapabilityCeiling({
      sessionId: review.sessionId,
      source: "brioche-packages-bot-review",
      ceiling: {
        allowedAgents: ["researcher"],
        allowedTools: [
          "read",
          "web_search",
          "fetch_content",
          "get_search_content",
        ],
      },
    });
    try {
      const rpc = await sendRpc(pi, "spawn", {
        cwd: review.cwd,
        context: "fresh",
        workflowScript: singleChildWorkflow(
          "researcher",
          researcherTask(review),
        ),
        reads: [
          join(review.directory, "pr-metadata.json"),
          join(review.directory, "pr-description.md"),
          join(review.directory, "diff.patch"),
          join(review.directory, "status-checks.txt"),
          review.cwd,
        ],
        intercomBridge: { mode: "off" },
        mission: {
          title: `Research release notes for Brioche package PR ${review.number}`,
          objective:
            "Determine whether release changes require adaptation of the build recipe.",
        },
        async: true,
      });
      const id = runId(rpc);
      if (!id) throw new Error("Researcher started without a run identifier.");
      if (shuttingDown || active?.directory !== review.directory) {
        earlyCompletions.delete(id);
        if (await stopAndConfirm(id))
          await rm(review.directory, { recursive: true, force: true });
        else retainedDirectories.add(review.directory);
        return;
      }
      pending.set(id, { kind: "researcher", review });
      const early = earlyCompletions.get(id);
      if (early) {
        earlyCompletions.delete(id);
        startCompletion(id, early);
      }
    } finally {
      capability.dispose();
    }
  };

  pi.registerCommand("brioche-packages:bot-review", {
    description:
      "Review the first open Brioche package update pull request or a specified PR URL",
    handler: async (args, ctx) => {
      const requestedPullRequest = args.trim() || undefined;
      if (shuttingDown) return;
      await stopReview();
      let review: PreparedReview;
      try {
        ctx.ui.notify(
          "Preparing Brioche package update pull request evidence...",
          "info",
        );
        review = await prepareReview(
          ctx.cwd,
          ctx.sessionManager.getSessionId(),
          requestedPullRequest,
        );
        active = review;
        const events = await discoverCompletion(pi);
        subscribeCompletion(events.asyncComplete);
        subscribeProcessTerminal(events.processTerminal);
        spawning += 1;
        try {
          await spawnResearcher(review);
        } finally {
          spawning -= 1;
        }
        const pullRequest = object(review.metadata.pullRequest);
        ctx.ui.notify(
          `Started read-only Brioche package bot review for ${string(pullRequest.url)}.`,
          "info",
        );
      } catch (error) {
        active = undefined;
        ctx.ui.notify(
          error instanceof Error ? error.message : String(error),
          "error",
        );
      }
    },
  });

  pi.registerTool({
    name: "brioche_packages_bot_review_execute",
    label: "Brioche package bot review execute",
    description:
      "Execute an explicitly user-selected Brioche package bot review action.",
    parameters: Type.Object({
      action: Type.Union([
        Type.Literal("merge"),
        Type.Literal("checkout"),
        Type.Literal("wait"),
        Type.Literal("follow-up"),
      ]),
    }),
    async execute(_id, params, _signal, _onUpdate, ctx) {
      if (!active)
        return {
          content: [
            { type: "text", text: "No active Brioche package bot review." },
          ],
        };
      if (!["merge", "checkout", "wait", "follow-up"].includes(params.action))
        throw new Error("Invalid Brioche package bot review action.");
      if (params.action === "wait")
        return {
          content: [
            {
              type: "text",
              text: "Waiting. No external mutation was performed.",
            },
          ],
        };
      if (params.action === "follow-up")
        return {
          content: [
            {
              type: "text",
              text: "Follow-up selected. No external mutation was performed.",
            },
          ],
        };
      const text =
        params.action === "merge"
          ? await mergeReview(active, ctx)
          : await checkoutReview(active, ctx);
      return { content: [{ type: "text", text }] };
    },
  });

  pi.on("tool_call", (event) => {
    if (!active || !isToolCallEventType("bash", event)) return;
    const command = event.input.command;
    const bypassesReview =
      /\bgh\b.*\bpr\s+(?:merge|review|checkout|close|comment|edit)\b/.test(
        command,
      ) ||
      /\bgit\b(?:\s+\S+)*\s+(?:checkout|switch|reset|merge|rebase|commit|push|pull|fetch)\b/.test(
        command,
      );
    if (bypassesReview)
      return {
        block: true,
        terminate: true,
        reason:
          "A Brioche package bot review is active. Use brioche_packages_bot_review_execute after explicit user action selection.",
      };
  });

  pi.on("session_shutdown", async () => {
    shuttingDown = true;
    const runs = [...pending.keys()];
    const stopped = await Promise.all(runs.map(stopAndConfirm));
    await Promise.all(processingPromises);
    pending.clear();
    earlyCompletions.clear();
    processing.clear();
    if (
      active &&
      !retainedDirectories.has(active.directory) &&
      spawning === 0 &&
      (runs.length === 0 || stopped.every(Boolean))
    )
      await rm(active.directory, { recursive: true, force: true });
    active = undefined;
  });
}
