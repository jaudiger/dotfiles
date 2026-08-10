import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const TERMINAL_BELL = "\x07"; // ASCII BEL control character

export default function (pi: ExtensionAPI) {
  let isTui = false;

  pi.on("session_start", (_event, ctx) => {
    isTui = ctx.mode === "tui";
  });

  pi.on("agent_settled", () => {
    if (isTui) process.stdout.write(TERMINAL_BELL);
  });
}
