import * as crypto from "node:crypto";
import { join } from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import type { NixpkgsContext } from "./context.js";
import {
  capturePiExec,
  createPiExec,
  requirePiExecComplete,
  type PiExec,
} from "../pi-extension-infrastructure/pi-exec.js";

export type VerificationStep = {
  name: string;
  success: boolean;
  output: string;
};

export type VerificationResult = {
  success: boolean;
  diff: string;
  steps: VerificationStep[];
};

async function command(
  exec: PiExec,
  name: string,
  args: string[],
): Promise<{ success: boolean; output: string }> {
  const captured = await capturePiExec(exec, name, args);
  requirePiExecComplete(name, captured.result);
  return { success: captured.success, output: captured.output.trim() };
}

async function changedFiles(
  repository: string,
  head: string,
  exec: PiExec,
): Promise<string[]> {
  const result = await command(exec, "git", [
    "-C",
    repository,
    "diff",
    "--name-only",
    head,
  ]);
  if (!result.success) return [];
  return result.output.split("\n").filter(Boolean);
}

export async function verifyUpdate(
  repository: string,
  packages: string[],
  context: NixpkgsContext,
  pi: ExtensionAPI,
): Promise<VerificationResult> {
  const exec = createPiExec(pi, 256 * 1024 * 1024);
  const diffResult = await command(exec, "git", [
    "-C",
    repository,
    "diff",
    "--binary",
    context.head,
  ]);
  const statusResult = await command(exec, "git", [
    "-C",
    repository,
    "status",
    "--short",
  ]);
  const changedState = `${diffResult.output}\n${statusResult.output}`;
  const fingerprint = changedState.trim()
    ? crypto.createHash("sha256").update(changedState).digest("hex")
    : "";
  const files = await changedFiles(repository, context.head, exec);
  const nixFiles = files
    .filter((file) => file.endsWith(".nix"))
    .map((file) => join(repository, file));
  const steps: VerificationStep[] = [];

  const format = nixFiles.length
    ? await command(exec, "nixfmt", ["--check", ...nixFiles])
    : { success: true, output: "No changed Nix files." };
  steps.push({ name: "nixfmt", ...format });

  const diffCheck = await command(exec, "git", [
    "-C",
    repository,
    "diff",
    "--check",
    context.head,
  ]);
  steps.push({ name: "git diff check", ...diffCheck });

  for (const packageName of packages) {
    const build = await command(exec, "nix", [
      "build",
      "--impure",
      "--no-link",
      `${repository}#${packageName}`,
    ]);
    steps.push({ name: `build ${packageName}`, ...build });
  }

  return {
    success: steps.every((step) => step.success),
    diff: fingerprint,
    steps,
  };
}
