import { spawnSync } from "node:child_process";
import { homedir } from "node:os";
import { join } from "node:path";

export type Decision = "allow" | "deny" | "defer";

export type Classification = {
  decision: Decision;
  reason: string;
};

const hookPath = join(
  homedir(),
  ".pi",
  "extensions",
  "pi-auto-approve-safe-commands-scripts",
  "mod.nu",
);

export function classify(command: string): Classification {
  const result = spawnSync("nu", ["--stdin", hookPath, "pi"], {
    encoding: "utf8",
    input: JSON.stringify({
      tool_name: "Bash",
      tool_input: { command },
    }),
  });

  if (result.error) {
    return {
      decision: "deny",
      reason: `The command classifier failed: ${result.error.message}`,
    };
  }

  if (result.status !== 0) {
    return {
      decision: "deny",
      reason: "The command classifier exited unsuccessfully",
    };
  }

  const output = result.stdout.trim();
  if (output === "") {
    return {
      decision: "defer",
      reason: "The command was not classified as read-only",
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(output);
  } catch {
    return {
      decision: "deny",
      reason: "The command classifier returned invalid JSON",
    };
  }

  if (typeof parsed !== "object" || parsed === null) {
    return {
      decision: "deny",
      reason: "The command classifier returned an invalid decision",
    };
  }

  const record = parsed as Record<string, unknown>;
  const decision = record.decision;
  if (decision !== "allow" && decision !== "deny" && decision !== "defer") {
    return {
      decision: "deny",
      reason: "The command classifier returned an unknown decision",
    };
  }

  return {
    decision,
    reason: typeof record.reason === "string" ? record.reason : "",
  };
}
