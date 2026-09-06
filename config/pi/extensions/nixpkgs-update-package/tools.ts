import type {
  ExtensionAPI,
  ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import type { ActiveWorkflow } from "./workflow.js";

const actions = ["prefetch", "hash-convert", "build", "log"] as const;

type CommandAction = (typeof actions)[number];

function validUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password;
  } catch {
    return false;
  }
}

function validValue(action: CommandAction, value: string): boolean {
  if (!value || value.length > 4096 || /[\u0000-\u0020]/.test(value))
    return false;
  if (action === "prefetch") return validUrl(value);
  if (action === "build") return /^[A-Za-z0-9+._-]+$/.test(value);
  if (action === "log")
    return /^\/(?:nix\/store|tmp)\/[A-Za-z0-9+._/?=-]+$/.test(value);
  return /^[A-Za-z0-9+._-]+$/.test(value);
}

function commandFor(
  action: CommandAction,
  value: string,
  repository: string,
): { name: string; args: string[] } {
  if (action === "prefetch")
    return { name: "nix-prefetch-url", args: ["--unpack", value] };
  if (action === "hash-convert")
    return {
      name: "nix",
      args: [
        "hash",
        "convert",
        "--hash-algo",
        "sha256",
        "--from",
        "nix32",
        "--to",
        "sri",
        value,
      ],
    };
  if (action === "build")
    return {
      name: "nix",
      args: ["build", "--impure", "--no-link", `${repository}#${value}`],
    };
  return { name: "nix", args: ["log", value] };
}

function ownsWorkflow(
  active: ActiveWorkflow | undefined,
  ctx: ExtensionContext,
): active is ActiveWorkflow {
  return Boolean(
    active && active.sessionId === ctx.sessionManager.getSessionId(),
  );
}

function actionAllowed(
  active: ActiveWorkflow,
  action: CommandAction,
  value: string,
): boolean {
  if (active.phase !== "editing") return false;
  // Build is the only action whose argument is a package name. Keep it
  // restricted to the packages selected when the workflow started.
  return action !== "build" || active.packages.includes(value);
}

export function registerCommandTool(
  pi: ExtensionAPI,
  repository: string,
  getActive: () => ActiveWorkflow | undefined,
): void {
  pi.registerTool({
    name: "nixpkgs_update_package_command",
    label: "Nixpkgs update package command",
    description:
      "Run one safe, read-only Nixpkgs update command. Use prefetch for source hashes, hash-convert for SRI conversion, build for a package build, and log for a derivation log. Arbitrary shell commands are intentionally unavailable during this workflow.",
    parameters: Type.Object({
      action: Type.Union(actions.map((action) => Type.Literal(action))),
      value: Type.String(),
    }),
    async execute(_toolCallId, params, signal, _onUpdate, ctx) {
      const active = getActive();
      if (
        !ownsWorkflow(active, ctx) ||
        active.context.repository !== repository
      )
        return {
          content: [{ type: "text", text: "No active Nixpkgs update." }],
          details: {},
          isError: true,
        };
      if (!actionAllowed(active, params.action, params.value))
        return {
          content: [
            {
              type: "text",
              text: "This command is unavailable in the current workflow phase or for the selected package.",
            },
          ],
          details: {},
          isError: true,
        };
      if (!validValue(params.action, params.value))
        return {
          content: [{ type: "text", text: "The command value is invalid." }],
          details: {},
          isError: true,
        };
      const command = commandFor(params.action, params.value, repository);
      const result = await pi.exec(command.name, command.args, { signal });
      const output = `${result.stdout}${result.stderr}`.trim();
      return {
        content: [
          { type: "text", text: output || `Exit code: ${result.code}` },
        ],
        details: {
          action: params.action,
          value: params.value,
          code: result.code,
        },
        isError: result.code !== 0,
      };
    },
  });
}
