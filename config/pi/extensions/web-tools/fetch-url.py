#!/usr/bin/env python3
import asyncio
import re
import sys
from io import BytesIO
from typing import Any
from urllib.parse import urlsplit

import trafilatura
from browser_fetch import (
    MAX_DOCUMENT_BYTES,
    NAVIGATION_TIMEOUT_MS,
    BrowserTransport,
)
from playwright.async_api import Error as PlaywrightError
from playwright.async_api import TimeoutError as PlaywrightTimeoutError
from pypdf import PdfReader
from pypdf.errors import PyPdfError

CONTENT_READY_TIMEOUT_MS = 5_000
SETTLE_DELAY_MS = 750
MIN_CANDIDATE_CHARS = 32
MAX_FETCHED_TEXT_BYTES = 2 * 1024 * 1024
HTML_CONTENT_TYPES = {"text/html", "application/xhtml+xml"}
PDF_CONTENT_TYPES = {"application/pdf"}
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


def ensure_successful_response(response: Any, url: str) -> None:
    if response.status >= 400:
        raise ValueError(f"HTTP request failed with status {response.status} for {url}")


def ensure_text_size(text: str, maximum: int = MAX_FETCHED_TEXT_BYTES) -> str:
    if len(text.encode("utf-8")) > maximum:
        raise ValueError(f"fetched content exceeds the {maximum}-byte limit")
    return text


def media_type(content_type: str) -> str:
    return content_type.split(";", 1)[0].strip().lower()


def is_html_content(content_type: str) -> bool:
    return media_type(content_type) in HTML_CONTENT_TYPES


def is_pdf_content(content_type: str) -> bool:
    return media_type(content_type) in PDF_CONTENT_TYPES


def is_text_content(content_type: str) -> bool:
    content_type = media_type(content_type)
    return (
        content_type.startswith("text/")
        or content_type in TEXT_CONTENT_TYPES
        or content_type.endswith(("+json", "+xml"))
    )


def is_pdf_response(response: Any) -> bool:
    content_type = response.headers.get("content-type", "")
    if is_pdf_content(content_type):
        return True
    if is_html_content(content_type) or is_text_content(content_type):
        return False
    if urlsplit(response.url).path.lower().endswith(".pdf"):
        return True
    return ".pdf" in response.headers.get("content-disposition", "").lower()


def ensure_supported_content_type(content_type: str) -> None:
    normalized = media_type(content_type)
    if (
        normalized
        and not is_html_content(normalized)
        and not is_text_content(normalized)
    ):
        raise ValueError(f"unsupported content type: {normalized}")


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


class _PDFExtractor:
    @staticmethod
    def is_pdf_file(path: str) -> bool:
        with open(path, "rb") as pdf_file:
            return b"%PDF-" in pdf_file.read(1024)

    @classmethod
    def extract_bytes(cls, body: bytes) -> str:
        return cls.extract_stream(BytesIO(body))

    @classmethod
    def extract_file(cls, path: str) -> str:
        with open(path, "rb") as pdf_file:
            return cls.extract_stream(pdf_file)

    @staticmethod
    def extract_stream(stream: Any) -> str:
        if b"%PDF-" not in stream.read(1024):
            raise ValueError("response does not contain a valid PDF document")
        stream.seek(0)

        try:
            reader = PdfReader(stream, strict=False)
            if reader.is_encrypted:
                raise ValueError("encrypted PDFs are not supported")
            pages: list[str] = []
            text_size = 0
            for page_number, page in enumerate(reader.pages, start=1):
                page_text = (page.extract_text() or "").strip()
                if not page_text:
                    continue
                section = f"[Page {page_number}]\n{page_text}"
                section_size = len(section.encode("utf-8"))
                separator_size = 2 if pages else 0
                if text_size + separator_size + section_size > MAX_FETCHED_TEXT_BYTES:
                    raise ValueError(
                        f"PDF text exceeds the {MAX_FETCHED_TEXT_BYTES}-byte limit"
                    )
                pages.append(section)
                text_size += separator_size + section_size
        except PyPdfError as error:
            raise ValueError(f"could not read PDF: {error}") from error

        extracted = "\n\n".join(pages)
        if not extracted:
            raise ValueError("PDF contains no extractable text")
        return extracted


class _HTMLExtractor:
    @staticmethod
    def extract_article(html: str) -> str | None:
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

    @staticmethod
    def candidate_score(candidate: dict[str, Any]) -> tuple[float, int]:
        text = candidate["text"]
        link_length = candidate["link_length"]
        link_ratio = min(link_length / len(text), 0.8) if text else 1.0
        return (len(text) * (1 - link_ratio), len(text))

    @classmethod
    def select_semantic_candidate(cls, candidates: list[dict[str, Any]]) -> str | None:
        usable = [
            candidate
            for candidate in candidates
            if len(candidate["text"]) >= MIN_CANDIDATE_CHARS
        ]
        if not usable:
            return None
        return max(usable, key=cls.candidate_score)["text"]

    @staticmethod
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

    @staticmethod
    async def semantic_candidates(page: Any) -> list[dict[str, Any]]:
        return await page.locator(CONTENT_ROOTS_SELECTOR).evaluate_all(
            """(elements, selectors) => elements.map(element => {
                const text = (element.innerText || '').trim();
                const linkLength = Array.from(element.querySelectorAll(selectors.link))
                    .reduce((length, link) => length + (link.innerText || '').length, 0);
                return { text, link_length: linkLength };
            })""",
            {"link": "a"},
        )

    @classmethod
    async def extract_rendered_page(
        cls, transport: BrowserTransport, content_type: str
    ) -> str:
        page = transport.page
        await cls.wait_for_content(page)
        html = await transport.capture_html()
        if is_html_content(content_type):
            extracted = cls.extract_article(html)
            if extracted:
                return ensure_text_size(extracted)

        semantic = cls.select_semantic_candidate(await cls.semantic_candidates(page))
        if semantic:
            return ensure_text_size(semantic)

        return ensure_text_size((await page.locator("body").inner_text()).strip())


class _BrowserFetcher:
    def __init__(self, url: str) -> None:
        self.url = url
        self.download_event: asyncio.Future[Any] | None = None

    def capture_download(self, download: Any) -> None:
        if self.download_event is not None and not self.download_event.done():
            self.download_event.set_result(download)

    async def handle_download(self) -> str:
        if self.download_event is None:
            raise ValueError("browser download event was not initialized")
        try:
            download = await asyncio.wait_for(
                asyncio.shield(self.download_event),
                timeout=NAVIGATION_TIMEOUT_MS / 1000,
            )
        except TimeoutError as error:
            raise ValueError("browser download was not available") from error

        try:
            path = await download.path()
            is_pdf = await asyncio.to_thread(_PDFExtractor.is_pdf_file, str(path))
            if not is_pdf:
                raise ValueError("unsupported format: downloaded file is not a PDF")
            return await asyncio.to_thread(_PDFExtractor.extract_file, str(path))
        finally:
            try:
                await download.delete()
            except PlaywrightError:
                pass

    async def fetch(self) -> str:
        async with BrowserTransport() as transport:
            self.download_event = asyncio.get_running_loop().create_future()
            transport.page.on("download", self.capture_download)
            return await self.fetch_page(transport)

    async def fetch_page(self, transport: BrowserTransport) -> str:
        page = transport.page
        try:
            response = await transport.navigate(self.url)
        except PlaywrightError as error:
            if "Download is starting" in str(error):
                return await self.handle_download()
            response = transport.navigation_response
            if response is not None:
                validate_url(response.url)
                ensure_successful_response(response, self.url)
                if response.status == 204:
                    return ""
                if is_pdf_response(response):
                    return _PDFExtractor.extract_bytes(await response.body())
            raise

        if response is None:
            response = transport.navigation_response
        validate_url(page.url)
        if response:
            ensure_successful_response(response, self.url)
        if response and response.status == 204:
            return ""

        content_type = response.headers.get("content-type", "") if response else ""
        if response and is_pdf_response(response):
            validate_url(response.url)
            return _PDFExtractor.extract_bytes(await response.body())
        if response:
            ensure_response_size(response, MAX_DOCUMENT_BYTES)

        if (
            response
            and is_text_content(content_type)
            and not is_html_content(content_type)
        ):
            ensure_response_size(response, MAX_FETCHED_TEXT_BYTES)
            return decode_response_body(await response.body(), content_type)

        ensure_supported_content_type(content_type)
        await page.wait_for_load_state(
            "domcontentloaded", timeout=NAVIGATION_TIMEOUT_MS
        )
        validate_url(page.url)
        return await _HTMLExtractor.extract_rendered_page(transport, content_type)


async def fetch_url(url: str) -> str:
    validate_url(url)
    return await _BrowserFetcher(url).fetch()


def error_message(error: PlaywrightError | ValueError) -> str:
    if isinstance(error, PlaywrightError) and "Download is starting" in str(error):
        return "unsupported format: the browser download could not be inspected"
    message = str(error).strip()
    return message or type(error).__name__


if __name__ == "__main__":
    try:
        if len(sys.argv) == 2:
            output = asyncio.run(fetch_url(sys.argv[1]))
        else:
            raise SystemExit("expected a URL")
        print(output, end="")
    except (PlaywrightError, ValueError) as error:
        print(error_message(error), file=sys.stderr)
        raise SystemExit(1) from None
