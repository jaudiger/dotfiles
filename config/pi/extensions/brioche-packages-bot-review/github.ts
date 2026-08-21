import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { ReviewCandidate, ReviewDetails } from "./review-picker.js";
import type { CommandResult, Json, PreparedReview } from "./types.js";
import { number, object, string } from "./utils.js";

const execFileAsync = promisify(execFile);
const maxBuffer = 40 * 1024 * 1024;
const repository = "brioche-dev/brioche-packages";

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

function githubRepositoryFromRemote(value: string): string | undefined {
  const normalized = value.trim().replace(/\.git$/, "");
  return normalized.match(/github\.com[/:]([^/\s]+\/[^/\s]+)$/)?.[1];
}

async function remoteForRepository(
  cwd: string,
  expectedRepository: string,
): Promise<string> {
  const remotes = (await successful("git", ["remote"], cwd))
    .split(/\s+/)
    .filter(Boolean);
  for (const remote of remotes) {
    const urls = await successful(
      "git",
      ["remote", "get-url", "--all", remote],
      cwd,
    );
    if (
      urls
        .split("\n")
        .some((url) => githubRepositoryFromRemote(url) === expectedRepository)
    )
      return remote;
  }
  throw new Error(
    `No Git remote for ${expectedRepository} is configured in the current checkout.`,
  );
}

function prNumber(value: unknown): number | undefined {
  return number(value);
}

const packageUpdateAuthorLogins = [
  "package-update-bot[bot]",
  "package-update-bot",
  "app/package-update-bot",
];
const pullRequestFields =
  "number,title,body,author,state,isDraft,url,headRefName,headRefOid,baseRefName,reviewDecision,createdAt,updatedAt";
const detailFields =
  "number,title,author,state,isDraft,url,reviewDecision,mergeStateStatus,mergeable,statusCheckRollup";

function packageUpdateAuthor(value: Json): boolean {
  const author = object(value.author);
  return packageUpdateAuthorLogins.includes(string(author.login));
}

async function ensureRepository(cwd: string): Promise<void> {
  const metadata = await ghJson(
    ["repo", "view", "--json", "nameWithOwner"],
    cwd,
  );
  const nameWithOwner = string(object(metadata).nameWithOwner);
  if (nameWithOwner !== repository)
    throw new Error(
      `This command must run in a checkout of ${repository}, not ${nameWithOwner || "an unknown repository"}.`,
    );
}

function openPackageUpdate(value: Json): boolean {
  return (
    string(value.state).toUpperCase() === "OPEN" && packageUpdateAuthor(value)
  );
}

function liveUpdatePullRequest(value: Json): boolean {
  return (
    openPackageUpdate(value) && /\blive update\b/i.test(string(value.title))
  );
}

function changedPaths(diff: string): string[] {
  return diff.split("\n").flatMap((line) => {
    const match = line.match(/^diff --git a\/(.+) b\/(.+)$/);
    return match ? [match[2]] : [];
  });
}

function isLiveUpdateDiff(diff: string): boolean {
  const paths = changedPaths(diff);
  const recipeFiles = paths.flatMap((path) => {
    const match = path.match(/^packages\/(.+)\/(project\.bri|brioche\.lock)$/);
    return match ? [{ recipe: match[1], file: match[2] }] : [];
  });
  const recipes = new Set(recipeFiles.map(({ recipe }) => recipe));
  const files = new Set(recipeFiles.map(({ file }) => file));
  return (
    paths.length > 0 &&
    recipeFiles.length === paths.length &&
    recipes.size === 1 &&
    files.has("project.bri") &&
    files.has("brioche.lock")
  );
}

export async function listCandidates(cwd: string): Promise<ReviewCandidate[]> {
  await ensureRepository(cwd);
  const listed = await ghJson(
    [
      "search",
      "prs",
      "--state",
      "open",
      "--review",
      "none",
      "--app",
      "package-update-bot",
      "--repo",
      repository,
      "--limit",
      "1000",
      "--json",
      "number,title,author,state,isDraft,url",
    ],
    cwd,
  );
  const candidates = Array.isArray(listed) ? listed : [];
  return candidates.flatMap((item) => {
    if (!liveUpdatePullRequest(item)) return [];
    const pr = prNumber(item.number);
    const url = string(item.url);
    if (!pr || !url) return [];
    return [
      {
        number: pr,
        title: string(item.title) || `Pull request #${pr}`,
        url,
        author: string(object(item.author).login),
        repository,
      },
    ];
  });
}

export async function fetchReviewDiff(
  candidate: ReviewCandidate,
  cwd: string,
): Promise<string> {
  const diff = await capture(
    "gh",
    ["pr", "diff", String(candidate.number), "--repo", repository],
    cwd,
  );
  if (diff.exitCode !== 0 || !diff.output) {
    const detail = diff.output.trim().slice(-2000);
    throw new Error(
      `Could not retrieve the diff for Brioche package update PR ${candidate.number} (exit code ${diff.exitCode})${detail ? `: ${detail}` : "."}`,
    );
  }
  if (!isLiveUpdateDiff(diff.output))
    throw new Error(
      `PR ${candidate.number} is not a single Brioche package live update of project.bri and brioche.lock.`,
    );
  return diff.output;
}

type QueueDetails = {
  state?: string;
  position?: number;
  removalReason?: string;
  workflowUrl?: string;
};

function formatDetailLabel(value: string): string {
  return value
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function checkSummary(value: unknown): string {
  const checks = Array.isArray(value) ? value : [];
  if (checks.length === 0) return "no checks";
  const states = checks.map((check) => {
    const item = object(check);
    return string(item.conclusion || item.status || item.state).toUpperCase();
  });
  if (
    states.some((state) =>
      [
        "FAILURE",
        "ERROR",
        "FAIL",
        "CANCELLED",
        "ACTION_REQUIRED",
        "TIMED_OUT",
        "STALE",
      ].includes(state),
    )
  )
    return "failure";
  if (
    states.some((state) =>
      [
        "PENDING",
        "EXPECTED",
        "QUEUED",
        "IN_PROGRESS",
        "WAITING",
        "REQUESTED",
        "COMPLETED",
        "",
      ].includes(state),
    )
  )
    return "pending";
  return "success";
}

function reviewDecision(value: unknown): string {
  const decision = string(value).toUpperCase();
  if (decision === "APPROVED") return "approved";
  if (decision === "CHANGES_REQUESTED") return "changes requested";
  if (decision === "REVIEW_REQUIRED") return "review required";
  return "not requested";
}

async function fetchQueueDetails(
  pullRequestNumber: number,
  cwd: string,
): Promise<QueueDetails> {
  const query = `query($owner:String!,$name:String!,$number:Int!) {
    repository(owner:$owner, name:$name) {
      pullRequest(number:$number) {
        mergeQueueEntry { state position }
        timelineItems(last:1, itemTypes:[REMOVED_FROM_MERGE_QUEUE_EVENT]) {
          nodes {
            ... on RemovedFromMergeQueueEvent {
              reason
              beforeCommit {
                checkSuites(last:1) {
                  nodes { workflowRun { url } }
                }
              }
            }
          }
        }
      }
    }
  }`;
  const result = object(
    await ghJson(
      [
        "api",
        "graphql",
        "-f",
        `query=${query}`,
        "-F",
        "owner=brioche-dev",
        "-F",
        "name=brioche-packages",
        "-F",
        `number=${pullRequestNumber}`,
      ],
      cwd,
    ),
  );
  const pullRequest = object(object(result.data).repository).pullRequest;
  const data = object(pullRequest);
  const queue = object(data.mergeQueueEntry);
  const timelineNodes = object(data.timelineItems).nodes;
  const removal = Array.isArray(timelineNodes) ? object(timelineNodes[0]) : {};
  const suites = object(object(removal.beforeCommit).checkSuites).nodes;
  const workflow = Array.isArray(suites)
    ? string(object(object(suites[0]).workflowRun).url)
    : "";
  return {
    state: string(queue.state) || undefined,
    position: number(queue.position),
    removalReason: string(removal.reason)
      ? formatDetailLabel(string(removal.reason))
      : undefined,
    workflowUrl: workflow || undefined,
  };
}

export async function fetchReviewDetails(
  candidate: ReviewCandidate,
  cwd: string,
): Promise<ReviewDetails> {
  const metadata = object(
    await ghJson(
      [
        "pr",
        "view",
        String(candidate.number),
        "--repo",
        repository,
        "--json",
        detailFields,
      ],
      cwd,
    ),
  );
  let queue: QueueDetails = {};
  try {
    queue = await fetchQueueDetails(candidate.number, cwd);
  } catch {
    queue = {};
  }
  const mergeState = string(
    metadata.mergeStateStatus || metadata.mergeable,
  ).toUpperCase();
  const status = queue.state
    ? `in merge queue (${formatDetailLabel(queue.state)})`
    : mergeState === "CLEAN" || mergeState === "MERGEABLE"
      ? "ready to merge"
      : mergeState === "DIRTY" || mergeState === "CONFLICTING"
        ? "merge conflict"
        : string(metadata.state).toLowerCase() || "unknown";
  return {
    number: number(metadata.number) ?? candidate.number,
    title: string(metadata.title) || candidate.title,
    author: string(object(metadata.author).login) || candidate.author,
    repository,
    isDraft: metadata.isDraft === true,
    status,
    checkSummary: checkSummary(metadata.statusCheckRollup),
    reviewDecision: reviewDecision(metadata.reviewDecision),
    url: string(metadata.url) || candidate.url,
    mergeQueueState: queue.state ? formatDetailLabel(queue.state) : undefined,
    mergeQueuePosition: queue.position,
    queueRemovalReason: queue.removalReason,
    queueWorkflowUrl: queue.workflowUrl,
  };
}

export async function prepareReview(
  cwd: string,
  sessionId: string,
  requestedPullRequest?: string,
): Promise<PreparedReview> {
  const directory = await mkdtemp(
    join(tmpdir(), "pi-brioche-packages-bot-review-"),
  );
  try {
    await ensureRepository(cwd);
    const requested = requestedPullRequest?.trim();
    let metadata: Json | undefined;
    if (requested) {
      metadata = object(
        await ghJson(
          [
            "pr",
            "view",
            requested,
            "--repo",
            repository,
            "--json",
            pullRequestFields,
          ],
          cwd,
        ),
      );
    } else {
      const candidate = (await listCandidates(cwd))[0];
      if (candidate) {
        metadata = object(
          await ghJson(
            [
              "pr",
              "view",
              candidate.url,
              "--repo",
              repository,
              "--json",
              pullRequestFields,
            ],
            cwd,
          ),
        );
      }
    }
    if (!metadata || !liveUpdatePullRequest(metadata)) {
      throw new Error(
        requested
          ? `PR ${requested} is not an open Brioche package live update pull request.`
          : "No open Brioche package update pull request without a review was found in the current repository.",
      );
    }
    const pr = prNumber(metadata.number);
    if (!pr)
      throw new Error(
        "Brioche package update pull request had no valid number.",
      );

    const diff = await fetchReviewDiff(
      { number: pr, title: string(metadata.title), url: string(metadata.url) },
      cwd,
    );
    const checks = await capture(
      "gh",
      ["pr", "checks", String(pr), "--repo", repository],
      cwd,
    );
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
    await writeFile(join(directory, "diff.patch"), diff, {
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
  await ensureRepository(review.cwd);
  const parsed = await ghJson(
    [
      "pr",
      "view",
      String(review.number),
      "--repo",
      repository,
      "--json",
      "number,author,state,isDraft,title,url,headRefName,headRefOid,baseRefName,reviewDecision,mergeable,mergeStateStatus",
    ],
    review.cwd,
  );
  const metadata = Array.isArray(parsed) ? object(parsed[0]) : parsed;
  if (!openPackageUpdate(metadata))
    throw new Error(
      "The pull request is no longer open and Brioche package update-authored.",
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
      "--repo",
      repository,
      "--required",
      "--json",
      "name,state,bucket,link",
    ],
    review.cwd,
  );
}

async function mergeSingleReview(
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
      "Merge Brioche package update pull request?",
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
      "--repo",
      repository,
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
        "--repo",
        repository,
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

export async function mergeReview(
  reviews: PreparedReview[],
  ctx: ExtensionContext,
): Promise<string> {
  if (reviews.length === 0)
    throw new Error("No pull requests were selected for merging.");
  if (reviews.length === 1) return mergeSingleReview(reviews[0]!, ctx);

  const initial = await Promise.all(
    reviews.map(async (review) => {
      const metadata = await refreshedMetadata(review, true);
      const head = assertReviewedHead(review, metadata);
      const checks = await requiredChecks(review);
      if (!statusSuccessful(checks))
        throw new Error(
          `Required checks are not all successful for PR ${review.number}; no review or merge was performed.`,
        );
      return { head, review };
    }),
  );
  if (
    !ctx.hasUI ||
    !(await ctx.ui.confirm(
      "Merge Brioche package update pull requests?",
      `Approve and squash-merge PRs ${reviews.map((review) => review.number).join(", ")}?`,
    ))
  )
    return "Merge cancelled. No pull request mutation was performed.";

  const current = await Promise.all(
    reviews.map(async (review) => {
      const metadata = await refreshedMetadata(review, true);
      const head = assertReviewedHead(review, metadata);
      const checks = await requiredChecks(review);
      if (!statusSuccessful(checks))
        throw new Error(
          `Required checks changed before merging PR ${review.number}; no review or merge was performed.`,
        );
      return { head, metadata, review };
    }),
  );
  for (let index = 0; index < current.length; index += 1) {
    if (initial[index]!.head !== current[index]!.head)
      throw new Error(
        "A pull request head changed while waiting for confirmation; no mutation was performed.",
      );
  }

  const mergedUrls: string[] = [];
  for (const item of current) {
    await successful(
      "gh",
      [
        "pr",
        "review",
        String(item.review.number),
        "--repo",
        repository,
        "--approve",
        "--body",
        "Looks good to me 🚀",
      ],
      item.review.cwd,
    );
    try {
      await successful(
        "gh",
        [
          "pr",
          "merge",
          String(item.review.number),
          "--repo",
          repository,
          "--squash",
          "--delete-branch",
          "--match-head-commit",
          item.head,
        ],
        item.review.cwd,
      );
    } catch (error) {
      throw new Error(
        `PR ${item.review.number} was approved, but the merge failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    mergedUrls.push(string(item.metadata.url));
  }
  return `Approved and squash-merged ${mergedUrls.join(", ")}.`;
}

async function checkoutSingleReview(
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
      "Checkout Brioche package update pull request?",
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
  const remote = await remoteForRepository(review.cwd, repository);
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
  return `Checked out reviewed Brioche package update PR ${review.number} at ${currentHead}.`;
}

export async function checkoutReview(
  reviews: PreparedReview[],
  ctx: ExtensionContext,
): Promise<string> {
  if (reviews.length !== 1)
    throw new Error(
      "Checkout supports exactly one selected pull request because it changes the current worktree.",
    );
  return checkoutSingleReview(reviews[0]!, ctx);
}
