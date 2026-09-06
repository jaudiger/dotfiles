import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { NixpkgsContext } from "./context.js";
import type { ResearchResult } from "./research.js";

const execFileAsync = promisify(execFile);
const maxBuffer = 20 * 1024 * 1024;

export type PublicationResult = {
  success: boolean;
  branch?: string;
  commits: string[];
  pullRequest?: string;
  assignee?: string;
  reviewOutput?: string;
  error?: string;
};

async function command(
  name: string,
  args: string[],
  cwd: string,
  signal?: AbortSignal,
): Promise<string> {
  try {
    const result = await execFileAsync(name, args, {
      cwd,
      maxBuffer,
      ...(signal ? { signal } : {}),
    });
    return String(result.stdout ?? "");
  } catch (error) {
    const value = error as {
      stdout?: unknown;
      stderr?: unknown;
      message?: unknown;
    };
    const output =
      `${String(value.stdout ?? "")}${String(value.stderr ?? "")}`.trim();
    throw new Error(output || String(value.message ?? `${name} failed`));
  }
}

function branchName(packages: string[]): string {
  const suffix = packages.join("-").replace(/[^A-Za-z0-9._-]+/g, "-");
  return `update-${suffix}`.slice(0, eightyChars);
}

const eightyChars = 80;

function packageForPath(path: string, packages: string[]): string {
  return packages.find((name) => path.split("/").includes(name)) ?? packages[0];
}

function githubRepository(remote: string): string | undefined {
  if (remote.startsWith("git@github.com:")) {
    const value = remote.slice("git@github.com:".length).replace(/\.git$/, "");
    return /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(value) ? value : undefined;
  }
  try {
    const url = new URL(remote);
    if (
      url.protocol !== "https:" ||
      url.hostname.toLowerCase() !== "github.com" ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    )
      return undefined;
    const value = url.pathname.replace(/^\//, "").replace(/\.git$/, "");
    return /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(value) ? value : undefined;
  } catch {
    return undefined;
  }
}

async function nixpkgsPullRequestTemplate(
  repository: string,
  signal?: AbortSignal,
): Promise<string> {
  const encoded = await command(
    "gh",
    [
      "api",
      "repos/NixOS/nixpkgs/contents/.github/PULL_REQUEST_TEMPLATE.md",
      "--jq",
      ".content",
    ],
    repository,
    signal,
  );
  const template = Buffer.from(encoded.replace(/\s/g, ""), "base64").toString(
    "utf8",
  );
  if (!template.trim())
    throw new Error("The Nixpkgs pull request template is empty.");
  return template;
}

async function refExists(
  name: string,
  args: string[],
  cwd: string,
  signal?: AbortSignal,
): Promise<boolean> {
  try {
    await command(name, args, cwd, signal);
    return true;
  } catch {
    return false;
  }
}

function pullRequestBody(
  packages: string[],
  research: ResearchResult,
  template: string,
  reviewPosted = false,
): string {
  const summary = [
    `Update ${packages.join(", ")} to their latest stable upstream releases.`,
    "",
    ...research.packages.flatMap((item) => [
      `${item.name}: ${item.currentVersion} to ${item.latestVersion}`,
      `Release: ${item.releaseUrl}`,
      `Changelog: ${item.changelogUrl}`,
      `Dependencies: ${item.dependencyNotes}`,
    ]),
  ].join("\n");
  const summarizedTemplate = template.replace(
    /^<!--[\s\S]*?-->/,
    `${summary}\n`,
  );
  if (summarizedTemplate === template)
    throw new Error(
      "The official Nixpkgs pull request template is unexpected.",
    );
  return reviewPosted
    ? summarizedTemplate.replace(
        /- \[ \] Ran `nixpkgs-review` on this PR\./,
        "- [x] Ran `nixpkgs-review` on this PR.",
      )
    : summarizedTemplate;
}

export async function publishUpdate(
  repository: string,
  packages: string[],
  context: NixpkgsContext,
  research: ResearchResult | undefined,
  signal: AbortSignal | undefined,
): Promise<PublicationResult> {
  const result: PublicationResult = { success: false, commits: [] };
  if (!research) {
    result.error = "Research must complete before publication.";
    return result;
  }

  let bodyDirectory: string | undefined;
  try {
    const currentBranch = (
      await command("git", ["branch", "--show-current"], repository, signal)
    ).trim();
    const currentHead = (
      await command("git", ["rev-parse", "HEAD"], repository, signal)
    ).trim();
    if (currentHead !== context.head)
      throw new Error(
        "Nixpkgs HEAD changed after the update started. Review the changes before publishing.",
      );
    if (currentBranch !== context.branch)
      throw new Error(
        `The Nixpkgs branch changed from ${context.branch} to ${currentBranch}.`,
      );
    if (currentBranch !== "master")
      throw new Error("Nixpkgs publication must start from the master branch.");

    const status = await command(
      "git",
      ["status", "--porcelain=v1", "--untracked-files=all"],
      repository,
      signal,
    );
    if (status.split("\n").some((line) => line.startsWith("?? ")))
      throw new Error("Untracked files are present in the Nixpkgs repository.");
    const changed = (
      await command(
        "git",
        ["diff", "--name-only", context.head],
        repository,
        signal,
      )
    )
      .split("\n")
      .filter(Boolean);
    if (changed.length === 0)
      throw new Error("No recipe changes are available to publish.");
    if (
      changed.some(
        (path) => !path.endsWith(".nix") || !context.recipePaths.includes(path),
      )
    )
      throw new Error(
        "The working tree contains changes outside the resolved target recipes.",
      );

    const owner = (
      await command("gh", ["api", "user", "--jq", ".login"], repository, signal)
    ).trim();
    if (!owner)
      throw new Error("Could not determine the authenticated GitHub user.");
    const originFetch = await command(
      "git",
      ["remote", "get-url", "origin"],
      repository,
      signal,
    );
    const originPush = await command(
      "git",
      ["remote", "get-url", "--push", "origin"],
      repository,
      signal,
    );
    if (
      githubRepository(originFetch.trim()) !== `${owner}/nixpkgs` ||
      githubRepository(originPush.trim()) !== `${owner}/nixpkgs`
    )
      throw new Error(
        "Origin fetch and push URLs must target the user's nixpkgs fork.",
      );
    const template = await nixpkgsPullRequestTemplate(repository, signal);
    const branch = branchName(packages);
    if (
      (await refExists(
        "git",
        ["show-ref", "--verify", `refs/heads/${branch}`],
        repository,
        signal,
      )) ||
      (await refExists(
        "git",
        ["ls-remote", "--exit-code", "--heads", "origin", branch],
        repository,
        signal,
      ))
    )
      throw new Error(`The update branch already exists: ${branch}.`);
    await command("git", ["switch", "-c", branch], repository, signal);
    result.branch = branch;

    for (const path of changed) {
      const packageName = packageForPath(path, packages);
      const metadata = research.packages.find(
        (item) => item.name === packageName,
      );
      const subject = metadata
        ? `${packageName}: ${metadata.currentVersion} -> ${metadata.latestVersion}`
        : `${packageName}: update`;
      await command("git", ["add", "--", path], repository, signal);
      const commit = await command(
        "git",
        ["commit", "-S", "-s", "-m", subject],
        repository,
        signal,
      );
      const hash = await command(
        "git",
        ["rev-parse", "HEAD"],
        repository,
        signal,
      );
      result.commits.push(`${hash.trim()} ${subject}`);
      if (!commit.trim() && !hash.trim())
        throw new Error("Git did not create a commit.");
    }

    await command(
      "git",
      ["push", "--set-upstream", "origin", branch],
      repository,
      signal,
    );

    bodyDirectory = await mkdtemp(join(tmpdir(), "nixpkgs-update-package-"));
    const bodyPath = join(bodyDirectory, "pull-request-body.md");
    await writeFile(bodyPath, pullRequestBody(packages, research, template), {
      mode: 0o600,
    });
    const pullRequest = (
      await command(
        "gh",
        [
          "pr",
          "create",
          "--repo",
          "NixOS/nixpkgs",
          "--base",
          "master",
          "--head",
          `${owner}:${branch}`,
          "--draft",
          "--title",
          result.commits[0]?.replace(/^[^ ]+ /, "") ??
            `nixpkgs: update ${packages.join(", ")}`,
          "--body-file",
          bodyPath,
        ],
        repository,
        signal,
      )
    ).trim();
    result.pullRequest = pullRequest;

    await command(
      "gh",
      ["pr", "edit", pullRequest, "--add-assignee", owner],
      repository,
      signal,
    );
    result.assignee = owner;

    const number = pullRequest.match(/\/pull\/(\d+)(?:\D|$)/)?.[1];
    if (!number)
      throw new Error(
        `Could not determine the pull request number from ${pullRequest}.`,
      );
    try {
      result.reviewOutput = (
        await command(
          "nixpkgs-review",
          ["pr", number, "--post-result"],
          repository,
          signal,
        )
      ).trim();
    } catch (error) {
      const githubFailure =
        error instanceof Error ? error.message : String(error);
      const system = (
        await command(
          "nix",
          ["eval", "--raw", "--impure", "--expr", "builtins.currentSystem"],
          repository,
          signal,
        )
      ).trim();
      const localOutput = await command(
        "nixpkgs-review",
        ["pr", number, "--eval", "local", "--system", system, "--post-result"],
        repository,
        signal,
      );
      result.reviewOutput = [
        `GitHub evaluation failed: ${githubFailure}`,
        `Local evaluation on ${system}:`,
        localOutput.trim(),
      ].join("\n");
    }
    await writeFile(
      bodyPath,
      pullRequestBody(packages, research, template, true),
      { mode: 0o600 },
    );
    await command(
      "gh",
      ["pr", "edit", pullRequest, "--body-file", bodyPath],
      repository,
      signal,
    );
    result.success = true;
    return result;
  } catch (error) {
    result.error = error instanceof Error ? error.message : String(error);
    return result;
  } finally {
    if (bodyDirectory)
      await rm(bodyDirectory, { recursive: true, force: true });
  }
}
