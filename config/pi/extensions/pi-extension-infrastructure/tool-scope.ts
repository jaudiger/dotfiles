import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export type ToolScope = {
  acquire: () => void;
  release: () => void;
  reset: () => void;
};

/** Keep owned tools active while one or more workflows hold the scope. */
export function createToolScope(
  pi: ExtensionAPI,
  toolNames: readonly string[],
): ToolScope {
  const owned = new Set(toolNames);
  let count = 0;

  const setActiveWithoutOwnedTools = (): void => {
    pi.setActiveTools(pi.getActiveTools().filter((name) => !owned.has(name)));
  };

  const reset = (): void => {
    count = 0;
    setActiveWithoutOwnedTools();
  };

  const acquire = (): void => {
    if (count === 0) {
      const active = new Set(pi.getActiveTools());
      for (const name of owned) active.add(name);
      pi.setActiveTools([...active]);
    }
    count += 1;
  };

  const release = (): void => {
    if (count === 0) return;
    count -= 1;
    if (count === 0) setActiveWithoutOwnedTools();
  };

  pi.on("session_start", reset);
  pi.on("session_shutdown", reset);

  return { acquire, release, reset };
}
