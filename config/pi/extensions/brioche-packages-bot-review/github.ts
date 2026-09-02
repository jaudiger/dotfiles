import { execFile } from "node:child_process";
import { realpath } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import {
  checkoutReview as sharedCheckoutReview,
  fetchReviewDetails as sharedFetchReviewDetails,
  fetchReviewDiff as sharedFetchReviewDiff,
  listCandidates as sharedListCandidates,
  mergeReview as sharedMergeReview,
  prepareMutationTarget as sharedPrepareMutationTarget,
  prepareReview as sharedPrepareReview,
  supersedeReview as sharedSupersedeReview,
  type GithubPrReviewProvider,
} from "../pi-extension-infrastructure/github-pr-review/github-operations.js";
import type {
  Json,
  MutationTarget,
  ReviewCandidate,
  ReviewDetails,
} from "../pi-extension-infrastructure/github-pr-review/types.js";
import { object, string } from "../pi-extension-infrastructure/parsing.js";

const execFileAsync = promisify(execFile);
const maxBuffer = 40 * 1024 * 1024;
const repository = "brioche-dev/brioche-packages";
const networkRetryDelays = [1000, 2000];

type CommandResult = { output: string; exitCode: number };
type MutationProgress = (message: string) => void;

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
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

async function successful(
  command: string,
  args: string[],
  cwd: string,
): Promise<string> {
  for (let attempt = 0; ; attempt += 1) {
    const result = await capture(command, args, cwd);
    if (result.exitCode === 0) return result.output;
    const detail = result.output.trim().slice(-2000);
    const failure = new Error(
      `${command} ${args.join(" ")} failed with exit code ${result.exitCode}${detail ? `: ${detail}` : "."}`,
    );
    const kind = command === "gh" ? networkFailureKind(failure) : undefined;
    const delay =
      kind === "safe" || (kind === "ambiguous" && readOnlyGhCall(args))
        ? networkRetryDelays[attempt]
        : undefined;
    if (delay === undefined) throw failure;
    await new Promise((resolve) => setTimeout(resolve, delay));
  }
}

function githubRepositoryFromRemote(value: string): string | undefined {
  const normalized = value.trim().replace(/\.git$/, "");
  return normalized.match(/github\.com[/:]([^/\s]+\/[^/\s]+)$/)?.[1];
}

function repositoryPath(repositoryName: string): string {
  const [owner, name] = repositoryName.split("/");
  if (
    !owner ||
    !name ||
    repositoryName.split("/").length !== 2 ||
    !/^[A-Za-z0-9_.-]+$/.test(owner) ||
    !/^[A-Za-z0-9_.-]+$/.test(name)
  )
    throw new Error(`Invalid GitHub repository name: ${repositoryName}.`);
  return join(homedir(), "Development", "git-repositories", owner, name);
}

async function repositoryCwd(repositoryName: string): Promise<string> {
  const expectedPath = repositoryPath(repositoryName);
  let expectedRoot: string;
  let actualRoot: string;
  try {
    expectedRoot = await realpath(expectedPath);
    actualRoot = await realpath(
      (
        await successful("git", ["rev-parse", "--show-toplevel"], expectedPath)
      ).trim(),
    );
  } catch (error) {
    throw new Error(
      `Local checkout for ${repositoryName} was not found at ${expectedPath}: ${errorMessage(error)}`,
    );
  }
  if (actualRoot !== expectedRoot)
    throw new Error(
      `Local checkout for ${repositoryName} resolved to ${actualRoot}, not ${expectedPath}.`,
    );
  const remotes = await successful("git", ["remote"], actualRoot);
  for (const remote of remotes.split(/\s+/).filter(Boolean)) {
    const urls = await successful(
      "git",
      ["remote", "get-url", "--all", remote],
      actualRoot,
    );
    if (
      urls
        .split("\n")
        .some(
          (url) =>
            githubRepositoryFromRemote(url)?.toLowerCase() ===
            repositoryName.toLowerCase(),
        )
    )
      return actualRoot;
  }
  throw new Error(
    `Local checkout at ${expectedPath} has no remote for ${repositoryName}.`,
  );
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

async function ghJson(args: string[], cwd: string): Promise<Json | Json[]> {
  const output = await successful("gh", args, cwd);
  try {
    const parsed = JSON.parse(output) as unknown;
    return Array.isArray(parsed) ? (parsed as Json[]) : object(parsed);
  } catch {
    throw new Error(`gh ${args.join(" ")} returned invalid JSON.`);
  }
}

async function ensureRepository(): Promise<string> {
  const checkout = await repositoryCwd(repository);
  const metadata = await ghJson(
    ["repo", "view", repository, "--json", "nameWithOwner"],
    checkout,
  );
  const nameWithOwner = string(object(metadata).nameWithOwner);
  if (nameWithOwner !== repository)
    throw new Error(
      `The local checkout at ${checkout} does not point to ${repository}.`,
    );
  return checkout;
}

const packageUpdateAuthorLogins = [
  "package-update-bot[bot]",
  "package-update-bot",
  "app/package-update-bot",
];

function packageUpdateAuthor(value: Json): boolean {
  return packageUpdateAuthorLogins.includes(string(object(value.author).login));
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
    (files.has("project.bri") || files.has("brioche.lock"))
  );
}

function repositoryFromUrl(value: unknown): string | undefined {
  const match = string(value).match(
    /^https:\/\/github\.com\/([^/]+\/[^/]+)\/pull\/\d+$/,
  );
  return match?.[1];
}

const briocheGithubProvider: GithubPrReviewProvider = {
  search: async () => {
    const cwd = await ensureRepository();
    return {
      cwd,
      repository,
      args: [
        "search",
        "prs",
        "--state",
        "open",
        "--app",
        "package-update-bot",
        "--repo",
        repository,
        "--limit",
        "1000",
        "--json",
        "number,title,author,state,isDraft,url",
      ],
    };
  },
  resolveRepository: async (request) => {
    const cwd = await ensureRepository();
    const requestedRepository =
      request.repository ?? repositoryFromUrl(request.candidate?.url);
    const metadataRepository = repositoryFromUrl(request.metadata?.url);
    if (
      (requestedRepository && requestedRepository !== repository) ||
      (metadataRepository && metadataRepository !== repository)
    )
      throw new Error("Brioche pull request had an invalid GitHub repository.");
    return { repository, cwd };
  },
  resolveRemote: remoteForRepository,
  authorRules: packageUpdateAuthor,
  candidateEligibility: liveUpdatePullRequest,
  queueBehavior: {
    repository: (value) =>
      value === repository
        ? { owner: "brioche-dev", name: "brioche-packages" }
        : undefined,
  },
  labels: {
    subject: "Brioche package update",
    subjectPlural: "Brioche package update",
  },
  messages: {
    invalidUrl: "Brioche pull request had no valid GitHub URL.",
    invalidRepository: "Brioche pull request had an invalid GitHub repository.",
    noCandidate:
      "No open Brioche package update pull request was found in the current repository.",
    notEligible: (pullRequest) =>
      `PR ${pullRequest} is not an open Brioche package live update pull request.`,
    noLongerEligible:
      "The pull request is no longer open and Brioche package update-authored.",
    invalidNumber: "Brioche package update pull request had no valid number.",
    statusChecksFailure: (pullRequest, detail) =>
      `Could not retrieve status checks for Brioche package update PR ${pullRequest}${detail ? `: ${detail}` : "."}`,
    diffFailure: (pullRequest, detail) =>
      `Could not retrieve the diff for Brioche package update PR ${pullRequest} (${detail}).`,
    invalidDiff: (pullRequest) =>
      `PR ${pullRequest} is not a single Brioche package live update of project.bri and/or brioche.lock.`,
    checkoutConfirmation: "Checkout Brioche package update pull request?",
    checkoutSuccess: (pullRequest, head) =>
      `Checked out reviewed Brioche package update PR ${pullRequest} at ${head}.`,
  },
  policy: {
    temporaryDirectoryPrefix: "pi-brioche-packages-bot-review-",
    supersedeTemporaryDirectoryPrefix: "pi-supersede-brioche-",
    pullRequestViewArgs: (reference, fields) => [
      "pr",
      "view",
      reference,
      "--repo",
      repository,
      "--json",
      fields,
    ],
    validateWorkingDirectory: async () => ensureRepository(),
    validateMutationRepository: async () => {
      await ensureRepository();
    },
    mutationEligibility: openPackageUpdate,
    validateDiff: (diff, candidate) => {
      if (!isLiveUpdateDiff(diff))
        throw new Error(
          `PR ${candidate.number} is not a single Brioche package live update of project.bri and/or brioche.lock.`,
        );
    },
  },
};

export function listCandidates(): Promise<ReviewCandidate[]> {
  return sharedListCandidates(briocheGithubProvider, process.cwd());
}

export function fetchReviewDiff(candidate: ReviewCandidate): Promise<string> {
  return sharedFetchReviewDiff(briocheGithubProvider, candidate, process.cwd());
}

export function fetchReviewDetails(
  candidate: ReviewCandidate,
): Promise<ReviewDetails> {
  return sharedFetchReviewDetails(
    briocheGithubProvider,
    candidate,
    process.cwd(),
  );
}

export function prepareReview(
  cwd: string,
  sessionId: string,
  requestedPullRequest?: string,
) {
  return sharedPrepareReview(
    briocheGithubProvider,
    cwd,
    sessionId,
    requestedPullRequest,
  );
}

export function prepareMutationTarget(candidate: ReviewCandidate, cwd: string) {
  return sharedPrepareMutationTarget(briocheGithubProvider, candidate, cwd);
}

export function mergeReview(
  reviews: MutationTarget[],
  ctx: ExtensionContext,
  progress: MutationProgress = () => {},
) {
  return sharedMergeReview(briocheGithubProvider, reviews, ctx, progress);
}

export function supersedeReview(
  reviews: MutationTarget[],
  ctx: ExtensionContext,
  progress: MutationProgress = () => {},
) {
  return sharedSupersedeReview(briocheGithubProvider, reviews, ctx, progress);
}

export function checkoutReview(
  reviews: MutationTarget[],
  ctx: ExtensionContext,
  progress: MutationProgress = () => {},
) {
  return sharedCheckoutReview(briocheGithubProvider, reviews, ctx, progress);
}
