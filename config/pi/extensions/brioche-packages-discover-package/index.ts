import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { createPiExec } from "../pi-extension-infrastructure/pi-exec.js";
import {
  parseArguments,
  removeDiscoveryDirectory,
  runDiscovery,
  type DiscoveryResult,
} from "./discovery.js";

const usage =
  "Usage: /brioche-packages:discover-package [homebrew|nixpkgs|arch|all] [count]";
const DISCOVERY_MAX_BUFFER = 32 * 1024 * 1024;

function metadataValue(
  result: DiscoveryResult,
  key: string,
  fallback = "[]",
): string {
  const value = result.metadata[key];
  return typeof value === "string" ? value : JSON.stringify(value ?? fallback);
}

export default function (pi: ExtensionAPI) {
  const exec = createPiExec(pi, DISCOVERY_MAX_BUFFER);
  const temporaryDirectories = new Set<string>();
  let discoveryActive = false;
  let sessionShuttingDown = false;
  let activeDiscovery:
    | { controller: AbortController; execution: Promise<DiscoveryResult> }
    | undefined;
  let settlementCount = 0;
  let discoverySettlementTarget: number | undefined;

  pi.registerCommand("brioche-packages:discover-package", {
    description: "Discover recently updated packages for Brioche",
    handler: async (args, ctx) => {
      const options = parseArguments(args);
      if (!options) {
        ctx.ui.notify(usage, "warning");
        return;
      }
      if (discoveryActive) {
        ctx.ui.notify("Package discovery is already in progress.", "warning");
        return;
      }
      if (sessionShuttingDown) return;
      discoveryActive = true;

      const controller = new AbortController();
      const execution = runDiscovery(ctx.cwd, options, exec, controller.signal);
      activeDiscovery = { controller, execution };
      let result: DiscoveryResult;
      try {
        ctx.ui.notify("Running package discovery...", "info");
        result = await execution;
      } catch (error) {
        discoveryActive = false;
        if (!sessionShuttingDown) {
          ctx.ui.notify(
            error instanceof Error ? error.message : String(error),
            "error",
          );
        }
        return;
      } finally {
        if (activeDiscovery?.execution === execution)
          activeDiscovery = undefined;
      }

      if (sessionShuttingDown || controller.signal.aborted) {
        await removeDiscoveryDirectory(result.directory);
        discoveryActive = false;
        return;
      }

      temporaryDirectories.add(result.directory);
      const settlementTarget = settlementCount + 1;
      discoverySettlementTarget = settlementTarget;
      const failed = metadataValue(result, "failed", "{}");
      const excludedCount = metadataValue(result, "excluded_count");
      try {
        pi.sendMessage(
          {
            customType: "brioche-packages-discovery",
            content: `Package discovery completed with ${result.packageCount} candidates. Read the complete JSON output at ${result.outputPath} before responding. Discovery metadata: excluded_count=${excludedCount}, failed=${failed}. The command was run once with --exclude-defaults; do not run it again. Review candidates, use the researcher subagent for complementary information when useful, and return a concise Markdown table with package, source, candidate recipe type, candidate recipe build dependencies, version, and description. After the table, note failed sources, their issue messages, or other limitations.`,
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
      } catch (error) {
        temporaryDirectories.delete(result.directory);
        discoverySettlementTarget = undefined;
        discoveryActive = false;
        await removeDiscoveryDirectory(result.directory);
        if (!sessionShuttingDown) {
          ctx.ui.notify(
            error instanceof Error ? error.message : String(error),
            "error",
          );
        }
        return;
      }

      if (sessionShuttingDown) {
        temporaryDirectories.delete(result.directory);
        await removeDiscoveryDirectory(result.directory);
        discoveryActive = false;
        return;
      }
      ctx.ui.notify(
        `Discovery context prepared in ${result.directory}.`,
        "info",
      );
    },
  });

  pi.on("agent_settled", async () => {
    settlementCount += 1;
    if (
      discoverySettlementTarget !== undefined &&
      settlementCount >= discoverySettlementTarget
    ) {
      discoverySettlementTarget = undefined;
      discoveryActive = false;
    }
    const directories = [...temporaryDirectories];
    temporaryDirectories.clear();
    await Promise.all(directories.map(removeDiscoveryDirectory));
  });

  pi.on("session_shutdown", async () => {
    sessionShuttingDown = true;
    discoveryActive = false;
    discoverySettlementTarget = undefined;
    const runningDiscovery = activeDiscovery;
    runningDiscovery?.controller.abort();
    if (runningDiscovery)
      await runningDiscovery.execution.catch(() => undefined);
    const directories = [...temporaryDirectories];
    temporaryDirectories.clear();
    await Promise.all(directories.map(removeDiscoveryDirectory));
  });
}
