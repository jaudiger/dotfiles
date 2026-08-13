import { spawn } from "node:child_process";
import {
  isToolCallEventType,
  type BashOperations,
  type ExtensionAPI,
} from "@earendil-works/pi-coding-agent";

const SANDBOX_COMMAND = "pi-bash-sandbox";
const SANDBOX_BASH_COMMAND = "/bin/bash";

function shellQuote(value: string): string {
  return `'${value.replaceAll("'", "'\\''")}'`;
}

function sandboxArgs(command: string): string[] {
  return [SANDBOX_BASH_COMMAND, "-c", command];
}

function wrapCommand(command: string): string {
  return [SANDBOX_COMMAND, ...sandboxArgs(shellQuote(command))].join(" ");
}

function killProcessGroup(child: ReturnType<typeof spawn>): void {
  if (!child.pid) return;

  try {
    process.kill(-child.pid, "SIGKILL");
  } catch {
    child.kill("SIGKILL");
  }
}

function createSandboxOperations(): BashOperations {
  return {
    exec(command, cwd, { onData, signal, timeout, env }) {
      if (signal?.aborted) return Promise.reject(new Error("aborted"));

      return new Promise((resolve, reject) => {
        const child = spawn(SANDBOX_COMMAND, sandboxArgs(command), {
          cwd,
          detached: process.platform !== "win32",
          env: env ?? process.env,
          stdio: ["ignore", "pipe", "pipe"],
          windowsHide: true,
        });
        let timedOut = false;
        let timeoutHandle: NodeJS.Timeout | undefined;

        child.stdout?.on("data", onData);
        child.stderr?.on("data", onData);

        const onAbort = () => killProcessGroup(child);
        if (signal) {
          if (signal.aborted) onAbort();
          else signal.addEventListener("abort", onAbort, { once: true });
        }

        if (timeout !== undefined && timeout > 0) {
          timeoutHandle = setTimeout(() => {
            timedOut = true;
            killProcessGroup(child);
          }, timeout * 1000);
        }

        child.on("error", (error) => {
          if (timeoutHandle) clearTimeout(timeoutHandle);
          signal?.removeEventListener("abort", onAbort);
          reject(error);
        });

        child.on("close", (exitCode) => {
          if (timeoutHandle) clearTimeout(timeoutHandle);
          signal?.removeEventListener("abort", onAbort);

          if (signal?.aborted) {
            reject(new Error("aborted"));
          } else if (timedOut) {
            reject(new Error(`timeout:${timeout}`));
          } else {
            resolve({ exitCode });
          }
        });
      });
    },
  };
}

export default function (pi: ExtensionAPI) {
  pi.on("tool_call", (event) => {
    if (!isToolCallEventType("bash", event)) return;

    event.input.command = wrapCommand(event.input.command);
  });

  pi.on("user_bash", () => ({ operations: createSandboxOperations() }));
}
