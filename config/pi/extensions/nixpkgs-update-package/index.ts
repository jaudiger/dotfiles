import type {
  ExtensionAPI,
  ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { cancelDelegatedRequests } from "../pi-extension-infrastructure/subagents/delegation.js";
import { createToolScope } from "../pi-extension-infrastructure/tool-scope.js";
import { registerResearchTool, type ResearchResult } from "./research.js";
import { collectNixpkgsContext, type NixpkgsContext } from "./context.js";
import { publishUpdate, type PublicationResult } from "./publication.js";
import { verifyUpdate, type VerificationResult } from "./verification.js";
import { registerCommandTool } from "./tools.js";
import {
  contextMessage,
  ownsWorkflow,
  registerWorkflowGuidance,
  workflowPrompt,
  type WorkflowPhase,
} from "./workflow.js";

const repository =
  process.env.NIXPKGS_REPOSITORY ??
  "/Users/jaudiger/Development/git-repositories/jaudiger/nixpkgs";
const customType = "nixpkgs-update-package";

type ActiveUpdate = {
  sessionId: string;
  packages: string[];
  context: NixpkgsContext;
  phase: WorkflowPhase;
  research?: ResearchResult;
  lastDiff?: string;
  verification?: VerificationResult;
  verificationRound: number;
  publicationArmed: boolean;
  publicationRunning: boolean;
};

function report(
  pi: ExtensionAPI,
  content: string,
  details: Record<string, unknown> = {},
  triggerTurn = false,
): void {
  pi.sendMessage(
    { customType, content, details, display: true },
    { triggerTurn, deliverAs: "followUp" },
  );
}

function packageArguments(value: string): string[] | undefined {
  const packages = value.trim().split(/\s+/).filter(Boolean);
  if (
    packages.length === 0 ||
    packages.some((value) => !/^[A-Za-z0-9][A-Za-z0-9+._-]*$/.test(value))
  )
    return undefined;
  return [...new Set(packages)];
}

function verificationMessage(result: VerificationResult): string {
  const lines = [
    result.success
      ? "Automatic Nixpkgs verification passed."
      : "Automatic Nixpkgs verification failed.",
    "",
    ...result.steps.map(
      (step) =>
        `${step.name}: ${step.success ? "passed" : "failed"}\n${step.output}`,
    ),
  ];
  return lines.join("\n\n");
}

function publicationMessage(result: PublicationResult): string {
  return [
    result.success
      ? "Nixpkgs update publication completed."
      : "Nixpkgs update publication stopped after a partial result.",
    "",
    `Branch: ${result.branch ?? "not created"}`,
    `Commits: ${result.commits.length ? result.commits.join(", ") : "none"}`,
    `Pull request: ${result.pullRequest ?? "not created"}`,
    `Assigned user: ${result.assignee ?? "not assigned"}`,
    `nixpkgs-review: ${result.reviewOutput || "not run"}`,
    result.error ? `Error: ${result.error}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

export default function (pi: ExtensionAPI) {
  let active: ActiveUpdate | undefined;
  let shuttingDown = false;
  const verificationPromises = new Set<Promise<void>>();
  const nixpkgsToolScope = createToolScope(pi, [
    "nixpkgs_update_package_research",
    "nixpkgs_update_package_command",
    "nixpkgs_update_package_execute",
  ]);
  const clearActive = (): void => {
    active = undefined;
    nixpkgsToolScope.release();
  };

  registerWorkflowGuidance(pi, () => active);

  registerCommandTool(pi, repository, () =>
    shuttingDown ? undefined : active,
  );

  registerResearchTool(pi, {
    getActive: () => active,
    setResearch: (result) => {
      if (active) {
        active.research = result;
        active.phase = "editing";
      }
    },
    repository,
  });

  pi.registerCommand("nixpkgs:update-package", {
    description: "Update Nixpkgs recipes and prepare a draft pull request",
    handler: async (args, ctx: ExtensionContext) => {
      if (shuttingDown || active) {
        ctx.ui.notify("A Nixpkgs update is already in progress.", "warning");
        return;
      }

      const packages = packageArguments(args);
      if (!packages) {
        ctx.ui.notify(
          "Usage: /nixpkgs:update-package <package> [package...]",
          "warning",
        );
        return;
      }

      try {
        const context = await collectNixpkgsContext(repository, packages, pi);
        active = {
          sessionId: ctx.sessionManager.getSessionId(),
          packages,
          context,
          phase: "research",
          verificationRound: 0,
          publicationArmed: false,
          publicationRunning: false,
        };
        nixpkgsToolScope.acquire();
        report(pi, contextMessage(context, packages), {
          repository,
          packages,
          recipePaths: context.recipePaths,
        });
        pi.sendUserMessage(workflowPrompt(context, packages), {
          expandPromptTemplates: false,
        });
        ctx.ui.notify("Nixpkgs update workflow started.", "info");
      } catch (error) {
        if (active?.sessionId === ctx.sessionManager.getSessionId())
          clearActive();
        ctx.ui.notify(
          error instanceof Error ? error.message : String(error),
          "error",
        );
      }
    },
  });

  pi.registerTool({
    name: "nixpkgs_update_package_execute",
    label: "Nixpkgs update package execute",
    description:
      "Execute the explicitly approved complete Nixpkgs publication action. This creates the Git branch, signed commits, draft pull request, assignment, and nixpkgs-review result.",
    parameters: Type.Object({ action: Type.Literal("publish") }),
    async execute(_toolCallId, _params, signal, _onUpdate, ctx) {
      if (!ownsWorkflow(active, ctx))
        return {
          content: [{ type: "text", text: "No active Nixpkgs update." }],
          details: {},
          isError: true,
        };
      if (active.phase !== "publication" || !active.publicationArmed)
        return {
          content: [
            {
              type: "text",
              text: "Publication is not approved. Ask the user for explicit approval after verification passes.",
            },
          ],
          details: {},
          isError: true,
        };
      if (active.publicationRunning)
        return {
          content: [{ type: "text", text: "Publication is already running." }],
          details: {},
        };

      const update = active;
      update.publicationRunning = true;
      update.publicationArmed = false;
      try {
        const result = await publishUpdate(
          repository,
          update.packages,
          update.context,
          update.research,
          signal,
        );
        report(pi, publicationMessage(result), {
          repository,
          packages: update.packages,
          branch: result.branch,
          pullRequest: result.pullRequest,
          reviewOutput: result.reviewOutput,
        });
        return {
          content: [{ type: "text", text: publicationMessage(result) }],
          details: result,
          isError: !result.success,
        };
      } finally {
        update.publicationRunning = false;
        if (active === update) clearActive();
      }
    },
  });

  pi.on("agent_settled", async (_event, ctx) => {
    if (shuttingDown || !ownsWorkflow(active, ctx)) return;
    if (
      active.phase !== "editing" ||
      active.publicationRunning ||
      verificationPromises.size > 0
    )
      return;

    const update = active;
    update.phase = "verification";
    const promise = (async () => {
      try {
        const result = await verifyUpdate(
          repository,
          update.packages,
          update.context,
          pi,
        );
        if (shuttingDown || active !== update) return;
        const diff = result.diff;
        if (!diff || diff === update.lastDiff) return;
        update.lastDiff = diff;
        update.verification = result;
        update.verificationRound += 1;
        report(pi, verificationMessage(result), {
          repository,
          packages: update.packages,
          success: result.success,
          round: update.verificationRound,
          steps: result.steps,
        });

        if (!result.success) {
          update.phase = "editing";
          if (update.verificationRound < 3) {
            report(
              pi,
              "Fix the verification failures above and stop when the changes are ready for publication approval.",
              { repository, packages: update.packages },
              true,
            );
          } else {
            report(
              pi,
              "Automatic verification stopped after three repair rounds. Review the recipe changes manually before continuing.",
              { repository, packages: update.packages },
            );
            clearActive();
          }
          return;
        }
        update.phase = "publication";
        if (!ctx.hasUI) {
          report(
            pi,
            "Verification passed, but publication requires an interactive approval. The workflow is now inactive and the recipe changes remain local.",
            { repository, packages: update.packages },
          );
          clearActive();
          return;
        }

        const approved = await ctx.ui.confirm(
          "Publish Nixpkgs update?",
          "This will create the branch, signed commits, draft pull request, assignment, and nixpkgs-review result.",
        );
        if (!approved || active !== update) {
          if (!approved) {
            report(
              pi,
              "Publication was canceled. The verified recipe changes remain in the Nixpkgs working tree and no publication action was run.",
              { repository, packages: update.packages },
            );
            clearActive();
          }
          return;
        }
        update.publicationArmed = true;
        report(
          pi,
          "The user explicitly approved publication. Call nixpkgs_update_package_execute with action publish now. Do not run the publication commands directly.",
          { repository, packages: update.packages },
          true,
        );
      } catch (error) {
        if (active === update) {
          report(
            pi,
            `Automatic Nixpkgs verification failed: ${
              error instanceof Error ? error.message : String(error)
            }`,
            { repository, packages: update.packages },
          );
          clearActive();
        }
      } finally {
        if (active === update && update.phase === "verification")
          update.phase = "editing";
      }
    })();
    verificationPromises.add(promise);
    try {
      await promise;
    } finally {
      verificationPromises.delete(promise);
    }
  });

  pi.on("session_shutdown", async () => {
    shuttingDown = true;
    cancelDelegatedRequests(pi);
    await Promise.allSettled([...verificationPromises]);
    clearActive();
  });
}
