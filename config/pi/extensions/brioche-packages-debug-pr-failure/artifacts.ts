import { writeFile } from "node:fs/promises";
import { join } from "node:path";

export type CommandRunner = (
  command: string,
  args: string[],
  cwd: string,
) => Promise<string>;

export type RunEvidence = {
  eventFiles: string[];
  failedLog: string;
  processEventsAvailable: boolean;
  failedLogAvailable: boolean;
};

function isMissingArtifactsError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const stderr = (error as { stderr?: unknown }).stderr;
  return (
    typeof stderr === "string" &&
    stderr.toLowerCase().includes("no valid artifacts found to download")
  );
}

export async function collectRunEvidence(
  runId: string,
  cwd: string,
  directory: string,
  run: CommandRunner,
): Promise<RunEvidence> {
  let processEventsAvailable = true;
  try {
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
  } catch (error) {
    if (!isMissingArtifactsError(error)) throw error;
    processEventsAvailable = false;
  }

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
  let failedLogAvailable = true;
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
    failedLogAvailable = false;
    failedLog = `Diagnostic: failed-job evidence unavailable (${error instanceof Error ? error.message : String(error)}).`;
  }

  await writeFile(join(directory, "failed-jobs.log"), failedLog);
  await writeFile(
    join(directory, "process-events-status.txt"),
    processEventsAvailable
      ? "Process-event artifacts were downloaded.\n"
      : "Process-event artifacts were unavailable: gh run download reported 'no valid artifacts found to download'.\n",
  );
  return {
    eventFiles,
    failedLog,
    processEventsAvailable,
    failedLogAvailable,
  };
}
