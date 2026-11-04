import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  requirePiExecSuccess,
  type PiExec,
} from "../pi-extension-infrastructure/pi-exec.js";

const sources = new Set(["homebrew", "nixpkgs", "arch", "all"]);
const defaultLimit = 20;
const diagnosticLimit = 2000;

export type DiscoveryOptions = {
  source: string;
  limit: number;
};

export type DiscoveryResult = {
  directory: string;
  outputPath: string;
  stderrPath: string;
  packageCount: number;
  metadata: Record<string, unknown>;
};

export function parseArguments(value: string): DiscoveryOptions | undefined {
  const tokens = value.trim() ? value.trim().split(/\s+/) : [];
  let source = "all";
  let limit = defaultLimit;
  let hasSource = false;
  let hasLimit = false;

  for (const token of tokens) {
    if (sources.has(token)) {
      if (hasSource) return undefined;
      source = token;
      hasSource = true;
      continue;
    }

    if (/^[1-9]\d*$/.test(token)) {
      if (hasLimit) return undefined;
      limit = Number(token);
      hasLimit = true;
      if (!Number.isSafeInteger(limit)) return undefined;
      continue;
    }

    return undefined;
  }

  return { source, limit };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function capturedOutput(stdout: string, stderr: string): string {
  const detail = [
    stdout.trim() ? `stdout: ${stdout.trim()}` : "",
    stderr.trim() ? `stderr: ${stderr.trim()}` : "",
  ]
    .filter(Boolean)
    .join("\n");
  return detail.slice(-diagnosticLimit);
}

export async function runDiscovery(
  cwd: string,
  options: DiscoveryOptions,
  exec: PiExec,
  signal?: AbortSignal,
): Promise<DiscoveryResult> {
  if (signal?.aborted) throw new Error("Discovery command was canceled.");
  const directory = await mkdtemp(join(tmpdir(), "brioche-packages-discover-"));
  const outputPath = join(directory, "packages.json");
  const stderrPath = join(directory, "stderr.log");

  try {
    if (signal?.aborted) throw new Error("Discovery command was canceled.");
    const result = await exec(
      "brioche-wrapper",
      [
        "packages",
        "discover",
        "--source",
        options.source,
        "--limit",
        String(options.limit),
        "--exclude-defaults",
      ],
      { cwd, signal },
    );
    if (signal?.aborted) throw new Error("Discovery command was canceled.");
    requirePiExecSuccess("Discovery command", result);

    let document: unknown;
    try {
      document = JSON.parse(result.stdout) as unknown;
    } catch {
      const detail = capturedOutput(result.stdout, result.stderr);
      throw new Error(
        `Discovery command returned invalid JSON.${detail ? ` Captured output: ${detail}` : ""}`,
      );
    }

    if (!isObject(document) || !Array.isArray(document.packages)) {
      const detail = capturedOutput(result.stdout, result.stderr);
      throw new Error(
        `Discovery output has an unexpected shape.${detail ? ` Captured output: ${detail}` : ""}`,
      );
    }

    await writeFile(outputPath, result.stdout, { mode: 0o600 });
    await writeFile(stderrPath, result.stderr, { mode: 0o600 });

    const metadata = isObject(document.metadata) ? document.metadata : {};
    return {
      directory,
      outputPath,
      stderrPath,
      packageCount: document.packages.length,
      metadata,
    };
  } catch (error) {
    await rm(directory, { recursive: true, force: true });
    throw error;
  }
}

export async function removeDiscoveryDirectory(
  directory: string,
): Promise<void> {
  await rm(directory, { recursive: true, force: true });
}
