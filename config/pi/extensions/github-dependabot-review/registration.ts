import { rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  isToolCallEventType,
  type ExtensionAPI,
  type ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { registerSubagentCapabilityCeiling } from "pi-subagents/capability-ceiling";
import { checkoutReview, mergeReview, prepareReview } from "./github.js";
import { discoverCompletion, completion, runId, sendRpc } from "./rpc.js";
import { researcherTask, scoutTask } from "./tasks.js";
import type { Json, PendingRun, PreparedReview } from "./types.js";
import { object, string } from "./utils.js";

export default function registerDependabotReview(pi: ExtensionAPI) {
  const pending = new Map<string, PendingRun>();
  const earlyCompletions = new Map<string, unknown>();
  const processing = new Set<string>();
  const subscribed = new Set<string>();
  let active: PreparedReview | undefined;
  let spawning = 0;
  let shuttingDown = false;
  let internalMutation = false;

  const report = (content: string, details: Json = {}, triggerTurn = false) => {
    pi.sendMessage(
      {
        customType: "github-dependabot-review",
        content,
        details,
        display: true,
      },
      { triggerTurn, deliverAs: "followUp" },
    );
  };

  const stopReview = async () => {
    const runs = [...pending.keys()];
    const directory = active?.directory;
    pending.clear();
    earlyCompletions.clear();
    active = undefined;
    await Promise.all(
      runs.map(async (id) => {
        try {
          await sendRpc(pi, "stop", { runId: id });
        } catch {
          return undefined;
        }
        return undefined;
      }),
    );
    if (directory) await rm(directory, { recursive: true, force: true });
  };

  const spawnScout = async (review: PreparedReview, reportPath: string) => {
    if (shuttingDown || active?.directory !== review.directory) return;
    spawning += 1;
    const capability = registerSubagentCapabilityCeiling({
      sessionId: review.sessionId,
      source: "github-dependabot-review",
      ceiling: { allowedTools: ["read", "grep", "find", "ls"] },
    });
    try {
      const rpc = await sendRpc(pi, "spawn", {
        cwd: review.cwd,
        context: "fresh",
        agent: "scout",
        task: scoutTask(review, reportPath),
        reads: [
          join(review.directory, "pr-metadata.json"),
          join(review.directory, "pr-description.md"),
          join(review.directory, "diff.patch"),
          join(review.directory, "status-checks.txt"),
          reportPath,
          review.cwd,
        ],
        output: false,
        intercomBridge: { mode: "off" },
        mission: {
          title: `Scout repository usage for Dependabot PR ${review.number}`,
          objective:
            "Compare changed dependency usage with the researcher release report.",
        },
        async: true,
      });
      const id = runId(rpc);
      if (!id) throw new Error("Scout started without a run identifier.");
      if (shuttingDown || active?.directory !== review.directory) {
        earlyCompletions.delete(id);
        try {
          await sendRpc(pi, "stop", { runId: id });
        } catch {
          return;
        }
        return;
      }
      pending.set(id, { kind: "scout", review });
      const early = earlyCompletions.get(id);
      if (early) {
        earlyCompletions.delete(id);
        startCompletion(id, early);
      }
    } finally {
      capability.dispose();
      spawning -= 1;
    }
  };

  const finishResearcher = async (
    id: string,
    item: PendingRun,
    raw: unknown,
  ) => {
    const result = completion(raw);
    const reportPath = join(item.review.directory, "researcher-report.md");
    await writeFile(reportPath, `${result.output}\n`, { mode: 0o600 });
    if (shuttingDown || active?.directory !== item.review.directory) return;
    if (
      result.success === false ||
      ["failed", "error", "cancelled", "canceled"].includes(
        result.status.toLowerCase(),
      )
    ) {
      report(
        `Dependabot researcher failed for PR ${item.review.number}. Evidence retained at ${item.review.directory}.`,
        { runId: id, reportPath },
        true,
      );
      return;
    }
    try {
      await spawnScout(item.review, reportPath);
      report(
        `Dependabot researcher completed for PR ${item.review.number}; repository scout started.`,
        { runId: id, reportPath },
      );
    } catch (error) {
      report(
        `Could not start the Dependabot repository scout: ${error instanceof Error ? error.message : String(error)}`,
        { runId: id, reportPath },
      );
    }
  };

  const finishScout = async (id: string, item: PendingRun, raw: unknown) => {
    const result = completion(raw);
    const reportPath = join(item.review.directory, "scout-report.md");
    await writeFile(reportPath, `${result.output}\n`, { mode: 0o600 });
    if (shuttingDown || active?.directory !== item.review.directory) return;
    if (
      result.success === false ||
      ["failed", "error", "cancelled", "canceled"].includes(
        result.status.toLowerCase(),
      )
    ) {
      report(
        `Dependabot repository scout failed for PR ${item.review.number}. Evidence retained at ${item.review.directory}.`,
        { runId: id, reportPath },
        true,
      );
      return;
    }
    report(
      `Dependabot review evidence is ready for PR ${item.review.number}. Read the researcher and scout reports, the PR description, diff, and status checks from ${item.review.directory}. Summarize the evidence and classify the recommendation as safe to merge, follow-up needed, wait, or cannot recommend. Ask the end user to explicitly choose merge, checkout, wait, or follow-up. Do not execute any PR mutation based only on the recommendation.`,
      {
        pr: item.review.number,
        directory: item.review.directory,
        researcherReport: join(item.review.directory, "researcher-report.md"),
        scoutReport: reportPath,
        statusChecks: join(item.review.directory, "status-checks.txt"),
        diff: join(item.review.directory, "diff.patch"),
        scoutRunId: id,
        scoutStatus: result.status,
      },
      true,
    );
  };

  const startCompletion = (id: string, raw: unknown) => {
    if (processing.has(id)) return;
    const item = pending.get(id);
    if (!item) return;
    processing.add(id);
    pending.delete(id);
    void (
      item.kind === "researcher"
        ? finishResearcher(id, item, raw)
        : finishScout(id, item, raw)
    )
      .catch((error: unknown) => {
        report(
          `Dependabot review run ${id} failed: ${error instanceof Error ? error.message : String(error)}`,
          { runId: id, directory: item.review.directory },
        );
      })
      .finally(() => processing.delete(id));
  };

  const subscribeCompletion = (event: string) => {
    if (subscribed.has(event)) return;
    subscribed.add(event);
    pi.events.on(event, (raw) => {
      const id = completion(raw).runId;
      if (pending.has(id)) startCompletion(id, raw);
      else if (spawning > 0 && id) earlyCompletions.set(id, raw);
    });
  };

  const spawnResearcher = async (review: PreparedReview) => {
    const capability = registerSubagentCapabilityCeiling({
      sessionId: review.sessionId,
      source: "github-dependabot-review",
      ceiling: {
        allowedTools: [
          "read",
          "web_search",
          "fetch_content",
          "get_search_content",
        ],
      },
    });
    try {
      const rpc = await sendRpc(pi, "spawn", {
        cwd: review.cwd,
        context: "fresh",
        agent: "researcher",
        task: researcherTask(review),
        reads: [
          join(review.directory, "pr-metadata.json"),
          join(review.directory, "pr-description.md"),
          join(review.directory, "diff.patch"),
          join(review.directory, "status-checks.txt"),
          review.cwd,
        ],
        output: false,
        intercomBridge: { mode: "off" },
        mission: {
          title: `Research Dependabot PR ${review.number}`,
          objective:
            "Identify changed direct dependencies and authoritative release-note risks.",
        },
        async: true,
      });
      const id = runId(rpc);
      if (!id) throw new Error("Researcher started without a run identifier.");
      if (shuttingDown || active?.directory !== review.directory) {
        earlyCompletions.delete(id);
        try {
          await sendRpc(pi, "stop", { runId: id });
        } catch {
          return;
        }
        return;
      }
      pending.set(id, { kind: "researcher", review });
      const early = earlyCompletions.get(id);
      if (early) {
        earlyCompletions.delete(id);
        startCompletion(id, early);
      }
    } finally {
      capability.dispose();
    }
  };

  pi.registerCommand("github:dependabot-review", {
    description: "Review the first open Dependabot pull request",
    handler: async (_args, ctx) => {
      if (shuttingDown) return;
      await stopReview();
      let review: PreparedReview;
      try {
        ctx.ui.notify("Preparing Dependabot pull request evidence...", "info");
        review = await prepareReview(
          ctx.cwd,
          ctx.sessionManager.getSessionId(),
        );
        active = review;
        const event = await discoverCompletion(pi);
        subscribeCompletion(event);
        spawning += 1;
        try {
          await spawnResearcher(review);
        } finally {
          spawning -= 1;
        }
        const pullRequest = object(review.metadata.pullRequest);
        ctx.ui.notify(
          `Started read-only Dependabot review for ${string(pullRequest.url)}.`,
          "info",
        );
      } catch (error) {
        active = undefined;
        ctx.ui.notify(
          error instanceof Error ? error.message : String(error),
          "error",
        );
      }
    },
  });

  pi.registerTool({
    name: "github_dependabot_review_execute",
    label: "Dependabot Review Execute",
    description:
      "Execute an explicitly user-selected Dependabot review action.",
    parameters: Type.Object({
      action: Type.Union([
        Type.Literal("merge"),
        Type.Literal("checkout"),
        Type.Literal("wait"),
        Type.Literal("follow-up"),
      ]),
    }),
    async execute(_id, params, _signal, _onUpdate, ctx) {
      if (!active)
        return {
          content: [{ type: "text", text: "No active Dependabot review." }],
        };
      if (!["merge", "checkout", "wait", "follow-up"].includes(params.action))
        throw new Error("Invalid Dependabot review action.");
      if (params.action === "wait")
        return {
          content: [
            {
              type: "text",
              text: "Waiting. No external mutation was performed.",
            },
          ],
        };
      if (params.action === "follow-up")
        return {
          content: [
            {
              type: "text",
              text: "Follow-up selected. No external mutation was performed.",
            },
          ],
        };
      internalMutation = true;
      try {
        const text =
          params.action === "merge"
            ? await mergeReview(active, ctx)
            : await checkoutReview(active, ctx);
        return { content: [{ type: "text", text }] };
      } finally {
        internalMutation = false;
      }
    },
  });

  pi.on("tool_call", (event) => {
    if (!active || internalMutation || !isToolCallEventType("bash", event))
      return;
    if (/\bgh\s+pr\s+(?:merge|review|checkout)\b/.test(event.input.command))
      return {
        block: true,
        terminate: true,
        reason:
          "A Dependabot review is active. Use github_dependabot_review_execute after explicit user action selection.",
      };
  });

  pi.on("session_shutdown", async () => {
    shuttingDown = true;
    const runs = [...pending.keys()];
    await Promise.all(
      runs.map(async (id) => {
        try {
          await sendRpc(pi, "stop", { runId: id });
        } catch {
          return undefined;
        }
        return undefined;
      }),
    );
    pending.clear();
    earlyCompletions.clear();
    processing.clear();
    if (active) await rm(active.directory, { recursive: true, force: true });
    active = undefined;
  });
}
