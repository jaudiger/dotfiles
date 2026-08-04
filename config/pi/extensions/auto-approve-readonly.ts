import { spawnSync } from "node:child_process";
import { homedir } from "node:os";
import { join } from "node:path";
import {
	isToolCallEventType,
	type ExtensionAPI,
} from "@earendil-works/pi-coding-agent";

type Decision = "allow" | "deny" | "defer";

const hookPath = join(
	homedir(),
	".pi",
	"extensions",
	"pi-auto-approve-readonly-scripts",
	"mod.nu",
);

function classify(command: string): { decision: Decision; reason: string } {
	const result = spawnSync("nu", ["--stdin", hookPath, "pi"], {
		encoding: "utf8",
		input: JSON.stringify({
			tool_name: "Bash",
			tool_input: { command },
		}),
	});

	if (result.error) {
		return {
			decision: "deny",
			reason: `The command classifier failed: ${result.error.message}`,
		};
	}

	if (result.status !== 0) {
		return {
			decision: "deny",
			reason: "The command classifier exited unsuccessfully",
		};
	}

	const output = result.stdout.trim();
	if (output === "") {
		return {
			decision: "defer",
			reason: "The command was not classified as read-only",
		};
	}

	let parsed: unknown;
	try {
		parsed = JSON.parse(output);
	} catch {
		return {
			decision: "deny",
			reason: "The command classifier returned invalid JSON",
		};
	}

	if (typeof parsed !== "object" || parsed === null) {
		return {
			decision: "deny",
			reason: "The command classifier returned an invalid decision",
		};
	}

	const record = parsed as Record<string, unknown>;
	const decision = record.decision;
	if (decision !== "allow" && decision !== "deny" && decision !== "defer") {
		return {
			decision: "deny",
			reason: "The command classifier returned an unknown decision",
		};
	}

	return {
		decision,
		reason: typeof record.reason === "string" ? record.reason : "",
	};
}

export default function (pi: ExtensionAPI) {
	pi.on("tool_call", async (event, ctx) => {
		if (!isToolCallEventType("bash", event)) return;

		const result = classify(event.input.command);
		if (result.decision === "allow") return;

		if (result.decision === "deny") {
			return {
				block: true,
				reason: result.reason || "Command rejected by the command classifier",
			};
		}

		if (!ctx.hasUI) {
			return {
				block: true,
				reason: "Deferred bash commands require interactive approval",
			};
		}

		const prompt = [event.input.command, result.reason]
			.filter(Boolean)
			.join("\n\n");
		const approved = await ctx.ui.confirm("Run deferred bash command?", prompt);
		if (!approved)
			return { block: true, reason: "Command rejected by the user" };
	});
}
