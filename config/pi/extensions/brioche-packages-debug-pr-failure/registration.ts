import { basename, join } from "node:path";
import { homedir } from "node:os";
import type {
  ExtensionAPI,
  ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import {
  createAgentJobs,
  type AgentJob,
} from "../pi-extension-infrastructure/subagents/jobs.js";
import { oracleAgent } from "../pi-extension-infrastructure/subagents/roles.js";
import { prepareContext, removeDirectory } from "./evidence.js";
import { parsePr, text } from "./parsing.js";
import type { PendingRun, PreparedContext } from "./types.js";

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
  const agentJobs = createAgentJobs(pi, {
    customType: "brioche-debug-pr-failure",
    maxConcurrentJobs: 4,
  });
  let shuttingDown = false;
  const preparations = new Set<Promise<void>>();
  const taskFor = (owner: DebugOwner, task: string): AgentJob => ({
    label: `Investigation for PR ${owner.pr}`,
    launch: {
      cwd: briochePackagesRepository,
      readRoots: [
        owner.directory,
        briocheSourceRepository,
        briocheRuntimeUtilsRepository,
      ],
      config: oracleAgent,
      task,
    },
    evidence: {
      path: owner.directory,
      remove: async () => {
        if (!(await removeDirectory(owner.directory)))
          throw new Error("Could not remove debug evidence directory.");
      },
    },
    complete: async (completion: string) => ({
      content: `Investigation completed for PR ${owner.pr}.\n\n${completion}`,
      details: { pr: owner.pr },
    }),
  });

  async function investigate(
    args: string,
    ctx: ExtensionContext,
  ): Promise<void> {
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
      if (shuttingDown) {
        await removeDirectory(prepared.directory);
        return;
      }
      const context = prepared;
      const packageName = text(context.metadata.package) || "unknown";
      const task = [
        investigationInstructions,
        "",
        `Investigate Brioche package PR ${pr} for package ${packageName}.`,
        "Inspect these configured read-only roots:",
        context.directory,
        briochePackagesRepository,
        briocheSourceRepository,
        briocheRuntimeUtilsRepository,
        "Return your findings for the parent agent.",
      ].join("\n");
      const owner: DebugOwner = { directory: context.directory, pr };
      void agentJobs
        .start(ctx, taskFor(owner, task))
        .catch((error: unknown) => {
          if (!shuttingDown) ctx.ui.notify(errorMessage(error), "error");
        });
      ctx.ui.notify(
        `Prepared ${context.summary}. Started investigation for PR ${pr} in ${basename(context.directory)}.`,
        "info",
      );
    } catch (error) {
      if (prepared) {
        try {
          await removeDirectory(prepared.directory);
        } catch {}
      }
      if (!shuttingDown) ctx.ui.notify(errorMessage(error), "error");
    }
  }

  pi.registerCommand("brioche-packages:debug-pr-failure", {
    description: "Investigate a Brioche package PR merge queue failure",
    handler: async (args, ctx: ExtensionContext) => {
      if (shuttingDown) return;
      const preparation = investigate(args, ctx);
      preparations.add(preparation);
      try {
        await preparation;
      } finally {
        preparations.delete(preparation);
      }
    },
  });

  pi.on("session_shutdown", async () => {
    shuttingDown = true;
    await Promise.allSettled([...preparations]);
    await agentJobs.shutdown();
  });
}
