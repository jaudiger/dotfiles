import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const TERMINAL_BELL = "\x07"; // ASCII BEL control character

export default function (pi: ExtensionAPI) {
  pi.on("agent_settled", (_event, ctx) => {
    if (ctx.mode === "tui") process.stdout.write(TERMINAL_BELL);
  });
}
