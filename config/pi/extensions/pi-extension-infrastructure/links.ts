import {
  getCapabilities,
  hyperlink,
  truncateToWidth,
} from "@earendil-works/pi-tui";

const DEFAULT_URL_LABEL_WIDTH = 72;
const CONTROL_CHARACTERS = /[\u0000-\u0020\u007f-\u009f]/;
const TERMINAL_CONTROLS = /[\u0000-\u001f\u007f-\u009f]/g;

function parseHttpUrl(value: string): URL | undefined {
  if (CONTROL_CHARACTERS.test(value)) return undefined;

  try {
    const url = new URL(value);
    if (
      (url.protocol !== "http:" && url.protocol !== "https:") ||
      url.username ||
      url.password
    )
      return undefined;
    return url;
  } catch {
    return undefined;
  }
}

function compactUrlLabel(url: URL, maxWidth: number): string {
  if (maxWidth <= 0) return "";

  const path = `${url.pathname}${url.search}${url.hash}`;
  const visiblePath = path === "/" ? "" : path;
  const fullLabel = `${url.host}${visiblePath}`;
  if (fullLabel.length <= maxWidth) return fullLabel;
  if (maxWidth <= 3) return ".".repeat(maxWidth);

  const prefix = `${url.host}/...`;
  if (prefix.length >= maxWidth) return truncateToWidth(url.host, maxWidth);

  const suffixWidth = maxWidth - prefix.length;
  return `${prefix}${path.slice(-suffixWidth)}`;
}

export function formatUrlLink(url: string, maxWidth?: number): string {
  const width = Math.max(0, Math.floor(maxWidth ?? DEFAULT_URL_LABEL_WIDTH));
  const parsedUrl = parseHttpUrl(url);

  if (!parsedUrl || !getCapabilities().hyperlinks) {
    const plainUrl = url.replace(TERMINAL_CONTROLS, "");
    return maxWidth === undefined ? plainUrl : truncateToWidth(plainUrl, width);
  }

  const label = compactUrlLabel(parsedUrl, width);
  if (!label) return "";
  return hyperlink(label, parsedUrl.href);
}
