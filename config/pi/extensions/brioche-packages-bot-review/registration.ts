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
import { briocheWorkflowProvider } from "./tasks.js";
import type {
  PreparedReview,
  ReviewCandidate,
  ReviewDetails,
} from "../pi-extension-infrastructure/github-pr-review/types.js";

const reviewLabel = "Brioche package bot";
const researchLabel = "package";

export default function registerBriochePackagesBotReview(pi: ExtensionAPI) {
  const exec = createPiExec(pi, GITHUB_EXEC_MAX_BUFFER);
  registerGithubPrReviewController(pi, {
    identity: {
      customType: "brioche-packages-bot-review",
      statusKey: "brioche-package-bot-review",
    },
    labels: {
      review: reviewLabel,
      research: researchLabel,
    },
    command: {
      name: "brioche-packages:bot-review",
      description:
        "Select an open Brioche package update pull request or use a specified PR URL",
    },
    tool: {
      name: "brioche_packages_bot_review_execute",
      followUpName: "brioche_packages_bot_review_follow_up",
      label: "Brioche package bot review execute",
      description:
        "Execute an explicitly user-selected Brioche package bot review action: merge or checkout.",
    },
    // listCandidates delegates filtering to the Brioche GitHub operations provider.
    candidateEligibility: () => true,
    listCandidates: (cwd) => listCandidates(exec, cwd),
    loadDiff: (candidate: ReviewCandidate, cwd: string) =>
      fetchReviewDiff(exec, candidate, cwd),
    loadDetails: (
      candidate: ReviewCandidate,
      cwd: string,
    ): Promise<ReviewDetails> => fetchReviewDetails(exec, candidate, cwd),
    showQueuePosition: true,
    prepareReview: (
      cwd: string,
      sessionId: string,
      requestedPullRequest?: string,
    ) => prepareReview(exec, cwd, sessionId, requestedPullRequest),
    workflow: briocheWorkflowProvider,
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
      loadingCandidates: "Loading Brioche package update pull requests...",
      noCandidates:
        "No open Brioche package update pull request was found in the current repository.",
      preparingEvidence: (count) =>
        `Preparing Brioche package update evidence for ${count} pull request${count === 1 ? "" : "s"}...`,
      startedReview: (urls) =>
        `Started read-only Brioche package bot review for ${urls.map((url) => formatUrlLink(url)).join(", ")}.`,
      preparingRequested: "Preparing the requested pull request...",
      preparingSelected: (count, action) =>
        `Preparing ${count} pull request${count === 1 ? "" : "s"} for ${action}...`,
      noActiveReview: "No active Brioche package bot review.",
      notReady:
        "Review evidence is not ready. Wait until successful researcher and scout reports are available for every selected PR.",
      mutationStatus: (action, review) =>
        action === "merge"
          ? `Merging PR ${review?.number ?? "selected pull request"}...`
          : `Checking out PR ${review?.number ?? "selected pull request"}...`,
      workflowReady: (review, result) =>
        createReviewReadyMessage(
          "Brioche package bot",
          "recipe and check",
          review,
          result,
        ),
    },
  });
}
