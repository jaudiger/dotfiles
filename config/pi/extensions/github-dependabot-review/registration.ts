import { join } from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { createPiExec } from "../pi-extension-infrastructure/pi-exec.js";
import { GITHUB_EXEC_MAX_BUFFER } from "../pi-extension-infrastructure/github-pr-review/github-operations.js";
import { formatUrlLink } from "../pi-extension-infrastructure/links.js";
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
    content: `${reviewLabel} review evidence is ready for PR ${review.number}. Read the researcher and scout reports, the diff, current status checks, merge queue history, and every referenced log from ${review.directory}. Treat the researcher report as the canonical ${researchLabel} research. Summarize only repository and check evidence, resolve any discrepancies against the diff, and classify the recommendation. Offer merge, checkout, wait, or follow-up. Wait for the user's explicit selection, then execute it with the review execution tool. Do not execute any PR mutation based only on the recommendation.`,
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
      label: "Dependabot Review Execute",
      description:
        "Execute an explicitly user-selected Dependabot review action: merge, checkout, wait, or follow-up.",
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
