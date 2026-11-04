import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { createPiExec } from "../pi-exec.js";
import { runSubagent } from "./standalone.js";

const SUBAGENT_MAX_BUFFER = 8 * 1024 * 1024;

export function registerSubagentTool(pi: ExtensionAPI): void {
  const agentNames = (process.env.PI_SUBAGENT_AGENT_NAMES ?? "")
    .split(",")
    .filter((name) => name.length > 0);

  if (
    agentNames.length === 0 ||
    new Set(agentNames).size !== agentNames.length
  ) {
    throw new Error(
      "PI_SUBAGENT_AGENT_NAMES must contain unique subagent roles",
    );
  }

  const agentParameters = Type.Union(
    agentNames.map((name) => Type.Literal(name)),
  );
  const parameters = Type.Object(
    {
      agent: agentParameters,
      task: Type.String({ minLength: 1 }),
    },
    { additionalProperties: false },
  );
  const exec = createPiExec(pi, SUBAGENT_MAX_BUFFER);

  pi.registerTool({
    name: "subagent",
    label: "Pi subagent",
    description: `Run one configured specialist in a separate Pi process and return its final response. Available roles are ${agentNames.join(", ")}. Use this when the user asks for a specialist or asks you to delegate. Provide a standalone task, then evaluate the result and continue the work before answering.`,
    promptSnippet:
      "Run a configured Pi specialist when requested, then continue with its result.",
    promptGuidelines: [
      "When asked for a configured specialist or delegation, call subagent; do not ask the user to run pi-subagent.",
      "Evaluate the subagent result and complete any needed work or follow-up calls before answering.",
    ],
    parameters,
    executionMode: "sequential",
    async execute(_toolCallId, params, signal, _onUpdate, ctx) {
      return runSubagent(exec, params.agent, params.task, ctx.cwd, signal);
    },
  });
}
