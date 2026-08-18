import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import {
  parseArguments,
  removeDiscoveryDirectory,
  runDiscovery,
  type DiscoveryResult,
} from "./discovery.js";

const usage =
  "Usage: /brioche-packages:discover-package [homebrew|nixpkgs|arch|all] [count]";

function metadataValue(
  result: DiscoveryResult,
  key: string,
  fallback = "[]",
): string {
  const value = result.metadata[key];
  return typeof value === "string" ? value : JSON.stringify(value ?? fallback);
}

export default function (pi: ExtensionAPI) {
  const temporaryDirectories = new Set<string>();

  pi.registerCommand("brioche-packages:discover-package", {
    description: "Discover recently updated packages for Brioche",
    handler: async (args, ctx) => {
      const options = parseArguments(args);
      if (!options) {
        ctx.ui.notify(usage, "warning");
        return;
      }

      let result: DiscoveryResult;
      try {
        ctx.ui.notify("Running package discovery...", "info");
        result = await runDiscovery(ctx.cwd, options);
      } catch (error) {
        ctx.ui.notify(
          error instanceof Error ? error.message : String(error),
          "error",
        );
        return;
      }

      temporaryDirectories.add(result.directory);
      const failed = metadataValue(result, "failed", "{}");
      const excludedCount = metadataValue(result, "excluded_count");
      pi.sendMessage(
        {
          customType: "brioche-packages-discovery",
          content: `Package discovery completed with ${result.packageCount} candidates. Read ${result.outputPath} for the complete JSON output before responding. Discovery metadata: excluded_count=${excludedCount}, failed=${failed}. The command was run once with --exclude-defaults; do not run it again. Review the candidates, gather complementary information with the researcher subagent when useful, and present the result as a concise markdown table with package, source, candidate recipe type, candidate recipe build dependencies, version, and description. Mention failed sources, their issue messages, or other limitations after the table.`,
          details: {
            directory: result.directory,
            outputPath: result.outputPath,
            stderrPath: result.stderrPath,
            packageCount: result.packageCount,
            metadata: result.metadata,
          },
          display: true,
        },
        { triggerTurn: true, deliverAs: "followUp" },
      );
      ctx.ui.notify(
        `Discovery context prepared in ${result.directory}.`,
        "info",
      );
    },
  });

  pi.on("agent_settled", async () => {
    const directories = [...temporaryDirectories];
    temporaryDirectories.clear();
    await Promise.all(directories.map(removeDiscoveryDirectory));
  });

  pi.on("session_shutdown", async () => {
    const directories = [...temporaryDirectories];
    temporaryDirectories.clear();
    await Promise.all(directories.map(removeDiscoveryDirectory));
  });
}
