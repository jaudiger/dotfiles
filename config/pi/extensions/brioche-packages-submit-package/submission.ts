import { execFile } from "node:child_process";
import {
  access,
  mkdtemp,
  readFile,
  realpath,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
type Json = Record<string, unknown>;

function asObject(value: unknown): Json {
  return value && typeof value === "object" ? (value as Json) : {};
}

const execFileAsync = promisify(execFile);
const limaMachine = "brioche-packages";
const maxBuffer = 100 * 1024 * 1024;

type CommandResult = {
  exitCode: number;
  output: string;
};

type ValidationStep = "check" | "format" | "build" | "test" | "liveUpdate";

const validationSteps: ValidationStep[] = [
  "check",
  "format",
  "build",
  "test",
  "liveUpdate",
];

type LogFile = {
  path: string;
  exitCode: number;
};

export type ResearchMetadata = {
  upstreamUrl: string;
  repologyUrl: string;
  description: string;
};

export type PreparedSubmission = {
  directory: string;
  packageName: string;
  projectPath: string;
  success: boolean;
  failureStep?: ValidationStep;
  logs: Record<string, LogFile>;
  summary: string;
};

type SubmissionState = {
  branch?: string;
  branchCreated: boolean;
  commitCreated: boolean;
  pushSucceeded: boolean;
  pullRequestCreated: boolean;
};

export class SubmissionError extends Error {
  readonly state: SubmissionState;

  constructor(message: string, state: SubmissionState) {
    super(message);
    this.name = "SubmissionError";
    this.state = state;
  }
}

function commandOutput(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function commandExitCode(value: unknown): number {
  return typeof value === "number" ? value : 1;
}

async function runCaptured(
  args: string[],
  cwd: string,
  logPath: string,
): Promise<CommandResult> {
  try {
    const result = await execFileAsync("limactl", args, {
      cwd,
      maxBuffer,
    });
    const output = `${commandOutput(result.stdout)}${commandOutput(result.stderr)}`;
    await writeFile(logPath, output);
    return { exitCode: 0, output };
  } catch (error) {
    const result = asObject(error);
    const output = `${commandOutput(result.stdout)}${commandOutput(result.stderr)}`;
    await writeFile(logPath, output);
    return { exitCode: commandExitCode(result.code), output };
  }
}

function limaBash(script: string, packageName: string): string[] {
  return [
    "shell",
    limaMachine,
    "--",
    "bash",
    "-o",
    "pipefail",
    "-c",
    script,
    "brioche-packages-submit",
    packageName,
  ];
}

function validationCommand(command: string, logName: string): string {
  return `${command} "./packages/$1" 2>&1 | tee "/tmp/$1-${logName}.log"`;
}

async function writeMetadata(directory: string, metadata: Json): Promise<void> {
  await writeFile(
    join(directory, "metadata.json"),
    `${JSON.stringify(metadata, null, 2)}\n`,
  );
}

function logPath(directory: string, name: string): string {
  return join(directory, `${name}.log`);
}

function logRecord(
  directory: string,
  name: string,
  result: CommandResult,
): LogFile {
  return { path: logPath(directory, name), exitCode: result.exitCode };
}

function logMapJson(logs: Record<string, LogFile>): Json {
  return Object.fromEntries(
    Object.entries(logs).map(([name, log]) => [name, log]),
  );
}

async function runCheckAndFormat(
  packageName: string,
  cwd: string,
  directory: string,
  logs: Record<string, LogFile>,
): Promise<ValidationStep | undefined> {
  const check = await runCaptured(
    limaBash(validationCommand("brioche check", "check"), packageName),
    cwd,
    logPath(directory, "check"),
  );
  logs.check = logRecord(directory, "check", check);
  if (check.exitCode !== 0) return "check";

  const format = await runCaptured(
    limaBash(validationCommand("brioche fmt", "format"), packageName),
    cwd,
    logPath(directory, "format"),
  );
  logs.format = logRecord(directory, "format", format);
  if (format.exitCode !== 0) return "format";
  return undefined;
}

async function runTestAndLiveUpdate(
  packageName: string,
  cwd: string,
  directory: string,
  logs: Record<string, LogFile>,
): Promise<ValidationStep | undefined> {
  const test = await runCaptured(
    limaBash(
      validationCommand("brioche build", "test").replace(
        '"./packages/$1"',
        '"./packages/$1^test"',
      ),
      packageName,
    ),
    cwd,
    logPath(directory, "test"),
  );
  logs.test = logRecord(directory, "test", test);
  if (test.exitCode !== 0) return "test";

  const liveUpdate = await runCaptured(
    limaBash(
      validationCommand("brioche run", "liveupdate").replace(
        '"./packages/$1"',
        '"./packages/$1^liveUpdate"',
      ),
      packageName,
    ),
    cwd,
    logPath(directory, "liveupdate"),
  );
  logs.liveUpdate = logRecord(directory, "liveupdate", liveUpdate);
  if (liveUpdate.exitCode !== 0) return "liveUpdate";

  return undefined;
}

async function runValidation(
  packageName: string,
  cwd: string,
  directory: string,
  logs: Record<string, LogFile>,
): Promise<ValidationStep | undefined> {
  const checkOrFormatFailure = await runCheckAndFormat(
    packageName,
    cwd,
    directory,
    logs,
  );
  if (checkOrFormatFailure) return checkOrFormatFailure;

  const build = await runCaptured(
    limaBash(validationCommand("brioche build", "build"), packageName),
    cwd,
    logPath(directory, "build"),
  );
  logs.build = logRecord(directory, "build", build);
  if (build.exitCode !== 0) return "build";

  return runTestAndLiveUpdate(packageName, cwd, directory, logs);
}

function validationSummary(failureStep: ValidationStep | undefined): string {
  if (!failureStep)
    return "Check, format, build, test, and live-update passed.";
  return `Preflight stopped after ${failureStep} failed.`;
}

export async function prepareSubmission(
  packageName: string,
  cwd: string,
): Promise<PreparedSubmission> {
  const projectPath = join(cwd, "packages", packageName, "project.bri");
  try {
    await access(projectPath);
  } catch {
    throw new Error(`Package does not exist: ${projectPath}`);
  }

  const directory = await mkdtemp(join(tmpdir(), "brioche-packages-submit-"));
  const logs: Record<string, LogFile> = {};

  try {
    const failureStep = await runValidation(packageName, cwd, directory, logs);
    const success = !failureStep;
    await writeMetadata(directory, {
      package: packageName,
      projectPath,
      success,
      ...(failureStep ? { failureStep } : {}),
      logs: logMapJson(logs),
    });

    return {
      directory,
      packageName,
      projectPath,
      success,
      ...(failureStep ? { failureStep } : {}),
      logs,
      summary: validationSummary(failureStep),
    };
  } catch (error) {
    await rm(directory, { recursive: true, force: true });
    throw error;
  }
}

export function packageArgument(value: string): string | undefined {
  const packageName = value.trim();
  if (
    !packageName ||
    packageName === "." ||
    packageName === ".." ||
    !/^[A-Za-z0-9][A-Za-z0-9._+-]*$/.test(packageName)
  ) {
    return undefined;
  }
  return packageName;
}

export function evidenceLogPaths(prepared: PreparedSubmission): string[] {
  return Object.values(prepared.logs).map((log) => log.path);
}

export async function tailLog(
  logPathValue: string,
  maxChars = 4000,
): Promise<string> {
  const content = await readFile(logPathValue, "utf8");
  return content.length > maxChars ? content.slice(-maxChars) : content;
}

export async function removeSubmissionDirectory(
  directory: string,
): Promise<boolean> {
  try {
    await rm(directory, { recursive: true, force: true });
    return true;
  } catch {
    return false;
  }
}

export function failureOutput(prepared: PreparedSubmission): Promise<string> {
  if (!prepared.failureStep) return Promise.resolve("");
  const log = prepared.logs[prepared.failureStep];
  if (!log) return Promise.resolve("");
  return tailLog(log.path);
}

function commandError(command: string, error: unknown): Error {
  const result = asObject(error);
  const output =
    `${commandOutput(result.stdout)}${commandOutput(result.stderr)}`.trim();
  const detail = output ? `: ${output.slice(-2000)}` : "";
  return new Error(`${command} failed${detail}`);
}

async function runCommand(
  command: string,
  args: string[],
  cwd: string,
  signal?: AbortSignal,
): Promise<string> {
  if (signal?.aborted) throw new Error("Package submission was cancelled.");
  try {
    const result = await execFileAsync(command, args, {
      cwd,
      maxBuffer,
      signal,
    });
    return commandOutput(result.stdout);
  } catch (error) {
    throw commandError(`${command} ${args.join(" ")}`, error);
  }
}

export function validateResearchMetadata(value: unknown): ResearchMetadata {
  const object = asObject(value);
  const keys = Object.keys(object).sort((left, right) =>
    left.localeCompare(right),
  );
  if (
    keys.length !== 3 ||
    keys.some(
      (key, index) =>
        key !== ["description", "repologyUrl", "upstreamUrl"][index],
    )
  ) {
    throw new Error(
      "Researcher metadata must contain only upstreamUrl, repologyUrl, and description.",
    );
  }

  const upstreamUrl = object.upstreamUrl;
  const repologyUrl = object.repologyUrl;
  const description = object.description;
  if (
    typeof upstreamUrl !== "string" ||
    typeof repologyUrl !== "string" ||
    typeof description !== "string"
  ) {
    throw new Error("Researcher metadata fields must all be strings.");
  }
  if (!isHttpsUrl(upstreamUrl))
    throw new Error("Researcher returned an invalid upstream URL.");
  if (!isHttpsUrl(repologyUrl))
    throw new Error("Researcher returned an invalid Repology URL.");
  let repology: URL;
  try {
    repology = new URL(repologyUrl);
  } catch {
    throw new Error("Researcher returned an invalid Repology URL.");
  }
  if (
    !["repology.org", "www.repology.org"].includes(repology.hostname) ||
    !repology.pathname.startsWith("/project/")
  ) {
    throw new Error(
      "Researcher returned a URL outside the Repology project page.",
    );
  }
  if (
    !description.trim() ||
    description.length > 500 ||
    /[\u0000-\u001f\u007f]/.test(description)
  ) {
    throw new Error("Researcher returned an invalid package description.");
  }
  return { upstreamUrl, repologyUrl, description: description.trim() };
}

function isHttpsUrl(value: string): boolean {
  if (value.length > 2048 || /[\u0000-\u0020]/.test(value)) return false;
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      Boolean(url.hostname) &&
      !url.username &&
      !url.password
    );
  } catch {
    return false;
  }
}

function statusPaths(status: string): string[] {
  const paths: string[] = [];
  const records = status.split("\0");
  for (let index = 0; index < records.length; index += 1) {
    const record = records[index];
    if (!record) continue;
    const path = record.slice(3);
    if (path) paths.push(path);
    if (
      record[0] === "R" ||
      record[0] === "C" ||
      record[1] === "R" ||
      record[1] === "C"
    ) {
      const previousPath = records[index + 1];
      if (previousPath) paths.push(previousPath);
      index += 1;
    }
  }
  return paths;
}

function packageOnly(paths: string[], packagePath: string): boolean {
  return paths.every(
    (path) => path === packagePath || path.startsWith(`${packagePath}/`),
  );
}

function githubRepository(remote: string): string | undefined {
  const value = remote.trim();
  let owner: string;
  let name: string;
  if (value.startsWith("git@github.com:")) {
    const path = value.slice("git@github.com:".length).split("/");
    if (path.length !== 2) return undefined;
    [owner, name] = path;
  } else {
    let url: URL;
    try {
      url = new URL(value);
    } catch {
      return undefined;
    }
    if (
      url.protocol !== "https:" ||
      url.hostname.toLowerCase() !== "github.com" ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    )
      return undefined;
    const path = url.pathname.replace(/^\//, "").split("/");
    if (path.length !== 2) return undefined;
    [owner, name] = path;
  }
  if (!owner || !name) return undefined;
  name = name.replace(/\.git$/, "");
  if (!/^[A-Za-z0-9_.-]+$/.test(owner) || !/^[A-Za-z0-9_.-]+$/.test(name))
    return undefined;
  return `${owner}/${name}`;
}

async function verifyRepository(
  cwd: string,
  packagePath: string,
  signal: AbortSignal,
): Promise<{ base: string; repository: string; branch: string }> {
  const command = (name: string, args: string[]) =>
    runCommand(name, args, cwd, signal);
  const repositoryRoot = await realpath(
    (await command("git", ["rev-parse", "--show-toplevel"])).trim(),
  );
  if (repositoryRoot !== (await realpath(cwd)))
    throw new Error("Package submission must run from the repository root.");
  const status = await command("git", [
    "status",
    "--porcelain=v1",
    "--null",
    "--untracked-files=all",
  ]);
  const changedPaths = statusPaths(status).filter(
    (path, index, paths) => paths.indexOf(path) === index,
  );
  if (!packageOnly(changedPaths, packagePath))
    throw new Error(
      `Repository has changes outside ${packagePath}: ${changedPaths
        .filter((path) => !packageOnly([path], packagePath))
        .join(", ")}`,
    );
  const branch = (await command("git", ["branch", "--show-current"])).trim();
  if (!branch) throw new Error("Repository is in detached HEAD state.");
  const remote = (await command("git", ["remote", "get-url", "origin"])).trim();
  const pushRemote = (
    await command("git", ["remote", "get-url", "--push", "origin"])
  ).trim();
  const repository = githubRepository(remote);
  if (!repository || githubRepository(pushRemote) !== repository)
    throw new Error(
      "Origin fetch and push URLs must target the same GitHub repository.",
    );
  try {
    await command("git", ["rev-parse", "--verify", "refs/remotes/origin/main"]);
  } catch {
    throw new Error("Repository origin has no main branch.");
  }
  try {
    await command("git", ["show-ref", "--verify", "refs/heads/main"]);
  } catch {
    throw new Error("Repository has no local main branch.");
  }
  return { base: "main", repository, branch };
}

function branchName(packageName: string): string {
  return `add-${packageName}`;
}

async function gitRef(
  cwd: string,
  ref: string,
  signal: AbortSignal,
): Promise<string | undefined> {
  try {
    return (
      await runCommand("git", ["rev-parse", "--verify", ref], cwd, signal)
    ).trim();
  } catch {
    return undefined;
  }
}

async function packageChanges(
  cwd: string,
  packagePath: string,
  signal: AbortSignal,
): Promise<boolean> {
  try {
    await runCommand(
      "git",
      ["diff", "--quiet", "main", "--", packagePath],
      cwd,
      signal,
    );
    return false;
  } catch {
    return true;
  }
}

async function startFromMain(
  cwd: string,
  packagePath: string,
  originalBranch: string,
  signal: AbortSignal,
): Promise<void> {
  const command = (name: string, args: string[]) =>
    runCommand(name, args, cwd, signal);
  await command("git", ["fetch", "origin", "main"]);
  try {
    await runCommand(
      "git",
      [
        "merge-base",
        "--is-ancestor",
        "refs/heads/main",
        "refs/remotes/origin/main",
      ],
      cwd,
      signal,
    );
  } catch {
    throw new Error("Local main is not at or behind origin/main.");
  }

  const status = await runCommand(
    "git",
    ["status", "--porcelain=v1", "--null", "--untracked-files=all"],
    cwd,
    signal,
  );
  const hasPackageChanges = statusPaths(status).some(
    (path) => path === packagePath || path.startsWith(`${packagePath}/`),
  );
  const stashBefore = await gitRef(cwd, "refs/stash", signal);
  await command("git", [
    "stash",
    "push",
    "--include-untracked",
    "--message",
    "brioche package submission",
    "--",
    packagePath,
  ]);
  const stashAfter = await gitRef(cwd, "refs/stash", signal);
  const stashed = stashBefore !== stashAfter;
  if (hasPackageChanges && !stashed)
    throw new Error("Could not safely stash uncommitted package changes.");
  if (
    originalBranch !== "main" &&
    !hasPackageChanges &&
    (await packageChanges(cwd, packagePath, signal))
  )
    throw new Error(
      "Current branch has committed package changes; start submission from main.",
    );

  await command("git", ["switch", "main"]);
  await command("git", ["merge", "--ff-only", "refs/remotes/origin/main"]);
  const mainRevision = (
    await command("git", ["rev-parse", "refs/heads/main"])
  ).trim();
  const originMainRevision = (
    await command("git", ["rev-parse", "refs/remotes/origin/main"])
  ).trim();
  if (mainRevision !== originMainRevision)
    throw new Error("Local main did not fast-forward to origin/main.");
  if (stashed) {
    try {
      await command("git", ["stash", "pop", "--index"]);
    } catch {
      throw new Error(
        "Could not restore the package changes after updating main. The changes remain in git stash, and the repository is on main.",
      );
    }
  }
}

async function ensureBranchAvailable(
  branch: string,
  cwd: string,
  signal: AbortSignal,
): Promise<void> {
  const command = (name: string, args: string[]) =>
    runCommand(name, args, cwd, signal);
  try {
    await command("git", ["show-ref", "--verify", `refs/heads/${branch}`]);
    throw new Error(`Package branch already exists: ${branch}`);
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Package branch"))
      throw error;
  }
  try {
    await command("git", [
      "ls-remote",
      "--exit-code",
      "--heads",
      "origin",
      branch,
    ]);
    throw new Error(`Remote package branch already exists: ${branch}`);
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.startsWith("Remote package branch")
    )
      throw error;
  }
}

async function validationBody(prepared: PreparedSubmission): Promise<string> {
  const sections: string[] = [];
  for (const step of validationSteps) {
    const log = prepared.logs[step];
    if (!log) continue;
    const output = await tailLog(log.path, 1200).catch(() => "");
    if (step === "test") {
      sections.push(
        "1. Run the **test** scenario:",
        "",
        "<details><summary>Test output (click to expand)</summary>",
        "<p>",
        "",
        "```",
        output,
        "```",
        "",
        "</p>",
        "</details>",
        "",
      );
      continue;
    }
    if (step === "liveUpdate") {
      sections.push(
        "2. Run the **live-update** scenario:",
        "",
        "<details><summary>Live-update output (click to expand)</summary>",
        "<p>",
        "",
        "```",
        output,
        "```",
        "",
        "</p>",
        "</details>",
      );
      continue;
    }
    sections.push(
      `### ${step} output (exit ${log.exitCode})`,
      `Evidence: \`${log.path}\``,
      "<details><summary>Output</summary>",
      "<p>",
      "",
      "```",
      output,
      "```",
      "",
      "</p>",
      "</details>",
      "",
    );
  }
  return sections.join("\n");
}

export async function submitPreparedPackage(
  prepared: PreparedSubmission,
  metadata: ResearchMetadata,
  cwd: string,
  signal: AbortSignal,
): Promise<{ branch: string; pullRequest: string }> {
  if (!prepared.success)
    throw new Error("Cannot submit a package with a failed preflight.");
  const state: SubmissionState = {
    branchCreated: false,
    commitCreated: false,
    pushSucceeded: false,
    pullRequestCreated: false,
  };
  try {
    const packagePath = `packages/${prepared.packageName}`;
    const repository = await verifyRepository(cwd, packagePath, signal);
    const branch = branchName(prepared.packageName);
    await startFromMain(cwd, packagePath, repository.branch, signal);
    await ensureBranchAvailable(branch, cwd, signal);
    await runCommand("git", ["switch", "-c", branch], cwd, signal);
    state.branch = branch;
    state.branchCreated = true;
    await runCommand("git", ["add", "--", packagePath], cwd, signal);
    const staged = (
      await runCommand(
        "git",
        [
          "diff",
          "--cached",
          "--name-only",
          "-z",
          "--find-renames",
          "--find-copies",
        ],
        cwd,
        signal,
      )
    )
      .split("\0")
      .filter(Boolean);
    if (!staged.length || !packageOnly(staged, packagePath))
      throw new Error(
        "Package staging contained paths outside the package directory or no package paths.",
      );
    await runCommand(
      "git",
      ["commit", "-m", `feat(${prepared.packageName}): add package`],
      cwd,
      signal,
    );
    state.commitCreated = true;
    await runCommand(
      "git",
      ["push", "--set-upstream", "origin", branch],
      cwd,
      signal,
    );
    state.pushSucceeded = true;

    const body = [
      "# Add a new Brioche recipe",
      "",
      "## Summary",
      "",
      "This Pull Request adds a new recipe to the registry.",
      "",
      `- **Recipe name:** \`${prepared.packageName}\``,
      `- **Website / repository:** ${metadata.upstreamUrl}`,
      `- **Repology URL:** ${metadata.repologyUrl}`,
      `- **Short description:** ${metadata.description}`,
      "",
      "## Related issue(s) or discussion(s)",
      "",
      "None.",
      "",
      "## Checklist (required)",
      "",
      "- [x] `liveUpdate()` method added.",
      "- [x] `test()` method added.",
      "",
      "## How I tested this locally (required)",
      "",
      await validationBody(prepared),
      "",
      "## Implementation notes / special instructions",
      "",
      "None.",
    ].join("\n");
    const bodyPath = join(prepared.directory, "pull-request-body.md");
    await writeFile(bodyPath, body, { mode: 0o600 });
    const output = (
      await runCommand(
        "gh",
        [
          "pr",
          "create",
          "--repo",
          repository.repository,
          "--base",
          repository.base,
          "--head",
          branch,
          "--title",
          `feat(${prepared.packageName}): add package`,
          "--body-file",
          bodyPath,
        ],
        cwd,
        signal,
      )
    ).trim();
    state.pullRequestCreated = true;
    const pullRequest = output || "creation succeeded but no URL was returned";
    return { branch, pullRequest };
  } catch (error) {
    if (error instanceof SubmissionError) throw error;
    const message = error instanceof Error ? error.message : String(error);
    throw new SubmissionError(message, state);
  }
}
