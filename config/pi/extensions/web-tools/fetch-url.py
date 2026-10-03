#!/usr/bin/env python3
import asyncio
import re
import sys
from typing import Any
from urllib.parse import urlsplit

import trafilatura
from playwright.async_api import TimeoutError as PlaywrightTimeoutError
from playwright.async_api import async_playwright

NAVIGATION_TIMEOUT_MS = 30_000
CONTENT_READY_TIMEOUT_MS = 5_000
SETTLE_DELAY_MS = 750
MIN_CANDIDATE_CHARS = 32
MAX_FETCHED_TEXT_BYTES = 2 * 1024 * 1024
MAX_DOCUMENT_BYTES = 8 * 1024 * 1024
HTML_CONTENT_TYPES = {"text/html", "application/xhtml+xml"}
TEXT_CONTENT_TYPES = {
    "application/ecmascript",
    "application/javascript",
    "application/ld+json",
    "application/json",
    "application/manifest+json",
    "application/rss+xml",
    "application/xml",
    "image/svg+xml",
    "text/css",
    "text/event-stream",
}
CONTENT_ROOTS_SELECTOR = "article, main, [role='main'], pre"


def validate_url(url: str) -> None:
    try:
        parsed = urlsplit(url)
        hostname = parsed.hostname
    except ValueError as error:
        raise ValueError("URL must be an absolute HTTP or HTTPS URL") from error
    if (
        parsed.scheme.lower() not in {"http", "https"}
        or not parsed.netloc
        or not hostname
    ):
        raise ValueError("URL must be an absolute HTTP or HTTPS URL")


def ensure_response_size(response: Any, maximum: int) -> None:
    content_length = response.headers.get("content-length")
    if content_length is None:
        return
    try:
        size = int(content_length)
    except ValueError:
        return
    if size > maximum:
        raise ValueError(f"response exceeds the {maximum}-byte limit")


def ensure_text_size(text: str, maximum: int = MAX_FETCHED_TEXT_BYTES) -> str:
    if len(text.encode("utf-8")) > maximum:
        raise ValueError(f"fetched content exceeds the {maximum}-byte limit")
    return text


def media_type(content_type: str) -> str:
    return content_type.split(";", 1)[0].strip().lower()


def is_html_content(content_type: str) -> bool:
    return media_type(content_type) in HTML_CONTENT_TYPES


def is_text_content(content_type: str) -> bool:
    content_type = media_type(content_type)
    return (
        content_type.startswith("text/")
        or content_type in TEXT_CONTENT_TYPES
        or content_type.endswith(("+json", "+xml"))
    )


def response_charset(content_type: str) -> str:
    match = re.search(r"(?:^|;)\s*charset=([^;]+)", content_type, re.IGNORECASE)
    return match.group(1).strip().strip("\"'") if match else "utf-8"


def decode_response_body(body: bytes, content_type: str) -> str:
    if len(body) > MAX_FETCHED_TEXT_BYTES:
        raise ValueError(
            f"fetched content exceeds the {MAX_FETCHED_TEXT_BYTES}-byte limit"
        )
    charset = response_charset(content_type)
    try:
        text = body.decode(charset).strip()
    except (LookupError, UnicodeDecodeError):
        text = body.decode("utf-8", errors="replace").strip()
    return ensure_text_size(text)


def extract_html(html: str) -> str | None:
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
    if extracted is None:
        return None
    extracted = extracted.strip()
    return extracted or None


def candidate_score(candidate: dict[str, Any]) -> tuple[float, int]:
    text = candidate["text"]
    link_length = candidate["link_length"]
    link_ratio = min(link_length / len(text), 0.8) if text else 1.0
    return (len(text) * (1 - link_ratio), len(text))


def select_semantic_candidate(candidates: list[dict[str, Any]]) -> str | None:
    usable = [
        candidate
        for candidate in candidates
        if len(candidate["text"]) >= MIN_CANDIDATE_CHARS
    ]
    if not usable:
        return None
    return max(usable, key=candidate_score)["text"]


async def wait_for_content(page: Any) -> None:
    try:
        await page.wait_for_function(
            """selector => {
                const roots = Array.from(document.querySelectorAll(selector));
                return roots.length === 0 || roots.some(root => {
                    return (root.innerText || '').trim().length > 0;
                });
            }""",
            arg=CONTENT_ROOTS_SELECTOR,
            timeout=CONTENT_READY_TIMEOUT_MS,
        )
    except PlaywrightTimeoutError:
        pass
    await page.wait_for_timeout(SETTLE_DELAY_MS)


async def semantic_candidates(page: Any) -> list[dict[str, Any]]:
    return await page.locator(CONTENT_ROOTS_SELECTOR).evaluate_all(
        """elements => elements.map(element => {
            const text = (element.innerText || '').trim();
            const linkLength = Array.from(element.querySelectorAll('a'))
                .reduce((length, link) => length + (link.innerText || '').length, 0);
            return { text, link_length: linkLength };
        })"""
    )


async def fetch_url(url: str) -> str:
    validate_url(url)
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
            response = await page.goto(
                url,
                timeout=NAVIGATION_TIMEOUT_MS,
                wait_until="commit",
            )
            validate_url(page.url)
            content_type = response.headers.get("content-type", "") if response else ""
            if response:
                ensure_response_size(response, MAX_DOCUMENT_BYTES)

            if (
                response
                and is_text_content(content_type)
                and not is_html_content(content_type)
            ):
                ensure_response_size(response, MAX_FETCHED_TEXT_BYTES)
                return decode_response_body(await response.body(), content_type)

            await page.wait_for_load_state(
                "domcontentloaded", timeout=NAVIGATION_TIMEOUT_MS
            )
            await wait_for_content(page)
            validate_url(page.url)
            html = await page.content()
            if (
                len(html) > MAX_DOCUMENT_BYTES
                or len(html.encode("utf-8")) > MAX_DOCUMENT_BYTES
            ):
                raise ValueError(
                    f"document exceeds the {MAX_DOCUMENT_BYTES}-byte limit"
                )
            if is_html_content(content_type):
                extracted = extract_html(html)
                if extracted:
                    return ensure_text_size(extracted)

            semantic = select_semantic_candidate(await semantic_candidates(page))
            if semantic:
                return ensure_text_size(semantic)

            return ensure_text_size((await page.locator("body").inner_text()).strip())
        finally:
            await context.close()
            await browser.close()


if __name__ == "__main__":
    if len(sys.argv) != 2:
        raise SystemExit("expected exactly one URL")
    print(asyncio.run(fetch_url(sys.argv[1])), end="")
