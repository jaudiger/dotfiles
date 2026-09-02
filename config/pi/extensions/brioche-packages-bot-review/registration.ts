import { rm } from "node:fs/promises";
import { join } from "node:path";
import {
  isToolCallEventType,
  type ExtensionAPI,
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
  requireAsyncCapacity,
  registerRpcReady,
} from "./rpc.js";
import { workflowTask } from "./tasks.js";
import type {
  Json,
  PickerMode,
  ReviewCandidate,
  PreparedReview,
  ReviewContext,
} from "./types.js";
import { object, string } from "./utils.js";

export default function registerBriochePackagesBotReview(pi: ExtensionAPI) {
  registerRpcReady(pi);
  type ReviewRun = {
    id: string;
    review: PreparedReview;
    completionReceived: boolean;
    completion?: unknown;
    processing: boolean;
    terminalObserved: boolean;
    stopping: boolean;
    successful?: boolean;
    reported: boolean;
    cleaned: boolean;
  };

  const reviewLabel = "Brioche package bot";
  const researchLabel = "package";
  const customType = "brioche-packages-bot-review";
  const capabilitySource = "brioche-packages-bot-review";
  const capabilityLockKey = Symbol.for(
    "pi-subagents.capability-ceiling-spawn-lock",
  );
  const globalLocks = globalThis as typeof globalThis &
    Record<symbol, Promise<void> | undefined>;
  const runs = new Map<string, ReviewRun>();
  const earlyCompletions = new Map<string, unknown>();
  const earlyTerminals = new Map<string, string>();
  const processingPromises = new Set<Promise<void>>();
  const spawningPromises = new Set<Promise<void>>();
  const retainedDirectories = new Set<string>();
  const subscribed = new Set<string>();
  let active: ReviewContext | undefined;
  const statusKey = "brioche-package-bot-review";
  let spawning = 0;
  let shuttingDown = false;
  const terminalStates = new Map<string, string>();
  const terminalWaiters = new Map<string, Set<(observed: boolean) => void>>();

  const isActiveReview = (review: PreparedReview): boolean =>
    active?.reviews.some((item) => item.directory === review.directory) ??
    false;

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

  const stopAndConfirm = async (run: ReviewRun): Promise<boolean> => {
    try {
      await sendRpc(pi, "stop", { runId: run.id });
    } catch {
      return waitForProcessTerminal(run.id);
    }
    return waitForProcessTerminal(run.id);
  };

  const cleanupRun = async (run: ReviewRun): Promise<void> => {
    if (!run.terminalObserved || run.cleaned) return;
    try {
      await rm(run.review.directory, { recursive: true, force: true });
      run.cleaned = true;
      runs.delete(run.id);
      terminalStates.delete(run.id);
    } catch {
      retainedDirectories.add(run.review.directory);
    }
  };

  const report = (content: string, details: Json = {}, triggerTurn = false) => {
    pi.sendMessage(
      { customType, content, details, display: true },
      { triggerTurn, deliverAs: "followUp" },
    );
  };

  const stopReview = async () => {
    const directories = active?.reviews.map((review) => review.directory) ?? [];
    active = undefined;
    for (const run of runs.values()) run.stopping = true;
    await Promise.allSettled([...spawningPromises]);
    const ownedRuns = [...runs.values()];
    const stopped = await Promise.all(
      ownedRuns.map(async (run) => {
        run.terminalObserved = await stopAndConfirm(run);
        if (run.terminalObserved) await cleanupRun(run);
        return run.terminalObserved;
      }),
    );
    await Promise.allSettled([...processingPromises]);
    const runDirectories = new Set(
      ownedRuns.map((run) => run.review.directory),
    );
    if (stopped.every(Boolean))
      await Promise.all(
        directories
          .filter(
            (directory) =>
              !runDirectories.has(directory) &&
              !retainedDirectories.has(directory),
          )
          .map((directory) => rm(directory, { recursive: true, force: true })),
      );
    earlyCompletions.clear();
    earlyTerminals.clear();
  };

  const acquireCapabilityLock = async (): Promise<() => void> => {
    const previous = globalLocks[capabilityLockKey] ?? Promise.resolve();
    let release!: () => void;
    globalLocks[capabilityLockKey] = new Promise<void>((resolve) => {
      release = resolve;
    });
    await previous;
    return release;
  };

  const spawnWorkflow = async (review: PreparedReview): Promise<void> => {
    if (shuttingDown || !isActiveReview(review)) return;
    spawning += 1;
    const release = await acquireCapabilityLock();
    try {
      if (shuttingDown || !isActiveReview(review)) return;
      const capability = registerSubagentCapabilityCeiling({
        sessionId: review.sessionId,
        source: capabilitySource,
        ceiling: {
          allowedAgents: ["researcher", "scout"],
          allowedTools: [
            "read",
            "grep",
            "find",
            "ls",
            "web_search",
            "fetch_content",
            "get_search_content",
          ],
        },
      });
      let rpc: unknown;
      try {
        rpc = await sendRpc(pi, "spawn", {
          cwd: review.cwd,
          workflowScript: workflowTask(review),
          output: false,
          intercomBridge: { mode: "off" },
          mission: false,
          async: true,
        });
      } finally {
        capability.dispose();
      }
      const id = runId(rpc);
      if (!id)
        throw new Error("Review workflow started without a run identifier.");
      const earlyTerminal = earlyTerminals.get(id);
      earlyTerminals.delete(id);
      if (earlyTerminal) terminalStates.set(id, earlyTerminal);
      const run: ReviewRun = {
        id,
        review,
        completionReceived: false,
        processing: false,
        terminalObserved:
          earlyTerminal === "observed" || terminalStates.get(id) === "observed",
        stopping: shuttingDown || !isActiveReview(review),
        reported: false,
        cleaned: false,
      };
      runs.set(id, run);
      if (run.stopping) {
        run.terminalObserved = await stopAndConfirm(run);
        if (run.terminalObserved) await cleanupRun(run);
        else retainedDirectories.add(review.directory);
        return;
      }
      const early = earlyCompletions.get(id);
      if (early !== undefined) {
        earlyCompletions.delete(id);
        run.completion = early;
        run.completionReceived = true;
        startCompletion(run);
      }
    } finally {
      release();
      spawning -= 1;
    }
  };

  const processCompletion = async (run: ReviewRun): Promise<void> => {
    try {
      if (!run.terminalObserved)
        run.terminalObserved = await waitForProcessTerminal(run.id);
      if (!run.terminalObserved) return;
      if (run.stopping || shuttingDown || !isActiveReview(run.review)) {
        await cleanupRun(run);
        return;
      }
      const result = completion(run.completion);
      const failed =
        result.success === false ||
        !["complete", "completed", "success", "succeeded"].includes(
          result.status.toLowerCase(),
        );
      run.successful = !failed;
      run.reported = true;
      if (failed) {
        report(
          `${reviewLabel} review workflow failed for PR ${run.review.number}. Evidence retained at ${run.review.directory}.`,
          {
            runId: run.id,
            directory: run.review.directory,
            researcherReport: join(
              run.review.directory,
              "researcher-report.md",
            ),
            scoutReport: join(run.review.directory, "scout-report.md"),
            status: result.status,
          },
        );
        return;
      }
      const ready =
        active?.reviews.every((review) =>
          [...runs.values()].some(
            (candidate) =>
              candidate.review.directory === review.directory &&
              candidate.successful === true &&
              candidate.terminalObserved,
          ),
        ) ?? false;
      if (ready) active.state = "ready";
      report(
        `${reviewLabel} review evidence is ready for PR ${run.review.number}. Read the researcher and scout reports, the diff, current status checks, merge queue history, and every referenced log from ${run.review.directory}. Treat the researcher report as the canonical ${researchLabel} research. Summarize only recipe and check evidence, resolve any discrepancies against the diff, and classify the recommendation. Tell the user that available next actions are merge, checkout, wait, or follow-up. Wait for explicit selection and use the review execution tool for the selected action. Do not execute any PR mutation based only on the recommendation.`,
        {
          pr: run.review.number,
          directory: run.review.directory,
          researcherReport: join(run.review.directory, "researcher-report.md"),
          scoutReport: join(run.review.directory, "scout-report.md"),
          statusChecks: join(run.review.directory, "pr-metadata.json"),
          diff: join(run.review.directory, "diff.patch"),
          workflowRunId: run.id,
          workflowStatus: result.status,
        },
      );
    } finally {
      run.processing = false;
    }
  };

  const startCompletion = (run: ReviewRun): void => {
    if (run.processing || run.reported || !run.completionReceived) return;
    run.processing = true;
    const promise = processCompletion(run).catch((error: unknown) => {
      run.successful = false;
      run.reported = true;
      report(
        `${reviewLabel} review run ${run.id} failed: ${error instanceof Error ? error.message : String(error)}`,
        { runId: run.id, directory: run.review.directory },
      );
    });
    processingPromises.add(promise);
    void promise.then(
      () => processingPromises.delete(promise),
      () => processingPromises.delete(promise),
    );
  };

  const subscribeCompletion = (event: string): void => {
    if (subscribed.has(event)) return;
    subscribed.add(event);
    pi.events.on(event, (raw) => {
      const id = completion(raw).runId;
      const run = runs.get(id);
      if (run) {
        if (!run.completionReceived) {
          run.completion = raw;
          run.completionReceived = true;
          startCompletion(run);
        }
      } else if (spawning > 0 && id) {
        earlyCompletions.set(id, raw);
      }
    });
  };

  const trackSpawning = (promise: Promise<void>): Promise<void> => {
    spawningPromises.add(promise);
    void promise.then(
      () => spawningPromises.delete(promise),
      () => spawningPromises.delete(promise),
    );
    return promise;
  };

  const subscribeProcessTerminal = (event: string): void => {
    if (subscribed.has(event)) return;
    subscribed.add(event);
    pi.events.on(event, (raw) => {
      const id = processTerminalRunId(raw);
      const state = processTerminalState(raw);
      const run = id ? runs.get(id) : undefined;
      if (!run || !state) {
        if (id && state && spawning > 0) earlyTerminals.set(id, state);
        return;
      }
      terminalStates.set(id, state);
      if (state === "observed") run.terminalObserved = true;
      const waiters = terminalWaiters.get(id);
      if (waiters) for (const finish of waiters) finish(state === "observed");
      if (run.stopping && run.terminalObserved) void cleanupRun(run);
      else if (run.completionReceived) startCompletion(run);
    });
  };

  pi.registerCommand("brioche-packages:bot-review", {
    description:
      "Select an open Brioche package update pull request or use a specified PR URL",
    handler: async (args, ctx) => {
      const requestedPullRequest = args.trim() || undefined;
      if (shuttingDown) return;
      await stopReview();
      if (shuttingDown) return;
      const progress = (message: string) =>
        ctx.ui.setStatus(statusKey, message);
      let requests: string[] = [];
      let candidates: ReviewCandidate[] = [];
      let pickerMode: PickerMode = "review";
      try {
        progress(
          requestedPullRequest
            ? "Preparing the requested pull request..."
            : "Loading Brioche package update pull requests...",
        );
        if (!requestedPullRequest) {
          ctx.ui.notify(
            "Loading Brioche package update pull requests...",
            "info",
          );
          candidates = await listCandidates();
          if (candidates.length === 0)
            throw new Error(
              "No open Brioche package update pull request was found in the current repository.",
            );
          const selected = await pickReview(
            ctx,
            candidates,
            (candidate) => fetchReviewDiff(candidate),
            (candidate) => fetchReviewDetails(candidate),
            true,
          );
          if (!selected || selected.candidates.length === 0) return;
          if (shuttingDown) return;
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
            if (shuttingDown) return;
            const text =
              pickerMode === "merge"
                ? await mergeReview(targets, ctx, progress)
                : await supersedeReview(targets, ctx, progress);
            progress("Refreshing remaining pull requests...");
            try {
              candidates = await listCandidates();
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
          `Preparing Brioche package update evidence for ${requests.length} pull request${requests.length === 1 ? "" : "s"}...`,
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
          if (shuttingDown) {
            await rm(review.directory, { recursive: true, force: true });
            await stopReview();
            return;
          }
          session.reviews = [...session.reviews, review];
          session.generation += 1;
        }
        if (shuttingDown) {
          await stopReview();
          return;
        }
        session.state = "researching";
        progress(
          `Starting read-only research for ${session.reviews.length} pull request${session.reviews.length === 1 ? "" : "s"}...`,
        );
        const reviews = session.reviews;
        const events = await discoverCompletion(pi);
        if (shuttingDown) {
          await stopReview();
          return;
        }
        subscribeCompletion(events.asyncComplete);
        subscribeProcessTerminal(events.processTerminal);
        const status = await sendRpc(pi, "status", {});
        if (shuttingDown) {
          await stopReview();
          return;
        }
        requireAsyncCapacity(
          status,
          reviews.length,
          `the selected ${reviews.length} pull request${reviews.length === 1 ? "" : "s"}`,
        );
        spawning += 1;
        try {
          const results = await Promise.allSettled(
            reviews.map((review) => trackSpawning(spawnWorkflow(review))),
          );
          const failure = results.find(
            (result) => result.status === "rejected",
          );
          if (failure?.status === "rejected") throw failure.reason;
        } finally {
          spawning -= 1;
        }
        if (shuttingDown) return;
        progress(
          "Read-only research started; waiting for researcher results...",
        );
        const urls = reviews.map((review) =>
          string(object(review.metadata.pullRequest).url),
        );
        ctx.ui.notify(
          `Started read-only Brioche package bot review for ${urls.join(", ")}.`,
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
    name: "brioche_packages_bot_review_execute",
    label: "Brioche package bot review execute",
    description:
      "Execute an explicitly user-selected Brioche package bot review action: merge, checkout, wait, or follow-up.",
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
      if (active.state !== "ready")
        return {
          content: [
            {
              type: "text",
              text: "Review evidence is not ready for mutation. Wait until every selected PR has a successful, terminal-observed result.",
            },
          ],
        };
      active.state = "mutating";
      ctx.ui.setStatus(
        statusKey,
        params.action === "merge"
          ? `Merging PR ${active.reviews[0]?.number ?? "selected pull request"}...`
          : `Checking out PR ${active.reviews[0]?.number ?? "selected pull request"}...`,
      );
      try {
        const targets = active.reviews.map((review) => ({
          number: review.number,
          repository: review.repository,
          snapshot: review.snapshot,
          cwd: review.cwd,
        }));
        const text =
          params.action === "merge"
            ? await mergeReview(targets, ctx, (message) =>
                ctx.ui.setStatus(statusKey, message),
              )
            : await checkoutReview(active.reviews, ctx, (message) =>
                ctx.ui.setStatus(statusKey, message),
              );
        try {
          ctx.ui.setStatus(statusKey, "Refreshing remaining pull requests...");
          active.candidates = await listCandidates();
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
          "A Brioche package bot review is active. Use brioche_packages_bot_review_execute after explicit user action selection.",
      };
  });

  pi.on("session_shutdown", async () => {
    shuttingDown = true;
    await stopReview();
  });
}
