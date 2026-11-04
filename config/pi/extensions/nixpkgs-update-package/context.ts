import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import {
  createPiExec,
  runPiExec,
  type PiExec,
} from "../pi-extension-infrastructure/pi-exec.js";

export type NixpkgsContext = {
  repository: string;
  branch: string;
  head: string;
  status: string;
  recipePaths: string[];
  recipeContent: string;
};

async function command(
  exec: PiExec,
  repository: string,
  args: string[],
): Promise<string> {
  const result = await runPiExec(exec, "git", ["-C", repository, ...args]);
  return result.stdout;
}

function pathMatchesPackage(path: string, packageName: string): boolean {
  const parts = path.split("/");
  return (
    parts.includes(packageName) ||
    path.endsWith(`/${packageName}.nix`) ||
    path.endsWith(`/${packageName}/package.nix`)
  );
}

async function recipePaths(
  exec: PiExec,
  repository: string,
  packages: string[],
): Promise<string[]> {
  const files = (await command(exec, repository, ["ls-files", "--", "*.nix"]))
    .split("\n")
    .filter(Boolean);
  const matches = files.filter((path) =>
    packages.some((packageName) => pathMatchesPackage(path, packageName)),
  );
  return [...new Set(matches)].slice(0, 40);
}

async function recipeContent(
  exec: PiExec,
  repository: string,
  paths: string[],
): Promise<string> {
  const sections: string[] = [];
  for (const path of paths.slice(0, 12)) {
    const content = await command(exec, repository, ["show", `HEAD:${path}`]);
    sections.push(`### ${path}\n${content.slice(0, 12000)}`);
  }
  return sections.join("\n\n");
}

export async function collectNixpkgsContext(
  repository: string,
  packages: string[],
  pi: ExtensionAPI,
): Promise<NixpkgsContext> {
  const exec = createPiExec(pi, 256 * 1024 * 1024);
  const branch = (
    await command(exec, repository, ["branch", "--show-current"])
  ).trim();
  if (!branch)
    throw new Error("The Nixpkgs repository is in detached HEAD state.");
  const status = await command(exec, repository, ["status", "--short"]);
  if (status.trim())
    throw new Error(
      "The Nixpkgs repository has uncommitted changes. Clean it before starting an update.",
    );
  if (branch !== "master")
    throw new Error("Nixpkgs updates must start from the master branch.");
  await command(exec, repository, ["fetch", "--prune"]);
  await command(exec, repository, ["merge", "--ff-only", "@{u}"]);
  const [head, paths] = await Promise.all([
    command(exec, repository, ["rev-parse", "HEAD"]),
    recipePaths(exec, repository, packages),
  ]);
  return {
    repository,
    branch,
    head: head.trim(),
    status: "",
    recipePaths: paths,
    recipeContent: await recipeContent(exec, repository, paths),
  };
}
