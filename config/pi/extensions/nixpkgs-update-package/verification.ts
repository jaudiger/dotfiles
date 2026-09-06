import * as crypto from "node:crypto";
import { join } from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import type { NixpkgsContext } from "./context.js";

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
  pi: ExtensionAPI,
  name: string,
  args: string[],
): Promise<{ success: boolean; output: string }> {
  const result = await pi.exec(name, args);
  return {
    success: result.code === 0,
    output: `${result.stdout}${result.stderr}`.trim(),
  };
}

async function changedFiles(
  repository: string,
  head: string,
  pi: ExtensionAPI,
): Promise<string[]> {
  const result = await command(pi, "git", [
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
  const diffResult = await command(pi, "git", [
    "-C",
    repository,
    "diff",
    "--binary",
    context.head,
  ]);
  const statusResult = await command(pi, "git", [
    "-C",
    repository,
    "status",
    "--short",
  ]);
  const changedState = `${diffResult.output}\n${statusResult.output}`;
  const fingerprint = changedState.trim()
    ? crypto.createHash("sha256").update(changedState).digest("hex")
    : "";
  const files = await changedFiles(repository, context.head, pi);
  const nixFiles = files
    .filter((file) => file.endsWith(".nix"))
    .map((file) => join(repository, file));
  const steps: VerificationStep[] = [];

  const format = nixFiles.length
    ? await command(pi, "nixfmt", ["--check", ...nixFiles])
    : { success: true, output: "No changed Nix files." };
  steps.push({ name: "nixfmt", ...format });

  const diffCheck = await command(pi, "git", [
    "-C",
    repository,
    "diff",
    "--check",
    context.head,
  ]);
  steps.push({ name: "git diff check", ...diffCheck });

  for (const packageName of packages) {
    const build = await command(pi, "nix", [
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
