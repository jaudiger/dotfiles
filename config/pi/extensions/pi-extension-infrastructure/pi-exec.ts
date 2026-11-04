import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export type PiExec = ExtensionAPI["exec"];
export type PiExecResult = Awaited<ReturnType<PiExec>>;
export type PiExecOptions = Parameters<PiExec>[2];

export class PiExecError extends Error {
  readonly command: string;
  readonly stdout: string;
  readonly stderr: string;
  readonly code: number;
  readonly killed: boolean;
  readonly truncated: boolean;

  constructor(command: string, result: PiExecResult) {
    super(piExecFailure(command, result));
    this.name = "PiExecError";
    this.command = command;
    this.stdout = result.stdout;
    this.stderr = result.stderr;
    this.code = result.code;
    this.killed = result.killed;
    this.truncated = result.truncated;
  }
}

export type PiExecCapture = {
  result: PiExecResult;
  output: string;
  exitCode: number;
  success: boolean;
  error?: PiExecError;
};

export function createPiExec(pi: ExtensionAPI, maxBuffer: number): PiExec {
  return (command, args, options) =>
    pi.exec(command, args, { maxBuffer, ...options });
}

export function piExecSucceeded(result: PiExecResult): boolean {
  return result.code === 0 && !result.killed && !result.truncated;
}

export function piExecFailure(command: string, result: PiExecResult): string {
  const reason = result.truncated
    ? "output was truncated by Pi"
    : result.killed
      ? "was terminated by Pi"
      : `failed with exit code ${result.code}`;
  const output = `${result.stdout}${result.stderr}`.trim();
  const detail = output.slice(-2000);
  return `${command} ${reason}${detail ? `: ${detail}` : "."}`;
}

export function requirePiExecComplete(
  command: string,
  result: PiExecResult,
): PiExecResult {
  if (result.killed || result.truncated) throw new PiExecError(command, result);
  return result;
}

export function requirePiExecSuccess(
  command: string,
  result: PiExecResult,
): PiExecResult {
  requirePiExecComplete(command, result);
  if (result.code !== 0) throw new PiExecError(command, result);
  return result;
}

export async function runPiExec(
  exec: PiExec,
  command: string,
  args: string[],
  options?: PiExecOptions,
): Promise<PiExecResult> {
  return requirePiExecSuccess(command, await exec(command, args, options));
}

export async function capturePiExec(
  exec: PiExec,
  command: string,
  args: string[],
  options?: PiExecOptions,
): Promise<PiExecCapture> {
  const result = await exec(command, args, options);
  const success = piExecSucceeded(result);
  const error = success ? undefined : new PiExecError(command, result);
  return {
    result,
    output: `${result.stdout}${result.stderr}`,
    exitCode: success ? 0 : result.code || 1,
    success,
    ...(error ? { error } : {}),
  };
}

export function isPiExecInterrupted(error: unknown): boolean {
  return error instanceof PiExecError && (error.killed || error.truncated);
}
