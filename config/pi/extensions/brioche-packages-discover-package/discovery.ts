import { spawn } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const sources = new Set(["homebrew", "nixpkgs", "arch", "all"]);
const defaultLimit = 20;

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

async function runCommand(
  command: string,
  args: string[],
  cwd: string,
): Promise<{ stdout: string; stderr: string; code: number }> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
    });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];

    child.stdout.on("data", (chunk: Buffer) => stdout.push(chunk));
    child.stderr.on("data", (chunk: Buffer) => {
      stderr.push(chunk);
      process.stderr.write(chunk);
    });
    child.once("error", reject);
    child.once("close", (code) =>
      resolve({
        stdout: Buffer.concat(stdout).toString("utf8"),
        stderr: Buffer.concat(stderr).toString("utf8"),
        code: code ?? 1,
      }),
    );
  });
}

export async function runDiscovery(
  cwd: string,
  options: DiscoveryOptions,
): Promise<DiscoveryResult> {
  const directory = await mkdtemp(join(tmpdir(), "brioche-packages-discover-"));
  const outputPath = join(directory, "packages.json");
  const stderrPath = join(directory, "stderr.log");

  try {
    const result = await runCommand(
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
      cwd,
    );
    await writeFile(outputPath, result.stdout, { mode: 0o600 });
    await writeFile(stderrPath, result.stderr, { mode: 0o600 });

    if (result.code !== 0) {
      throw new Error(
        `Discovery command failed with exit code ${result.code}. Full stderr: ${stderrPath}`,
      );
    }

    let document: unknown;
    try {
      document = JSON.parse(result.stdout) as unknown;
    } catch {
      throw new Error(`Discovery command returned invalid JSON: ${outputPath}`);
    }

    if (!isObject(document) || !Array.isArray(document.packages)) {
      throw new Error(
        `Discovery output has an unexpected shape: ${outputPath}`,
      );
    }

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
