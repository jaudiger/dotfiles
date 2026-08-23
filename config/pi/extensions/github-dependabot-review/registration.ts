import { rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  isToolCallEventType,
  type ExtensionAPI,
  type ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { registerSubagentCapabilityCeiling } from "pi-subagents/capability-ceiling";
import {
  checkoutReview,
  fetchReviewDetails,
  fetchReviewDiff,
  listCandidates,
  mergeReview,
  prepareMutationTarget,
  prepareReview,
  supersedeReview,
} from "./github.js";
import { pickReview } from "./review-picker.js";
import {
  discoverCompletion,
  completion,
  processTerminalRunId,
  processTerminalState,
  runId,
  sendRpc,
  preflightLaunch,
  requireAsyncCapacity,
} from "./rpc.js";
import { researcherTask, scoutTask } from "./tasks.js";
import type {
  Json,
  PendingRun,
  PickerMode,
  ReviewCandidate,
  PreparedReview,
  ReviewContext,
} from "./types.js";
import { object, string } from "./utils.js";

export default function registerDependabotReview(pi: ExtensionAPI) {
  const pending = new Map<string, PendingRun>();
  const earlyCompletions = new Map<string, unknown>();
  const processing = new Set<string>();
  const processingPromises = new Set<Promise<void>>();
  const retainedDirectories = new Set<string>();
  const subscribed = new Set<string>();
  let active: ReviewContext | undefined;
  const statusKey = "github-dependabot-review";

  const isActiveReview = (review: PreparedReview): boolean =>
    active?.reviews.some((item) => item.directory === review.directory) ??
    false;
  let spawning = 0;
  let shuttingDown = false;
  let currentContext: ExtensionContext | undefined;
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
        customType: "github-dependabot-review",
        content,
        details,
        display: true,
      },
      { triggerTurn, deliverAs: "followUp" },
    );
  };

  const stopReview = async () => {
    const runs = [...pending.keys()];
    const directories = active?.reviews.map((review) => review.directory) ?? [];
    pending.clear();
    earlyCompletions.clear();
    active = undefined;
    const stopped = await Promise.all(runs.map(stopAndConfirm));
    await Promise.all(processingPromises);
    if (spawning === 0 && (runs.length === 0 || stopped.every(Boolean))) {
      await Promise.all(
        directories
          .filter((directory) => !retainedDirectories.has(directory))
          .map((directory) => rm(directory, { recursive: true, force: true })),
      );
    }
  };

  const spawnScout = async (review: PreparedReview, reportPath: string) => {
    if (shuttingDown || !isActiveReview(review)) return;
    spawning += 1;
    const capability = registerSubagentCapabilityCeiling({
      sessionId: review.sessionId,
      source: "github-dependabot-review",
      ceiling: {
        allowedAgents: ["scout"],
        allowedTools: ["read", "grep", "find", "ls"],
      },
    });
    try {
      const task = scoutTask(review, reportPath);
      if (!currentContext)
        throw new Error("No active extension context for scout preflight.");
      await preflightLaunch(currentContext, "scout", task);
      const rpc = await sendRpc(pi, "spawn", {
        cwd: review.cwd,
        context: "fresh",
        workflowScript: singleChildWorkflow("scout", task),
        reads: [
          join(review.directory, "pr-metadata.json"),
          join(review.directory, "pr-description.md"),
          join(review.directory, "diff.patch"),
          join(review.directory, "status-checks.txt"),
          reportPath,
          review.cwd,
        ],
        intercomBridge: { mode: "off" },
        mission: false,
        async: true,
      });
      const id = runId(rpc);
      if (!id) throw new Error("Scout started without a run identifier.");
      if (shuttingDown || !isActiveReview(review)) {
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
    if (shuttingDown || !isActiveReview(item.review)) return;
    if (
      result.success === false ||
      ["failed", "error", "cancelled", "canceled"].includes(
        result.status.toLowerCase(),
      )
    ) {
      report(
        `Dependabot researcher failed for PR ${item.review.number}. Evidence retained at ${item.review.directory}.`,
        { runId: id, reportPath },
        true,
      );
      return;
    }
    try {
      await spawnScout(item.review, reportPath);
      report(
        `Dependabot researcher completed for PR ${item.review.number}; repository scout started.`,
        { runId: id, reportPath },
      );
    } catch (error) {
      report(
        `Could not start the Dependabot repository scout: ${error instanceof Error ? error.message : String(error)}`,
        { runId: id, reportPath },
      );
    }
  };

  const finishScout = async (id: string, item: PendingRun, raw: unknown) => {
    const result = completion(raw);
    const reportPath = join(item.review.directory, "scout-report.md");
    await writeFile(reportPath, `${result.output}\n`, { mode: 0o600 });
    if (shuttingDown || !isActiveReview(item.review)) return;
    if (
      result.success === false ||
      ["failed", "error", "cancelled", "canceled"].includes(
        result.status.toLowerCase(),
      )
    ) {
      report(
        `Dependabot repository scout failed for PR ${item.review.number}. Evidence retained at ${item.review.directory}.`,
        { runId: id, reportPath },
        true,
      );
      return;
    }
    report(
      `Dependabot review evidence is ready for PR ${item.review.number}. Read the researcher and scout reports, the PR description, diff, and status checks from ${item.review.directory}. Summarize the evidence and classify the recommendation as safe to merge, follow-up needed, wait, or cannot recommend. Ask the end user to explicitly choose merge, checkout, wait, or follow-up. Do not execute any PR mutation based only on the recommendation.`,
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
          `Dependabot review run ${id} failed: ${error instanceof Error ? error.message : String(error)}`,
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
      source: "github-dependabot-review",
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
      const task = researcherTask(review);
      if (!currentContext)
        throw new Error(
          "No active extension context for researcher preflight.",
        );
      await preflightLaunch(currentContext, "researcher", task);
      const rpc = await sendRpc(pi, "spawn", {
        cwd: review.cwd,
        context: "fresh",
        workflowScript: singleChildWorkflow("researcher", task),
        reads: [
          join(review.directory, "pr-metadata.json"),
          join(review.directory, "pr-description.md"),
          join(review.directory, "diff.patch"),
          join(review.directory, "status-checks.txt"),
          review.cwd,
        ],
        intercomBridge: { mode: "off" },
        mission: false,
        async: true,
      });
      const id = runId(rpc);
      if (!id) throw new Error("Researcher started without a run identifier.");
      if (shuttingDown || !isActiveReview(review)) {
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

  pi.registerCommand("github:dependabot-review", {
    description:
      "Select an open Dependabot pull request or use a specified PR URL",
    handler: async (args, ctx) => {
      const requestedPullRequest = args.trim() || undefined;
      if (shuttingDown) return;
      currentContext = ctx;
      await stopReview();
      const progress = (message: string) =>
        ctx.ui.setStatus(statusKey, message);
      let requests: string[] = [];
      let candidates: ReviewCandidate[] = [];
      let pickerMode: PickerMode = "review";
      try {
        progress(
          requestedPullRequest
            ? "Preparing the requested pull request..."
            : "Loading Dependabot pull requests...",
        );
        if (!requestedPullRequest) {
          ctx.ui.notify("Loading Dependabot pull requests...", "info");
          candidates = await listCandidates(ctx.cwd);
          if (candidates.length === 0)
            throw new Error(
              "No open Dependabot pull request without a review was found across the searched repositories.",
            );
          const selected = await pickReview(
            ctx,
            candidates,
            (candidate) => fetchReviewDiff(candidate, ctx.cwd),
            (candidate) => fetchReviewDetails(candidate, ctx.cwd),
            false,
          );
          if (!selected || selected.candidates.length === 0) return;
          pickerMode = selected.mode;
          candidates = selected.candidates;
          if (pickerMode !== "review") {
            const action = pickerMode === "merge" ? "merge" : "supersede";
            progress(
              `Preparing ${candidates.length} pull request${candidates.length === 1 ? "" : "s"} for ${action}...`,
            );
            ctx.ui.notify(
              `Loading fresh pull request metadata for ${candidates.length} selected pull request${candidates.length === 1 ? "" : "s"}...`,
              "info",
            );
            const targets = await Promise.all(
              candidates.map(async (candidate, index) => {
                progress(
                  `Preparing ${action} pull request ${index + 1} of ${candidates.length}: PR ${candidate.number}...`,
                );
                return prepareMutationTarget(candidate, ctx.cwd);
              }),
            );
            const text =
              pickerMode === "merge"
                ? await mergeReview(targets, ctx, progress)
                : await supersedeReview(targets, ctx, progress);
            progress("Refreshing remaining pull requests...");
            try {
              candidates = await listCandidates(ctx.cwd);
            } catch {
              candidates = [];
            }
            ctx.ui.notify(text, "info");
            return;
          }
          requests = candidates.map((candidate) => candidate.url);
        } else {
          requests = [requestedPullRequest];
        }

        progress(
          `Preparing evidence for ${requests.length} pull request${requests.length === 1 ? "" : "s"}...`,
        );
        ctx.ui.notify(
          `Preparing Dependabot evidence for ${requests.length} pull request${requests.length === 1 ? "" : "s"}...`,
          "info",
        );
        const session: ReviewContext = {
          candidates,
          reviews: [],
          generation: 0,
          state: "preparing",
        };
        active = session;
        for (let index = 0; index < requests.length; index += 1) {
          const request = requests[index]!;
          progress(`Preparing evidence ${index + 1} of ${requests.length}...`);
          const review = await prepareReview(
            ctx.cwd,
            ctx.sessionManager.getSessionId(),
            request,
          );
          session.reviews = [...session.reviews, review];
          session.generation += 1;
        }
        session.state = "researching";
        progress(
          `Starting read-only research for ${session.reviews.length} pull request${session.reviews.length === 1 ? "" : "s"}...`,
        );
        const reviews = session.reviews;
        const events = await discoverCompletion(pi);
        subscribeCompletion(events.asyncComplete);
        subscribeProcessTerminal(events.processTerminal);
        const status = await sendRpc(pi, "status", {});
        requireAsyncCapacity(
          status,
          reviews.length,
          `the selected ${reviews.length} pull request${reviews.length === 1 ? "" : "s"}`,
        );
        spawning += 1;
        try {
          const results = await Promise.allSettled(
            reviews.map((review) => spawnResearcher(review)),
          );
          const failure = results.find(
            (result) => result.status === "rejected",
          );
          if (failure?.status === "rejected") throw failure.reason;
        } finally {
          spawning -= 1;
        }
        progress(
          "Read-only research started; waiting for researcher results...",
        );
        const urls = reviews.map((review) =>
          string(object(review.metadata.pullRequest).url),
        );
        ctx.ui.notify(
          `Started read-only Dependabot review for ${urls.join(", ")}.`,
          "info",
        );
      } catch (error) {
        await stopReview();
        ctx.ui.notify(
          error instanceof Error ? error.message : String(error),
          "error",
        );
      } finally {
        ctx.ui.setStatus(statusKey, undefined);
      }
    },
  });

  pi.registerTool({
    name: "github_dependabot_review_execute",
    label: "Dependabot Review Execute",
    description:
      "Execute an explicitly user-selected Dependabot review action.",
    parameters: Type.Object({
      action: Type.Union([
        Type.Literal("checkout"),
        Type.Literal("wait"),
        Type.Literal("follow-up"),
      ]),
    }),
    async execute(_id, params, _signal, _onUpdate, ctx) {
      if (!active)
        return {
          content: [{ type: "text", text: "No active Dependabot review." }],
        };
      if (!["checkout", "wait", "follow-up"].includes(params.action))
        throw new Error("Invalid Dependabot review action.");
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
      active.state = "mutating";
      ctx.ui.setStatus(
        statusKey,
        `Checking out PR ${active.reviews[0]?.number ?? "selected pull request"}...`,
      );
      try {
        const text = await checkoutReview(active.reviews, ctx, (message) =>
          ctx.ui.setStatus(statusKey, message),
        );
        try {
          ctx.ui.setStatus(statusKey, "Refreshing remaining pull requests...");
          active.candidates = await listCandidates(ctx.cwd);
          active.generation += 1;
        } catch {
          active.state = "stale";
        }
        return { content: [{ type: "text", text }] };
      } finally {
        active.generation += 1;
        active.state = "stale";
        ctx.ui.setStatus(statusKey, undefined);
      }
    },
  });

  pi.on("tool_call", (event) => {
    if (!active || !isToolCallEventType("bash", event)) return;
    const command = event.input.command;
    const bypassesReview =
      /\bgh\b.*\bpr\s+(?:merge|review|checkout|close|comment|edit|create)\b/.test(
        command,
      ) ||
      /\bgh\b(?:\s+\S+)*\s+api\b/.test(command) ||
      /\bgit\b(?:\s+\S+)*\s+(?:clone|checkout|switch|reset|merge|rebase|commit|cherry-pick|branch|push|pull|fetch)\b/.test(
        command,
      );
    if (bypassesReview)
      return {
        block: true,
        terminate: true,
        reason:
          "A Dependabot review is active. Use github_dependabot_review_execute after explicit user action selection.",
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
      spawning === 0 &&
      (runs.length === 0 || stopped.every(Boolean))
    )
      await Promise.all(
        active.reviews
          .map((review) => review.directory)
          .filter((directory) => !retainedDirectories.has(directory))
          .map((directory) => rm(directory, { recursive: true, force: true })),
      );
    active = undefined;
    currentContext = undefined;
  });
}
