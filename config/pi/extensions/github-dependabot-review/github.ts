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
type MutationProgress = (message: string) => void;

async function successful(
  command: string,
  args: string[],
  cwd: string,
): Promise<string> {
  try {
    const result = await execFileAsync(command, args, { cwd, maxBuffer });
    return `${string(result.stdout)}${string(result.stderr)}`;
  } catch (error) {
    const result = object(error);
    const code =
      typeof result.code === "number" || typeof result.code === "string"
        ? result.code
        : "unknown";
    const output = `${string(result.stdout)}${string(result.stderr)}`.trim();
    throw new Error(
      `${command} ${args.join(" ")} failed with exit code ${code}${output ? `: ${output}` : "."}`,
    );
  }
}

async function ghJson(args: string[], cwd: string): Promise<Json | Json[]> {
  const output = await successful("gh", args, cwd);
  try {
    const parsed = JSON.parse(output) as unknown;
    return Array.isArray(parsed) ? parsed.map(object) : object(parsed);
  } catch {
    throw new Error(`gh ${args.join(" ")} returned invalid JSON.`);
  }
}

function githubRepositoryFromRemote(value: string): string | undefined {
  const normalized = value.trim().replace(/\.git$/, "");
  return normalized.match(/github\.com[/:]([^/\s]+\/[^/\s]+)$/)?.[1];
}

function repositoryFromUrl(value: unknown): string | undefined {
  const url = string(value);
  return url.match(/^https:\/\/github\.com\/([^/]+\/[^/]+)\/pull\/\d+$/)?.[1];
}

function repositoryPath(repository: string): string {
  const [owner, name] = repository.split("/");
  if (
    !owner ||
    !name ||
    repository.split("/").length !== 2 ||
    !/^[A-Za-z0-9_.-]+$/.test(owner) ||
    !/^[A-Za-z0-9_.-]+$/.test(name)
  )
    throw new Error(`Invalid GitHub repository name: ${repository}.`);
  return join(homedir(), "Development", "git-repositories", owner, name);
}

async function repositoryCwd(repository: string): Promise<string> {
  const expectedPath = repositoryPath(repository);
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
      `Local checkout for ${repository} was not found at ${expectedPath}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  if (actualRoot !== expectedRoot)
    throw new Error(
      `Local checkout for ${repository} resolved to ${actualRoot}, not ${expectedPath}.`,
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
            repository.toLowerCase(),
        )
    )
      return actualRoot;
  }
  throw new Error(
    `Local checkout at ${expectedPath} has no remote for ${repository}.`,
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

async function dependabotSearchScope(cwd: string): Promise<string[]> {
  const account = object(await ghJson(["api", "user"], cwd));
  const login = string(account.login);
  if (!login) throw new Error("GitHub returned no authenticated user.");
  const organizationOutput = await successful(
    "gh",
    ["api", "user/orgs?per_page=100", "--paginate", "--jq", ".[].login"],
    cwd,
  );
  const organizations = organizationOutput
    .split("\n")
    .map((organization) => organization.trim())
    .filter(Boolean);
  const scopes = [
    `user:${login}`,
    ...organizations.map((organization) => `org:${organization}`),
  ];
  return scopes.length === 1
    ? scopes
    : [
        "(",
        ...scopes.flatMap((scope, index) =>
          index === 0 ? [scope] : ["OR", scope],
        ),
        ")",
      ];
}

function dependabotAuthor(value: Json): boolean {
  return ["app/dependabot", "dependabot[bot]", "dependabot"].includes(
    string(object(value.author).login),
  );
}

function openDependabot(value: Json): boolean {
  return (
    string(value.state).toUpperCase() === "OPEN" && dependabotAuthor(value)
  );
}

const dependabotGithubProvider: GithubPrReviewProvider = {
  search: async (cwd) => ({
    cwd,
    args: [
      "search",
      "prs",
      "--state",
      "open",
      "--app",
      "dependabot",
      "--limit",
      "1000",
      "--json",
      "number,title,author,state,isDraft,url",
      "--",
      ...(await dependabotSearchScope(cwd)),
    ],
  }),
  repositoryFromUrl,
  resolveRepository: async (request) => {
    const candidateUrl = request.candidate?.url;
    const metadataUrl = request.metadata?.url;
    const candidateRepository =
      request.repository ?? repositoryFromUrl(candidateUrl);
    const metadataRepository = repositoryFromUrl(metadataUrl);
    if (request.metadata && !metadataRepository)
      throw new Error("Dependabot pull request had no valid GitHub URL.");
    if (!candidateRepository && candidateUrl)
      throw new Error(
        "Dependabot pull request had no valid GitHub repository.",
      );
    const repository = candidateRepository || metadataRepository;
    if (!repository)
      throw new Error(
        "Dependabot pull request had no valid GitHub repository.",
      );
    return { repository, cwd: await repositoryCwd(repository) };
  },
  resolveRemote: remoteForRepository,
  authorRules: dependabotAuthor,
  candidateEligibility: (value) => string(value.state).toUpperCase() === "OPEN",
  queueBehavior: {
    repository: (value) => {
      const [owner, name] = value.split("/");
      return owner && name ? { owner, name } : undefined;
    },
  },
  labels: {
    subject: "Dependabot",
    subjectPlural: "Dependabot",
  },
  messages: {
    invalidUrl: "Dependabot pull request had no valid GitHub URL.",
    invalidRepository:
      "Dependabot pull request had no valid GitHub repository.",
    noCandidate:
      "No open Dependabot pull request was found across the searched repositories.",
    notEligible: (pullRequest) =>
      `PR ${pullRequest} is not an open Dependabot pull request.`,
    noLongerEligible:
      "The pull request is no longer open and Dependabot-authored.",
    invalidNumber: "Dependabot pull request had no valid number.",
    statusChecksFailure: (pullRequest, detail) =>
      `Could not retrieve status checks for Dependabot PR ${pullRequest}${detail ? `: ${detail}` : "."}`,
    diffFailure: (pullRequest, detail) =>
      `Could not retrieve the diff for Dependabot PR ${pullRequest} (${detail}).`,
    checkoutConfirmation: "Checkout Dependabot pull request?",
    checkoutSuccess: (pullRequest, head) =>
      `Checked out reviewed Dependabot PR ${pullRequest} at ${head}.`,
  },
  policy: {
    temporaryDirectoryPrefix: "pi-dependabot-review-",
    supersedeTemporaryDirectoryPrefix: "pi-supersede-dependabot-",
    mutationEligibility: openDependabot,
  },
};

export function listCandidates(cwd: string): Promise<ReviewCandidate[]> {
  return sharedListCandidates(dependabotGithubProvider, cwd);
}

export function fetchReviewDiff(candidate: ReviewCandidate): Promise<string> {
  if (!candidate.repository && !repositoryFromUrl(candidate.url))
    return Promise.reject(
      new Error("Dependabot pull request had no valid GitHub URL."),
    );
  return sharedFetchReviewDiff(
    dependabotGithubProvider,
    candidate,
    process.cwd(),
  );
}

export function fetchReviewDetails(
  candidate: ReviewCandidate,
): Promise<ReviewDetails> {
  if (!candidate.repository && !repositoryFromUrl(candidate.url))
    return Promise.reject(
      new Error("Dependabot pull request had no valid GitHub repository."),
    );
  return sharedFetchReviewDetails(
    dependabotGithubProvider,
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
    dependabotGithubProvider,
    cwd,
    sessionId,
    requestedPullRequest,
  );
}

export function prepareMutationTarget(candidate: ReviewCandidate, cwd: string) {
  if (!candidate.repository && !repositoryFromUrl(candidate.url))
    return Promise.reject(
      new Error("Dependabot pull request had no valid GitHub repository."),
    );
  return sharedPrepareMutationTarget(dependabotGithubProvider, candidate, cwd);
}

export function mergeReview(
  reviews: MutationTarget[],
  ctx: ExtensionContext,
  progress: MutationProgress = () => {},
) {
  return sharedMergeReview(dependabotGithubProvider, reviews, ctx, progress);
}

export function supersedeReview(
  reviews: MutationTarget[],
  ctx: ExtensionContext,
  progress: MutationProgress = () => {},
) {
  return sharedSupersedeReview(
    dependabotGithubProvider,
    reviews,
    ctx,
    progress,
  );
}

export function checkoutReview(
  reviews: MutationTarget[],
  ctx: ExtensionContext,
  progress: MutationProgress = () => {},
) {
  return sharedCheckoutReview(dependabotGithubProvider, reviews, ctx, progress);
}
