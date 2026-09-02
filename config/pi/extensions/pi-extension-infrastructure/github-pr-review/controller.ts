import { rm } from "node:fs/promises";
import {
  isToolCallEventType,
  type ExtensionAPI,
  type ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { pickReview } from "./picker.js";
import {
  workflowTask,
  type ReviewWorkflowProvider,
} from "./workflow-script.js";
import type {
  Json,
  MutationTarget,
  PreparedReview,
  ReviewCandidate,
  ReviewDetails,
} from "./types.js";

type ReviewMutationAction = "merge" | "checkout" | "supersede";

/**
 * The provider boundary for the shared review controller.
 *
 * Candidate discovery/preparation, prompts, wording, and mutations remain
 * provider-owned. The controller only coordinates their lifecycle and the
 * read-only researcher/scout workflow. Providers can implement the operation
 * callbacks with the shared github-operations module without coupling this
 * controller to a particular pull-request source.
 */
export type GithubPrReviewControllerProvider = {
  /** Stable names used for status, custom messages, and capability ceilings. */
  identity: {
    customType: string;
    statusKey: string;
    capabilitySource: string;
  };
  labels: {
    review: string;
    research: string;
  };
  command: {
    name: string;
    description: string;
  };
  tool: {
    name: string;
    label: string;
    description: string;
  };

  /** Provider filtering and data loading, including provider-specific PR URLs. */
  candidateEligibility: (candidate: ReviewCandidate) => boolean;
  listCandidates: (cwd: string) => Promise<ReviewCandidate[]>;
  /** Preserve provider-specific repository context in cross-repository pickers. */
  showRepositoryDescription?: boolean;
  loadDiff: (candidate: ReviewCandidate, cwd: string) => Promise<string>;
  loadDetails: (
    candidate: ReviewCandidate,
    cwd: string,
  ) => Promise<ReviewDetails>;
  showQueuePosition: boolean;
  prepareReview: (
    cwd: string,
    sessionId: string,
    requestedPullRequest?: string,
  ) => Promise<PreparedReview>;

  workflow: ReviewWorkflowProvider;

  /** Provider-specific mutation preparation and mutation implementations. */
  prepareMutationTarget: (
    candidate: ReviewCandidate,
    cwd: string,
  ) => Promise<MutationTarget>;
  mutations: {
    before: (
      action: ReviewMutationAction,
      targets: MutationTarget[],
      ctx: ExtensionContext,
    ) => Promise<void>;
    /** Preserve provider-specific picker mutation UX without owning it here. */
    beforePickerPreparation?: (
      action: "merge" | "supersede",
      count: number,
      ctx: ExtensionContext,
    ) => void;
    pickerPreparationProgress?: (
      action: "merge" | "supersede",
      candidate: ReviewCandidate,
      index: number,
      count: number,
      progress: (message: string) => void,
    ) => void;
    beforePickerRefresh?: (
      ctx: ExtensionContext,
      progress: (message: string) => void,
    ) => void;
    beforeMutationRefresh?: (
      ctx: ExtensionContext,
      progress: (message: string) => void,
    ) => void;
    afterPickerMutation?: (text: string, ctx: ExtensionContext) => void;
    merge: (
      targets: MutationTarget[],
      ctx: ExtensionContext,
      progress: (message: string) => void,
    ) => Promise<string>;
    checkout: (
      reviews: PreparedReview[],
      ctx: ExtensionContext,
      progress: (message: string) => void,
    ) => Promise<string>;
    supersede?: (
      targets: MutationTarget[],
      ctx: ExtensionContext,
      progress: (message: string) => void,
    ) => Promise<string>;
  };

  /** User-facing wording stays with each provider rather than this controller. */
  text: {
    loadingCandidates: string;
    noCandidates: string;
    preparingEvidence: (count: number) => string;
    /** Optional provider-specific status emitted before workflow discovery. */
    startingResearch?: (count: number) => string;
    /** Optional provider-specific status emitted after workflows start. */
    researchStarted?: string;
    startedReview: (urls: string[]) => string;
    preparingRequested: string;
    preparingSelected: (count: number, action: "merge" | "supersede") => string;
    noActiveReview: string;
    waiting: string;
    followUp: string;
    notReady: string;
    mutationStatus: (
      action: "merge" | "checkout",
      review?: PreparedReview,
    ) => string;
    blockedCommand: string;
    workflowFailure: (run: ReviewRun, result: RpcCompletion) => ReviewMessage;
    workflowReady: (run: ReviewRun, result: RpcCompletion) => ReviewMessage;
    runFailure: (run: ReviewRun, error: unknown) => ReviewMessage;
  };

  /** RPC and process-event details are shared infrastructure seams. */
  runtime: ReviewControllerRuntime;
};

export type ReviewControllerRuntime = {
  registerReady: (pi: ExtensionAPI) => void;
  discoverEvents: (
    pi: ExtensionAPI,
  ) => Promise<{ asyncComplete: string; processTerminal: string }>;
  send: (pi: ExtensionAPI, method: string, params: Json) => Promise<unknown>;
  completion: (value: unknown) => RpcCompletion;
  processTerminalRunId: (value: unknown) => string;
  processTerminalState: (value: unknown) => string;
  runId: (value: unknown) => string;
  requireAsyncCapacity: (
    value: unknown,
    requested: number,
    label: string,
  ) => void;
  /** Start a read-only workflow under the provider's capability ceiling. */
  spawn: (
    pi: ExtensionAPI,
    review: PreparedReview,
    workflowScript: string,
    capabilitySource: string,
  ) => Promise<unknown>;
};

type ReviewSessionState =
  "preparing" | "researching" | "ready" | "mutating" | "stale";

type ReviewContext = {
  candidates: ReviewCandidate[];
  reviews: PreparedReview[];
  generation: number;
  state: ReviewSessionState;
};

type RpcCompletion = {
  runId: string;
  output: string;
  status: string;
  success?: boolean;
};

export type ReviewMessage = {
  content: string;
  details?: Json;
  triggerTurn?: boolean;
};

function reviewUrl(review: PreparedReview): string {
  const pullRequest = review.metadata.pullRequest;
  if (
    pullRequest &&
    typeof pullRequest === "object" &&
    !Array.isArray(pullRequest)
  ) {
    const url = (pullRequest as Json).url;
    if (typeof url === "string" && url) return url;
  }
  return review.number.toString();
}

export type ReviewRun = {
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

export type GithubPrReviewController = {
  readonly active: ReviewContext | undefined;
  readonly shuttingDown: boolean;
  stopReview: () => Promise<void>;
};

/**
 * Register the provider-neutral review command, execution tool, mutation gate,
 * and shutdown cleanup. Consumers only supply provider seams; they do not own
 * run/event bookkeeping.
 */
export function registerGithubPrReviewController(
  pi: ExtensionAPI,
  provider: GithubPrReviewControllerProvider,
): GithubPrReviewController {
  provider.runtime.registerReady(pi);

  const runs = new Map<string, ReviewRun>();
  const earlyCompletions = new Map<string, unknown>();
  const earlyTerminals = new Map<string, string>();
  const processingPromises = new Set<Promise<void>>();
  const spawningPromises = new Set<Promise<void>>();
  const retainedDirectories = new Set<string>();
  const subscribed = new Set<string>();
  const terminalStates = new Map<string, string>();
  const terminalWaiters = new Map<string, Set<(observed: boolean) => void>>();
  let active: ReviewContext | undefined;
  let spawning = 0;
  let shuttingDown = false;

  const report = (message: ReviewMessage): void => {
    pi.sendMessage(
      {
        customType: provider.identity.customType,
        content: message.content,
        details: message.details ?? {},
        display: true,
      },
      {
        triggerTurn: message.triggerTurn ?? false,
        deliverAs: "followUp",
      },
    );
  };

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
      await provider.runtime.send(pi, "stop", { runId: run.id });
    } catch {
      // A failed stop request is still followed by terminal-event observation.
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

  const stopReview = async (): Promise<void> => {
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

  const spawnWorkflow = async (review: PreparedReview): Promise<void> => {
    if (shuttingDown || !isActiveReview(review)) return;
    spawning += 1;
    try {
      if (shuttingDown || !isActiveReview(review)) return;
      const rpc = await provider.runtime.spawn(
        pi,
        review,
        workflowTask(review, provider.workflow),
        provider.identity.capabilitySource,
      );
      const id = provider.runtime.runId(rpc);
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
      const result = provider.runtime.completion(run.completion);
      const failed =
        result.success === false ||
        !["complete", "completed", "success", "succeeded"].includes(
          result.status.toLowerCase(),
        );
      run.successful = !failed;
      run.reported = true;
      if (!failed) {
        const ready =
          active?.reviews.every((review) =>
            [...runs.values()].some(
              (candidate) =>
                candidate.review.directory === review.directory &&
                candidate.successful === true &&
                candidate.terminalObserved,
            ),
          ) ?? false;
        if (ready && active) active.state = "ready";
      }
      report(
        failed
          ? provider.text.workflowFailure(run, result)
          : provider.text.workflowReady(run, result),
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
      report(provider.text.runFailure(run, error));
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
      const id = provider.runtime.completion(raw).runId;
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
      const id = provider.runtime.processTerminalRunId(raw);
      const state = provider.runtime.processTerminalState(raw);
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

  const progressFor = (ctx: ExtensionContext) => (message: string) =>
    ctx.ui.setStatus(provider.identity.statusKey, message);

  pi.registerCommand(provider.command.name, {
    description: provider.command.description,
    handler: async (args, ctx) => {
      const requestedPullRequest = args.trim() || undefined;
      if (shuttingDown) return;
      await stopReview();
      if (shuttingDown) return;
      const progress = progressFor(ctx);
      let requests: string[] = [];
      let candidates: ReviewCandidate[] = [];
      try {
        progress(
          requestedPullRequest
            ? provider.text.preparingRequested
            : provider.text.loadingCandidates,
        );
        if (!requestedPullRequest) {
          ctx.ui.notify(provider.text.loadingCandidates, "info");
          candidates = (await provider.listCandidates(ctx.cwd)).filter(
            provider.candidateEligibility,
          );
          if (candidates.length === 0)
            throw new Error(provider.text.noCandidates);
          const selected = await pickReview(
            ctx,
            candidates,
            (candidate) => provider.loadDiff(candidate, ctx.cwd),
            (candidate) => provider.loadDetails(candidate, ctx.cwd),
            provider.showQueuePosition,
            provider.showRepositoryDescription ?? false,
          );
          if (!selected || selected.candidates.length === 0) return;
          if (shuttingDown) return;
          candidates = selected.candidates;
          if (selected.mode !== "review") {
            const action = selected.mode === "merge" ? "merge" : "supersede";
            progress(
              provider.text.preparingSelected(candidates.length, action),
            );
            provider.mutations.beforePickerPreparation?.(
              action,
              candidates.length,
              ctx,
            );
            const targets = await Promise.all(
              candidates.map((candidate, index) => {
                provider.mutations.pickerPreparationProgress?.(
                  action,
                  candidate,
                  index,
                  candidates.length,
                  progress,
                );
                return provider.prepareMutationTarget(candidate, ctx.cwd);
              }),
            );
            if (shuttingDown) return;
            await provider.mutations.before(action, targets, ctx);
            let text: string;
            if (action === "merge")
              text = await provider.mutations.merge(targets, ctx, progress);
            else if (provider.mutations.supersede)
              text = await provider.mutations.supersede(targets, ctx, progress);
            else
              throw new Error(
                "This provider does not support superseding pull requests.",
              );
            provider.mutations.beforePickerRefresh?.(ctx, progress);
            try {
              await provider.listCandidates(ctx.cwd);
            } catch {
              // Refreshing the picker is best effort after a mutation.
            }
            provider.mutations.afterPickerMutation?.(text, ctx);
            return;
          }
          requests = candidates.map((candidate) => candidate.url);
        } else requests = [requestedPullRequest];

        progress(provider.text.preparingEvidence(requests.length));
        ctx.ui.notify(provider.text.preparingEvidence(requests.length), "info");
        const session: ReviewContext = {
          candidates,
          reviews: [],
          generation: 0,
          state: "preparing",
        };
        active = session;
        for (const [index, request] of requests.entries()) {
          progress(`Preparing evidence ${index + 1} of ${requests.length}...`);
          const review = await provider.prepareReview(
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
        if (provider.text.startingResearch)
          progress(provider.text.startingResearch(session.reviews.length));
        const reviews = session.reviews;
        const events = await provider.runtime.discoverEvents(pi);
        if (shuttingDown) {
          await stopReview();
          return;
        }
        subscribeCompletion(events.asyncComplete);
        subscribeProcessTerminal(events.processTerminal);
        const status = await provider.runtime.send(pi, "status", {});
        if (shuttingDown) {
          await stopReview();
          return;
        }
        provider.runtime.requireAsyncCapacity(
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
        if (provider.text.researchStarted)
          progress(provider.text.researchStarted);
        ctx.ui.notify(
          provider.text.startedReview(reviews.map(reviewUrl)),
          "info",
        );
      } catch (error) {
        await stopReview();
        ctx.ui.notify(
          error instanceof Error ? error.message : String(error),
          "error",
        );
      } finally {
        ctx.ui.setStatus(provider.identity.statusKey, undefined);
      }
    },
  });

  pi.registerTool({
    name: provider.tool.name,
    label: provider.tool.label,
    description: provider.tool.description,
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
          content: [{ type: "text", text: provider.text.noActiveReview }],
        };
      if (params.action === "wait")
        return { content: [{ type: "text", text: provider.text.waiting }] };
      if (params.action === "follow-up")
        return { content: [{ type: "text", text: provider.text.followUp }] };
      if (active.state !== "ready")
        return { content: [{ type: "text", text: provider.text.notReady }] };

      const session = active;
      const targets = session.reviews.map((review) => ({
        number: review.number,
        repository: review.repository,
        snapshot: review.snapshot,
        cwd: review.cwd,
      }));
      await provider.mutations.before(params.action, targets, ctx);
      session.state = "mutating";
      const progress = progressFor(ctx);
      ctx.ui.setStatus(
        provider.identity.statusKey,
        provider.text.mutationStatus(params.action, session.reviews[0]),
      );
      try {
        const text =
          params.action === "merge"
            ? await provider.mutations.merge(targets, ctx, progress)
            : await provider.mutations.checkout(session.reviews, ctx, progress);
        try {
          provider.mutations.beforeMutationRefresh?.(ctx, progress);
          session.candidates = (await provider.listCandidates(ctx.cwd)).filter(
            provider.candidateEligibility,
          );
          session.generation += 1;
        } catch {
          session.state = "stale";
        }
        return { content: [{ type: "text", text }] };
      } finally {
        session.generation += 1;
        session.state = "stale";
        ctx.ui.setStatus(provider.identity.statusKey, undefined);
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
        reason: provider.text.blockedCommand,
      };
  });

  pi.on("session_shutdown", async () => {
    shuttingDown = true;
    await stopReview();
  });

  return {
    get active() {
      return active;
    },
    get shuttingDown() {
      return shuttingDown;
    },
    stopReview,
  };
}
