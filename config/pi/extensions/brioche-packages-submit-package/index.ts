import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { registerSubmitPackage } from "./submit-registration.js";

export default function (pi: ExtensionAPI) {
  registerSubmitPackage(pi);
}
