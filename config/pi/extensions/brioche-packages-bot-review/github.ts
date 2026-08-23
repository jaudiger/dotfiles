import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import type {
  PullRequestSnapshot,
  ReviewCandidate,
  ReviewDetails,
  CommandResult,
  Json,
  MutationTarget,
  PreparedReview,
} from "./types.js";
import { number, object, string } from "./utils.js";

const execFileAsync = promisify(execFile);
const maxBuffer = 40 * 1024 * 1024;
const repository = "brioche-dev/brioche-packages";
const networkRetryDelays = [1000, 2000];
type MutationProgress = (message: string) => void;

function formatMutationResults(results: string[], heading: string): string {
  if (results.length === 1) return results[0]!;
  return `${heading}:\n${results.map((result) => `- ${result}`).join("\n")}`;
}

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
  progress: MutationProgress = () => {},
  description = `${command} ${args.join(" ")}`,
): Promise<string> {
  for (let attempt = 0; ; attempt += 1) {
    const result = await capture(command, args, cwd);
    if (result.exitCode === 0) return result.output;
    const detail = result.output.trim().slice(-2000);
    const failure = new Error(
      `${command} ${args.join(" ")} failed with exit code ${result.exitCode}${detail ? `: ${detail}` : "."}`,
    );
    const delay =
      command === "gh" && shouldRetryGhCall(args, failure)
        ? networkRetryDelays[attempt]
        : undefined;
    if (delay === undefined) throw failure;
    progress(
      `${description} hit a network failure; retrying in ${delay / 1000}s (${attempt + 2}/${networkRetryDelays.length + 1})`,
    );
    await new Promise((resolve) => setTimeout(resolve, delay));
  }
}

function networkFailureKind(error: unknown): "safe" | "ambiguous" | undefined {
  const message = errorMessage(error).toLowerCase();
  if (
    message.includes("tls handshake timeout") ||
    message.includes("temporary failure in name resolution") ||
    message.includes("no such host") ||
    message.includes("connection refused") ||
    message.includes("network is unreachable") ||
    (message.includes("dial tcp") && message.includes("i/o timeout"))
  )
    return "safe";
  if (
    message.includes("i/o timeout") ||
    message.includes("context deadline exceeded") ||
    message.includes("connection reset by peer") ||
    message.includes("unexpected eof")
  )
    return "ambiguous";
  return undefined;
}

function readOnlyGhCall(args: string[]): boolean {
  if (args[0] === "api") {
    const methodIndex = args.indexOf("--method");
    return methodIndex === -1 || args[methodIndex + 1]?.toUpperCase() === "GET";
  }
  if (args[0] === "repo" && args[1] === "clone") return false;
  if (args[0] === "pr")
    return !["comment", "review", "edit", "merge", "close", "create"].includes(
      args[1] ?? "",
    );
  return true;
}

function shouldRetryGhCall(args: string[], error: unknown): boolean {
  const kind = networkFailureKind(error);
  return kind === "safe" || (kind === "ambiguous" && readOnlyGhCall(args));
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
  "number,title,body,author,state,isDraft,url,headRefName,headRefOid,headRepository,baseRefName,reviewDecision,mergeable,mergeStateStatus,createdAt,updatedAt";
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
    return {
      directory,
      number: pr,
      repository,
      metadata: enriched,
      snapshot: snapshotFromMetadata(metadata, repository),
      cwd,
      sessionId,
    };
  } catch (error) {
    await rm(directory, { recursive: true, force: true });
    throw error;
  }
}

export async function prepareMutationTarget(
  candidate: ReviewCandidate,
  cwd: string,
): Promise<MutationTarget> {
  await ensureRepository(cwd);
  const metadata = object(
    await ghJson(
      [
        "pr",
        "view",
        String(candidate.number),
        "--repo",
        repository,
        "--json",
        pullRequestFields,
      ],
      cwd,
    ),
  );
  if (!liveUpdatePullRequest(metadata))
    throw new Error(
      `PR ${candidate.number} is not an open Brioche package live update pull request.`,
    );
  const target: MutationTarget = {
    number: candidate.number,
    repository,
    snapshot: snapshotFromMetadata(metadata, repository),
    cwd,
  };
  await requiredChecks(target);
  return target;
}

function statusSuccessful(output: string): boolean {
  try {
    const parsed = JSON.parse(output) as unknown;
    const checks = Array.isArray(parsed) ? parsed : [];
    return (
      checks.length > 0 &&
      checks.every((check) => {
        const item = object(check);
        const bucket = string(item.bucket);
        return bucket === "pass" || bucket === "skipping";
      })
    );
  } catch {
    return false;
  }
}

function snapshotFromMetadata(
  metadata: Json,
  repository: string,
): PullRequestSnapshot {
  const pullRequestNumber = number(metadata.number);
  if (pullRequestNumber === undefined)
    throw new Error("GitHub returned a pull request without a number.");
  return {
    number: pullRequestNumber,
    repository,
    title: string(metadata.title),
    url: string(metadata.url),
    author: string(object(metadata.author).login) || undefined,
    state: string(metadata.state),
    isDraft: metadata.isDraft === true,
    reviewDecision: string(metadata.reviewDecision),
    mergeable: string(metadata.mergeable),
    mergeStateStatus: string(metadata.mergeStateStatus),
    headRefName: string(metadata.headRefName),
    headRefOid: string(metadata.headRefOid),
    headRepository:
      string(object(metadata.headRepository).nameWithOwner) || undefined,
    baseRefName: string(metadata.baseRefName),
  };
}

async function refreshedMetadata(
  review: MutationTarget,
  requireMergeable = false,
): Promise<PullRequestSnapshot> {
  await ensureRepository(review.cwd);
  const parsed = await ghJson(
    [
      "pr",
      "view",
      String(review.number),
      "--repo",
      repository,
      "--json",
      "number,author,state,isDraft,title,url,headRefName,headRefOid,headRepository,baseRefName,reviewDecision,mergeable,mergeStateStatus",
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
    if (mergeable !== "MERGEABLE") {
      const mergeState = string(metadata.mergeStateStatus).toUpperCase();
      const stateDetail = mergeState ? `; merge state ${mergeState}` : "";
      throw new Error(
        `The pull request is not mergeable (${mergeable || "UNKNOWN"}${stateDetail}).`,
      );
    }
    const mergeState = string(metadata.mergeStateStatus).toUpperCase();
    const reviewDecision = string(metadata.reviewDecision).toUpperCase();
    if (mergeState === "BLOCKED" && reviewDecision !== "REVIEW_REQUIRED")
      throw new Error(
        `The pull request is blocked (${mergeState}; review decision ${reviewDecision || "UNKNOWN"}).`,
      );
  }
  return snapshotFromMetadata(metadata, review.repository);
}

export async function refreshReview(
  review: MutationTarget,
  requireMergeable = false,
): Promise<PullRequestSnapshot> {
  return refreshedMetadata(review, requireMergeable);
}

export async function refreshReviewState(
  review: MutationTarget,
): Promise<PullRequestSnapshot> {
  const parsed = await ghJson(
    [
      "pr",
      "view",
      String(review.number),
      "--repo",
      repository,
      "--json",
      "number,author,state,isDraft,title,url,headRefName,headRefOid,headRepository,baseRefName,reviewDecision,mergeable,mergeStateStatus",
    ],
    review.cwd,
  );
  const metadata = Array.isArray(parsed) ? object(parsed[0]) : parsed;
  return snapshotFromMetadata(metadata, review.repository);
}

function reviewedHead(review: MutationTarget): string {
  return review.snapshot.headRefOid;
}

function assertReviewedHead(
  review: MutationTarget,
  metadata: PullRequestSnapshot,
  expectedHead = reviewedHead(review),
): string {
  const expected = expectedHead;
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

async function requiredChecks(review: MutationTarget): Promise<string> {
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

async function authenticatedUser(cwd: string): Promise<string> {
  const account = object(await ghJson(["api", "user"], cwd));
  const login = string(account.login);
  if (!login) throw new Error("GitHub returned no authenticated user.");
  return login;
}

async function assignReview(
  review: MutationTarget,
  login: string,
): Promise<void> {
  await successful(
    "gh",
    [
      "pr",
      "edit",
      String(review.number),
      "--repo",
      repository,
      "--add-assignee",
      login,
    ],
    review.cwd,
  );
}

async function approvalRecorded(
  review: MutationTarget,
  login: string,
  expectedHead: string,
): Promise<boolean> {
  const parsed = await ghJson(
    [
      "api",
      "--paginate",
      "--slurp",
      `repos/${review.repository}/pulls/${review.number}/reviews`,
    ],
    review.cwd,
  );
  const latest = new Map<
    string,
    { id: number; state: string; commit: string; submittedAt: string }
  >();
  const pages = Array.isArray(parsed) ? parsed : [];
  for (const page of pages) {
    if (!Array.isArray(page)) continue;
    for (const raw of page) {
      const item = object(raw);
      const reviewer = string(object(item.user).login);
      if (reviewer !== login) continue;
      const id = number(item.id) ?? 0;
      const submittedAt = string(item.submitted_at);
      const previous = latest.get(reviewer);
      if (
        !previous ||
        submittedAt > previous.submittedAt ||
        (submittedAt === previous.submittedAt && id > previous.id)
      )
        latest.set(reviewer, {
          id,
          state: string(item.state),
          commit: string(item.commit_id),
          submittedAt,
        });
    }
  }
  const reviewRecord = latest.get(login);
  return (
    reviewRecord !== undefined &&
    reviewRecord.state === "APPROVED" &&
    reviewRecord.commit === expectedHead
  );
}

async function commentAndApprove(review: MutationTarget): Promise<void> {
  await successful(
    "gh",
    [
      "pr",
      "comment",
      String(review.number),
      "--repo",
      repository,
      "--body",
      "Looks good to me",
    ],
    review.cwd,
  );
  try {
    await successful(
      "gh",
      [
        "pr",
        "review",
        String(review.number),
        "--repo",
        repository,
        "--approve",
      ],
      review.cwd,
    );
  } catch (error) {
    throw new Error(
      `The exact comment was added, but approval failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

async function mergePreparedReview(
  review: MutationTarget,
  expectedHead: string,
  login: string,
  progress: MutationProgress,
): Promise<string> {
  progress(`PR #${review.number}: refreshing metadata and required checks`);
  const [metadata, checks] = await Promise.all([
    refreshedMetadata(review, true),
    requiredChecks(review),
  ]);
  assertReviewedHead(review, metadata, expectedHead);
  if (!statusSuccessful(checks))
    throw new Error("Required checks are not all successful.");
  review.snapshot = metadata;

  progress(`PR #${review.number}: assigning reviewer`);
  try {
    await assignReview(review, login);
  } catch (error) {
    throw new Error(
      `The authenticated user could not be assigned: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  let state = metadata;
  let mergeHead = expectedHead;
  let approved = false;
  try {
    approved = state.reviewDecision === "APPROVED";
    if (!approved) {
      progress(`PR #${review.number}: checking existing approval`);
      approved = await approvalRecorded(review, login, expectedHead);
    }
    if (!approved) {
      progress(`PR #${review.number}: requesting approval`);
      await commentAndApprove(review);
      approved = true;
      state = await refreshReview(review, true);
      assertReviewedHead(review, state, expectedHead);
      review.snapshot = state;
    }
    mergeHead = assertReviewedHead(review, state, expectedHead);
    if (
      state.reviewDecision !== "APPROVED" &&
      !(await approvalRecorded(review, login, expectedHead))
    )
      throw new Error(
        "GitHub did not report the pull request as approved for its current head.",
      );
  } catch (error) {
    if (approved)
      throw new Error(
        `The pull request was approved, but refreshing before merge failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    if (error instanceof Error && error.message.startsWith("The exact comment"))
      throw error;
    throw new Error(
      `The authenticated user was assigned, but approval did not complete: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  review.snapshot = state;
  progress(`PR #${review.number}: submitting merge`);
  const mergeArgs = [
    "pr",
    "merge",
    String(review.number),
    "--repo",
    repository,
    "--squash",
    "--delete-branch",
    "--match-head-commit",
    mergeHead,
  ];
  let queued = false;
  try {
    await successful(
      "gh",
      mergeArgs,
      review.cwd,
      progress,
      `PR #${review.number}: merge request`,
    );
  } catch (error) {
    const message = errorMessage(error);
    const normalizedMessage = message.toLowerCase();
    if (
      !normalizedMessage.includes("cannot use") ||
      !normalizedMessage.includes("--delete-branch") ||
      !normalizedMessage.includes("merge queue enabled")
    )
      throw new Error(
        `The pull request was approved or already approved, but the merge failed: ${message}`,
      );
    queued = true;
    try {
      await successful(
        "gh",
        mergeArgs.filter((argument) => argument !== "--delete-branch"),
        review.cwd,
        progress,
        `PR #${review.number}: merge queue request`,
      );
    } catch (retryError) {
      throw new Error(
        `The pull request was approved or already approved, but the merge failed: ${errorMessage(retryError)}`,
      );
    }
  }
  try {
    progress(`PR #${review.number}: verifying merge or queue state`);
    state = await refreshReviewState(review);
    assertReviewedHead(review, state, expectedHead);
    const stateName = state.state.toUpperCase();
    if (queued && stateName !== "MERGED") {
      if (stateName !== "OPEN")
        throw new Error(
          `GitHub reported pull request state ${state.state || "UNKNOWN"} after queuing the merge.`,
        );
      const queue = await fetchQueueDetails(review.number, review.cwd);
      if (!queue.state)
        throw new Error(
          "GitHub did not report the pull request in the merge queue.",
        );
      review.snapshot = state;
      return `Queued PR ${string(state.url) || review.number} for merging.`;
    }
    if (stateName !== "MERGED")
      throw new Error(
        `GitHub reported pull request state ${state.state || "UNKNOWN"} after the merge command.`,
      );
    review.snapshot = state;
  } catch (error) {
    throw new Error(
      `The merge command succeeded, but refreshing pull request state failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  return `Squash-merged PR ${string(state.url) || review.number}.`;
}

export async function mergeReview(
  reviews: MutationTarget[],
  ctx: ExtensionContext,
  progress: MutationProgress = () => {},
): Promise<string> {
  if (reviews.length === 0)
    throw new Error("No pull requests were selected for merging.");

  const initialHeads = reviews.map((review) => review.snapshot.headRefOid);
  if (
    !ctx.hasUI ||
    !(await ctx.ui.confirm(
      reviews.length === 1
        ? "Merge Brioche package update pull request?"
        : "Merge Brioche package update pull requests?",
      `Approve and squash-merge PRs ${reviews.map((review) => review.number).join(", ")}?`,
    ))
  )
    return "Merge cancelled. No pull request mutation was performed.";

  progress(
    `Resolving the authenticated reviewer for ${reviews.length} pull requests`,
  );
  const login = await authenticatedUser(reviews[0]!.cwd);
  const completed: string[] = [];
  for (let index = 0; index < reviews.length; index += 1) {
    const review = reviews[index]!;
    try {
      progress(`Merging PR #${review.number} (${index + 1}/${reviews.length})`);
      completed.push(
        await mergePreparedReview(
          review,
          initialHeads[index]!,
          login,
          progress,
        ),
      );
    } catch (error) {
      const prior = completed.length
        ? `${completed.length === 1 ? `Completed: ${completed[0]}` : formatMutationResults(completed, "Completed")}\n`
        : "No earlier pull request was mutated. ";
      throw new Error(
        `${prior}Stopped at PR ${review.number}. ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
  return formatMutationResults(completed, "Completed pull request actions");
}

type SupersedeSource = {
  review: MutationTarget;
  head: string;
  base: string;
  branch: string;
  sourceRepository: string;
};

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function supersedeSource(
  source: SupersedeSource,
  supersedingUrl: string,
  selectedNumbers: number[],
  cwd: string,
  progress: MutationProgress,
): Promise<string[]> {
  const failures: string[] = [];
  const review = source.review;
  const body = `This pull request is superseded by ${supersedingUrl}. The selected PRs ${selectedNumbers.map((number) => `#${number}`).join(", ")} were combined in the superseding pull request.`;
  let commented = false;
  let closed = false;
  progress(
    `PR #${source.review.number}: commenting on superseded pull request`,
  );
  try {
    await successful(
      "gh",
      [
        "pr",
        "comment",
        String(review.number),
        "--repo",
        review.repository,
        "--body",
        body,
      ],
      cwd,
    );
    commented = true;
  } catch (error) {
    failures.push(`PR ${review.number} comment failed: ${errorMessage(error)}`);
  }
  progress(`PR #${source.review.number}: closing superseded pull request`);
  try {
    if (!commented)
      throw new Error(
        "The source PR was not closed because its comment failed.",
      );
    await successful(
      "gh",
      ["pr", "close", String(review.number), "--repo", review.repository],
      cwd,
    );
    closed = true;
  } catch (error) {
    failures.push(`PR ${review.number} close failed: ${errorMessage(error)}`);
  }
  progress(`PR #${source.review.number}: deleting source branch safely`);
  try {
    if (!closed)
      throw new Error(
        "The source branch was retained because the PR stayed open.",
      );
    const readEndpoint = `repos/${source.sourceRepository}/git/ref/heads/${source.branch}`;
    const deleteEndpoint = `repos/${source.sourceRepository}/git/refs/heads/${source.branch}`;
    const response = await successful(
      "gh",
      ["api", readEndpoint, "--jq", ".object.sha"],
      cwd,
    );
    const currentHead = response.trim();
    if (!currentHead)
      throw new Error("GitHub returned no branch version for deletion.");
    if (currentHead !== source.head)
      throw new Error(
        "The source branch head changed; the source branch was not deleted.",
      );
    await successful("gh", ["api", "--method", "DELETE", deleteEndpoint], cwd);
  } catch (error) {
    failures.push(
      `PR ${review.number} source branch cleanup failed: ${errorMessage(error)}`,
    );
  }
  progress(`PR #${source.review.number}: refreshing cleanup state`);
  try {
    review.snapshot = await refreshReviewState(review);
  } catch (error) {
    failures.push(
      `PR ${review.number} state refresh failed: ${errorMessage(error)}`,
    );
  }
  return failures;
}

export async function supersedeReview(
  reviews: MutationTarget[],
  ctx: ExtensionContext,
  progress: MutationProgress = () => {},
): Promise<string> {
  if (reviews.length < 2)
    throw new Error(
      "Superseding requires at least two selected pull requests.",
    );

  const initial: SupersedeSource[] = [];
  for (let index = 0; index < reviews.length; index += 1) {
    const review = reviews[index]!;
    progress(
      `Validating supersede source ${index + 1}/${reviews.length}: PR #${review.number}`,
    );
    const metadata = await refreshedMetadata(review);
    const head = assertReviewedHead(review, metadata);
    if (!statusSuccessful(await requiredChecks(review)))
      throw new Error(
        `Required source checks are not all successful for PR ${review.number}; no mutation was performed.`,
      );
    const base = metadata.baseRefName;
    const branch = metadata.headRefName;
    const sourceRepository = metadata.headRepository || review.repository;
    if (!base || !branch || !sourceRepository)
      throw new Error(
        `PR ${review.number} is missing a source or base branch; no mutation was performed.`,
      );
    initial.push({ review, head, base, branch, sourceRepository });
  }
  const selectedRepository = initial[0]!.review.repository;
  const base = initial[0]!.base;
  if (
    initial.some(
      (source) =>
        source.review.repository !== selectedRepository || source.base !== base,
    )
  )
    throw new Error(
      "Superseding requires selected pull requests from one repository and one base branch.",
    );

  if (
    !ctx.hasUI ||
    !(await ctx.ui.confirm(
      "Supersede pull requests?",
      `Combine PRs ${reviews.map((review) => review.number).join(", ")} into a new pull request?`,
    ))
  )
    return "Superseding cancelled. No pull request mutation was performed.";

  const selected: SupersedeSource[] = [];
  for (let index = 0; index < initial.length; index += 1) {
    const source = initial[index]!;
    progress(
      `Revalidating supersede source ${index + 1}/${initial.length}: PR #${source.review.number}`,
    );
    const metadata = await refreshedMetadata(source.review);
    const currentHead = assertReviewedHead(source.review, metadata);
    if (currentHead !== source.head || metadata.baseRefName !== base)
      throw new Error(
        "A selected pull request head or base branch changed while waiting for confirmation; no mutation was performed.",
      );
    if (!statusSuccessful(await requiredChecks(source.review)))
      throw new Error(
        "Required source checks changed while waiting for confirmation; no mutation was performed.",
      );
    source.review.snapshot = metadata;
    selected.push(source);
  }

  progress("Cloning the repository for the superseding pull request...");
  const workspace = await mkdtemp(join(tmpdir(), "pi-supersede-brioche-"));
  const checkout = join(workspace, "repository");
  try {
    await successful(
      "gh",
      ["repo", "clone", selectedRepository, checkout],
      reviews[0]!.cwd,
    );
    await successful(
      "git",
      [
        "fetch",
        "--no-tags",
        "origin",
        `+refs/heads/${base}:refs/remotes/origin/${base}`,
      ],
      checkout,
    );
    await successful(
      "git",
      ["checkout", "--detach", `refs/remotes/origin/${base}`],
      checkout,
    );
    const branch = `supersede/prs-${Date.now()}`;
    await successful("git", ["switch", "--create", branch], checkout);

    const applied = new Set<string>();
    for (const source of selected) {
      progress(`PR #${source.review.number}: fetching and applying commits...`);
      const ref = `refs/remotes/origin/pi-pr-${source.review.number}`;
      await successful(
        "git",
        [
          "fetch",
          "--no-tags",
          "origin",
          `+refs/pull/${source.review.number}/head:${ref}`,
        ],
        checkout,
      );
      const fetchedHead = (
        await successful("git", ["rev-parse", ref], checkout)
      ).trim();
      if (fetchedHead !== source.head)
        throw new Error(
          `PR ${source.review.number} head changed while fetching; no mutation was performed.`,
        );
      const mergeCommits = (
        await successful(
          "git",
          ["rev-list", "--merges", `refs/remotes/origin/${base}..${ref}`],
          checkout,
        )
      ).trim();
      if (mergeCommits)
        throw new Error(
          `PR ${source.review.number} contains merge commits; no mutation was performed.`,
        );
      const commits = (
        await successful(
          "git",
          [
            "rev-list",
            "--reverse",
            "--topo-order",
            `refs/remotes/origin/${base}..${ref}`,
          ],
          checkout,
        )
      )
        .split("\n")
        .map((commit) => commit.trim())
        .filter(Boolean);
      for (const commit of commits) {
        if (applied.has(commit)) continue;
        await successful("git", ["cherry-pick", "--no-edit", commit], checkout);
        applied.add(commit);
      }
    }

    if (applied.size === 0)
      throw new Error(
        "The selected pull requests contain no unique commits to cherry-pick.",
      );

    progress("Pushing the combined branch...");
    await successful(
      "git",
      ["push", "--set-upstream", "origin", branch],
      checkout,
    );
    progress("Creating the superseding pull request...");
    const creationOutput = await successful(
      "gh",
      [
        "pr",
        "create",
        "--repo",
        selectedRepository,
        "--base",
        base,
        "--head",
        branch,
        "--title",
        `Supersede pull requests ${reviews.map((review) => `#${review.number}`).join(", ")}`,
        "--body",
        `This pull request supersedes ${reviews.map((review) => `#${review.number}`).join(", ")}. It combines every unique commit from the selected pull requests in selection order.`,
      ],
      checkout,
    );
    const createdMatch = creationOutput.match(
      /https:\/\/[^/\s]+\/[^/\s]+\/[^/\s]+\/pull\/(\d+)/,
    );
    const supersedingNumber = Number(createdMatch?.[1]);
    if (!createdMatch || !Number.isSafeInteger(supersedingNumber))
      throw new Error(
        "GitHub did not return the superseding pull request URL.",
      );
    const supersedingUrl = createdMatch[0];
    progress("Commenting on the superseding pull request...");
    try {
      await successful(
        "gh",
        [
          "pr",
          "comment",
          String(supersedingNumber),
          "--repo",
          selectedRepository,
          "--body",
          `This pull request supersedes ${reviews.map((review) => `#${review.number}`).join(", ")}. It combines every unique commit from the selected pull requests in selection order.`,
        ],
        checkout,
      );
    } catch (error) {
      throw new Error(
        `Created superseding PR ${supersedingUrl}, but its comment failed: ${errorMessage(error)}`,
      );
    }

    const failures: string[] = [];
    for (const source of selected)
      failures.push(
        ...(await supersedeSource(
          source,
          supersedingUrl,
          reviews.map((review) => review.number),
          checkout,
          progress,
        )),
      );
    const result = `Created superseding PR ${supersedingUrl} from PRs ${reviews.map((review) => `#${review.number}`).join(", ")}.`;
    return failures.length
      ? `${result} Cleanup failures: ${failures.join("; ")}`
      : result;
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
}

async function checkoutSingleReview(
  review: MutationTarget,
  ctx: ExtensionContext,
  progress: MutationProgress = () => {},
): Promise<string> {
  progress(`PR #${review.number}: checking current metadata and worktree`);
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
  progress(`PR #${review.number}: verifying the worktree is still clean`);
  const finalStatus = await successful(
    "git",
    ["status", "--porcelain"],
    review.cwd,
  );
  if (finalStatus.trim())
    throw new Error("The worktree became dirty; checkout was not performed.");
  progress(`PR #${review.number}: fetching the reviewed head`);
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
  progress(`PR #${review.number}: checking out the reviewed head`);
  await successful("git", ["checkout", "--detach", currentHead], review.cwd);
  return `Checked out reviewed Brioche package update PR ${review.number} at ${currentHead}.`;
}

export async function checkoutReview(
  reviews: MutationTarget[],
  ctx: ExtensionContext,
  progress: MutationProgress = () => {},
): Promise<string> {
  if (reviews.length !== 1)
    throw new Error(
      "Checkout supports exactly one selected pull request because it changes the current worktree.",
    );
  return checkoutSingleReview(reviews[0]!, ctx, progress);
}
