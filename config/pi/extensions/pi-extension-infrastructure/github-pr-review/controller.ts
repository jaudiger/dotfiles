import { rm } from "node:fs/promises";
import {
  isToolCallEventType,
  type ExtensionAPI,
  type ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { pickReview } from "./picker.js";
import {
  createAsyncRunSupervisor,
  type AsyncRun,
  type AsyncRunSupervisor,
} from "../subagents/async-run-supervisor.js";
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

type ReviewRunState = {
  successful?: boolean;
  reported: boolean;
};

export type ReviewRun = AsyncRun<PreparedReview, ReviewRunState>;

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

  // Keep prepared evidence owned until its directory is removed, including
  // reviews that never reach supervisor.start.
  const ownedDirectories = new Set<string>();
  const cleanupPromises = new Map<string, Promise<boolean>>();
  let active: ReviewContext | undefined;
  let supervisor: AsyncRunSupervisor<PreparedReview, ReviewRunState>;

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

  const cleanupDirectory = (directory: string): Promise<boolean> => {
    const existing = cleanupPromises.get(directory);
    if (existing) return existing;
    const operation = (async () => {
      try {
        await rm(directory, { recursive: true, force: true });
        ownedDirectories.delete(directory);
        return true;
      } catch {
        return false;
      } finally {
        cleanupPromises.delete(directory);
      }
    })();
    cleanupPromises.set(directory, operation);
    return operation;
  };

  const cleanupReview = (run: ReviewRun): Promise<boolean> =>
    cleanupDirectory(run.owner.directory);

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

  supervisor = createAsyncRunSupervisor({
    pi,
    discoverEvents: () => provider.runtime.discoverEvents(pi),
    runId: provider.runtime.runId,
    completionRunId: (value) => provider.runtime.completion(value).runId,
    processTerminalRunId: provider.runtime.processTerminalRunId,
    processTerminalState: provider.runtime.processTerminalState,
    stop: (runId) => provider.runtime.send(pi, "stop", { runId }),
    createState: () => ({ reported: false }),
    shouldStop: (review) => !isActiveReview(review),
    // Keep completed runs so readiness can account for every selected review
    // until stopReview performs the owner cleanup.
    retainCompletedRuns: true,
    cleanup: cleanupReview,
    cleanupUnstarted,
    onStopFailure: async (run, error) => {
      report(provider.text.runFailure(run, error));
    },
    onCompletion: async (run, payload) => {
      if (!isActiveReview(run.owner)) {
        // Let the supervisor coordinate cleanup with the stop outcome. A
        // terminal event can arrive while stopReview is still awaiting RPC.
        run.stopping = true;
        return;
      }
      const result = provider.runtime.completion(payload);
      const failed =
        result.success === false ||
        !["complete", "completed", "success", "succeeded"].includes(
          result.status.toLowerCase(),
        );
      run.state.successful = !failed;
      run.state.reported = true;
      if (!failed) {
        const ready =
          active?.reviews.every((review) =>
            [...supervisor.runs.values()].some(
              (candidate) =>
                candidate.owner.directory === review.directory &&
                candidate.state.successful === true &&
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
    },
    onCompletionError: async (run, error) => {
      run.state.successful = false;
      run.state.reported = true;
      report(provider.text.runFailure(run, error));
    },
  });

  const stopReview = async (): Promise<void> => {
    active = undefined;
    await supervisor.stopAll();
  };

  const spawnWorkflow = async (review: PreparedReview): Promise<void> => {
    if (supervisor.shuttingDown || !isActiveReview(review)) return;
    await supervisor.start(review, async () => {
      if (supervisor.shuttingDown || !isActiveReview(review)) return undefined;
      return provider.runtime.spawn(
        pi,
        review,
        workflowTask(review, provider.workflow),
        provider.identity.capabilitySource,
      );
    });
  };

  const progressFor = (ctx: ExtensionContext) => (message: string) =>
    ctx.ui.setStatus(provider.identity.statusKey, message);

  pi.registerCommand(provider.command.name, {
    description: provider.command.description,
    handler: async (args, ctx) => {
      const requestedPullRequest = args.trim() || undefined;
      if (supervisor.shuttingDown) return;
      await stopReview();
      if (supervisor.shuttingDown) return;
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
          if (supervisor.shuttingDown) return;
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
            if (supervisor.shuttingDown) return;
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
          ownedDirectories.add(review.directory);
          if (supervisor.shuttingDown) {
            await cleanupDirectory(review.directory);
            await stopReview();
            return;
          }
          session.reviews = [...session.reviews, review];
          session.generation += 1;
        }
        if (supervisor.shuttingDown) {
          await stopReview();
          return;
        }
        session.state = "researching";
        if (provider.text.startingResearch)
          progress(provider.text.startingResearch(session.reviews.length));
        const reviews = session.reviews;
        await supervisor.discoverEvents();
        if (supervisor.shuttingDown) {
          await stopReview();
          return;
        }
        const status = await provider.runtime.send(pi, "status", {});
        if (supervisor.shuttingDown) {
          await stopReview();
          return;
        }
        provider.runtime.requireAsyncCapacity(
          status,
          reviews.length,
          `the selected ${reviews.length} pull request${reviews.length === 1 ? "" : "s"}`,
        );
        const results = await Promise.allSettled(
          reviews.map((review) => spawnWorkflow(review)),
        );
        const failure = results.find((result) => result.status === "rejected");
        if (failure?.status === "rejected") throw failure.reason;
        if (supervisor.shuttingDown) return;
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
    await supervisor.shutdown();
  });

  return {
    get active() {
      return active;
    },
    get shuttingDown() {
      return supervisor.shuttingDown;
    },
    stopReview,
  };
}
