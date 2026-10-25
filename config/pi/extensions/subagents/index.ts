import { spawn } from "node:child_process";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";

const agentNames = (process.env.PI_SUBAGENT_AGENT_NAMES ?? "")
  .split(",")
  .filter((name) => name.length > 0);

if (agentNames.length === 0 || new Set(agentNames).size !== agentNames.length) {
  throw new Error("PI_SUBAGENT_AGENT_NAMES must contain unique subagent roles");
}

const agentParameters = Type.Union(
  agentNames.map((name) => Type.Literal(name)),
);

const parameters = Type.Object(
  {
    agent: agentParameters,
    task: Type.String({ minLength: 1 }),
  },
  { additionalProperties: false },
);

function runSubagent(
  agent: string,
  task: string,
  cwd: string,
  signal: AbortSignal | undefined,
): Promise<{
  content: { type: "text"; text: string }[];
  details: { agent: string; exitCode?: number | null };
  isError?: boolean;
}> {
  if (signal?.aborted) {
    return Promise.resolve({
      content: [{ type: "text", text: `Subagent ${agent} was canceled.` }],
      details: { agent },
      isError: true,
    });
  }

  return new Promise((resolve) => {
    const child = spawn("pi-subagent", [agent], {
      cwd,
      env: process.env,
      stdio: ["pipe", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    let settled = false;

    const finish = (result: {
      content: { type: "text"; text: string }[];
      details: { agent: string; exitCode?: number | null };
      isError?: boolean;
    }): void => {
      if (settled) return;
      settled = true;
      signal?.removeEventListener("abort", abort);
      resolve(result);
    };
    const abort = (): void => {
      child.kill("SIGTERM");
    };
    const stdin = child.stdin;
    const childStdout = child.stdout;
    const childStderr = child.stderr;

    if (!stdin || !childStdout || !childStderr) {
      child.kill();
      finish({
        content: [
          { type: "text", text: `Could not open subagent ${agent} streams.` },
        ],
        details: { agent },
        isError: true,
      });
      return;
    }

    childStdout.setEncoding("utf8");
    childStderr.setEncoding("utf8");
    childStdout.on("data", (chunk: string) => {
      stdout += chunk;
    });
    childStderr.on("data", (chunk: string) => {
      stderr += chunk;
    });
    stdin.on("error", () => undefined);
    child.once("error", (error) => {
      finish({
        content: [
          {
            type: "text",
            text: `Could not launch subagent ${agent}: ${error.message}`,
          },
        ],
        details: { agent },
        isError: true,
      });
    });
    child.once("close", (exitCode) => {
      if (signal?.aborted) {
        finish({
          content: [{ type: "text", text: `Subagent ${agent} was canceled.` }],
          details: { agent, exitCode },
          isError: true,
        });
        return;
      }

      const result = stdout.trim();
      if (exitCode !== 0 || !result) {
        const reason =
          stderr.trim() || `Pi exited with status ${exitCode ?? "unknown"}`;
        finish({
          content: [
            { type: "text", text: `Subagent ${agent} failed: ${reason}` },
          ],
          details: { agent, exitCode },
          isError: true,
        });
        return;
      }

      finish({
        content: [{ type: "text", text: result }],
        details: { agent, exitCode },
      });
    });

    signal?.addEventListener("abort", abort, { once: true });
    if (signal?.aborted) abort();
    stdin.end(task);
  });
}

export default function (pi: ExtensionAPI): void {
  pi.registerTool({
    name: "subagent",
    label: "Pi subagent",
    description: `Run one configured specialist in a separate Pi process and return its final response. Available roles are ${agentNames.join(", ")}. Use this when the user asks for a specialist or asks you to delegate. Provide a standalone task, then evaluate the result and continue the work before answering.`,
    promptSnippet:
      "Run a configured Pi specialist when requested, then continue with its result.",
    promptGuidelines: [
      "When the user asks for a configured specialist or asks you to delegate, call subagent instead of asking the user to run pi-subagent.",
      "After receiving a subagent result, evaluate it and continue with any needed work or follow-up calls before answering the user.",
    ],
    parameters,
    executionMode: "sequential",
    async execute(_toolCallId, params, signal, _onUpdate, ctx) {
      return runSubagent(params.agent, params.task, ctx.cwd, signal);
    },
  });
}
