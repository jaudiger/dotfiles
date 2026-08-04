import {
	isToolCallEventType,
	type ExtensionAPI,
} from "@earendil-works/pi-coding-agent";

function isProtectedPath(filePath: string): boolean {
	return filePath
		.replaceAll("\\", "/")
		.split("/")
		.some((part) => part.startsWith(".env"));
}

export default function (pi: ExtensionAPI) {
	pi.on("tool_call", (event, ctx) => {
		if (
			!isToolCallEventType("read", event) &&
			!isToolCallEventType("edit", event) &&
			!isToolCallEventType("write", event)
		) {
			return;
		}

		if (!isProtectedPath(event.input.path)) return;

		if (ctx.hasUI) {
			ctx.ui.notify(
				`Blocked access to protected path: ${event.input.path}`,
				"warning",
			);
		}
		return {
			block: true,
			reason: "Paths beginning with .env are protected",
		};
	});
}
