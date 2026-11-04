import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  piExecFailure,
  piExecSucceeded,
  type PiExec,
  type PiExecResult,
} from "../pi-exec.js";

export type SubagentResult = {
  content: { type: "text"; text: string }[];
  details: {
    agent: string;
    exitCode?: number | null;
    killed?: boolean;
    truncated?: boolean;
    taskFilePath?: string;
    cleanupError?: string;
  };
  isError?: boolean;
};

function resultDetails(agent: string, result?: PiExecResult) {
  return {
    agent,
    ...(result
      ? {
          exitCode: result.code,
          killed: result.killed,
          truncated: result.truncated,
        }
      : {}),
  };
}

function canceled(agent: string, result?: PiExecResult): SubagentResult {
  return {
    content: [{ type: "text", text: `Subagent ${agent} was canceled.` }],
    details: resultDetails(agent, result),
    isError: true,
  };
}

function bounded(value: string): string {
  const text = value.trim();
  return text.length > 2000 ? text.slice(-2000) : text;
}

function diagnostics(result: PiExecResult): string {
  return [
    result.stderr.trim() ? `stderr: ${bounded(result.stderr)}` : "",
    result.stdout.trim() ? `stdout: ${bounded(result.stdout)}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

function failed(agent: string, result: PiExecResult): SubagentResult {
  const reason = piExecFailure("Pi subagent", {
    ...result,
    stdout: "",
    stderr: "",
  });
  const detail = diagnostics(result);
  return {
    content: [
      {
        type: "text",
        text: `Subagent ${agent}: ${reason}${detail ? `\n${detail}` : ""}`,
      },
    ],
    details: resultDetails(agent, result),
    isError: true,
  };
}

function emptyResult(agent: string, result: PiExecResult): SubagentResult {
  const detail = result.stderr.trim()
    ? `\nstderr: ${bounded(result.stderr)}`
    : "";
  return {
    content: [
      {
        type: "text",
        text: `Subagent ${agent} failed: Pi returned an empty result.${detail}`,
      },
    ],
    details: resultDetails(agent, result),
    isError: true,
  };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function withCleanupFailure(
  result: SubagentResult,
  taskPath: string,
  error: unknown,
): SubagentResult {
  return {
    ...result,
    content: [
      ...result.content,
      {
        type: "text",
        text: `Task file remains at ${taskPath} because cleanup failed.`,
      },
    ],
    details: {
      ...result.details,
      taskFilePath: taskPath,
      cleanupError: errorMessage(error),
    },
    isError: true,
  };
}

export async function runSubagent(
  exec: PiExec,
  agent: string,
  task: string,
  cwd: string,
  signal: AbortSignal | undefined,
): Promise<SubagentResult> {
  if (signal?.aborted) return canceled(agent);

  let directory: string | undefined;
  let taskPath: string | undefined;
  let response: SubagentResult = {
    content: [{ type: "text", text: `Could not prepare subagent ${agent}.` }],
    details: { agent },
    isError: true,
  };

  try {
    directory = await mkdtemp(join(tmpdir(), "pi-subagent-"));
    taskPath = join(directory, "task.txt");
    await writeFile(taskPath, task, { flag: "wx", mode: 0o600 });

    if (signal?.aborted) {
      response = canceled(agent);
    } else {
      try {
        const result = await exec(
          "/bin/sh",
          [
            "-c",
            'exec pi-subagent "$1" < "$2"',
            "pi-subagent-stdin",
            agent,
            taskPath,
          ],
          { cwd, signal },
        );
        if (signal?.aborted) {
          response = canceled(agent, result);
        } else if (!piExecSucceeded(result)) {
          response = failed(agent, result);
        } else {
          const output = result.stdout.trim();
          response = output
            ? {
                content: [{ type: "text", text: output }],
                details: resultDetails(agent, result),
              }
            : emptyResult(agent, result);
        }
      } catch (error) {
        response = signal?.aborted
          ? canceled(agent)
          : {
              content: [
                {
                  type: "text",
                  text: `Could not launch subagent ${agent}: ${errorMessage(error)}`,
                },
              ],
              details: { agent },
              isError: true,
            };
      }
    }
  } catch (error) {
    response = {
      content: [
        {
          type: "text",
          text: `Could not prepare subagent ${agent}: ${errorMessage(error)}`,
        },
      ],
      details: { agent },
      isError: true,
    };
  }

  if (directory && taskPath) {
    try {
      await rm(directory, { recursive: true, force: true });
    } catch (error) {
      response = withCleanupFailure(response, taskPath, error);
    }
  }

  return response;
}
