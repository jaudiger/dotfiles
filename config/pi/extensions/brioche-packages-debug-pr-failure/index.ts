import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { registerDebugPrFailure } from "./registration.js";

export default function (pi: ExtensionAPI) {
  registerDebugPrFailure(pi);
}
