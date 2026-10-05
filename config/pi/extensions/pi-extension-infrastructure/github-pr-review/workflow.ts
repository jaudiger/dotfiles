import { resolve } from "node:path";
import { writeFile } from "node:fs/promises";
import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { runReadOnlyPiAgent, type PiAgentConfig } from "../subagents/agent.js";
import { researcherAgent, repositoryScoutAgent } from "../subagents/roles.js";
import type { PreparedReview } from "./types.js";

type ReviewWorkflowArtifacts = {
  researcherReport: string;
  scoutReport: string;
};

type ReviewWorkflowTaskBuilder = (review: PreparedReview) => string;

type ReviewWorkflowAgents = {
  researcher: PiAgentConfig;
  scout: PiAgentConfig;
};

export type ReviewWorkflowProvider = {
  researcherTask: ReviewWorkflowTaskBuilder;
  scoutTask: ReviewWorkflowTaskBuilder;
  agents?: ReviewWorkflowAgents;
};

export type ReviewWorkflowCompletion = {
  text: string;
  researcherReport: string;
  scoutReport: string;
};

const defaultAgents: ReviewWorkflowAgents = {
  researcher: researcherAgent,
  scout: repositoryScoutAgent,
};

function reviewWorkflowArtifacts(
  review: PreparedReview,
): ReviewWorkflowArtifacts {
  return {
    researcherReport: resolve(review.directory, "researcher-report.md"),
    scoutReport: resolve(review.directory, "scout-report.md"),
  };
}

export async function runReviewWorkflow(
  review: PreparedReview,
  provider: ReviewWorkflowProvider,
  context: ExtensionContext,
  signal: AbortSignal,
): Promise<ReviewWorkflowCompletion> {
  const artifacts = reviewWorkflowArtifacts(review);
  const agents = provider.agents ?? defaultAgents;
  const researcherEvidence = [
    resolve(review.directory, "pr-metadata.json"),
    resolve(review.directory, "pr-description.md"),
    resolve(review.directory, "diff.patch"),
  ];
  const scoutEvidence = [
    resolve(review.directory, "pr-metadata.json"),
    resolve(review.directory, "diff.patch"),
    artifacts.researcherReport,
  ];
  const researcherPrompt = [
    provider.researcherTask(review),
    "",
    "Read these prepared evidence files before investigating:",
    ...researcherEvidence,
    "",
    `Inspect the repository at ${review.cwd}.`,
    "Return only the Markdown report.",
  ].join("\n");
  const researcherReport = await runReadOnlyPiAgent({
    context,
    config: agents.researcher,
    cwd: review.cwd,
    prompt: researcherPrompt,
    evidenceFiles: researcherEvidence,
    includeFetchUrl: true,
    signal,
  });
  await writeFile(artifacts.researcherReport, `${researcherReport}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });

  const scoutPrompt = [
    provider.scoutTask(review),
    "",
    "Read these prepared evidence files before inspecting the repository:",
    ...scoutEvidence,
    "",
    `Inspect the repository at ${review.cwd}.`,
    "Return only the Markdown report.",
  ].join("\n");
  const scoutReport = await runReadOnlyPiAgent({
    context,
    config: agents.scout,
    cwd: review.cwd,
    prompt: scoutPrompt,
    evidenceFiles: scoutEvidence,
    includeFetchUrl: false,
    signal,
  });
  await writeFile(artifacts.scoutReport, `${scoutReport}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });

  return {
    text: researcherReport,
    researcherReport: artifacts.researcherReport,
    scoutReport: artifacts.scoutReport,
  };
}
