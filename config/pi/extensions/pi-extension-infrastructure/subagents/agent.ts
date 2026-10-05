import { realpath } from "node:fs/promises";
import { homedir } from "node:os";
import { isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import {
  Agent,
  type AgentTool,
  type AgentToolUpdateCallback,
  type BeforeToolCallContext,
  type StreamFn,
  type ThinkingLevel,
} from "@earendil-works/pi-agent-core";
import {
  convertToLlm,
  createReadOnlyTools,
  type ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import {
  executeFetchUrl,
  MAX_FIND_TEXT_LENGTH,
  MAX_FIND_TEXT_QUERIES,
  type FetchUrlParams,
} from "../../web-tools/fetch-url.js";

export type PiAgentConfig = {
  model: string;
  thinkingLevel: ThinkingLevel;
  systemPrompt: string;
};

export type ReadOnlyPiAgentOptions = {
  context: ExtensionContext;
  config: PiAgentConfig;
  cwd: string;
  prompt: string;
  evidenceFiles: readonly string[];
  readRoots?: readonly string[];
  includeFetchUrl: boolean;
  signal: AbortSignal;
  timeoutMs?: number;
};

const maxConcurrentPiAgents = 4;
const globalPiAgentRunsKey = Symbol.for(
  "dotfiles.pi.extensions.subagents.active-pi-agents",
);
const globalPiAgentRunsRegistry = globalThis as typeof globalThis &
  Record<symbol, Set<symbol>>;
const activePiAgentRuns =
  globalPiAgentRunsRegistry[globalPiAgentRunsKey] ?? new Set<symbol>();
globalPiAgentRunsRegistry[globalPiAgentRunsKey] = activePiAgentRuns;

export class PiAgentCapacityError extends Error {
  constructor() {
    super("Project agent capacity is full");
    this.name = "PiAgentCapacityError";
  }
}

function reservePiAgentRun(): () => void {
  if (activePiAgentRuns.size >= maxConcurrentPiAgents)
    throw new PiAgentCapacityError();
  const token = Symbol();
  activePiAgentRuns.add(token);
  return () => activePiAgentRuns.delete(token);
}

const fetchUrlParameters = Type.Object(
  {
    url: Type.String(),
    findText: Type.Optional(
      Type.Union([
        Type.String({ maxLength: MAX_FIND_TEXT_LENGTH }),
        Type.Array(Type.String({ maxLength: MAX_FIND_TEXT_LENGTH }), {
          maxItems: MAX_FIND_TEXT_QUERIES,
        }),
      ]),
    ),
    findMode: Type.Optional(
      Type.Union([
        Type.Literal("exact"),
        Type.Literal("case-insensitive"),
        Type.Literal("fuzzy"),
      ]),
    ),
    range: Type.Optional(
      Type.Object(
        {
          start: Type.Integer({ minimum: 0 }),
          end: Type.Integer({ minimum: 0 }),
        },
        { additionalProperties: false },
      ),
    ),
  },
  { additionalProperties: false },
);

function createFetchUrlTool(): AgentTool<typeof fetchUrlParameters> {
  return {
    name: "fetch_url",
    label: "Fetch URL",
    description: "Fetch and inspect a URL.",
    parameters: fetchUrlParameters,
    async execute(_id, params, signal) {
      const result = await executeFetchUrl(
        params as FetchUrlParams,
        signal ?? new AbortController().signal,
      );
      return {
        content: result.content,
        details: result.details,
        isError: result.isError,
      };
    },
  };
}

function within(root: string, candidate: string): boolean {
  const path = relative(root, candidate);
  return (
    path === "" ||
    (path !== ".." && !path.startsWith(`..${sep}`) && !isAbsolute(path))
  );
}

function normalizeWindowsShellPath(filePath: string): string {
  if (
    !filePath.startsWith("/") ||
    filePath.startsWith("//") ||
    filePath.includes("\\")
  )
    return filePath;
  const match = filePath.match(/^\/(?:mnt\/|cygdrive\/)?([a-z])(?:\/(.*))?$/i);
  if (!match) return filePath;
  const suffix = match[2]?.replaceAll("/", "\\");
  return `${match[1].toUpperCase()}:\\${suffix ?? ""}`;
}

function resolveToolPath(filePath: string, cwd: string): string {
  let normalized = filePath.replace(
    /[\u00A0\u2000-\u200A\u202F\u205F\u3000]/g,
    " ",
  );
  if (normalized.startsWith("@")) normalized = normalized.slice(1);
  if (process.platform === "win32")
    normalized = normalizeWindowsShellPath(normalized);
  if (normalized === "~") normalized = homedir();
  else if (normalized.startsWith("~/"))
    normalized = join(homedir(), normalized.slice(2));
  if (/^file:\/\//.test(normalized)) normalized = fileURLToPath(normalized);
  return resolve(cwd, normalized);
}

function isProtectedPath(filePath: string): boolean {
  return filePath
    .replaceAll("\\", "/")
    .split("/")
    .some((part) => part.startsWith(".env"));
}

function containsProtectedGrepResults(text: string): boolean {
  return text.split("\n").some((line) => {
    const match = line.match(/^(.*?)(?:[:\-])\d+(?:[:\-]) /);
    return match !== null && isProtectedPath(match[1]);
  });
}

function protectGrepResults(tool: AgentTool): AgentTool {
  if (tool.name !== "grep") return tool;
  let foundProtectedResults = false;
  const blockedResult = {
    content: [
      {
        type: "text" as const,
        text: "Search results from protected paths were blocked.",
      },
    ],
    details: undefined,
    isError: true,
  };
  return {
    ...tool,
    execute: async (toolCallId, params, signal, onUpdate) => {
      foundProtectedResults = false;
      const guardedUpdate = onUpdate
        ? (partial: Parameters<AgentToolUpdateCallback>[0]) => {
            const containsProtectedPath = partial.content.some(
              (item) =>
                item.type === "text" && containsProtectedGrepResults(item.text),
            );
            if (containsProtectedPath) foundProtectedResults = true;
            onUpdate(foundProtectedResults ? blockedResult : partial);
          }
        : undefined;
      const result = await tool.execute(
        toolCallId,
        params,
        signal,
        guardedUpdate,
      );
      const containsProtectedPath = result.content.some(
        (item) =>
          item.type === "text" && containsProtectedGrepResults(item.text),
      );
      if (containsProtectedPath) foundProtectedResults = true;
      return foundProtectedResults ? blockedResult : result;
    },
  };
}

async function allowedReadPaths(
  cwd: string,
  readRoots: readonly string[],
  evidenceFiles: readonly string[],
): Promise<{ repositoryRoots: Set<string>; evidencePaths: Set<string> }> {
  const repositoryRoots = new Set(
    await Promise.all([cwd, ...readRoots].map((path) => realpath(path))),
  );
  const evidencePaths = new Set(
    await Promise.all(evidenceFiles.map((path) => realpath(path))),
  );
  return { repositoryRoots, evidencePaths };
}

function createReadPathGuard(
  repositoryRoots: ReadonlySet<string>,
  evidencePaths: ReadonlySet<string>,
) {
  return async ({ toolCall }: BeforeToolCallContext) => {
    if (toolCall.name === "fetch_url") return undefined;

    const args = toolCall.arguments as { path?: unknown };
    let requestedPath: string;
    try {
      requestedPath =
        typeof args.path === "string"
          ? resolveToolPath(
              args.path,
              repositoryRoots.values().next().value ?? process.cwd(),
            )
          : (repositoryRoots.values().next().value ?? process.cwd());
    } catch {
      return {
        block: true,
        reason: "This agent can only read its configured roots and evidence.",
      };
    }
    let actualPath: string;
    try {
      actualPath = await realpath(requestedPath);
    } catch {
      return {
        block: true,
        reason: "This agent can only read its configured roots and evidence.",
      };
    }

    if (isProtectedPath(requestedPath) || isProtectedPath(actualPath))
      return {
        block: true,
        reason: "Paths beginning with .env are protected.",
      };

    if (
      [...repositoryRoots].some((root) => within(root, actualPath)) ||
      evidencePaths.has(actualPath)
    )
      return undefined;
    return {
      block: true,
      reason: "This agent can only read its configured roots and evidence.",
    };
  };
}

function modelReference(reference: string): { provider: string; id: string } {
  const separator = reference.indexOf("/");
  if (separator <= 0 || separator === reference.length - 1)
    throw new Error(`Invalid agent model reference: ${reference}.`);
  return {
    provider: reference.slice(0, separator),
    id: reference.slice(separator + 1),
  };
}

function agentOutput(agent: Agent): string {
  let finalMessage: (typeof agent.state.messages)[number] | undefined;
  for (const message of [...agent.state.messages].reverse()) {
    if (message.role === "assistant") {
      finalMessage = message;
      break;
    }
  }
  if (!finalMessage || finalMessage.role !== "assistant")
    throw new Error("Agent returned no final response.");
  if (["error", "aborted", "length"].includes(finalMessage.stopReason))
    throw new Error(
      finalMessage.errorMessage ||
        `Agent stopped with ${finalMessage.stopReason}.`,
    );
  const output = finalMessage.content
    .filter((item) => item.type === "text")
    .map((item) => item.text)
    .join("\n")
    .trim();
  if (!output) throw new Error("Agent returned an empty response.");
  return output;
}

export async function runReadOnlyPiAgent({
  context,
  config,
  cwd,
  prompt,
  evidenceFiles,
  readRoots = [],
  includeFetchUrl,
  signal,
  timeoutMs,
}: ReadOnlyPiAgentOptions): Promise<string> {
  const releaseCapacity = reservePiAgentRun();
  try {
    const { provider, id } = modelReference(config.model);
    const model = context.modelRegistry.find(provider, id);
    if (!model)
      throw new Error(`Agent model ${config.model} is not available.`);

    const tools: AgentTool[] = [
      ...createReadOnlyTools(cwd).map(protectGrepResults),
      ...(includeFetchUrl ? [createFetchUrlTool()] : []),
    ];
    const { repositoryRoots, evidencePaths } = await allowedReadPaths(
      cwd,
      readRoots,
      evidenceFiles,
    );
    const streamFn: StreamFn = (requestedModel, transcript, options) =>
      context.modelRegistry.streamSimple(requestedModel, transcript, options);
    const agent = new Agent({
      initialState: {
        systemPrompt: config.systemPrompt,
        model,
        thinkingLevel: config.thinkingLevel,
        tools,
      },
      convertToLlm,
      streamFn,
      beforeToolCall: createReadPathGuard(repositoryRoots, evidencePaths),
      toolExecution: "sequential",
    });
    const effectiveTimeoutMs = timeoutMs ?? 30 * 60 * 1000;
    let timedOut = false;
    const abort = () => agent.abort();
    const timeout = setTimeout(() => {
      timedOut = true;
      agent.abort();
    }, effectiveTimeoutMs);
    signal.addEventListener("abort", abort, { once: true });

    try {
      if (signal.aborted) throw new Error("Agent run was cancelled.");
      await agent.prompt(prompt);
      if (timedOut)
        throw new Error(
          `Agent run timed out after ${effectiveTimeoutMs} milliseconds.`,
        );
      if (signal.aborted) throw new Error("Agent run was cancelled.");
      return agentOutput(agent);
    } catch (error) {
      if (timedOut)
        throw new Error(
          `Agent run timed out after ${effectiveTimeoutMs} milliseconds.`,
        );
      throw error;
    } finally {
      clearTimeout(timeout);
      signal.removeEventListener("abort", abort);
    }
  } finally {
    releaseCapacity();
  }
}
