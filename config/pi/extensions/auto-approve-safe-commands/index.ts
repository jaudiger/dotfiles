import {
  isToolCallEventType,
  type ExtensionAPI,
} from "@earendil-works/pi-coding-agent";
import { classify } from "./command-classifier.js";

export default function (pi: ExtensionAPI) {
  pi.on("tool_call", async (event, ctx) => {
    if (!isToolCallEventType("bash", event)) return;

    const result = classify(event.input.command);
    if (result.decision === "allow") return;

    if (result.decision === "deny" || !ctx.hasUI) {
      return {
        block: true,
        reason: result.reason || "Command rejected by the command classifier",
      };
    }

    // Else, prompt the user for approval
    const prompt = [event.input.command, result.reason]
      .filter(Boolean)
      .join("\n\n");
    const approved = await ctx.ui.confirm("Run deferred command?", prompt);
    if (!approved)
      return { block: true, reason: "Command rejected by the user" };
  });
}
