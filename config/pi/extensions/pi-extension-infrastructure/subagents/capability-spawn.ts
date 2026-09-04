import { registerSubagentCapabilityCeiling } from "pi-subagents/capability-ceiling";

export type CapabilityCeiling = {
  allowedAgents: string[];
  allowedTools: string[];
};

type CapabilitySpawnOptions<T> = {
  sessionId: string;
  source: string;
  ceiling: CapabilityCeiling;
  signal?: AbortSignal;
  spawn: (signal: AbortSignal) => Promise<T>;
};

const capabilityLockKey = Symbol.for(
  "pi-subagents.capability-ceiling-spawn-locks",
);
const globalLocks = globalThis as typeof globalThis &
  Record<symbol, Map<string, Promise<void>>>;
const locks =
  globalLocks[capabilityLockKey] ?? new Map<string, Promise<void>>();
globalLocks[capabilityLockKey] = locks;

const acquireCapabilityLock = async (
  key: string,
  signal?: AbortSignal,
): Promise<() => void> => {
  const previous = locks.get(key) ?? Promise.resolve();
  let release!: () => void;
  const current = new Promise<void>((resolve) => {
    release = resolve;
  });
  locks.set(key, current);

  await new Promise<void>((resolve, reject) => {
    let settled = false;
    const removeAbortListener = () =>
      signal?.removeEventListener("abort", onAbort);
    const onAbort = () => {
      if (settled) return;
      settled = true;
      removeAbortListener();
      // Keep the lock chain live, but do not hold this cancelled request in it.
      void previous.then(
        () => {
          release();
          if (locks.get(key) === current) locks.delete(key);
        },
        () => {
          release();
          if (locks.get(key) === current) locks.delete(key);
        },
      );
      const error = new Error(
        "Capability ceiling acquisition was cancelled.",
      ) as Error & { dispatchState?: string };
      error.dispatchState = "not-dispatched";
      reject(error);
    };

    if (signal?.aborted) {
      onAbort();
      return;
    }
    signal?.addEventListener("abort", onAbort, { once: true });
    void previous.then(
      () => {
        if (settled) return;
        settled = true;
        removeAbortListener();
        resolve();
      },
      (error) => {
        if (settled) return;
        settled = true;
        removeAbortListener();
        release();
        if (locks.get(key) === current) locks.delete(key);
        reject(error);
      },
    );
  });

  return () => {
    release();
    if (locks.get(key) === current) locks.delete(key);
  };
};

/** Run one spawn while its temporary capability ceiling is registered. */
export async function spawnWithCapabilityCeiling<T>(
  options: CapabilitySpawnOptions<T>,
): Promise<T> {
  const key = `${options.sessionId}\u0000${options.source}`;
  const release = await acquireCapabilityLock(key, options.signal);
  if (options.signal?.aborted) {
    release();
    const error = new Error(
      "Capability ceiling acquisition was cancelled.",
    ) as Error & { dispatchState?: string };
    error.dispatchState = "not-dispatched";
    throw error;
  }
  let capability: { dispose: () => void };
  try {
    capability = registerSubagentCapabilityCeiling({
      sessionId: options.sessionId,
      source: options.source,
      ceiling: options.ceiling,
    });
  } catch (cause) {
    const error = new Error(
      `Capability ceiling setup failed: ${
        cause instanceof Error ? cause.message : String(cause)
      }`,
    ) as Error & { dispatchState?: string };
    error.dispatchState = "not-dispatched";
    release();
    throw error;
  }
  try {
    try {
      return await options.spawn(
        options.signal ?? new AbortController().signal,
      );
    } finally {
      capability.dispose();
    }
  } finally {
    release();
  }
}
