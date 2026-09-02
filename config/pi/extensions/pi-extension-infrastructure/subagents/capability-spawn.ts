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
  spawn: () => Promise<T>;
};

const capabilityLockKey = Symbol.for(
  "pi-subagents.capability-ceiling-spawn-lock",
);
const globalLocks = globalThis as typeof globalThis &
  Record<symbol, Promise<void> | undefined>;

const acquireCapabilityLock = async (
  signal?: AbortSignal,
): Promise<() => void> => {
  const previous = globalLocks[capabilityLockKey] ?? Promise.resolve();
  let release!: () => void;
  globalLocks[capabilityLockKey] = new Promise<void>((resolve) => {
    release = resolve;
  });

  await new Promise<void>((resolve, reject) => {
    let settled = false;
    const removeAbortListener = () =>
      signal?.removeEventListener("abort", onAbort);
    const onAbort = () => {
      if (settled) return;
      settled = true;
      removeAbortListener();
      // Keep the lock chain live, but do not hold this cancelled request in it.
      void previous.then(release, release);
      reject(new Error("Capability ceiling acquisition was cancelled."));
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
        void release();
        reject(error);
      },
    );
  });

  return release;
};

/** Run one spawn while its temporary capability ceiling is registered. */
export async function spawnWithCapabilityCeiling<T>(
  options: CapabilitySpawnOptions<T>,
): Promise<T> {
  const release = await acquireCapabilityLock(options.signal);
  if (options.signal?.aborted) {
    release();
    throw new Error("Capability ceiling acquisition was cancelled.");
  }
  try {
    const capability = registerSubagentCapabilityCeiling({
      sessionId: options.sessionId,
      source: options.source,
      ceiling: options.ceiling,
    });
    try {
      return await options.spawn();
    } finally {
      capability.dispose();
    }
  } finally {
    release();
  }
}
