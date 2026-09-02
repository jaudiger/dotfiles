import { join } from "node:path";
import type { Json, PreparedReview } from "./types.js";

/** Evidence files produced by the staged pull-request review workflow. */
type ReviewWorkflowArtifacts = {
  researcherReport: string;
  scoutReport: string;
};

type ReviewWorkflowTaskBuilder = (review: PreparedReview) => string;

/** Provider-specific metadata returned with the workflow handoff. */
type ReviewWorkflowMetadataBuilder = (
  review: PreparedReview,
  artifacts: ReviewWorkflowArtifacts,
) => Json;

/** Provider hooks used by the generic research and repository-scout stages. */
export type ReviewWorkflowProvider = {
  researcherTask: ReviewWorkflowTaskBuilder;
  scoutTask: ReviewWorkflowTaskBuilder;
  reviewMetadata: ReviewWorkflowMetadataBuilder;
};

function reviewWorkflowArtifacts(
  review: PreparedReview,
): ReviewWorkflowArtifacts {
  return {
    researcherReport: join(review.directory, "researcher-report.md"),
    scoutReport: join(review.directory, "scout-report.md"),
  };
}

/**
 * Build the read-only researcher/scout workflow script for one prepared PR.
 *
 * Providers own the task prompts and metadata. This function owns the stage
 * ordering, the files each stage may read, and the artifact handoff returned
 * to the completion handler.
 */
export function workflowTask(
  review: PreparedReview,
  provider: ReviewWorkflowProvider,
): string {
  const artifacts = reviewWorkflowArtifacts(review);
  const researcherReads = [
    join(review.directory, "pr-metadata.json"),
    join(review.directory, "pr-description.md"),
    join(review.directory, "diff.patch"),
    review.cwd,
  ];
  const scoutReads = [
    join(review.directory, "pr-metadata.json"),
    join(review.directory, "diff.patch"),
    artifacts.researcherReport,
    review.cwd,
  ];
  const handoff = {
    ...provider.reviewMetadata(review, artifacts),
    status: "ready",
    directory: review.directory,
    researcherReport: artifacts.researcherReport,
    scoutReport: artifacts.scoutReport,
  };

  return [
    'await runs.run("researcher", {',
    '  agent: "researcher",',
    `  task: ${JSON.stringify(provider.researcherTask(review))},`,
    '  context: "fresh",',
    `  reads: ${JSON.stringify(researcherReads)},`,
    `  output: ${JSON.stringify(artifacts.researcherReport)},`,
    '  outputMode: "file-only",',
    "});",
    'await runs.run("scout", {',
    '  agent: "scout",',
    `  task: ${JSON.stringify(provider.scoutTask(review))},`,
    '  context: "fresh",',
    `  reads: ${JSON.stringify(scoutReads)},`,
    `  output: ${JSON.stringify(artifacts.scoutReport)},`,
    '  outputMode: "file-only",',
    "});",
    `return ${JSON.stringify(handoff)};`,
  ].join("\n");
}
