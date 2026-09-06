#!/usr/bin/env python3
import asyncio
import sys

import trafilatura
from playwright.async_api import async_playwright

NAVIGATION_TIMEOUT_MS = 30_000
SETTLE_DELAY_MS = 1_000


async def fetch_url(url: str) -> str:
    async with async_playwright() as playwright:
        browser = await playwright.webkit.launch(headless=True)
        context = await browser.new_context(
            java_script_enabled=True,
            locale="en-US",
            timezone_id="UTC",
            viewport={"width": 1280, "height": 720},
        )
        page = await context.new_page()
        page.set_default_navigation_timeout(NAVIGATION_TIMEOUT_MS)
        try:
            await page.goto(
                url,
                timeout=NAVIGATION_TIMEOUT_MS,
                wait_until="domcontentloaded",
            )
            await page.wait_for_timeout(SETTLE_DELAY_MS)
            html = await page.content()
            extracted = trafilatura.extract(
                html,
                output_format="markdown",
                fast=False,
                favor_precision=False,
                favor_recall=False,
                include_comments=False,
                include_tables=True,
                include_images=False,
                include_formatting=True,
                include_links=True,
                deduplicate=True,
                with_metadata=False,
                target_language=None,
            )
            if extracted:
                return extracted
            return (await page.locator("body").inner_text()).strip()
        finally:
            await context.close()
            await browser.close()


if __name__ == "__main__":
    if len(sys.argv) != 2:
        raise SystemExit("expected exactly one URL")
    print(asyncio.run(fetch_url(sys.argv[1])), end="")
