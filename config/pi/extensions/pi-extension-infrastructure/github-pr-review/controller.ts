import { rm } from "node:fs/promises";
import {
  isToolCallEventType,
  type ExtensionAPI,
  type ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { pickReview } from "./picker.js";
import {
  createAsyncJobs,
  type AsyncCompletion,
  type AsyncJob,
} from "../subagents/async.js";
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
    workflowReady: (
      review: PreparedReview,
      result: AsyncCompletion,
    ) => ReviewMessage;
    /** Validate the workflow handoff before evidence is considered ready. */
    validateWorkflowResult?: (
      review: PreparedReview,
      result: AsyncCompletion,
    ) => void;
  };
};

type ReviewSessionState =
  "preparing" | "researching" | "ready" | "mutating" | "stale";

type ReviewContext = {
  candidates: ReviewCandidate[];
  reviews: PreparedReview[];
  generation: number;
  state: ReviewSessionState;
  readyDirectories: Set<string>;
};

export type ReviewMessage = {
  content: string;
  details?: Json;
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

type ReviewOwner = {
  review: PreparedReview;
  generation: number;
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
  const source = provider.identity.capabilitySource;
  let active: ReviewContext | undefined;
  let reviewGeneration = 0;
  let shuttingDown = false;
  const asyncJobs = createAsyncJobs(pi, {
    source,
    customType: provider.identity.customType,
  });

  const isActiveReview = (review: PreparedReview): boolean =>
    active?.reviews.some((item) => item.directory === review.directory) ??
    false;

  const stopReview = async (): Promise<void> => {
    active = undefined;
    await asyncJobs.stopAll();
  };

  const removeReviewEvidence = async (directory: string): Promise<boolean> => {
    try {
      await rm(directory, { recursive: true, force: true });
      return true;
    } catch {
      return false;
    }
  };

  const taskFor = (owner: ReviewOwner): AsyncJob => ({
    label: `${provider.labels.review} review for PR ${owner.review.number}`,
    launch: {
      cwd: owner.review.cwd,
      workflowScript: workflowTask(owner.review, provider.workflow),
      capabilities: {
        sessionId: owner.review.sessionId,
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
    },
    evidence: {
      path: owner.review.directory,
      remove: async () => {
        if (!(await removeReviewEvidence(owner.review.directory)))
          throw new Error("Could not remove review evidence directory.");
      },
    },
    complete: async (result: AsyncCompletion) => {
      const current = active;
      if (
        !current ||
        current.generation !== owner.generation ||
        !isActiveReview(owner.review)
      )
        return {
          content: `${provider.labels.review} review became stale.`,
          retainEvidence: true,
        };
      provider.text.validateWorkflowResult?.(owner.review, result);
      const stillCurrent = active;
      if (
        !stillCurrent ||
        stillCurrent.generation !== owner.generation ||
        !isActiveReview(owner.review)
      )
        return {
          content: `${provider.labels.review} review became stale.`,
          retainEvidence: true,
        };
      stillCurrent.readyDirectories.add(owner.review.directory);
      if (
        stillCurrent.reviews.every((review) =>
          stillCurrent.readyDirectories.has(review.directory),
        )
      )
        stillCurrent.state = "ready";
      return {
        ...provider.text.workflowReady(owner.review, result),
        retainEvidence: true,
      };
    },
  });

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
          generation: ++reviewGeneration,
          state: "preparing",
          readyDirectories: new Set(),
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
          if (active !== session) {
            await rm(review.directory, { recursive: true, force: true });
            return;
          }
          session.reviews = [...session.reviews, review];
        }
        if (shuttingDown) {
          await stopReview();
          return;
        }
        session.state = "researching";
        if (provider.text.startingResearch)
          progress(provider.text.startingResearch(session.reviews.length));
        const reviews = session.reviews;
        if (provider.text.researchStarted)
          progress(provider.text.researchStarted);
        const reviewJobs = reviews.map((review) =>
          taskFor({ review, generation: session.generation }),
        );
        void asyncJobs.start(...reviewJobs);
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
    await asyncJobs.shutdown();
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
