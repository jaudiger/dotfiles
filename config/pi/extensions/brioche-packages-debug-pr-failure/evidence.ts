import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { asObject, packageFromFiles, text, workflowRunId } from "./parsing.js";
import type { PreparedContext } from "./types.js";

const execFileAsync = promisify(execFile);

const graphqlQuery = `query DebugPR($owner: String!, $repo: String!, $number: Int!) {
  repository(owner: $owner, name: $repo) {
    pullRequest(number: $number) {
      number title body headRefName url
      files(first: 100) { nodes { path additions deletions } }
      timelineItems(last: 1, itemTypes: [REMOVED_FROM_MERGE_QUEUE_EVENT]) {
        nodes { ... on RemovedFromMergeQueueEvent {
          createdAt reason
          beforeCommit { checkSuites(last: 1) { nodes { workflowRun { url } } } }
        } }
      }
    }
  }
}`;

async function run(
  command: string,
  args: string[],
  cwd: string,
): Promise<string> {
  const result = await execFileAsync(command, args, {
    cwd,
    maxBuffer: 20 * 1024 * 1024,
  });
  return result.stdout;
}

async function capture(
  command: string,
  args: string[],
  cwd: string,
): Promise<string> {
  try {
    return await run(command, args, cwd);
  } catch (error) {
    const result = asObject(error);
    const output = `${text(result.stdout)}${text(result.stderr)}`;
    if (output) return output;
    throw error;
  }
}

export async function removeDirectory(directory: string): Promise<boolean> {
  try {
    await rm(directory, { recursive: true, force: true });
    return true;
  } catch {
    return false;
  }
}

async function ghJson(args: string[], cwd: string): Promise<unknown> {
  const output = await run("gh", args, cwd);
  try {
    return JSON.parse(output) as unknown;
  } catch {
    throw new Error(
      `GitHub command returned invalid JSON: ${output.slice(0, 200)}`,
    );
  }
}

export async function prepareContext(
  pr: string,
  cwd: string,
): Promise<PreparedContext> {
  const directory = await mkdtemp(join(tmpdir(), "brioche-debug-pr-failure-"));
  try {
    const queryResult = await ghJson(
      [
        "api",
        "graphql",
        "-f",
        `query=${graphqlQuery}`,
        "-F",
        "owner=brioche-dev",
        "-F",
        "repo=brioche-packages",
        "-F",
        `number=${pr}`,
      ],
      cwd,
    );
    const pullRequest = asObject(asObject(queryResult.data).repository);
    const details = asObject(pullRequest.pullRequest);
    const timeline = asObject(details.timelineItems).nodes;
    const removal = asObject(Array.isArray(timeline) ? timeline[0] : undefined);
    const suites = asObject(asObject(removal.beforeCommit).checkSuites);
    const suiteNodes = Array.isArray(suites.nodes) ? suites.nodes : [];
    const workflowUrl = text(
      asObject(suiteNodes[0]).workflowRun &&
        asObject(asObject(suiteNodes[0]).workflowRun).url,
    );
    const runId = workflowRunId(workflowUrl);
    if (!runId)
      throw new Error(
        "No merge queue workflow run was found for this pull request.",
      );

    const files = Array.isArray(asObject(details.files).nodes)
      ? (asObject(details.files).nodes as unknown[])
      : [];
    const packageName = packageFromFiles(files) || "unknown";
    const metadata = {
      pullRequest: details,
      package: packageName,
      workflowRun: { id: runId, url: workflowUrl },
    };
    await writeFile(
      join(directory, "metadata.json"),
      `${JSON.stringify(metadata, null, 2)}\n`,
    );
    const pullRequestDiff = await capture(
      "gh",
      ["pr", "diff", pr, "--repo", "brioche-dev/brioche-packages"],
      cwd,
    );
    await writeFile(join(directory, "pr.diff"), pullRequestDiff);
    await run(
      "gh",
      [
        "run",
        "download",
        runId,
        "--repo",
        "brioche-dev/brioche-packages",
        "--pattern",
        "process-events-*",
        "--dir",
        directory,
      ],
      cwd,
    );

    const eventFileListing = await run(
      "find",
      [directory, "-type", "f", "-name", "events.bin.zst"],
      cwd,
    );
    const eventFiles = eventFileListing
      .split("\n")
      .map((path) => path.trim())
      .filter(Boolean);
    const failedLog = await capture(
      "gh",
      [
        "run",
        "view",
        runId,
        "--repo",
        "brioche-dev/brioche-packages",
        "--log-failed",
      ],
      cwd,
    );
    await writeFile(join(directory, "failed-jobs.log"), failedLog);
    for (const eventFile of eventFiles) {
      const output = await run(
        "limactl",
        [
          "shell",
          "brioche-packages",
          "--",
          "bash",
          "-c",
          `brioche jobs logs "$1"`,
          "brioche-jobs-logs",
          eventFile,
        ],
        cwd,
      );
      await writeFile(`${eventFile}.log`, output);
    }
    const listing = await run("find", [directory, "-type", "f"], cwd);
    await writeFile(join(directory, "manifest.txt"), listing);
    return {
      directory,
      metadata,
      summary: `event files=${eventFiles.length}, failed log=${Buffer.byteLength(failedLog)} bytes`,
    };
  } catch (error) {
    await rm(directory, { recursive: true, force: true });
    throw error;
  }
}
