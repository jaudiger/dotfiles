import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { runReadOnlyPiAgent } from "../pi-extension-infrastructure/subagents/agent.js";
import { researcherAgent } from "../pi-extension-infrastructure/subagents/roles.js";
import type { NixpkgsContext } from "./context.js";
import type { WorkflowPhase } from "./workflow.js";

export type ResearchPackage = {
  name: string;
  currentVersion: string;
  latestVersion: string;
  releaseDate: string;
  releaseUrl: string;
  changelogUrl: string;
  sourceTag: string;
  dependencyNotes: string;
};

export type ResearchResult = {
  packages: ResearchPackage[];
};

const researchOutputSchema = Type.Object(
  {
    packages: Type.Array(
      Type.Object(
        {
          name: Type.String(),
          currentVersion: Type.String(),
          latestVersion: Type.String(),
          releaseDate: Type.String(),
          releaseUrl: Type.String(),
          changelogUrl: Type.String(),
          sourceTag: Type.String(),
          dependencyNotes: Type.String(),
        },
        { additionalProperties: false },
      ),
    ),
  },
  { additionalProperties: false },
);

type ResearchState = {
  sessionId: string;
  packages: string[];
  context: NixpkgsContext;
  phase: WorkflowPhase;
  research?: ResearchResult;
};

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function httpsUrl(value: unknown, label: string): string {
  if (typeof value !== "string") throw new Error(`${label} must be a string.`);
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${label} must be an HTTPS URL.`);
  }
  if (url.protocol !== "https:" || url.username || url.password)
    throw new Error(`${label} must be an HTTPS URL.`);
  return value;
}

function stringField(value: unknown, label: string, maxLength = 2000): string {
  if (typeof value !== "string" || !value.trim() || value.length > maxLength)
    throw new Error(`${label} must be a non-empty string.`);
  return value.trim();
}

function parseResearch(
  value: string,
  expectedPackages: string[],
): ResearchResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value) as unknown;
  } catch {
    throw new Error("Nixpkgs researcher did not return valid JSON.");
  }
  const root = object(parsed);
  if (Object.keys(root).length !== 1 || !Array.isArray(root.packages))
    throw new Error("Nixpkgs researcher returned an invalid package list.");
  if (root.packages.length !== expectedPackages.length)
    throw new Error(
      "Nixpkgs researcher did not return every requested package.",
    );

  const packages = root.packages.map((raw) => {
    const item = object(raw);
    const allowed = [
      "changelogUrl",
      "currentVersion",
      "dependencyNotes",
      "latestVersion",
      "name",
      "releaseDate",
      "releaseUrl",
      "sourceTag",
    ];
    const keys = Object.keys(item).sort();
    if (
      keys.length !== allowed.length ||
      keys.some((key, index) => key !== allowed[index])
    )
      throw new Error("Nixpkgs researcher returned unexpected fields.");
    return {
      name: stringField(item.name, "package name", 128),
      currentVersion: stringField(item.currentVersion, "current version", 128),
      latestVersion: stringField(item.latestVersion, "latest version", 128),
      releaseDate: stringField(item.releaseDate, "release date", 128),
      releaseUrl: httpsUrl(item.releaseUrl, "release URL"),
      changelogUrl: httpsUrl(item.changelogUrl, "changelog URL"),
      sourceTag: stringField(item.sourceTag, "source tag", 256),
      dependencyNotes: stringField(item.dependencyNotes, "dependency notes"),
    };
  });
  const names = packages.map((item) => item.name).sort();
  const expected = [...expectedPackages].sort();
  if (names.some((name, index) => name !== expected[index]))
    throw new Error("Nixpkgs researcher returned unexpected package names.");
  return { packages };
}

function researcherTask(state: ResearchState): string {
  return [
    `Research the requested Nixpkgs packages in ${state.context.repository}.`,
    `Requested packages: ${state.packages.join(", ")}.`,
    "Read the existing recipes first. Use official upstream release APIs, tags, changelogs, and project metadata.",
    "Choose the latest stable release, not a prerelease.",
    "Return exactly one JSON object with a packages array. Include exactly these string fields for every package: name, currentVersion, latestVersion, releaseDate, releaseUrl, changelogUrl, sourceTag, dependencyNotes.",
    "Return no Markdown, explanation, or extra fields. Do not guess source hashes. The main agent will obtain hashes locally.",
  ].join("\n");
}

export function registerResearchTool(
  pi: ExtensionAPI,
  options: {
    repository: string;
    getActive: () => ResearchState | undefined;
    setResearch: (result: ResearchResult, owner: ResearchState) => void;
  },
): () => Promise<void> {
  const activeRuns = new Set<{
    controller: AbortController;
    completed: Promise<void>;
    finish: () => void;
  }>();
  pi.registerTool({
    name: "nixpkgs_update_package_research",
    label: "Nixpkgs update package research",
    description:
      "Launch the read-only researcher for the active Nixpkgs update and return latest stable release metadata.",
    outputSchema: researchOutputSchema,
    parameters: Type.Object({
      packages: Type.Array(Type.String()),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const active = options.getActive();
      if (!active || active.sessionId !== ctx.sessionManager.getSessionId())
        return {
          content: [{ type: "text", text: "No active Nixpkgs update." }],
          details: {},
          isError: true,
        };
      if (active.context.repository !== options.repository)
        return {
          content: [
            { type: "text", text: "The active Nixpkgs repository is invalid." },
          ],
          details: {},
          isError: true,
        };
      if (active.phase !== "research")
        return {
          content: [
            {
              type: "text",
              text: "Research is only available during the research phase.",
            },
          ],
          details: {},
          isError: true,
        };
      if (
        params.packages.length !== active.packages.length ||
        params.packages.some((name) => !active.packages.includes(name))
      )
        return {
          content: [
            {
              type: "text",
              text: "Research packages do not match the active update.",
            },
          ],
          details: {},
          isError: true,
        };
      if (activeRuns.size > 0)
        return {
          content: [
            { type: "text", text: "Nixpkgs research is already running." },
          ],
          details: {},
          isError: true,
        };

      const controller = new AbortController();
      let finish!: () => void;
      const completed = new Promise<void>((resolve) => {
        finish = resolve;
      });
      const run = { controller, completed, finish };
      const abort = () => controller.abort();
      activeRuns.add(run);
      if (_signal?.aborted) controller.abort();
      else _signal?.addEventListener("abort", abort, { once: true });
      try {
        const output = await runReadOnlyPiAgent({
          context: ctx,
          config: researcherAgent,
          cwd: active.context.repository,
          prompt: researcherTask(active),
          evidenceFiles: [],
          includeFetchUrl: true,
          signal: controller.signal,
          timeoutMs: 30 * 60 * 1000,
        });
        const current = options.getActive();
        if (
          controller.signal.aborted ||
          current !== active ||
          current.sessionId !== ctx.sessionManager.getSessionId() ||
          current.phase !== "research"
        )
          throw new Error("The active Nixpkgs update changed during research.");
        const result = parseResearch(output, active.packages);
        options.setResearch(result, active);
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
          details: result,
          structuredContent: result,
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: error instanceof Error ? error.message : String(error),
            },
          ],
          details: {},
          isError: true,
        };
      } finally {
        _signal?.removeEventListener("abort", abort);
        activeRuns.delete(run);
        finish();
      }
    },
  });
  return async () => {
    const runs = [...activeRuns];
    for (const run of runs) run.controller.abort();
    await Promise.all(runs.map((run) => run.completed));
  };
}
