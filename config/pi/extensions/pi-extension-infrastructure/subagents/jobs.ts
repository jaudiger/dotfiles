import type {
  ExtensionAPI,
  ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import {
  PiAgentCapacityError,
  runReadOnlyPiAgent,
  type PiAgentConfig,
} from "./agent.js";

export type AgentJobContext = {
  readonly signal: AbortSignal;
  mutate: <T>(operation: (signal: AbortSignal) => Promise<T>) => Promise<T>;
};

export type AgentReport = {
  content: string;
  details?: Record<string, unknown>;
  retainEvidence?: boolean;
};

export type AgentJob = {
  label: string;
  launch: {
    cwd: string;
    readRoots?: readonly string[];
    config: PiAgentConfig;
    task: string;
    includeFetchUrl?: boolean;
    timeoutMs?: number;
  };
  evidence: {
    path: string;
    remove: () => Promise<void>;
  };
  complete: (text: string, context: AgentJobContext) => Promise<AgentReport>;
};

export type AgentJobs = {
  start: (context: ExtensionContext, job: AgentJob) => Promise<void>;
  shutdown: () => Promise<void>;
};

type ActiveJob = {
  job: AgentJob;
  context: ExtensionContext;
  sessionId: string;
  controller: AbortController;
  mutationAmbiguous: boolean;
  done: Promise<void>;
};

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function failed(job: AgentJob, reason: string): AgentReport {
  return {
    content: `${job.label} did not finish safely: ${reason}. Evidence retained at ${job.evidence.path}.`,
    details: { evidenceDirectory: job.evidence.path },
    retainEvidence: true,
  };
}

function notStarted(job: AgentJob, reason: string): AgentReport {
  return { content: `${job.label} did not start: ${reason}.` };
}

function cancelled(job: AgentJob): AgentReport {
  return { content: `${job.label} was cancelled.` };
}

function currentSessionId(context: ExtensionContext): string | undefined {
  try {
    return context.sessionManager.getSessionId();
  } catch {
    return undefined;
  }
}

function ownsSession(record: ActiveJob): boolean {
  return currentSessionId(record.context) === record.sessionId;
}

export function createAgentJobs(
  pi: ExtensionAPI,
  options: { customType: string; maxConcurrentJobs: number },
): AgentJobs {
  if (
    !Number.isInteger(options.maxConcurrentJobs) ||
    options.maxConcurrentJobs < 1
  )
    throw new Error("maxConcurrentJobs must be a positive integer.");

  const active = new Set<ActiveJob>();
  let shuttingDown = false;
  let shutdownPromise: Promise<void> | undefined;

  async function removeEvidence(job: AgentJob): Promise<boolean> {
    try {
      await job.evidence.remove();
      return true;
    } catch {
      return false;
    }
  }

  async function finalize(
    record: ActiveJob,
    report: AgentReport,
  ): Promise<void> {
    let finalReport = report;
    if (record.mutationAmbiguous) {
      finalReport = failed(
        record.job,
        "cancellation interrupted a mutation; its result is ambiguous",
      );
    }
    if (finalReport.retainEvidence !== true) {
      const removed = await removeEvidence(record.job);
      if (!removed) finalReport = failed(record.job, "evidence cleanup failed");
    }
    if (
      finalReport.retainEvidence === true &&
      !finalReport.content.includes(record.job.evidence.path)
    ) {
      finalReport = {
        ...finalReport,
        content: `${finalReport.content}\n\nEvidence retained at ${record.job.evidence.path}.`,
      };
    }
    if (!ownsSession(record)) return;
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
      return;
    }
  }

  async function run(record: ActiveJob): Promise<void> {
    let report: AgentReport;
    try {
      if (shuttingDown || record.controller.signal.aborted)
        throw new Error("service is shutting down");
      if (!ownsSession(record)) throw new Error("the owning session changed");
      const text = await runReadOnlyPiAgent({
        context: record.context,
        config: record.job.launch.config,
        cwd: record.job.launch.cwd,
        readRoots: record.job.launch.readRoots,
        evidenceFiles: [],
        includeFetchUrl: record.job.launch.includeFetchUrl ?? false,
        prompt: record.job.launch.task,
        signal: record.controller.signal,
        timeoutMs: record.job.launch.timeoutMs,
      });
      if (
        record.controller.signal.aborted ||
        shuttingDown ||
        !ownsSession(record)
      ) {
        report = cancelled(record.job);
      } else {
        report = await record.job.complete(text, {
          signal: record.controller.signal,
          mutate: async <T>(
            operation: (signal: AbortSignal) => Promise<T>,
          ): Promise<T> => {
            if (record.controller.signal.aborted || !ownsSession(record))
              throw new Error("Mutation was cancelled before it started.");
            try {
              const value = await operation(record.controller.signal);
              if (record.controller.signal.aborted || !ownsSession(record)) {
                record.mutationAmbiguous = true;
                throw new Error(
                  "Mutation was interrupted; its result is ambiguous.",
                );
              }
              return value;
            } catch (error) {
              if (record.controller.signal.aborted || !ownsSession(record))
                record.mutationAmbiguous = true;
              throw error;
            }
          },
        });
      }
    } catch (error) {
      if (error instanceof PiAgentCapacityError) {
        report = notStarted(record.job, error.message);
      } else {
        report =
          record.controller.signal.aborted || !ownsSession(record)
            ? cancelled(record.job)
            : failed(record.job, errorMessage(error));
      }
    }
    await finalize(record, report);
  }

  async function start(
    context: ExtensionContext,
    job: AgentJob,
  ): Promise<void> {
    if (shuttingDown) {
      await removeEvidence(job);
      return;
    }
    const sessionId = currentSessionId(context);
    if (!sessionId) {
      await removeEvidence(job);
      return;
    }
    const capacityExceeded = active.size >= options.maxConcurrentJobs;
    const record: ActiveJob = {
      job,
      context,
      sessionId,
      controller: new AbortController(),
      mutationAmbiguous: false,
      done: Promise.resolve(),
    };
    active.add(record);
    record.done = Promise.resolve()
      .then(async () => {
        if (shuttingDown) await finalize(record, cancelled(job));
        else if (capacityExceeded)
          await finalize(
            record,
            notStarted(job, "local agent capacity is full"),
          );
        else await run(record);
      })
      .catch(async (error: unknown) => {
        await finalize(record, failed(job, errorMessage(error)));
      })
      .finally(() => active.delete(record));
    await record.done;
  }

  function shutdown(): Promise<void> {
    if (shutdownPromise) return shutdownPromise;
    shuttingDown = true;
    shutdownPromise = (async () => {
      const records = [...active];
      for (const record of records) record.controller.abort();
      await Promise.all(records.map((record) => record.done));
    })();
    return shutdownPromise;
  }

  pi.on("agent_settled", async (event, context) => {
    if (!event.aborted) return;
    const sessionId = currentSessionId(context);
    if (!sessionId) return;
    const records = [...active].filter(
      (record) => record.sessionId === sessionId,
    );
    for (const record of records) record.controller.abort();
    await Promise.all(records.map((record) => record.done));
  });

  return { start, shutdown };
}
