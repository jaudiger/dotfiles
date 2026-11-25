from types import TracebackType
from typing import Any, Self

from playwright.async_api import async_playwright

NAVIGATION_TIMEOUT_MS = 30_000
MAX_RENDERED_HTML_BYTES = 8 * 1024 * 1024


class BrowserTransport:
    def __init__(self) -> None:
        self.playwright: Any = None
        self.browser: Any = None
        self.context: Any = None
        self.page: Any = None
        self.navigation_response: Any = None

    async def __aenter__(self) -> Self:
        try:
            self.playwright = await async_playwright().start()
            self.browser = await self.playwright.webkit.launch(headless=True)
            self.context = await self.browser.new_context(
                accept_downloads=True,
                java_script_enabled=True,
                locale="en-US",
                timezone_id="UTC",
                viewport={"width": 1280, "height": 720},
            )
            self.page = await self.context.new_page()
            self.page.set_default_navigation_timeout(NAVIGATION_TIMEOUT_MS)
            self.page.on("response", self._capture_response)
            return self
        except BaseException:
            await self._cleanup()
            raise

    async def _cleanup(self) -> None:
        try:
            if self.context is not None:
                await self.context.close()
        finally:
            try:
                if self.browser is not None:
                    await self.browser.close()
            finally:
                if self.playwright is not None:
                    await self.playwright.stop()

    async def __aexit__(
        self,
        exc_type: type[BaseException] | None,
        exc: BaseException | None,
        traceback: TracebackType | None,
    ) -> None:
        await self._cleanup()

    def _capture_response(self, response: Any) -> None:
        if (
            response.request.is_navigation_request()
            and response.frame == self.page.main_frame
        ):
            self.navigation_response = response

    async def navigate(self, url: str) -> Any:
        self.navigation_response = None
        return await self.page.goto(
            url, timeout=NAVIGATION_TIMEOUT_MS, wait_until="commit"
        )

    async def capture_html(self) -> str:
        html = await self.page.content()
        if len(html.encode("utf-8")) > MAX_RENDERED_HTML_BYTES:
            raise ValueError(
                f"rendered HTML exceeds the {MAX_RENDERED_HTML_BYTES}-byte limit"
            )
        return html
