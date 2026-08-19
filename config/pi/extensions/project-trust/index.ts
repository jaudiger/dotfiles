import { realpathSync } from "node:fs";
import { homedir } from "node:os";
import { isAbsolute, join, relative, sep } from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const trustedProjectRoot = join(homedir(), "Development");

function isTrustedProject(projectPath: string): boolean {
  let trustedRoot: string;
  let resolvedProject: string;

  try {
    trustedRoot = realpathSync(trustedProjectRoot);
    resolvedProject = realpathSync(projectPath);
  } catch {
    return false;
  }

  const relativePath = relative(trustedRoot, resolvedProject);
  return (
    relativePath === "" ||
    (!relativePath.startsWith(`..${sep}`) &&
      relativePath !== ".." &&
      !isAbsolute(relativePath))
  );
}

export default function (pi: ExtensionAPI) {
  pi.on("project_trust", (event) => {
    if (!isTrustedProject(event.cwd)) return;
    return { trusted: "yes", remember: true };
  });
}
