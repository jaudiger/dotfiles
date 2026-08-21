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

export type ReviewDetails = {
  number: number;
  title: string;
  author?: string;
  repository?: string;
  isDraft: boolean;
  status: string;
  checkSummary: string;
  reviewDecision: string;
  url: string;
  mergeQueueState?: string;
  mergeQueuePosition?: number;
  queueRemovalReason?: string;
  queueWorkflowUrl?: string;
};

type ReviewPickerOptions = {
  tui: TUI;
  theme: Theme;
  keybindings: KeybindingsManager;
  candidates: ReviewCandidate[];
  loadDiff: (candidate: ReviewCandidate) => Promise<string>;
  loadDetails: (candidate: ReviewCandidate) => Promise<ReviewDetails>;
  showQueuePosition: boolean;
  done: (candidates: ReviewCandidate[] | null) => void;
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
  loadDetails: (candidate: ReviewCandidate) => Promise<ReviewDetails>,
  showQueuePosition: boolean,
): Promise<ReviewCandidate[] | null> {
  if (ctx.mode !== "tui")
    return candidates.length > 0 ? [candidates[0]!] : null;
  if (candidates.length === 0) return null;

  return ctx.ui.custom<ReviewCandidate[] | null>(
    (tui, theme, keybindings, done) =>
      new ReviewPicker({
        tui,
        theme,
        keybindings,
        candidates,
        loadDiff,
        loadDetails,
        showQueuePosition,
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
  private readonly loadDetailsFor: (
    candidate: ReviewCandidate,
  ) => Promise<ReviewDetails>;
  private readonly showQueuePosition: boolean;
  private readonly done: (candidates: ReviewCandidate[] | null) => void;
  private readonly candidatesByUrl: Map<string, ReviewCandidate>;
  private readonly selector: SelectList;
  private readonly diffCache = new Map<string, string>();
  private readonly detailsCache = new Map<string, ReviewDetails>();
  private readonly selectedCandidates = new Set<string>();
  private selected: ReviewCandidate;
  private focus: PanelFocus = "list";
  private diffLines: string[] = [];
  private diffOffset = 0;
  private loadingUrl: string | undefined;
  private error: string | undefined;
  private details: ReviewDetails | undefined;
  private detailsError: string | undefined;
  private loadingDetailsUrl: string | undefined;
  private loadGeneration = 0;
  private detailsGeneration = 0;

  constructor(options: ReviewPickerOptions) {
    this.tui = options.tui;
    this.theme = options.theme;
    this.keybindings = options.keybindings;
    this.candidates = options.candidates;
    this.loadDiffFor = options.loadDiff;
    this.loadDetailsFor = options.loadDetails;
    this.showQueuePosition = options.showQueuePosition;
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
    this.selector = new SelectList(
      items,
      this.listPanelRows(),
      {
        selectedPrefix: (text) => this.theme.fg("accent", text),
        selectedText: (text) => this.theme.fg("accent", text),
        description: (text) => this.theme.fg("muted", text),
        scrollInfo: (text) => this.theme.fg("dim", text),
        noMatch: (text) => this.theme.fg("warning", text),
      },
      {
        truncatePrimary: ({ text, item, maxWidth }) =>
          truncateToWidth(
            `${this.selectedCandidates.has(item.value) ? "[x]" : "[ ]"} ${text}`,
            maxWidth,
            "",
          ),
      },
    );
    this.selector.onSelectionChange = (item) => {
      const candidate = this.candidatesByUrl.get(item.value);
      if (candidate) this.selectCandidate(candidate);
    };
    this.selector.onSelect = () => this.finishSelection();
    this.selector.onCancel = () => this.done(null);
    void this.loadDiff(this.selected);
    void this.loadDetails(this.selected);
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
      if (data === " ") {
        this.toggleSelection();
        return;
      }
      if (this.keybindings.matches(data, confirm)) {
        this.finishSelection();
        return;
      }
      this.selector.handleInput(data);
      this.tui.requestRender();
      return;
    }
    if (this.keybindings.matches(data, confirm)) {
      this.finishSelection();
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
    const bodyRows = panelRows - 1;
    const detailRows = this.detailPanelRows();
    const listRows = bodyRows - detailRows - 1;
    const leftLines = this.selector.render(leftWidth).slice(0, listRows);
    const detailLines = this.renderDetail(leftWidth, detailRows);
    const rightLines = this.renderDiff(rightWidth, bodyRows);
    const lines = [
      truncateToWidth(this.theme.bold("Review pull requests"), width),
    ];

    for (let index = 0; index < bodyRows; index += 1) {
      const isListRow = index < listRows;
      const isDetailSeparator = index === listRows;
      const rawLeftLine = isListRow
        ? leftLines[index]
        : isDetailSeparator
          ? ""
          : detailLines[index - listRows - 1];
      const leftLine = padToWidth(rawLeftLine ?? "", leftWidth);
      const rightLine = padToWidth(rightLines[index] ?? "", rightWidth);
      const separatorColor =
        this.focus === "list" && isListRow ? "borderAccent" : "borderMuted";
      const separator = this.theme.fg(separatorColor, "|");
      const leftPanel =
        isListRow && this.focus === "list"
          ? panelBackground(this.theme, leftLine)
          : leftLine;
      const rightPanel =
        this.focus === "diff"
          ? panelBackground(this.theme, `${separator}${rightLine}`)
          : `${separator}${rightLine}`;
      const line = isDetailSeparator
        ? `${this.theme.fg("borderMuted", "-".repeat(leftWidth))}${rightPanel}`
        : `${leftPanel}${rightPanel}`;
      lines.push(truncateToWidth(line, width));
    }

    lines.push(
      truncateToWidth(
        this.theme.fg(
          "dim",
          `up/down move | tab switch | space toggle | enter start | esc cancel${this.selectedCandidates.size > 0 ? ` | ${this.selectedCandidates.size} selected` : ""}`,
        ),
        width,
      ),
    );
    return lines;
  }

  private finishSelection(): void {
    const selected =
      this.selectedCandidates.size > 0
        ? this.candidates.filter((candidate) =>
            this.selectedCandidates.has(candidate.url),
          )
        : [this.selected];
    this.done(selected);
  }

  private toggleSelection(): void {
    if (this.selectedCandidates.has(this.selected.url))
      this.selectedCandidates.delete(this.selected.url);
    else this.selectedCandidates.add(this.selected.url);
    this.tui.requestRender();
  }

  private selectCandidate(candidate: ReviewCandidate): void {
    if (this.selected.url === candidate.url) return;
    this.selected = candidate;
    this.diffOffset = 0;
    this.error = undefined;
    this.details = undefined;
    this.detailsError = undefined;
    void this.loadDiff(candidate);
    void this.loadDetails(candidate);
  }

  private async loadDetails(candidate: ReviewCandidate): Promise<void> {
    const cached = this.detailsCache.get(candidate.url);
    if (cached !== undefined) {
      this.details = cached;
      this.loadingDetailsUrl = undefined;
      this.detailsError = undefined;
      this.tui.requestRender();
      return;
    }

    const generation = ++this.detailsGeneration;
    this.loadingDetailsUrl = candidate.url;
    this.details = undefined;
    this.detailsError = undefined;
    this.tui.requestRender();
    try {
      const details = await this.loadDetailsFor(candidate);
      this.detailsCache.set(candidate.url, details);
      if (
        generation !== this.detailsGeneration ||
        this.selected.url !== candidate.url
      )
        return;
      this.details = details;
      this.loadingDetailsUrl = undefined;
      this.tui.requestRender();
    } catch (error) {
      if (
        generation !== this.detailsGeneration ||
        this.selected.url !== candidate.url
      )
        return;
      this.loadingDetailsUrl = undefined;
      this.detailsError =
        error instanceof Error ? error.message : String(error);
      this.tui.requestRender();
    }
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

  private renderDetail(width: number, rows: number): string[] {
    const repository = this.details?.repository ?? this.selected.repository;
    const header = repository
      ? `PR Detail | #${this.selected.number} | ${repository}`
      : `PR Detail | #${this.selected.number}`;
    const lines = [this.theme.bold(truncateToWidth(header, width))];
    if (this.loadingDetailsUrl === this.selected.url) {
      lines.push(this.theme.fg("muted", "Loading details..."));
      return lines;
    }
    if (this.detailsError) {
      lines.push(
        this.theme.fg("error", truncateToWidth(this.detailsError, width)),
      );
      return lines;
    }
    const details = this.details;
    if (!details) {
      lines.push(this.theme.fg("muted", "No details available."));
      return lines;
    }

    lines.push(
      truncateToWidth(
        `${details.isDraft ? "[draft] " : ""}${details.title}`,
        width,
      ),
    );
    lines.push(
      truncateToWidth(
        `Author: ${details.author || "unknown"} | Status: ${details.status}`,
        width,
      ),
    );
    lines.push(
      truncateToWidth(
        `Checks: ${details.checkSummary} | Review: ${details.reviewDecision}`,
        width,
      ),
    );
    if (this.showQueuePosition && details.mergeQueuePosition !== undefined)
      lines.push(
        truncateToWidth(
          `Queue: ${details.mergeQueuePosition} (${details.mergeQueueState || "unknown"})`,
          width,
        ),
      );
    else if (details.mergeQueueState)
      lines.push(truncateToWidth(`Queue: ${details.mergeQueueState}`, width));
    lines.push(truncateToWidth(`URL: ${details.url}`, width));
    if (details.queueRemovalReason || details.queueWorkflowUrl)
      lines.push(
        truncateToWidth(
          `Removed: ${details.queueRemovalReason || "unknown"}${details.queueWorkflowUrl ? ` | Workflow: ${details.queueWorkflowUrl}` : ""}`,
          width,
        ),
      );
    return lines.slice(0, rows);
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

  private detailPanelRows(): number {
    const bodyRows = this.visiblePanelRows() - 1;
    return Math.max(0, Math.min(bodyRows - 2, Math.floor(bodyRows / 3)));
  }

  private listPanelRows(): number {
    return this.visiblePanelRows() - 1 - this.detailPanelRows() - 1;
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
