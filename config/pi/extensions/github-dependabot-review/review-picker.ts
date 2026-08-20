import type { ExtensionContext, Theme } from "@earendil-works/pi-coding-agent";
import {
  SelectList,
  type Component,
  type Keybinding,
  type KeybindingsManager,
  type TUI,
  truncateToWidth,
} from "@earendil-works/pi-tui";

export type ReviewCandidate = {
  number: number;
  title: string;
  url: string;
  author?: string;
  repository?: string;
};

type ReviewPickerOptions = {
  tui: TUI;
  theme: Theme;
  keybindings: KeybindingsManager;
  candidates: ReviewCandidate[];
  loadDiff: (candidate: ReviewCandidate) => Promise<string>;
  done: (candidate: ReviewCandidate | null) => void;
};

type PanelFocus = "list" | "diff";

function panelBackground(theme: Theme, line: string): string {
  const background = theme.getBgAnsi("selectedBg");
  const reopenedBackground = `\x1b[0m${background}`;
  return theme.bg("selectedBg", line.replace(/\x1b\[0m/g, reopenedBackground));
}

const listUp: Keybinding = "tui.select.up";
const listDown: Keybinding = "tui.select.down";
const pageUp: Keybinding = "tui.select.pageUp";
const pageDown: Keybinding = "tui.select.pageDown";
const confirm: Keybinding = "tui.select.confirm";
const cancel: Keybinding = "tui.select.cancel";
const tab: Keybinding = "tui.input.tab";

export async function pickReview(
  ctx: ExtensionContext,
  candidates: ReviewCandidate[],
  loadDiff: (candidate: ReviewCandidate) => Promise<string>,
): Promise<ReviewCandidate | null> {
  if (ctx.mode !== "tui") return candidates[0] ?? null;
  if (candidates.length === 0) return null;

  return ctx.ui.custom<ReviewCandidate | null>(
    (tui, theme, keybindings, done) =>
      new ReviewPicker({
        tui,
        theme,
        keybindings,
        candidates,
        loadDiff,
        done,
      }),
    {
      overlay: true,
      overlayOptions: {
        width: "100%",
        maxHeight: "100%",
        anchor: "top-left",
        margin: 0,
      },
    },
  );
}

class ReviewPicker implements Component {
  private readonly tui: TUI;
  private readonly theme: Theme;
  private readonly keybindings: KeybindingsManager;
  private readonly candidates: ReviewCandidate[];
  private readonly loadDiffFor: (candidate: ReviewCandidate) => Promise<string>;
  private readonly done: (candidate: ReviewCandidate | null) => void;
  private readonly candidatesByUrl: Map<string, ReviewCandidate>;
  private readonly selector: SelectList;
  private readonly diffCache = new Map<string, string>();
  private selected: ReviewCandidate;
  private focus: PanelFocus = "list";
  private diffLines: string[] = [];
  private diffOffset = 0;
  private loadingUrl: string | undefined;
  private error: string | undefined;
  private loadGeneration = 0;

  constructor(options: ReviewPickerOptions) {
    this.tui = options.tui;
    this.theme = options.theme;
    this.keybindings = options.keybindings;
    this.candidates = options.candidates;
    this.loadDiffFor = options.loadDiff;
    this.done = options.done;
    this.selected = this.candidates[0]!;
    this.candidatesByUrl = new Map(
      this.candidates.map((candidate) => [candidate.url, candidate]),
    );

    const items = this.candidates.map((candidate) => ({
      value: candidate.url,
      label: `#${candidate.number} ${candidate.title}`,
      description: candidate.author
        ? `${candidate.author}${candidate.repository ? ` | ${candidate.repository}` : ""}`
        : candidate.repository,
    }));
    this.selector = new SelectList(items, this.visiblePanelRows() - 2, {
      selectedPrefix: (text) => this.theme.fg("accent", text),
      selectedText: (text) => this.theme.fg("accent", text),
      description: (text) => this.theme.fg("muted", text),
      scrollInfo: (text) => this.theme.fg("dim", text),
      noMatch: (text) => this.theme.fg("warning", text),
    });
    this.selector.onSelectionChange = (item) => {
      const candidate = this.candidatesByUrl.get(item.value);
      if (candidate) this.selectCandidate(candidate);
    };
    this.selector.onSelect = (item) => {
      const candidate = this.candidatesByUrl.get(item.value);
      if (candidate) this.done(candidate);
    };
    this.selector.onCancel = () => this.done(null);
    void this.loadDiff(this.selected);
  }

  handleInput(data: string): void {
    if (this.keybindings.matches(data, cancel)) {
      this.done(null);
      return;
    }

    if (this.keybindings.matches(data, tab)) {
      this.focus = this.focus === "list" ? "diff" : "list";
      this.tui.requestRender();
      return;
    }

    if (this.focus === "list") {
      this.selector.handleInput(data);
      this.tui.requestRender();
      return;
    }
    if (this.keybindings.matches(data, confirm)) {
      this.done(this.selected);
      return;
    }
    if (this.keybindings.matches(data, listUp)) {
      this.scrollDiff(-1);
      return;
    }
    if (this.keybindings.matches(data, listDown)) {
      this.scrollDiff(1);
      return;
    }
    if (this.keybindings.matches(data, pageUp)) {
      this.scrollDiff(-this.diffPageSize());
      return;
    }
    if (this.keybindings.matches(data, pageDown)) {
      this.scrollDiff(this.diffPageSize());
    }
  }

  invalidate(): void {
    this.selector.invalidate();
  }

  render(width: number): string[] {
    const separatorWidth = 1;
    const contentWidth = Math.max(2, width - separatorWidth);
    const leftWidth = Math.floor(contentWidth / 3);
    const rightWidth = Math.max(1, contentWidth - leftWidth);
    const panelRows = this.visiblePanelRows();
    const leftLines = this.selector.render(leftWidth).slice(0, panelRows - 1);
    const rightLines = this.renderDiff(rightWidth, panelRows - 1);
    const lines = [
      truncateToWidth(this.theme.bold("Review pull requests"), width),
    ];

    for (let index = 0; index < panelRows - 1; index += 1) {
      const leftLine = padToWidth(leftLines[index] ?? "", leftWidth);
      const rightLine = padToWidth(rightLines[index] ?? "", rightWidth);
      const separatorColor =
        this.focus === "list" ? "borderAccent" : "borderMuted";
      const separator = this.theme.fg(separatorColor, "|");
      const line =
        this.focus === "list"
          ? `${panelBackground(this.theme, `${leftLine}${separator}`)}${rightLine}`
          : `${leftLine}${panelBackground(this.theme, `${separator}${rightLine}`)}`;
      lines.push(truncateToWidth(line, width));
    }

    lines.push(
      truncateToWidth(
        this.theme.fg(
          "dim",
          "up/down move | tab switch | enter start | esc cancel",
        ),
        width,
      ),
    );
    return lines;
  }

  private selectCandidate(candidate: ReviewCandidate): void {
    if (this.selected.url === candidate.url) return;
    this.selected = candidate;
    this.diffOffset = 0;
    this.error = undefined;
    void this.loadDiff(candidate);
  }

  private async loadDiff(candidate: ReviewCandidate): Promise<void> {
    const cached = this.diffCache.get(candidate.url);
    if (cached !== undefined) {
      this.diffLines = splitDiff(cached);
      this.loadingUrl = undefined;
      this.error = undefined;
      this.tui.requestRender();
      return;
    }

    const generation = ++this.loadGeneration;
    this.loadingUrl = candidate.url;
    this.diffLines = [];
    this.error = undefined;
    this.tui.requestRender();
    try {
      const diff = await this.loadDiffFor(candidate);
      this.diffCache.set(candidate.url, diff);
      if (
        generation !== this.loadGeneration ||
        this.selected.url !== candidate.url
      )
        return;
      this.diffLines = splitDiff(diff);
      this.loadingUrl = undefined;
      this.tui.requestRender();
    } catch (error) {
      if (
        generation !== this.loadGeneration ||
        this.selected.url !== candidate.url
      )
        return;
      this.loadingUrl = undefined;
      this.error = error instanceof Error ? error.message : String(error);
      this.tui.requestRender();
    }
  }

  private renderDiff(width: number, rows: number): string[] {
    const heading = `${this.theme.bold(`#${this.selected.number} ${this.selected.title}`)}`;
    const lines = [truncateToWidth(heading, width)];
    if (this.loadingUrl === this.selected.url) {
      lines.push(this.theme.fg("muted", "Loading diff..."));
      return lines;
    }
    if (this.error) {
      lines.push(this.theme.fg("error", truncateToWidth(this.error, width)));
      return lines;
    }
    if (this.diffLines.length === 0) {
      lines.push(this.theme.fg("muted", "No diff available."));
      return lines;
    }

    const diffRows = Math.max(1, rows - 2);
    const maxOffset = Math.max(0, this.diffLines.length - diffRows);
    this.diffOffset = Math.min(this.diffOffset, maxOffset);
    for (const line of this.diffLines.slice(
      this.diffOffset,
      this.diffOffset + diffRows,
    )) {
      lines.push(truncateToWidth(styleDiffLine(line, this.theme), width));
    }
    lines.push(
      this.theme.fg(
        "dim",
        `Lines ${this.diffOffset + 1}-${Math.min(this.diffOffset + diffRows, this.diffLines.length)} of ${this.diffLines.length}`,
      ),
    );
    return lines;
  }

  private scrollDiff(delta: number): void {
    const diffRows = Math.max(1, this.visiblePanelRows() - 4);
    const maxOffset = Math.max(0, this.diffLines.length - diffRows);
    this.diffOffset = Math.max(0, Math.min(maxOffset, this.diffOffset + delta));
    this.tui.requestRender();
  }

  private diffPageSize(): number {
    return Math.max(1, this.visiblePanelRows() - 4);
  }

  private visiblePanelRows(): number {
    return Math.max(4, this.tui.terminal.rows - 1);
  }
}

function splitDiff(diff: string): string[] {
  const lines = diff.replace(/\n$/, "").split("\n");
  return lines.length === 1 && lines[0] === "" ? [] : lines;
}

function styleDiffLine(line: string, theme: Theme): string {
  if (line.startsWith("@@")) return theme.fg("borderAccent", line);
  if (line.startsWith("+++") || line.startsWith("---"))
    return theme.fg("toolDiffContext", line);
  if (line.startsWith("+")) return theme.fg("toolDiffAdded", line);
  if (line.startsWith("-")) return theme.fg("toolDiffRemoved", line);
  return theme.fg("toolDiffContext", line);
}

function padToWidth(line: string, width: number): string {
  return truncateToWidth(line, width, "", true);
}
