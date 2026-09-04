import { basename, join } from "node:path";
import { homedir } from "node:os";
import type {
  ExtensionAPI,
  ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import {
  createAsyncJobs,
  type AsyncCompletion,
  type AsyncJob,
} from "../pi-extension-infrastructure/subagents/async.js";
import { prepareContext, removeDirectory } from "./evidence.js";
import { parsePr, text } from "./parsing.js";
import type { PendingRun, PreparedContext } from "./types.js";

const source = "brioche-packages-debug-pr-failure";
const repositoriesRoot = join(homedir(), "Development", "git-repositories");
const briochePackagesRepository = join(
  repositoriesRoot,
  "brioche-dev",
  "brioche-packages",
);
const briocheSourceRepository = join(
  repositoriesRoot,
  "brioche-dev",
  "brioche",
);
const briocheRuntimeUtilsRepository = join(
  repositoriesRoot,
  "brioche-dev",
  "brioche-runtime-utils",
);

const investigationInstructions = `Identify the root cause of the supplied Brioche package pull request merge queue failure. Use the supplied temporary evidence and read-only repository context. When the failure may involve Brioche behavior, runtime utilities, or a bundled executable, trace the relevant implementation and configuration in the supplied source context instead of guessing from the package repository alone. Distinguish package changes from upstream Brioche or runtime utility behavior, and cite relevant file paths and line ranges in the report. Do not download artifacts, decode logs, commit, or push changes. Report the pull request, package and version change, failure classification, root cause, relevant evidence, proposed fix, and validation commands. Treat network, registry, runner, resource, and sandbox glitches as transient. Treat assertions, build errors, test failures, and Brioche process failures as code-related. Search the package repository for prior fixes with the same error before proposing a change.`;

type DebugOwner = PendingRun;

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function registerDebugPrFailure(pi: ExtensionAPI) {
  const asyncJobs = createAsyncJobs(pi, {
    source,
    customType: "brioche-debug-pr-failure",
  });
  const taskFor = (
    owner: DebugOwner,
    ctx: ExtensionContext,
    task: string,
  ): AsyncJob => ({
    label: `Investigation for PR ${owner.pr}`,
    launch: {
      cwd: briochePackagesRepository,
      agent: "oracle",
      task,
      reads: [
        owner.directory,
        briochePackagesRepository,
        briocheSourceRepository,
        briocheRuntimeUtilsRepository,
      ],
      capabilities: {
        sessionId: ctx.sessionManager.getSessionId(),
        allowedAgents: ["oracle"],
        allowedTools: ["read", "grep", "find", "ls"],
      },
    },
    evidence: {
      path: owner.directory,
      remove: async () => {
        if (!(await removeDirectory(owner.directory)))
          throw new Error("Could not remove debug evidence directory.");
      },
    },
    complete: async (completion: AsyncCompletion) => ({
      content: `Investigation completed for PR ${owner.pr}.\n\n${completion.text || "The subagent returned no report."}${completion.artifacts.length ? `\n\nSubagent artifacts:\n${completion.artifacts.join("\n")}` : ""}`,
      details: {
        pr: owner.pr,
        ...(completion.artifacts.length
          ? { artifactPaths: completion.artifacts }
          : {}),
      },
    }),
  });

  pi.registerCommand("brioche-packages:debug-pr-failure", {
    description: "Investigate a Brioche package PR merge queue failure",
    handler: async (args, ctx: ExtensionContext) => {
      const pr = parsePr(args);
      if (!pr) {
        ctx.ui.notify(
          "Usage: /brioche-packages:debug-pr-failure <PR number or URL>",
          "warning",
        );
        return;
      }
      let prepared: PreparedContext | undefined;
      try {
        ctx.ui.notify(`Preparing failure artifacts for PR ${pr}...`, "info");
        prepared = await prepareContext(pr, briochePackagesRepository);
        const context = prepared;
        const packageName = text(context.metadata.package) || "unknown";
        const task = `${investigationInstructions}\n\nInvestigate Brioche package PR ${pr} for package ${packageName}. The temporary evidence and package, Brioche, and runtime utility repositories are supplied as read-only context. Return your findings for the parent agent.`;
        const owner: DebugOwner = { directory: context.directory, pr };
        void asyncJobs.start(taskFor(owner, ctx, task));
        ctx.ui.notify(
          `Prepared ${context.summary}. Started investigation for PR ${pr} in ${basename(context.directory)}.`,
          "info",
        );
      } catch (error) {
        if (prepared) await removeDirectory(prepared.directory);
        ctx.ui.notify(errorMessage(error), "error");
      }
    },
  });

  pi.on("session_shutdown", async () => {
    await asyncJobs.shutdown();
  });
}
