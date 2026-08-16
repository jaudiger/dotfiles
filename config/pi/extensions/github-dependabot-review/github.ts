import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import type { CommandResult, Json, PreparedReview } from "./types.js";
import { number, object, string } from "./utils.js";
import type { ExtensionContext } from "@earendil-works/pi-coding-agent";

const execFileAsync = promisify(execFile);
const maxBuffer = 40 * 1024 * 1024;

function commandResult(value: unknown): CommandResult {
  const result = object(value);
  const rawCode = result.code;
  const exitCode =
    typeof rawCode === "number"
      ? rawCode
      : typeof rawCode === "string" && /^\d+$/.test(rawCode)
        ? Number(rawCode)
        : 1;
  return {
    output: `${string(result.stdout)}${string(result.stderr)}`,
    exitCode,
  };
}

async function capture(
  command: string,
  args: string[],
  cwd: string,
): Promise<CommandResult> {
  try {
    const result = await execFileAsync(command, args, { cwd, maxBuffer });
    return {
      output: `${string(result.stdout)}${string(result.stderr)}`,
      exitCode: 0,
    };
  } catch (error) {
    return commandResult(error);
  }
}

async function successful(
  command: string,
  args: string[],
  cwd: string,
): Promise<string> {
  const result = await capture(command, args, cwd);
  if (result.exitCode !== 0) {
    const detail = result.output.trim().slice(-2000);
    throw new Error(
      `${command} ${args.join(" ")} failed with exit code ${result.exitCode}${detail ? `: ${detail}` : "."}`,
    );
  }
  return result.output;
}

async function ghJson(args: string[], cwd: string): Promise<Json | Json[]> {
  const output = await successful("gh", args, cwd);
  try {
    const parsed = JSON.parse(output) as unknown;
    if (Array.isArray(parsed)) return parsed as Json[];
    return object(parsed);
  } catch {
    throw new Error(`gh ${args.join(" ")} returned invalid JSON.`);
  }
}

function prNumber(value: unknown): number | undefined {
  return number(value);
}

function dependabotAuthor(value: Json): boolean {
  const author = object(value.author);
  return ["app/dependabot", "dependabot[bot]", "dependabot"].includes(
    string(author.login),
  );
}

function openDependabot(value: Json): boolean {
  return (
    string(value.state).toUpperCase() === "OPEN" && dependabotAuthor(value)
  );
}

export async function prepareReview(
  cwd: string,
  sessionId: string,
): Promise<PreparedReview> {
  const directory = await mkdtemp(join(tmpdir(), "pi-dependabot-review-"));
  try {
    const listed = await ghJson(
      [
        "pr",
        "list",
        "--state",
        "open",
        "--limit",
        "100",
        "--search",
        "review:none author:app/dependabot",
        "--json",
        "number,title,body,author,state,isDraft,url,headRefName,headRefOid,baseRefName,reviewDecision,createdAt,updatedAt",
      ],
      cwd,
    );
    const candidates = Array.isArray(listed) ? listed : [];
    const metadata = candidates.find(
      (candidate) => openDependabot(candidate) && prNumber(candidate.number),
    );
    if (!metadata) {
      throw new Error(
        "No open Dependabot pull request without a review was found in the current repository.",
      );
    }
    const pr = prNumber(metadata.number);
    if (!pr) throw new Error("Dependabot pull request had no valid number.");

    const diff = await capture("gh", ["pr", "diff", String(pr)], cwd);
    if (diff.exitCode !== 0 || !diff.output)
      throw new Error(
        `Could not retrieve the diff for Dependabot PR ${pr} (exit code ${diff.exitCode}).`,
      );
    const checks = await capture("gh", ["pr", "checks", String(pr)], cwd);
    const enriched = {
      pullRequest: metadata,
      statusChecksExitCode: checks.exitCode,
      evidenceDirectory: directory,
    };
    await writeFile(
      join(directory, "pr-metadata.json"),
      `${JSON.stringify(enriched, null, 2)}\n`,
      { mode: 0o600 },
    );
    await writeFile(
      join(directory, "pr-description.md"),
      string(metadata.body),
      {
        mode: 0o600,
      },
    );
    await writeFile(join(directory, "diff.patch"), diff.output, {
      mode: 0o600,
    });
    await writeFile(join(directory, "status-checks.txt"), checks.output, {
      mode: 0o600,
    });
    await writeFile(
      join(directory, "status-checks-exit-code.txt"),
      `${checks.exitCode}\n`,
      { mode: 0o600 },
    );
    return { directory, number: pr, metadata: enriched, cwd, sessionId };
  } catch (error) {
    await rm(directory, { recursive: true, force: true });
    throw error;
  }
}

function statusSuccessful(output: string): boolean {
  try {
    const parsed = JSON.parse(output) as unknown;
    const checks = Array.isArray(parsed) ? parsed : [];
    return (
      checks.length > 0 &&
      checks.every((check) => {
        const item = object(check);
        return (
          string(item.bucket).toLowerCase() === "pass" ||
          string(item.state).toUpperCase() === "SUCCESS"
        );
      })
    );
  } catch {
    return false;
  }
}

async function refreshedMetadata(
  review: PreparedReview,
  requireMergeable = false,
): Promise<Json> {
  const parsed = await ghJson(
    [
      "pr",
      "view",
      String(review.number),
      "--json",
      "number,author,state,isDraft,title,url,headRefName,headRefOid,baseRefName,reviewDecision,mergeable,mergeStateStatus",
    ],
    review.cwd,
  );
  const metadata = Array.isArray(parsed) ? object(parsed[0]) : parsed;
  if (!openDependabot(metadata))
    throw new Error(
      "The pull request is no longer open and Dependabot-authored.",
    );
  if (metadata.isDraft === true)
    throw new Error("The pull request is still a draft.");
  if (requireMergeable) {
    const mergeable = string(metadata.mergeable).toUpperCase();
    if (mergeable === "CONFLICTING") {
      const mergeState = string(metadata.mergeStateStatus).toUpperCase();
      const stateDetail = mergeState ? `; merge state ${mergeState}` : "";
      throw new Error(
        `The pull request has merge conflicts (${mergeable}${stateDetail}).`,
      );
    }
    const mergeState = string(metadata.mergeStateStatus).toUpperCase();
    const reviewDecision = string(metadata.reviewDecision).toUpperCase();
    if (mergeState === "BLOCKED" && reviewDecision !== "REVIEW_REQUIRED")
      throw new Error(
        `The pull request is blocked (${mergeState}; review decision ${reviewDecision || "UNKNOWN"}).`,
      );
  }
  return metadata;
}

function reviewedHead(review: PreparedReview): string {
  return string(object(review.metadata.pullRequest).headRefOid);
}

function assertReviewedHead(review: PreparedReview, metadata: Json): string {
  const expected = reviewedHead(review);
  const actual = string(metadata.headRefOid);
  if (!expected || !actual)
    throw new Error(
      "The reviewed pull request has no stable head commit; no mutation was performed.",
    );
  if (expected !== actual)
    throw new Error(
      "The pull request head changed since evidence was collected; no mutation was performed.",
    );
  return actual;
}

async function requiredChecks(review: PreparedReview): Promise<string> {
  return successful(
    "gh",
    [
      "pr",
      "checks",
      String(review.number),
      "--required",
      "--json",
      "name,state,bucket,link",
    ],
    review.cwd,
  );
}

export async function mergeReview(
  review: PreparedReview,
  ctx: ExtensionContext,
): Promise<string> {
  const initialMetadata = await refreshedMetadata(review, true);
  const initialHead = assertReviewedHead(review, initialMetadata);
  const initialChecks = await requiredChecks(review);
  if (!statusSuccessful(initialChecks))
    throw new Error(
      "Required checks are not all successful; no review or merge was performed.",
    );
  if (
    !ctx.hasUI ||
    !(await ctx.ui.confirm(
      "Merge Dependabot pull request?",
      `Approve and squash-merge PR ${review.number}?`,
    ))
  )
    return "Merge cancelled. No pull request mutation was performed.";
  const metadata = await refreshedMetadata(review, true);
  const currentHead = assertReviewedHead(review, metadata);
  if (initialHead !== currentHead)
    throw new Error(
      "The pull request head changed while waiting for confirmation; no mutation was performed.",
    );
  const checks = await requiredChecks(review);
  if (!statusSuccessful(checks))
    throw new Error(
      "Required checks changed before merge; no review or merge was performed.",
    );
  await successful(
    "gh",
    [
      "pr",
      "review",
      String(review.number),
      "--approve",
      "--body",
      "Looks good to me 🚀",
    ],
    review.cwd,
  );
  try {
    await successful(
      "gh",
      [
        "pr",
        "merge",
        String(review.number),
        "--squash",
        "--delete-branch",
        "--match-head-commit",
        currentHead,
      ],
      review.cwd,
    );
  } catch (error) {
    throw new Error(
      `PR ${review.number} was approved, but the merge failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  return `Approved and squash-merged PR ${string(metadata.url)}.`;
}

export async function checkoutReview(
  review: PreparedReview,
  ctx: ExtensionContext,
): Promise<string> {
  const initialMetadata = await refreshedMetadata(review);
  assertReviewedHead(review, initialMetadata);
  const status = await successful("git", ["status", "--porcelain"], review.cwd);
  if (status.trim())
    throw new Error("Checkout requires a clean current worktree.");
  if (
    !ctx.hasUI ||
    !(await ctx.ui.confirm(
      "Checkout Dependabot pull request?",
      `Checkout PR ${review.number}?`,
    ))
  )
    return "Checkout cancelled. No repository mutation was performed.";
  const metadata = await refreshedMetadata(review);
  const currentHead = assertReviewedHead(review, metadata);
  const finalStatus = await successful(
    "git",
    ["status", "--porcelain"],
    review.cwd,
  );
  if (finalStatus.trim())
    throw new Error("The worktree became dirty; checkout was not performed.");
  const remotes = (await successful("git", ["remote"], review.cwd))
    .split(/\s+/)
    .filter(Boolean);
  const remote = remotes[0];
  if (!remote) throw new Error("No Git remote is configured for checkout.");
  await successful(
    "git",
    ["fetch", "--no-tags", remote, `pull/${review.number}/head`],
    review.cwd,
  );
  const fetchedHead = (
    await successful("git", ["rev-parse", "FETCH_HEAD"], review.cwd)
  ).trim();
  if (fetchedHead !== currentHead)
    throw new Error(
      "The pull request head changed while fetching; checkout was not performed.",
    );
  await successful("git", ["checkout", "--detach", currentHead], review.cwd);
  return `Checked out reviewed Dependabot PR ${review.number} at ${currentHead}.`;
}
