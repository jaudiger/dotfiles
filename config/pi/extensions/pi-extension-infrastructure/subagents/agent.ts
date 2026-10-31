import {
  createAgentSession,
  createExtensionRuntime,
  getAgentDir,
  SessionManager,
  SettingsManager,
  type AgentSession,
  type CreateAgentSessionOptions,
  type ExtensionContext,
  type ResourceLoader,
  type ToolDefinition,
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
  thinkingLevel: NonNullable<CreateAgentSessionOptions["thinkingLevel"]>;
  systemPrompt: string;
};

export type ReadOnlyPiAgentOptions = {
  context: ExtensionContext;
  config: PiAgentConfig;
  cwd: string;
  prompt: string;
  includeFetchUrl: boolean;
  signal: AbortSignal;
  timeoutMs?: number;
  settings: PiAgentSettings;
};

export type PiAgentSettings = ReturnType<SettingsManager["getSettings"]>;

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

function createFetchUrlTool(): ToolDefinition<typeof fetchUrlParameters> {
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

function createResourceLoader(systemPrompt: string): ResourceLoader {
  const extensionsResult = {
    extensions: [],
    errors: [],
    runtime: createExtensionRuntime(),
  };
  return {
    getExtensions: () => extensionsResult,
    getSkills: () => ({ skills: [], diagnostics: [] }),
    getPrompts: () => ({ prompts: [], diagnostics: [] }),
    getThemes: () => ({ themes: [], diagnostics: [] }),
    getAgentsFiles: () => ({ agentsFiles: [] }),
    getSystemPrompt: () => systemPrompt,
    getSystemPromptSource: () => undefined,
    getAppendSystemPrompt: () => [],
    getAppendSystemPromptSources: () => [],
    extendResources: () => undefined,
    reload: async () => undefined,
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

function agentOutput(session: AgentSession): string {
  const finalMessage = [...session.messages]
    .reverse()
    .find((message) => message.role === "assistant");
  if (finalMessage?.role !== "assistant")
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

type AgentRunStopReason = "cancelled" | "timed-out";

function agentRunStopError(
  reason: AgentRunStopReason,
  timeoutMs: number,
): Error {
  return reason === "timed-out"
    ? new Error(`Agent run timed out after ${timeoutMs} milliseconds.`)
    : new Error("Agent run was cancelled.");
}

export async function runReadOnlyPiAgent({
  context,
  config,
  cwd,
  prompt,
  includeFetchUrl,
  signal,
  timeoutMs,
  settings,
}: ReadOnlyPiAgentOptions): Promise<string> {
  const releaseCapacity = reservePiAgentRun();
  let session: AgentSession | undefined;
  let stopRequested = false;
  let stopReason: AgentRunStopReason | undefined;
  let transferred = false;
  const effectiveTimeoutMs = timeoutMs ?? 30 * 60 * 1000;
  let resolveStop!: (reason: AgentRunStopReason) => void;
  const stopped = new Promise<AgentRunStopReason>((resolve) => {
    resolveStop = resolve;
  });
  const stop = (reason: AgentRunStopReason) => {
    if (stopReason) return;
    stopReason = reason;
    stopRequested = true;
    resolveStop(reason);
    void session?.abort().catch(() => undefined);
  };
  const abort = () => stop("cancelled");
  const timeout = setTimeout(() => stop("timed-out"), effectiveTimeoutMs);
  signal.addEventListener("abort", abort, { once: true });
  const clearInterruption = () => {
    clearTimeout(timeout);
    signal.removeEventListener("abort", abort);
  };
  let unsubscribe: () => void = () => {};

  try {
    if (signal.aborted) stop("cancelled");
    if (stopReason) throw agentRunStopError(stopReason, effectiveTimeoutMs);
    const { provider, id } = modelReference(config.model);
    const model = context.modelRegistry.find(provider, id);
    if (!model)
      throw new Error(`Agent model ${config.model} is not available.`);

    const creation = createAgentSession({
      agentDir: getAgentDir(),
      cwd,
      model,
      thinkingLevel: config.thinkingLevel,
      noTools: "all",
      tools: [
        "read",
        "grep",
        "find",
        "ls",
        ...(includeFetchUrl ? ["fetch_url"] : []),
      ],
      customTools: includeFetchUrl ? [createFetchUrlTool()] : [],
      resourceLoader: createResourceLoader(config.systemPrompt),
      sessionManager: SessionManager.inMemory(cwd),
      settingsManager: SettingsManager.inMemory({
        ...settings,
        cacheWarming: "off",
        compaction: { ...settings.compaction, enabled: false },
      }),
    });
    const creationOutcome = await Promise.race([
      creation.then(
        (result) => ({ kind: "created" as const, result }),
        (error: unknown) => ({ kind: "failed" as const, error }),
      ),
      stopped.then((reason) => ({ kind: "stopped" as const, reason })),
    ]);
    if (creationOutcome.kind === "stopped") {
      transferred = true;
      clearInterruption();
      void creation
        .then(
          ({ session: lateSession }) => {
            try {
              lateSession.dispose();
            } finally {
              releaseCapacity();
            }
          },
          () => releaseCapacity(),
        )
        .catch(() => undefined);
      throw agentRunStopError(creationOutcome.reason, effectiveTimeoutMs);
    }
    if (creationOutcome.kind === "failed") throw creationOutcome.error;
    session = creationOutcome.result.session;
    unsubscribe = session.subscribe((event) => {
      if (event.type === "agent_start" && (stopRequested || signal.aborted))
        void session?.abort().catch(() => undefined);
    });
    if (stopReason) throw agentRunStopError(stopReason, effectiveTimeoutMs);

    const promptRun = session.prompt(prompt, { expandPromptTemplates: false });
    const promptOutcome = await Promise.race([
      promptRun.then(
        () => ({ kind: "completed" as const }),
        (error: unknown) => ({ kind: "failed" as const, error }),
      ),
      stopped.then((reason) => ({ kind: "stopped" as const, reason })),
    ]);
    if (promptOutcome.kind === "stopped") {
      transferred = true;
      clearInterruption();
      const activeSession = session;
      const stopSubscription = unsubscribe;
      void promptRun
        .then(
          () => undefined,
          () => undefined,
        )
        .then(() => {
          try {
            stopSubscription();
          } finally {
            try {
              activeSession?.dispose();
            } finally {
              releaseCapacity();
            }
          }
        })
        .catch(() => undefined);
      throw agentRunStopError(promptOutcome.reason, effectiveTimeoutMs);
    }
    if (promptOutcome.kind === "failed") throw promptOutcome.error;
    if (stopReason) throw agentRunStopError(stopReason, effectiveTimeoutMs);
    return agentOutput(session);
  } catch (error) {
    if (stopReason) throw agentRunStopError(stopReason, effectiveTimeoutMs);
    throw error;
  } finally {
    if (!transferred) {
      clearInterruption();
      unsubscribe();
      try {
        session?.dispose();
      } finally {
        releaseCapacity();
      }
    }
  }
}
