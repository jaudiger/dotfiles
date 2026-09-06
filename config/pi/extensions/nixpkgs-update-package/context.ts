import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export type NixpkgsContext = {
  repository: string;
  branch: string;
  head: string;
  status: string;
  recipePaths: string[];
  recipeContent: string;
};

async function command(
  pi: ExtensionAPI,
  repository: string,
  args: string[],
): Promise<string> {
  const result = await pi.exec("git", ["-C", repository, ...args]);
  if (result.code !== 0)
    throw new Error(
      `git ${args.join(" ")} failed: ${result.stderr.trim() || result.stdout.trim()}`,
    );
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
  pi: ExtensionAPI,
  repository: string,
  packages: string[],
): Promise<string[]> {
  const files = (await command(pi, repository, ["ls-files", "--", "*.nix"]))
    .split("\n")
    .filter(Boolean);
  const matches = files.filter((path) =>
    packages.some((packageName) => pathMatchesPackage(path, packageName)),
  );
  return [...new Set(matches)].slice(0, 40);
}

async function recipeContent(
  pi: ExtensionAPI,
  repository: string,
  paths: string[],
): Promise<string> {
  const sections: string[] = [];
  for (const path of paths.slice(0, 12)) {
    const content = await command(pi, repository, ["show", `HEAD:${path}`]);
    sections.push(`### ${path}\n${content.slice(0, 12000)}`);
  }
  return sections.join("\n\n");
}

export async function collectNixpkgsContext(
  repository: string,
  packages: string[],
  pi: ExtensionAPI,
): Promise<NixpkgsContext> {
  const branch = (
    await command(pi, repository, ["branch", "--show-current"])
  ).trim();
  if (!branch)
    throw new Error("The Nixpkgs repository is in detached HEAD state.");
  const status = await command(pi, repository, ["status", "--short"]);
  if (status.trim())
    throw new Error(
      "The Nixpkgs repository has uncommitted changes. Clean it before starting an update.",
    );
  if (branch !== "master")
    throw new Error("Nixpkgs updates must start from the master branch.");
  await command(pi, repository, ["fetch", "--prune"]);
  await command(pi, repository, ["merge", "--ff-only", "@{u}"]);
  const [head, paths] = await Promise.all([
    command(pi, repository, ["rev-parse", "HEAD"]),
    recipePaths(pi, repository, packages),
  ]);
  return {
    repository,
    branch,
    head: head.trim(),
    status: "",
    recipePaths: paths,
    recipeContent: await recipeContent(pi, repository, paths),
  };
}
