import { join } from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { spawnWithCapabilityCeiling } from "../pi-extension-infrastructure/subagents/capability-spawn.js";
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
import {
  completion,
  discoverCompletion,
  processTerminalRunId,
  processTerminalState,
  registerRpcReady,
  requireAsyncCapacity,
  sendRpc,
  spawnedRunId,
} from "../pi-extension-infrastructure/subagents/rpc-v1.js";
import { briocheWorkflowProvider } from "./tasks.js";
import type {
  PreparedReview,
  ReviewCandidate,
  ReviewDetails,
} from "../pi-extension-infrastructure/github-pr-review/types.js";

const rpcSource = "brioche-packages-bot-review";
const reviewLabel = "Brioche package bot";
const researchLabel = "package";

function workflowFailure(
  run: {
    id: string;
    review: PreparedReview;
  },
  result: ReturnType<typeof completion>,
): ReviewMessage {
  return {
    content: `${reviewLabel} review workflow failed for PR ${run.review.number}. Evidence retained at ${run.review.directory}.`,
    details: {
      runId: run.id,
      directory: run.review.directory,
      researcherReport: join(run.review.directory, "researcher-report.md"),
      scoutReport: join(run.review.directory, "scout-report.md"),
      status: result.status,
    },
  };
}

function workflowReady(
  run: {
    id: string;
    review: PreparedReview;
  },
  result: ReturnType<typeof completion>,
): ReviewMessage {
  return {
    content: `${reviewLabel} review evidence is ready for PR ${run.review.number}. Read the researcher and scout reports, the diff, current status checks, merge queue history, and every referenced log from ${run.review.directory}. Treat the researcher report as the canonical ${researchLabel} research. Summarize only recipe and check evidence, resolve any discrepancies against the diff, and classify the recommendation. Tell the user that available next actions are merge, checkout, wait, or follow-up. Wait for explicit selection and use the review execution tool for the selected action. Do not execute any PR mutation based only on the recommendation.`,
    details: {
      pr: run.review.number,
      directory: run.review.directory,
      researcherReport: join(run.review.directory, "researcher-report.md"),
      scoutReport: join(run.review.directory, "scout-report.md"),
      statusChecks: join(run.review.directory, "pr-metadata.json"),
      diff: join(run.review.directory, "diff.patch"),
      workflowRunId: run.id,
      workflowStatus: result.status,
    },
  };
}

export default function registerBriochePackagesBotReview(pi: ExtensionAPI) {
  registerGithubPrReviewController(pi, {
    identity: {
      customType: "brioche-packages-bot-review",
      statusKey: "brioche-package-bot-review",
      capabilitySource: rpcSource,
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
      label: "Brioche package bot review execute",
      description:
        "Execute an explicitly user-selected Brioche package bot review action: merge, checkout, wait, or follow-up.",
    },
    // listCandidates delegates filtering to the Brioche GitHub operations provider.
    candidateEligibility: () => true,
    listCandidates: async () => listCandidates(),
    loadDiff: (candidate: ReviewCandidate) => fetchReviewDiff(candidate),
    loadDetails: (
      candidate: ReviewCandidate,
      _cwd: string,
    ): Promise<ReviewDetails> => fetchReviewDetails(candidate),
    showQueuePosition: true,
    prepareReview: (
      cwd: string,
      sessionId: string,
      requestedPullRequest?: string,
    ) => prepareReview(cwd, sessionId, requestedPullRequest),
    workflow: briocheWorkflowProvider,
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
      afterPickerMutation: (text, ctx) => ctx.ui.notify(text, "info"),
      merge: (targets, ctx, progress) => mergeReview(targets, ctx, progress),
      checkout: (reviews, ctx, progress) =>
        checkoutReview(reviews, ctx, progress),
      supersede: (targets, ctx, progress) =>
        supersedeReview(targets, ctx, progress),
    },
    text: {
      loadingCandidates: "Loading Brioche package update pull requests...",
      noCandidates:
        "No open Brioche package update pull request was found in the current repository.",
      preparingEvidence: (count) =>
        `Preparing Brioche package update evidence for ${count} pull request${count === 1 ? "" : "s"}...`,
      startedReview: (urls) =>
        `Started read-only Brioche package bot review for ${urls.join(", ")}.`,
      preparingRequested: "Preparing the requested pull request...",
      preparingSelected: (count, action) =>
        `Preparing ${count} pull request${count === 1 ? "" : "s"} for ${action}...`,
      noActiveReview: "No active Brioche package bot review.",
      waiting: "Waiting. No external mutation was performed.",
      followUp: "Follow-up selected. No external mutation was performed.",
      notReady:
        "Review evidence is not ready for mutation. Wait until every selected PR has a successful, terminal-observed result.",
      mutationStatus: (action, review) =>
        action === "merge"
          ? `Merging PR ${review?.number ?? "selected pull request"}...`
          : `Checking out PR ${review?.number ?? "selected pull request"}...`,
      blockedCommand:
        "A Brioche package bot review is active. Use brioche_packages_bot_review_execute after explicit user action selection.",
      workflowFailure,
      workflowReady,
      runFailure: (run, error) => ({
        content: `${reviewLabel} review run ${run.id} failed: ${error instanceof Error ? error.message : String(error)}`,
        details: { runId: run.id, directory: run.review.directory },
      }),
    },
    runtime: {
      registerReady: registerRpcReady,
      discoverEvents: (pi) => discoverCompletion(pi, rpcSource),
      send: (pi, method, params) => sendRpc(pi, rpcSource, method, params),
      completion,
      processTerminalRunId,
      processTerminalState,
      runId: spawnedRunId,
      requireAsyncCapacity,
      spawn: async (pi, review, workflowScript, capabilitySource) =>
        spawnWithCapabilityCeiling({
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
          spawn: () =>
            sendRpc(pi, rpcSource, "spawn", {
              cwd: review.cwd,
              workflowScript,
              output: false,
              intercomBridge: { mode: "off" },
              mission: false,
              async: true,
            }),
        }),
    },
  });
}
