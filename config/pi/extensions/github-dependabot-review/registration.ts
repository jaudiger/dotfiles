import { join } from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import {
  registerGithubPrReviewController,
  type ReviewMessage,
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
import type { ReviewWorkflowCompletion } from "../pi-extension-infrastructure/github-pr-review/workflow.js";
import { dependabotWorkflowProvider } from "./tasks.js";
import type {
  PreparedReview,
  ReviewCandidate,
  ReviewDetails,
} from "../pi-extension-infrastructure/github-pr-review/types.js";

const reviewLabel = "Dependabot";
const researchLabel = "dependency";

function workflowReady(
  review: PreparedReview,
  result: ReviewWorkflowCompletion,
): ReviewMessage {
  return {
    content: `${reviewLabel} review evidence is ready for PR ${review.number}. Read the researcher and scout reports, the diff, current status checks, merge queue history, and every referenced log from ${review.directory}. Treat the researcher report as the canonical ${researchLabel} research. Summarize only repository and check evidence, resolve any discrepancies against the diff, and classify the recommendation. Tell the user that available next actions are merge, checkout, wait, or follow-up. Wait for explicit selection and use the review execution tool for the selected action. Do not execute any PR mutation based only on the recommendation.`,
    details: {
      pr: review.number,
      directory: review.directory,
      researcherReport: result.researcherReport,
      scoutReport: result.scoutReport,
      statusChecks: join(review.directory, "pr-metadata.json"),
      diff: join(review.directory, "diff.patch"),
      ...(result.text ? { researcherOutput: result.text } : {}),
    },
  };
}

export default function registerDependabotReview(pi: ExtensionAPI) {
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
      label: "Dependabot Review Execute",
      description:
        "Execute an explicitly user-selected Dependabot review action: merge, checkout, wait, or follow-up.",
    },
    // listCandidates delegates filtering to the Dependabot GitHub provider.
    candidateEligibility: () => true,
    listCandidates: (cwd) => listCandidates(cwd),
    showRepositoryDescription: true,
    loadDiff: (candidate, _cwd) => fetchReviewDiff(candidate),
    loadDetails: (
      candidate: ReviewCandidate,
      _cwd: string,
    ): Promise<ReviewDetails> => fetchReviewDetails(candidate),
    showQueuePosition: false,
    prepareReview: (
      cwd: string,
      sessionId: string,
      requestedPullRequest?: string,
    ) => prepareReview(cwd, sessionId, requestedPullRequest),
    workflow: dependabotWorkflowProvider,
    prepareMutationTarget: (candidate, cwd) =>
      prepareMutationTarget(candidate, cwd),
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
      beforePickerRefresh: (_ctx, progress) =>
        progress("Refreshing remaining pull requests..."),
      beforeMutationRefresh: (_ctx, progress) =>
        progress("Refreshing remaining pull requests..."),
      afterPickerMutation: (text, ctx) => ctx.ui.notify(text, "info"),
      merge: (targets, ctx, progress) => mergeReview(targets, ctx, progress),
      checkout: (reviews, ctx, progress) =>
        checkoutReview(reviews, ctx, progress),
      supersede: (targets, ctx, progress) =>
        supersedeReview(targets, ctx, progress),
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
        `Started read-only Dependabot review for ${urls.join(", ")}.`,
      preparingRequested: "Preparing the requested pull request...",
      preparingSelected: (count, action) =>
        `Preparing ${count} pull request${count === 1 ? "" : "s"} for ${action}...`,
      noActiveReview: "No active Dependabot review.",
      waiting: "Waiting. No external mutation was performed.",
      followUp: "Follow-up selected. No external mutation was performed.",
      notReady:
        "Review evidence is not ready for mutation. Wait until successful researcher and scout reports are available for every selected PR.",
      mutationStatus: (action, review) =>
        action === "merge"
          ? `Merging PR ${review?.number ?? "selected pull request"}...`
          : `Checking out PR ${review?.number ?? "selected pull request"}...`,
      blockedCommand:
        "A Dependabot review is active. Use github_dependabot_review_execute after explicit user action selection.",
      workflowReady,
    },
  });
}
