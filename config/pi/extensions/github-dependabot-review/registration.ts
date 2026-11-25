import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { createPiExec } from "../pi-extension-infrastructure/pi-exec.js";
import { GITHUB_EXEC_MAX_BUFFER } from "../pi-extension-infrastructure/github-pr-review/github-operations.js";
import { formatUrlLink } from "../pi-extension-infrastructure/links.js";
import {
  createReviewReadyMessage,
  registerGithubPrReviewController,
} from "../pi-extension-infrastructure/github-pr-review/controller.js";
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
import { dependabotWorkflowProvider } from "./tasks.js";
import type {
  PreparedReview,
  ReviewCandidate,
  ReviewDetails,
} from "../pi-extension-infrastructure/github-pr-review/types.js";

const reviewLabel = "Dependabot";
const researchLabel = "dependency";

export default function registerDependabotReview(pi: ExtensionAPI) {
  const exec = createPiExec(pi, GITHUB_EXEC_MAX_BUFFER);
  registerGithubPrReviewController(pi, {
    identity: {
      customType: "github-dependabot-review",
      statusKey: "github-dependabot-review",
    },
    labels: {
      review: reviewLabel,
      research: researchLabel,
    },
    command: {
      name: "github:dependabot-review",
      description:
        "Select an open Dependabot pull request or use a specified PR URL",
    },
    tool: {
      name: "github_dependabot_review_execute",
      followUpName: "github_dependabot_review_follow_up",
      label: "Dependabot Review Execute",
      description:
        "Execute an explicitly user-selected Dependabot review action: merge or checkout.",
    },
    // listCandidates delegates filtering to the Dependabot GitHub provider.
    candidateEligibility: () => true,
    listCandidates: (cwd) => listCandidates(exec, cwd),
    showRepositoryDescription: true,
    loadDiff: (candidate, cwd) => fetchReviewDiff(exec, candidate, cwd),
    loadDetails: (
      candidate: ReviewCandidate,
      cwd: string,
    ): Promise<ReviewDetails> => fetchReviewDetails(exec, candidate, cwd),
    showQueuePosition: false,
    prepareReview: (
      cwd: string,
      sessionId: string,
      requestedPullRequest?: string,
    ) => prepareReview(exec, cwd, sessionId, requestedPullRequest),
    workflow: dependabotWorkflowProvider,
    prepareMutationTarget: (candidate, cwd) =>
      prepareMutationTarget(exec, candidate, cwd),
    mutations: {
      // Shared GitHub operations perform the provider-specific mutation checks.
      before: async () => undefined,
      beforePickerPreparation: (_action, count, ctx) => {
        ctx.ui.notify(
          `Loading fresh pull request metadata for ${count} selected pull request${count === 1 ? "" : "s"}...`,
          "info",
        );
      },
      pickerPreparationProgress: (action, candidate, index, count, progress) =>
        progress(
          `Preparing ${action} pull request ${index + 1} of ${count}: PR ${candidate.number}...`,
        ),
      afterPickerMutation: (text, ctx) => ctx.ui.notify(text, "info"),
      merge: (targets, ctx, progress) =>
        mergeReview(exec, targets, ctx, progress),
      checkout: (reviews, ctx, progress) =>
        checkoutReview(exec, reviews, ctx, progress),
      supersede: (targets, ctx, progress) =>
        supersedeReview(exec, targets, ctx, progress),
    },
    text: {
      loadingCandidates: "Loading Dependabot pull requests...",
      noCandidates:
        "No open Dependabot pull request was found across the searched repositories.",
      preparingEvidence: (count) =>
        `Preparing Dependabot evidence for ${count} pull request${count === 1 ? "" : "s"}...`,
      startingResearch: (count) =>
        `Starting read-only research for ${count} pull request${count === 1 ? "" : "s"}...`,
      researchStarted:
        "Read-only research started; waiting for researcher results...",
      startedReview: (urls) =>
        `Started read-only Dependabot review for ${urls.map((url) => formatUrlLink(url)).join(", ")}.`,
      preparingRequested: "Preparing the requested pull request...",
      preparingSelected: (count, action) =>
        `Preparing ${count} pull request${count === 1 ? "" : "s"} for ${action}...`,
      noActiveReview: "No active Dependabot review.",
      notReady:
        "Review evidence is not ready. Wait until successful researcher and scout reports are available for every selected PR.",
      mutationStatus: (action, review) =>
        action === "merge"
          ? `Merging PR ${review?.number ?? "selected pull request"}...`
          : `Checking out PR ${review?.number ?? "selected pull request"}...`,
      workflowReady: (review, result) =>
        createReviewReadyMessage(
          "Dependabot",
          "dependency and check",
          review,
          result,
        ),
    },
  });
}
