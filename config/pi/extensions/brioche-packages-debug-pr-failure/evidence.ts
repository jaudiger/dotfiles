import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
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

async function removeLimaDirectory(
  directory: string,
  cwd: string,
): Promise<void> {
  try {
    await run(
      "limactl",
      ["shell", "brioche-packages", "--", "rm", "-rf", "--", directory],
      cwd,
    );
  } catch {}
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
    // The diff is required evidence; unlike optional job logs, a failed
    // command must abort preparation rather than produce a misleading run.
    const pullRequestDiff = await run(
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
    let failedLog: string;
    try {
      failedLog = await run(
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
    } catch (error) {
      // Failed-job logs are optional diagnostics. Preserve the failure and
      // label the missing evidence instead of treating it as a report.
      failedLog = `Diagnostic: failed-job evidence unavailable (${error instanceof Error ? error.message : String(error)}).`;
    }
    await writeFile(join(directory, "failed-jobs.log"), failedLog);
    if (eventFiles.length > 0) {
      const limaDirectory = `/tmp/${basename(directory)}`;
      try {
        await run(
          "limactl",
          ["shell", "brioche-packages", "--", "mkdir", "-p", limaDirectory],
          cwd,
        );
        for (const [index, eventFile] of eventFiles.entries()) {
          const limaEventFile = join(
            limaDirectory,
            `${String(index).padStart(4, "0")}-events.bin.zst`,
          );
          await run(
            "limactl",
            ["copy", eventFile, `brioche-packages:${limaEventFile}`],
            cwd,
          );
          const output = await run(
            "limactl",
            [
              "shell",
              "brioche-packages",
              "--",
              "brioche",
              "jobs",
              "logs",
              limaEventFile,
            ],
            cwd,
          );
          await writeFile(`${eventFile}.log`, output);
        }
      } finally {
        await removeLimaDirectory(limaDirectory, cwd);
      }
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
