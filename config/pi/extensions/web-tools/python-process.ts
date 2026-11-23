import type { PiExec } from "../pi-extension-infrastructure/pi-exec.js";
import { requirePiExecComplete } from "../pi-extension-infrastructure/pi-exec.js";

export async function runPythonTool(
  exec: PiExec,
  pythonPath: string,
  scriptPath: string,
  args: string[],
  cwd: string,
  signal: AbortSignal,
  label: string,
  cancellationMessage: string,
  failureName: string,
): Promise<string> {
  const result = await exec(pythonPath, [scriptPath, ...args], { cwd, signal });
  if (signal.aborted) throw new Error(cancellationMessage);
  requirePiExecComplete(label, result);
  if (result.code !== 0) {
    const stderr = Buffer.from(result.stderr)
      .subarray(0, 8192)
      .toString("utf8")
      .trim();
    throw new Error(
      stderr || `${failureName} failed with exit code ${result.code}`,
    );
  }
  return result.stdout;
}
