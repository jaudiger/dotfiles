import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { registerSubagentTool } from "./subagents/tool.js";

export default function (pi: ExtensionAPI): void {
  registerSubagentTool(pi);
}
