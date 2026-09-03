import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

type SupervisorEvents = {
  on(event: string, handler: (data: unknown) => void): (() => void) | void;
};

type StopFailureHandler<Owner, State> = (
  run: AsyncRun<Owner, State>,
  error: unknown,
) => Promise<void> | void;

export type AsyncRun<Owner, State = undefined> = {
  id: string;
  owner: Owner;
  state: State;
  completionReceived: boolean;
  completion?: unknown;
  processing: boolean;
  terminalObserved: boolean;
  stopping: boolean;
  cleaned: boolean;
};

export type AsyncRunSupervisorOptions<Owner, State = undefined> = {
  pi: ExtensionAPI;
  discoverEvents: () => Promise<{
    asyncComplete: string;
    processTerminal: string;
  }>;
  runId: (value: unknown) => string;
  completionRunId: (value: unknown) => string;
  processTerminalRunId: (value: unknown) => string;
  processTerminalState: (value: unknown) => string;
  stop: (runId: string) => Promise<unknown>;
  onCompletion: (
    run: AsyncRun<Owner, State>,
    payload: unknown,
  ) => Promise<void>;
  cleanup: (run: AsyncRun<Owner, State>) => Promise<boolean | void>;
  /** Retry resources prepared before a supervisor run could be attached. */
  cleanupUnstarted?: () => Promise<void>;
  createState?: (owner: Owner) => State;
  shouldStop?: (owner: Owner) => boolean;
  retainCompletedRuns?: boolean;
  onCompletionError?: (
    run: AsyncRun<Owner, State>,
    error: unknown,
  ) => Promise<void> | void;
  /** Report a stop request failure or missing terminal event. */
  onStopFailure?: StopFailureHandler<Owner, State>;
};

export type AsyncRunSupervisor<Owner, State = undefined> = {
  readonly shuttingDown: boolean;
  readonly runs: ReadonlyMap<string, AsyncRun<Owner, State>>;
  discoverEvents: () => Promise<void>;
  start: (
    owner: Owner,
    spawn: () => Promise<unknown | undefined>,
  ) => Promise<AsyncRun<Owner, State> | undefined>;
  stopAll: () => Promise<void>;
  shutdown: () => Promise<void>;
};

function eventsFor(pi: ExtensionAPI): SupervisorEvents {
  return pi.events as unknown as SupervisorEvents;
}

/**
 * Own the event and shutdown lifecycle for one provider-neutral async run
 * fleet. Resource cleanup remains an owner callback because only the consumer
 * knows when its evidence or temporary directory may be removed.
 */
export function createAsyncRunSupervisor<Owner, State = undefined>(
  options: AsyncRunSupervisorOptions<Owner, State>,
): AsyncRunSupervisor<Owner, State> {
  const events = eventsFor(options.pi);
  const runs = new Map<string, AsyncRun<Owner, State>>();
  const earlyCompletions = new Map<string, unknown>();
  const earlyTerminals = new Map<string, string>();
  const terminalStates = new Map<string, string>();
  const terminalWaiters = new Map<string, Set<(observed: boolean) => void>>();
  const cleanupPromises = new Map<string, Promise<void>>();
  const stopPromises = new Map<string, Promise<boolean>>();
  const stopOutcomes = new Map<string, "pending" | "succeeded" | "failed">();
  const spawningPromises = new Set<Promise<void>>();
  const processingPromises = new Set<Promise<void>>();
  const subscriptions = new Set<() => void>();
  const completionSubscriptions = new Set<string>();
  const terminalSubscriptions = new Set<string>();
  const reportedStopFailures = new Set<string>();
  let spawning = 0;
  let shuttingDown = false;
  let shutdownPromise: Promise<void> | undefined;

  const waitForProcessTerminal = (runId: string): Promise<boolean> => {
    const state = terminalStates.get(runId);
    if (state === "observed") return Promise.resolve(true);
    if (state === "unknown") return Promise.resolve(false);
    return new Promise((resolve) => {
      const waiters = terminalWaiters.get(runId) ?? new Set();
      let settled = false;
      const finish = (observed: boolean) => {
        if (settled) return;
        settled = true;
        waiters.delete(finish);
        if (waiters.size === 0) terminalWaiters.delete(runId);
        clearTimeout(timeout);
        resolve(observed);
      };
      const timeout = setTimeout(() => finish(false), 5_000);
      waiters.add(finish);
      terminalWaiters.set(runId, waiters);
    });
  };

  const reportStopFailure = async (
    run: AsyncRun<Owner, State>,
    error: unknown,
  ): Promise<void> => {
    if (!options.onStopFailure || reportedStopFailures.has(run.id)) return;
    reportedStopFailures.add(run.id);
    try {
      await options.onStopFailure(run, error);
    } catch {
      // Failure reporting must not prevent preserving the unfinished run.
    }
  };

  const cleanupRun = (run: AsyncRun<Owner, State>): Promise<void> => {
    if (!run.terminalObserved || run.cleaned) return Promise.resolve();
    // A terminal event may race with the stop RPC. Preserve the run and its
    // resources until the stop attempt has succeeded.
    if (run.stopping && stopOutcomes.get(run.id) !== "succeeded")
      return Promise.resolve();
    // Shutdown marks the fleet as stopping before stopRun can claim each run.
    if (shuttingDown && !run.stopping) return Promise.resolve();
    const existing = cleanupPromises.get(run.id);
    if (existing) return existing;
    const operation = (async () => {
      try {
        const cleaned = await options.cleanup(run);
        if (cleaned !== false) {
          run.cleaned = true;
          runs.delete(run.id);
          terminalStates.delete(run.id);
          reportedStopFailures.delete(run.id);
          stopOutcomes.delete(run.id);
        }
      } catch {
        // Owners retain resources and the run when cleanup is unsafe.
      } finally {
        cleanupPromises.delete(run.id);
      }
    })();
    cleanupPromises.set(run.id, operation);
    return operation;
  };

  const stopRun = (run: AsyncRun<Owner, State>): Promise<boolean> => {
    const existing = stopPromises.get(run.id);
    if (existing) return existing;
    const operation = (async () => {
      run.stopping = true;
      let stopError: unknown;
      const previousOutcome = stopOutcomes.get(run.id);
      const requestStop = !run.terminalObserved || previousOutcome === "failed";
      if (requestStop) {
        stopOutcomes.set(run.id, "pending");
        try {
          await options.stop(run.id);
          stopOutcomes.set(run.id, "succeeded");
        } catch (error) {
          stopOutcomes.set(run.id, "failed");
          stopError = error;
        }
        if (!run.terminalObserved)
          run.terminalObserved = await waitForProcessTerminal(run.id);
      } else if (!previousOutcome) {
        // A naturally terminal run does not need a stop RPC.
        stopOutcomes.set(run.id, "succeeded");
      }
      if (stopError || !run.terminalObserved) {
        const stopMessage = stopError
          ? `Stop request failed: ${String(stopError)}`
          : "";
        const terminalMessage = run.terminalObserved
          ? ""
          : "Process terminal state was not observed after stop.";
        await reportStopFailure(
          run,
          new Error([stopMessage, terminalMessage].filter(Boolean).join(" ")),
        );
      } else await cleanupRun(run);
      return run.terminalObserved;
    })();
    stopPromises.set(run.id, operation);
    void operation.then(
      () => stopPromises.delete(run.id),
      () => stopPromises.delete(run.id),
    );
    return operation;
  };

  const processCompletion = async (
    run: AsyncRun<Owner, State>,
  ): Promise<void> => {
    try {
      if (!run.terminalObserved)
        run.terminalObserved = await waitForProcessTerminal(run.id);
      if (!run.terminalObserved) return;
      if (run.stopping || shuttingDown) {
        await cleanupRun(run);
        return;
      }
      await options.onCompletion(run, run.completion);
    } finally {
      run.processing = false;
      if (
        run.cleaned ||
        (!options.retainCompletedRuns && !run.stopping && !shuttingDown)
      ) {
        runs.delete(run.id);
        terminalStates.delete(run.id);
        reportedStopFailures.delete(run.id);
      }
    }
  };

  const startCompletion = (run: AsyncRun<Owner, State>): void => {
    if (run.processing || !run.completionReceived) return;
    run.processing = true;
    const promise = processCompletion(run).catch(async (error: unknown) => {
      if (options.onCompletionError)
        await options.onCompletionError(run, error);
    });
    processingPromises.add(promise);
    void promise.then(
      () => processingPromises.delete(promise),
      () => processingPromises.delete(promise),
    );
  };

  const subscribeCompletion = (event: string): void => {
    if (completionSubscriptions.has(event)) return;
    completionSubscriptions.add(event);
    const unsubscribe = events.on(event, (raw) => {
      const runId = options.completionRunId(raw);
      const run = runs.get(runId);
      if (run) {
        if (!run.completionReceived) {
          run.completion = raw;
          run.completionReceived = true;
          startCompletion(run);
        }
      } else if (spawning > 0 && runId) {
        earlyCompletions.set(runId, raw);
      }
    });
    if (typeof unsubscribe === "function") subscriptions.add(unsubscribe);
  };

  const subscribeTerminal = (event: string): void => {
    if (terminalSubscriptions.has(event)) return;
    terminalSubscriptions.add(event);
    const unsubscribe = events.on(event, (raw) => {
      const runId = options.processTerminalRunId(raw);
      const state = options.processTerminalState(raw);
      if (!runId || !state) return;
      terminalStates.set(runId, state);
      const run = runs.get(runId);
      if (!run) {
        if (spawning > 0) earlyTerminals.set(runId, state);
        return;
      }
      if (state === "observed") run.terminalObserved = true;
      const waiters = terminalWaiters.get(runId);
      if (waiters)
        for (const finish of [...waiters]) finish(state === "observed");
      if (run.completionReceived) startCompletion(run);
    });
    if (typeof unsubscribe === "function") subscriptions.add(unsubscribe);
  };

  const discoverEvents = async (): Promise<void> => {
    if (shuttingDown) return;
    const discovered = await options.discoverEvents();
    if (shuttingDown) return;
    subscribeCompletion(discovered.asyncComplete);
    subscribeTerminal(discovered.processTerminal);
  };

  const start = (
    owner: Owner,
    spawn: () => Promise<unknown | undefined>,
  ): Promise<AsyncRun<Owner, State> | undefined> => {
    const operation = (async () => {
      if (shuttingDown) return undefined;
      spawning += 1;
      try {
        if (shuttingDown) return undefined;
        const rpc = await spawn();
        if (!rpc) return undefined;
        const id = options.runId(rpc);
        if (!id) throw new Error("Subagent started without a run identifier.");
        const earlyTerminal = earlyTerminals.get(id);
        earlyTerminals.delete(id);
        if (earlyTerminal) terminalStates.set(id, earlyTerminal);
        const run: AsyncRun<Owner, State> = {
          id,
          owner,
          state: options.createState
            ? options.createState(owner)
            : (undefined as State),
          completionReceived: false,
          processing: false,
          terminalObserved:
            earlyTerminal === "observed" ||
            terminalStates.get(id) === "observed",
          stopping: shuttingDown || options.shouldStop?.(owner) === true,
          cleaned: false,
        };
        runs.set(id, run);
        if (run.stopping) {
          await stopRun(run);
          return run;
        }
        if (earlyCompletions.has(id)) {
          run.completion = earlyCompletions.get(id);
          earlyCompletions.delete(id);
          run.completionReceived = true;
          startCompletion(run);
        }
        return run;
      } finally {
        spawning -= 1;
      }
    })();
    const tracked = operation.then(
      () => undefined,
      () => undefined,
    );
    spawningPromises.add(tracked);
    void tracked.then(() => spawningPromises.delete(tracked));
    return operation;
  };

  const stopAll = async (): Promise<void> => {
    await Promise.allSettled([...spawningPromises]);
    const ownedRuns = [...runs.values()];
    await Promise.all(ownedRuns.map(stopRun));
    await Promise.allSettled([...processingPromises]);
    await options.cleanupUnstarted?.();
    earlyCompletions.clear();
    earlyTerminals.clear();
  };

  const unsubscribeAll = (): void => {
    for (const unsubscribe of subscriptions) {
      try {
        unsubscribe();
      } catch {
        // Listener cleanup is best effort during host shutdown.
      }
    }
    subscriptions.clear();
    completionSubscriptions.clear();
    terminalSubscriptions.clear();
  };

  const shutdown = (): Promise<void> => {
    if (shutdownPromise) return shutdownPromise;
    shuttingDown = true;
    shutdownPromise = (async () => {
      await stopAll();
      unsubscribeAll();
      for (const waiters of terminalWaiters.values())
        for (const finish of [...waiters]) finish(false);
      terminalWaiters.clear();
      terminalStates.clear();
      earlyCompletions.clear();
      earlyTerminals.clear();
    })();
    return shutdownPromise;
  };

  return {
    get shuttingDown() {
      return shuttingDown;
    },
    runs,
    discoverEvents,
    start,
    stopAll,
    shutdown,
  };
}
