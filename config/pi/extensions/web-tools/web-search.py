import asyncio
import json
import sys
from urllib.parse import quote_plus

from browser_fetch import BrowserTransport
from playwright.async_api import Error as PlaywrightError
from playwright.async_api import TimeoutError as PlaywrightTimeoutError
from search_providers import duckduckgo, startpage

CONTENT_READY_TIMEOUT_MS = 5_000
PROVIDERS = [
    {
        "name": "DuckDuckGo",
        "endpoint": "https://html.duckduckgo.com/html/?q=",
        "parser": duckduckgo,
    },
    {
        "name": "Startpage",
        "endpoint": "https://www.startpage.com/sp/search?query=",
        "parser": startpage,
    },
]


async def search(query: str) -> dict[str, object]:
    if not query.strip():
        raise ValueError("query must not be empty")
    errors: list[str] = []
    async with BrowserTransport() as browser:
        for provider in PROVIDERS:
            name = provider["name"]
            parser = provider["parser"]
            try:
                response = await browser.navigate(
                    provider["endpoint"] + quote_plus(query)
                )
                if response is not None and response.status >= 400:
                    raise ValueError(
                        f"HTTP request failed with status {response.status}"
                    )
                try:
                    await (
                        browser.page.locator(parser.ROOT)
                        .locator(parser.TITLE)
                        .first.wait_for(
                            state="attached", timeout=CONTENT_READY_TIMEOUT_MS
                        )
                    )
                except PlaywrightTimeoutError:
                    pass
                results = await parser.parse(browser.page)
                return {"provider": name, "results": results[:10]}
            except (PlaywrightError, ValueError) as error:
                errors.append(f"{name}: {str(error).strip() or type(error).__name__}")
    raise ValueError("all search providers failed: " + "; ".join(errors))


if __name__ == "__main__":
    try:
        if len(sys.argv) != 2:
            raise SystemExit("expected a search query")
        print(json.dumps(asyncio.run(search(sys.argv[1])), ensure_ascii=True), end="")
    except (PlaywrightError, ValueError) as error:
        print(str(error).strip() or type(error).__name__, file=sys.stderr)
        raise SystemExit(1) from None
