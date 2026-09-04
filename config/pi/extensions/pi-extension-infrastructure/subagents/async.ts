import * as crypto from "node:crypto";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import {
  capacity,
  discover,
  errorMessage,
  parseCompletion,
  registerReady,
  spawn,
  status,
  stop,
  terminal,
  type Completion,
  type Json,
  type SpawnOutcome,
} from "./async-transport.js";

export type { Json };
export type AsyncCapabilities = {
  sessionId: string;
  allowedAgents: readonly string[];
  allowedTools: readonly string[];
};
type AsyncLaunchBase = {
  cwd: string;
  reads?: readonly string[];
  structuredOutputSchema?: Json;
  timeoutMs?: number;
  capabilities: AsyncCapabilities;
};
export type AsyncLaunch = AsyncLaunchBase &
  (
    | { agent: string; task: string; workflowScript?: never }
    | { workflowScript: string; agent?: never; task?: never }
  );
export type AsyncEvidence = { path: string; remove: () => Promise<void> };
export type AsyncCompletion = {
  text: string;
  value?: unknown;
  artifacts: readonly string[];
};
export type AsyncMessage = { content: string; details?: Json };
export type AsyncReport = AsyncMessage & { retainEvidence?: boolean };
export type AsyncContext = {
  readonly signal: AbortSignal;
  mutate: <T>(operation: (signal: AbortSignal) => Promise<T>) => Promise<T>;
};
export type AsyncJob = {
  label: string;
  launch: AsyncLaunch;
  evidence: AsyncEvidence;
  complete: (
    completion: AsyncCompletion,
    context: AsyncContext,
  ) => Promise<AsyncReport>;
};
export type AsyncJobs = {
  start: (...jobs: AsyncJob[]) => Promise<void>;
  stopAll: () => Promise<void>;
  shutdown: () => Promise<void>;
};

type Events = {
  on(event: string, handler: (value: unknown) => void): (() => void) | void;
};
type RecordState = {
  key: string;
  job: AsyncJob;
  controller: AbortController;
  finalizing: boolean;
  runId?: string;
  completion?: Completion;
  terminalObserved: boolean;
  incompleteScheduled: boolean;
  spawning?: Promise<SpawnOutcome>;
  spawnOutcome?: SpawnOutcome;
  processing?: Promise<void>;
  stopping?: Promise<void>;
  stopError?: unknown;
  mutationActive: boolean;
  mutationAmbiguous: boolean;
  cancelRequested: boolean;
  finalPromise: Promise<void>;
  resolveFinal: () => void;
};

const terminalWaitMs = 5_000;
const earlyEventTtlMs = 30_000;

function eventsFor(pi: ExtensionAPI): Events {
  return pi.events as unknown as Events;
}
function genericFailure(job: AsyncJob, reason: string): AsyncReport {
  return {
    content: `${job.label} did not finish safely: ${reason}. Evidence retained at ${job.evidence.path}.`,
    details: { evidenceDirectory: job.evidence.path },
    retainEvidence: true,
  };
}
function notStarted(job: AsyncJob, reason: string): AsyncReport {
  return {
    content: `${job.label} did not start: ${reason}.`,
  };
}

export function createAsyncJobs(
  pi: ExtensionAPI,
  options: { source: string; customType: string },
): AsyncJobs {
  registerReady(pi);
  const events = eventsFor(pi);
  const jobs = new Map<string, RecordState>();
  const byRun = new Map<string, RecordState>();
  const earlyCompletions = new Map<
    string,
    { value: unknown; expires: number }
  >();
  const earlyTerminals = new Map<
    string,
    { observed: boolean; expires: number }
  >();
  const subscriptions = new Set<() => void>();
  let shuttingDown = false;
  let shutdownPromise: Promise<void> | undefined;
  const discovered = discover(pi, options.source).then((found) => {
    if (shuttingDown) return;
    const completionUnsubscribe = events.on(found.completionEvent, (raw) => {
      let runId = "";
      try {
        const candidate =
          raw && typeof raw === "object"
            ? (raw as Record<string, unknown>)
            : {};
        runId =
          typeof candidate.runId === "string"
            ? candidate.runId
            : typeof candidate.id === "string"
              ? candidate.id
              : "";
        const completion = parseCompletion(raw);
        runId = completion.runId;
        const run = byRun.get(runId);
        if (!run) {
          earlyCompletions.set(runId, {
            value: raw,
            expires: Date.now() + earlyEventTtlMs,
          });
          return;
        }
        if (run.finalizing || run.completion) return;
        run.completion = completion;
        void process(run);
      } catch (error) {
        const run = runId ? byRun.get(runId) : undefined;
        if (run && !run.finalizing)
          void finalize(
            run,
            genericFailure(
              run.job,
              `completion was malformed (${errorMessage(error)})`,
            ),
          );
        else if (runId)
          earlyCompletions.set(runId, {
            value: raw,
            expires: Date.now() + earlyEventTtlMs,
          });
      }
    });
    if (typeof completionUnsubscribe === "function")
      subscriptions.add(completionUnsubscribe);
    const terminalUnsubscribe = events.on(found.terminalEvent, (raw) => {
      const observed = terminal(raw);
      if (!observed) return;
      const run = byRun.get(observed.runId);
      if (!run) {
        earlyTerminals.set(observed.runId, {
          observed: observed.observed,
          expires: Date.now() + earlyEventTtlMs,
        });
        return;
      }
      if (run.finalizing) return;
      if (observed.observed) run.terminalObserved = true;
      if (run.completion) void process(run);
      else scheduleIncomplete(run);
    });
    if (typeof terminalUnsubscribe === "function")
      subscriptions.add(terminalUnsubscribe);
  });
  // Discovery is intentionally allowed to reject; every start turns it into a
  // pre-dispatch final report rather than creating an unhandled rejection.
  void discovered.catch(() => undefined);

  function forget(run: RecordState): void {
    jobs.delete(run.key);
    if (run.runId && byRun.get(run.runId) === run) byRun.delete(run.runId);
  }
  function scheduleIncomplete(run: RecordState): void {
    if (run.incompleteScheduled) return;
    run.incompleteScheduled = true;
    setTimeout(() => {
      if (!run.finalizing && !run.stopping && !run.completion)
        void finalize(
          run,
          genericFailure(run.job, "the completion event was not observed"),
        );
    }, terminalWaitMs);
  }
  function waitForTerminal(run: RecordState): Promise<boolean> {
    if (run.terminalObserved) return Promise.resolve(true);
    if (!run.runId) return Promise.resolve(false);
    const cached = earlyTerminals.get(run.runId);
    if (cached && cached.expires > Date.now()) {
      earlyTerminals.delete(run.runId);
      run.terminalObserved = cached.observed;
      return Promise.resolve(cached.observed);
    }
    if (cached) earlyTerminals.delete(run.runId);
    return new Promise((resolve) => {
      let poll: ReturnType<typeof setInterval>;
      const timer = setTimeout(() => {
        clearInterval(poll);
        resolve(false);
      }, terminalWaitMs);
      poll = setInterval(() => {
        if (run.terminalObserved || run.finalizing) {
          clearTimeout(timer);
          clearInterval(poll);
          resolve(run.terminalObserved);
        }
      }, 25);
    });
  }
  async function removeEvidence(run: RecordState): Promise<boolean> {
    try {
      await run.job.evidence.remove();
      return true;
    } catch {
      return false;
    }
  }
  async function finalize(
    run: RecordState,
    report: AsyncReport,
  ): Promise<void> {
    if (run.finalizing) return run.finalPromise;
    run.finalizing = true;
    forget(run);
    let finalReport = report;
    if (run.mutationAmbiguous) {
      finalReport = genericFailure(
        run.job,
        "cancellation interrupted a mutation; its result is ambiguous",
      );
    }
    const retain = finalReport.retainEvidence === true;
    if (!retain) {
      const removed = await removeEvidence(run);
      if (!removed) {
        finalReport = genericFailure(run.job, "evidence cleanup failed");
      }
    }
    if (run.stopError && run.terminalObserved) {
      const diagnostic = `stop request failed (${errorMessage(run.stopError)})`;
      finalReport = {
        ...finalReport,
        content: `${finalReport.content}\n\nStop diagnostic: ${diagnostic}.`,
        details: { ...(finalReport.details ?? {}), stopError: diagnostic },
      };
    }
    if (
      finalReport.retainEvidence === true &&
      !finalReport.content.includes(run.job.evidence.path)
    ) {
      finalReport = {
        ...finalReport,
        content: `${finalReport.content}\n\nEvidence retained at ${run.job.evidence.path}.`,
      };
    }
    try {
      pi.sendMessage(
        {
          customType: options.customType,
          content: finalReport.content,
          details: finalReport.details ?? {},
          display: true,
        },
        { triggerTurn: false, deliverAs: "followUp" },
      );
    } catch {
      /* final reporting cannot reopen a finalized job */
    }
    run.resolveFinal();
  }
  async function process(run: RecordState): Promise<void> {
    if (run.processing || run.finalizing || !run.completion || !run.runId)
      return;
    run.processing = (async () => {
      const completion = run.completion!;
      if (completion.runId !== run.runId) {
        await finalize(
          run,
          genericFailure(run.job, "completion did not correlate to its run"),
        );
        return;
      }
      if (!(await waitForTerminal(run))) {
        await finalize(
          run,
          genericFailure(run.job, "the terminal event was not observed"),
        );
        return;
      }
      if (
        run.cancelRequested ||
        run.controller.signal.aborted ||
        shuttingDown
      ) {
        await finalize(run, {
          content: `${run.job.label} was cancelled.`,
          ...(run.mutationAmbiguous ? { retainEvidence: true } : {}),
        });
        return;
      }
      const success =
        completion.success !== false &&
        ["complete", "completed", "success", "succeeded"].includes(
          completion.status.toLowerCase(),
        );
      if (!success) {
        await finalize(
          run,
          genericFailure(
            run.job,
            `the child operation ended with status ${completion.status || "unknown"}`,
          ),
        );
        return;
      }
      try {
        const result = await run.job.complete(
          {
            text: completion.text,
            ...(completion.value !== undefined
              ? { value: completion.value }
              : {}),
            artifacts: completion.artifacts,
          },
          {
            signal: run.controller.signal,
            mutate: async <T>(
              operation: (signal: AbortSignal) => Promise<T>,
            ): Promise<T> => {
              if (run.controller.signal.aborted)
                throw new Error("Mutation was cancelled before it started.");
              run.mutationActive = true;
              try {
                const value = await operation(run.controller.signal);
                if (run.controller.signal.aborted) {
                  run.mutationAmbiguous = true;
                  throw new Error(
                    "Mutation was interrupted; its result is ambiguous.",
                  );
                }
                return value;
              } catch (error) {
                if (run.controller.signal.aborted) run.mutationAmbiguous = true;
                throw error;
              } finally {
                run.mutationActive = false;
              }
            },
          },
        );
        await finalize(run, result);
      } catch (error) {
        await finalize(run, genericFailure(run.job, errorMessage(error)));
      }
    })();
    await run.processing;
  }
  async function stopOne(run: RecordState): Promise<void> {
    if (run.finalizing) return run.finalPromise;
    if (run.stopping) return run.stopping;
    run.stopping = (async () => {
      run.cancelRequested = true;
      run.controller.abort();

      // An emitted spawn request may still be awaiting its acknowledgement.
      // Classify it before deciding whether cleanup or a stop is safe.
      let spawnOutcome: SpawnOutcome | undefined = run.spawnOutcome;
      if (run.spawning) {
        try {
          spawnOutcome = await run.spawning;
        } catch (error) {
          spawnOutcome = { state: "uncertain", error };
        }
      }
      if (spawnOutcome) run.spawnOutcome = spawnOutcome;
      if (run.finalizing) return run.finalPromise;
      if (spawnOutcome?.state === "uncertain") {
        await finalize(
          run,
          genericFailure(
            run.job,
            `dispatch acknowledgement was uncertain (${errorMessage(spawnOutcome.error)})`,
          ),
        );
        return;
      }
      if (spawnOutcome?.state === "started" && !run.runId) {
        run.runId = spawnOutcome.runId;
        byRun.set(spawnOutcome.runId, run);
      }

      if (run.runId && !run.terminalObserved) {
        try {
          await stop(pi, options.source, run.runId);
        } catch (error) {
          run.stopError = error;
        }
        if (!run.terminalObserved) await waitForTerminal(run);
        if (run.stopError && !run.terminalObserved) {
          await finalize(
            run,
            genericFailure(
              run.job,
              `stop failed (${errorMessage(run.stopError)})`,
            ),
          );
          return;
        }
      }
      if (run.processing) await run.processing;
      if (!run.finalizing) {
        if (run.runId && !run.terminalObserved)
          await finalize(
            run,
            genericFailure(run.job, "safe terminal handling was not confirmed"),
          );
        else
          await finalize(run, { content: `${run.job.label} was cancelled.` });
      }
    })();
    await run.stopping;
  }
  function makeRecord(job: AsyncJob): RecordState {
    let resolveFinal!: () => void;
    const finalPromise = new Promise<void>((resolve) => {
      resolveFinal = resolve;
    });
    return {
      key: crypto.randomUUID(),
      job,
      controller: new AbortController(),
      finalizing: false,
      terminalObserved: false,
      incompleteScheduled: false,
      mutationActive: false,
      mutationAmbiguous: false,
      cancelRequested: false,
      finalPromise,
      resolveFinal,
    };
  }
  async function start(...input: AsyncJob[]): Promise<void> {
    if (!input.length) return;
    const records = input.map(makeRecord);
    records.forEach((run) => jobs.set(run.key, run));
    let preparationError: unknown;
    try {
      if (shuttingDown) throw new Error("service is shutting down");
      await discovered;
      capacity(
        await requestStatus(),
        records.length,
        `${records.length} async job${records.length === 1 ? "" : "s"}`,
      );
    } catch (error) {
      preparationError = error;
    }
    if (preparationError) {
      await Promise.all(
        records.map(async (run) => {
          await finalize(
            run,
            notStarted(run.job, errorMessage(preparationError)),
          );
        }),
      );
      return;
    }
    await Promise.all(
      records.map(async (run) => {
        if (shuttingDown || run.controller.signal.aborted) {
          await finalize(run, notStarted(run.job, "service is shutting down"));
          return;
        }
        const spawning = spawn(
          pi,
          options.source,
          run.job.launch,
          run.controller.signal,
        );
        run.spawning = spawning;
        const result = await spawning;
        run.spawnOutcome = result;
        if (run.finalizing) return;
        if (result.state !== "started") {
          await finalize(
            run,
            result.state === "not-dispatched"
              ? notStarted(run.job, errorMessage(result.error))
              : genericFailure(
                  run.job,
                  `dispatch acknowledgement was uncertain (${errorMessage(result.error)})`,
                ),
          );
          return;
        }
        run.runId = result.runId;
        byRun.set(result.runId, run);
        const cachedCompletion = earlyCompletions.get(result.runId);
        if (cachedCompletion && cachedCompletion.expires > Date.now()) {
          earlyCompletions.delete(result.runId);
          try {
            run.completion = parseCompletion(cachedCompletion.value);
          } catch (error) {
            await finalize(
              run,
              genericFailure(
                run.job,
                `completion was malformed (${errorMessage(error)})`,
              ),
            );
            return;
          }
        } else if (cachedCompletion) earlyCompletions.delete(result.runId);
        const cachedTerminal = earlyTerminals.get(result.runId);
        if (cachedTerminal && cachedTerminal.expires > Date.now()) {
          earlyTerminals.delete(result.runId);
          run.terminalObserved = cachedTerminal.observed;
        } else if (cachedTerminal) earlyTerminals.delete(result.runId);
        if (run.completion) void process(run);
        else scheduleIncomplete(run);
      }),
    );
    await Promise.all(records.map((run) => run.finalPromise));
  }
  async function requestStatus(): Promise<Json> {
    return status(pi, options.source);
  }
  async function stopAll(): Promise<void> {
    await Promise.all([...jobs.values()].map(stopOne));
  }
  function unsubscribeAll(): void {
    for (const unsubscribe of subscriptions) {
      try {
        unsubscribe();
      } catch {
        /* host shutdown */
      }
    }
    subscriptions.clear();
  }
  function shutdown(): Promise<void> {
    if (shutdownPromise) return shutdownPromise;
    shuttingDown = true;
    shutdownPromise = (async () => {
      await stopAll();
      await Promise.all([...jobs.values()].map((run) => run.finalPromise));
      unsubscribeAll();
      earlyCompletions.clear();
      earlyTerminals.clear();
    })();
    return shutdownPromise;
  }
  return { start, stopAll, shutdown };
}
