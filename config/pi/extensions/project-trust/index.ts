import { homedir } from "node:os";
import { isAbsolute, join, relative, resolve, sep } from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const trustedProjectRoot = join(homedir(), "Development");

function isTrustedProject(projectPath: string): boolean {
	const relativePath = relative(
		resolve(trustedProjectRoot),
		resolve(projectPath),
	);
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
		return { trusted: "yes", remember: false };
	});
}
