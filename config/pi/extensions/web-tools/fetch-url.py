#!/usr/bin/env python3
import asyncio
import csv
import io
import json
import os
import re
import subprocess
import sys
import tempfile
from dataclasses import dataclass
from email.message import Message
from typing import Any, Literal
from urllib.parse import urldefrag, urlsplit
from xml.parsers import expat

import trafilatura
from browser_fetch import NAVIGATION_TIMEOUT_MS, BrowserTransport
from playwright.async_api import Error as PlaywrightError
from playwright.async_api import TimeoutError as PlaywrightTimeoutError
from pypdf import PdfReader
from pypdf.errors import PyPdfError

OCRMY_PDF = os.environ.get("PI_WEB_TOOLS_OCRMYPDF", "ocrmypdf")
CONTENT_READY_TIMEOUT_MS = 5_000
SETTLE_DELAY_MS = 750
MIN_CANDIDATE_CHARS = 32
MAX_FETCHED_TEXT_BYTES = 2 * 1024 * 1024
HTML_CONTENT_TYPES = {"text/html", "application/xhtml+xml"}
PDF_CONTENT_TYPES = {"application/pdf"}
XML_ENCODING_PATTERN = re.compile(
    rb"^<\?xml\s+[^?]*?\bencoding\s*=\s*(['\"])([A-Za-z][A-Za-z0-9._:-]*)\1",
    re.IGNORECASE,
)
CONTENT_ROOTS_SELECTOR = "article, main, [role='main'], pre"
ContentKind = Literal[
    "html", "pdf", "json", "xml", "csv", "text", "unknown", "generic", "unsupported"
]


@dataclass(frozen=True)
class DocumentMetadata:
    content_type: str
    filename: str
    url: str


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


def classify_content_type(content_type: str) -> ContentKind:
    normalized = media_type(content_type)
    if normalized in HTML_CONTENT_TYPES:
        return "html"
    if normalized in PDF_CONTENT_TYPES:
        return "pdf"
    if normalized in {"application/json", "text/json"} or normalized.endswith("+json"):
        return "json"
    if normalized in {"application/xml", "text/xml"} or normalized.endswith("+xml"):
        return "xml"
    if normalized in {"text/csv", "application/csv"} or normalized.endswith("+csv"):
        return "csv"
    if normalized in {"application/octet-stream", "binary/octet-stream"}:
        return "generic"
    if normalized.startswith("text/") or normalized in {
        "application/ecmascript",
        "application/javascript",
    }:
        return "text"
    return "unsupported" if normalized else "unknown"


def is_pdf_response(response: Any, content_kind: ContentKind) -> bool:
    if content_kind == "pdf":
        return True
    if content_kind in {"html", "json", "xml", "csv", "text"}:
        return False
    if urlsplit(response.url).path.lower().endswith(".pdf"):
        return True
    disposition = Message()
    disposition["Content-Disposition"] = response.headers.get("content-disposition", "")
    filename = disposition.get_filename()
    return bool(filename and os.path.splitext(filename)[1].lower() == ".pdf")


def response_charset(content_type: str) -> str | None:
    match = re.search(r"(?:^|;)\s*charset=([^;]+)", content_type, re.IGNORECASE)
    return match.group(1).strip().strip("\"'") if match else None


def decode_text_body(
    body: bytes,
    content_type: str = "",
    *,
    strict: bool = False,
    sniffing: bool = False,
) -> str:
    if len(body) > MAX_FETCHED_TEXT_BYTES:
        raise ValueError(
            f"fetched content exceeds the {MAX_FETCHED_TEXT_BYTES}-byte limit"
        )

    charset = response_charset(content_type)
    if body.startswith((b"\x00\x00\xfe\xff", b"\xff\xfe\x00\x00")):
        charset = "utf-32"
    elif body.startswith(b"\xef\xbb\xbf"):
        charset = "utf-8-sig"
    elif body.startswith((b"\xff\xfe", b"\xfe\xff")):
        charset = "utf-16"
    elif charset is None:
        declaration = XML_ENCODING_PATTERN.match(body[:1024])
        charset = declaration.group(2).decode("ascii") if declaration else "utf-8"

    try:
        text = body.decode(charset or "utf-8")
    except (LookupError, UnicodeDecodeError) as error:
        if strict:
            raise ValueError(
                "downloaded content has an invalid text encoding"
            ) from error
        text = body.decode("utf-8", errors="replace")

    if sniffing and any(
        (ord(character) < 32 and character not in "\t\n\r")
        or 0x7F <= ord(character) <= 0x9F
        for character in text
    ):
        raise ValueError("downloaded content contains binary data")
    return ensure_text_size(text)


class _PDFExtractor:
    @staticmethod
    def has_header(body: bytes) -> bool:
        return re.match(rb"%PDF-[0-9]\.[0-9]", body) is not None

    @classmethod
    def extract_bytes(cls, body: bytes) -> str:
        if not cls.has_header(body):
            raise ValueError("response does not contain a valid PDF document")

        with tempfile.TemporaryDirectory(prefix="pi-fetch-pdf-") as temp_dir:
            input_path = os.path.join(temp_dir, "input.pdf")
            with open(input_path, "wb") as pdf_file:
                pdf_file.write(body)
            return cls._ocr_and_extract(input_path, temp_dir)

    @classmethod
    def extract_file(cls, path: str) -> str:
        with tempfile.TemporaryDirectory(prefix="pi-fetch-pdf-") as temp_dir:
            return cls._ocr_and_extract(path, temp_dir)

    @classmethod
    def _ocr_and_extract(cls, input_path: str, temp_dir: str) -> str:
        output_path = os.path.join(temp_dir, "ocr.pdf")
        try:
            result = subprocess.run(
                [
                    OCRMY_PDF,
                    "--mode",
                    "redo",
                    "--rotate-pages",
                    "--language",
                    "fra+eng",
                    "--output-type",
                    "pdf",
                    "--optimize",
                    "0",
                    "--jobs",
                    "1",
                    "--quiet",
                    input_path,
                    output_path,
                ],
                capture_output=True,
                text=True,
                check=False,
            )
        except OSError:
            result = None

        extracted = cls._extract_text(
            output_path if result is not None and result.returncode == 0 else input_path
        )
        if not extracted and result is not None and result.returncode == 0:
            extracted = cls._extract_text(input_path)
        if not extracted:
            raise ValueError("PDF contains no extractable text")
        return extracted

    @staticmethod
    def _extract_text(path: str) -> str:
        try:
            with open(path, "rb") as pdf_file:
                reader = PdfReader(pdf_file, strict=False)
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
                    if (
                        text_size + separator_size + section_size
                        > MAX_FETCHED_TEXT_BYTES
                    ):
                        raise ValueError(
                            f"PDF text exceeds the {MAX_FETCHED_TEXT_BYTES}-byte limit"
                        )
                    pages.append(section)
                    text_size += separator_size + section_size
        except PyPdfError as error:
            raise ValueError(f"could not read PDF: {error}") from error
        return "\n\n".join(pages)


class _UnsupportedXmlFeature(ValueError):
    pass


class _DocumentExtractor:
    @classmethod
    def extract_file(
        cls,
        path: str,
        metadata: DocumentMetadata,
        content_kind: ContentKind,
    ) -> str:
        with open(path, "rb") as downloaded_file:
            prefix = downloaded_file.read(1024)
            if content_kind == "pdf" or (
                content_kind in {"unknown", "generic", "unsupported"}
                and _PDFExtractor.has_header(prefix)
            ):
                if not _PDFExtractor.has_header(prefix):
                    raise ValueError(
                        "response declared PDF but did not contain a PDF document"
                    )
                return _PDFExtractor.extract_file(path)
            body = prefix + downloaded_file.read(
                MAX_FETCHED_TEXT_BYTES + 1 - len(prefix)
            )
        return cls.extract_body(
            body,
            metadata,
            content_kind,
            strict=True,
            sniffing=content_kind in {"unknown", "generic", "unsupported"},
        )

    @classmethod
    def extract_body(
        cls,
        body: bytes,
        metadata: DocumentMetadata,
        content_kind: ContentKind,
        *,
        strict: bool = True,
        sniffing: bool = False,
    ) -> str:
        if content_kind == "pdf":
            return _PDFExtractor.extract_bytes(body)
        if content_kind == "unsupported":
            raise ValueError(
                f"unsupported content type: {media_type(metadata.content_type)}"
            )

        filename = metadata.filename or urlsplit(metadata.url).path.rsplit("/", 1)[-1]
        filename_kind = cls.kind_from_filename(filename)
        text = decode_text_body(
            body,
            metadata.content_type,
            strict=strict,
            sniffing=sniffing,
        )
        if content_kind in {"json", "xml", "csv"}:
            cls.validate_structured_text(text, content_kind)
            return text
        if content_kind == "html":
            extracted = _HTMLExtractor.extract_article(text)
            return ensure_text_size(extracted or text)
        if content_kind == "text":
            return text

        detected_kind = cls.detect_text_format(
            text,
            filename_kind if filename_kind in {"json", "xml", "csv"} else None,
        )
        if detected_kind is not None:
            return text
        if filename_kind == "text":
            return text
        if filename_kind == "html":
            extracted = _HTMLExtractor.extract_article(text)
            if extracted:
                return ensure_text_size(extracted)
        raise ValueError(
            "unsupported format: downloaded file is not a supported text file or PDF"
        )

    @staticmethod
    def kind_from_filename(filename: str) -> ContentKind | None:
        extension = os.path.splitext(filename.lower())[1]
        return {
            ".csv": "csv",
            ".json": "json",
            ".xml": "xml",
            ".txt": "text",
            ".html": "html",
            ".htm": "html",
        }.get(extension)

    @classmethod
    def detect_text_format(
        cls,
        text: str,
        preferred: Literal["json", "xml", "csv"] | None = None,
    ) -> Literal["json", "xml", "csv"] | None:
        candidates = ([preferred] if preferred else []) + ["json", "xml", "csv"]
        checked: set[str] = set()
        for kind in candidates:
            if kind is None or kind in checked:
                continue
            checked.add(kind)
            try:
                cls.validate_structured_text(text, kind, sniffing=True)
                return kind
            except _UnsupportedXmlFeature:
                raise
            except ValueError:
                continue
        return None

    @staticmethod
    def validate_structured_text(
        text: str,
        kind: Literal["json", "xml", "csv"],
        *,
        sniffing: bool = False,
    ) -> None:
        if kind == "json":
            try:
                json.loads(text)
            except json.JSONDecodeError as error:
                raise ValueError("JSON content is malformed") from error
            return
        if kind == "xml":
            parser = expat.ParserCreate()

            def reject_doctype(*_args: Any) -> None:
                raise _UnsupportedXmlFeature(
                    "XML DTD and entity declarations are not supported"
                )

            parser.StartDoctypeDeclHandler = reject_doctype
            try:
                parser.Parse(text, True)
            except expat.ExpatError as error:
                raise ValueError("XML content is malformed") from error
            return

        try:
            reader = csv.reader(io.StringIO(text, newline=""), strict=True)
            first_row = next((row for row in reader if row), None)
            if first_row is None or (sniffing and len(first_row) < 2):
                raise ValueError("CSV content is malformed")
            has_second_row = False
            for row in reader:
                if not row:
                    continue
                if len(row) != len(first_row):
                    raise ValueError("CSV content has inconsistent columns")
                has_second_row = True
            if sniffing and not has_second_row:
                raise ValueError("CSV content has no data rows")
        except csv.Error as error:
            raise ValueError("CSV content is malformed") from error


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
        cls, transport: BrowserTransport, content_kind: ContentKind
    ) -> str:
        page = transport.page
        await cls.wait_for_content(page)
        if content_kind == "html":
            html = await transport.capture_html()
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

    async def handle_download(self, transport: BrowserTransport) -> str:
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
            validate_url(download.url)
            response = transport.navigation_response
            content_type = ""
            if (
                response is not None
                and urldefrag(response.url).url == urldefrag(download.url).url
            ):
                ensure_successful_response(response, self.url)
                content_type = response.headers.get("content-type", "")
            metadata = DocumentMetadata(
                content_type=content_type,
                filename=download.suggested_filename,
                url=download.url,
            )
            content_kind = classify_content_type(content_type)
            path = await download.path()
            return await asyncio.to_thread(
                _DocumentExtractor.extract_file,
                str(path),
                metadata,
                content_kind,
            )
        finally:
            try:
                await download.delete()
            except PlaywrightError:
                pass

    async def extract_pdf_response(
        self,
        transport: BrowserTransport,
        response: Any,
        content_kind: ContentKind,
    ) -> str:
        body = await response.body()
        if not body:
            response = await transport.context.request.get(
                response.url, max_redirects=0
            )
            validate_url(response.url)
            if not 200 <= response.status < 300:
                raise ValueError(
                    f"HTTP request failed with status {response.status} for {response.url}"
                )
            content_kind = classify_content_type(
                response.headers.get("content-type", "")
            )
            if not is_pdf_response(response, content_kind):
                raise ValueError("response does not contain a valid PDF document")
            body = await response.body()
        return await asyncio.to_thread(_PDFExtractor.extract_bytes, body)

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
                return await self.handle_download(transport)
            response = transport.navigation_response
            if response is not None:
                validate_url(response.url)
                ensure_successful_response(response, self.url)
                if response.status == 204:
                    return ""
                content_kind = classify_content_type(
                    response.headers.get("content-type", "")
                )
                if is_pdf_response(response, content_kind):
                    return await self.extract_pdf_response(
                        transport, response, content_kind
                    )
            raise

        if response is None:
            response = transport.navigation_response
        validate_url(page.url)
        if response:
            ensure_successful_response(response, self.url)
        if response and response.status == 204:
            return ""

        content_type = response.headers.get("content-type", "") if response else ""
        content_kind = classify_content_type(content_type)
        if response and is_pdf_response(response, content_kind):
            validate_url(response.url)
            return await self.extract_pdf_response(transport, response, content_kind)
        if response and content_kind in {"json", "xml", "csv", "text"}:
            ensure_response_size(response, MAX_FETCHED_TEXT_BYTES)
            metadata = DocumentMetadata(
                content_type=content_type,
                filename="",
                url=response.url,
            )
            body = await response.body()
            return await asyncio.to_thread(
                _DocumentExtractor.extract_body,
                body,
                metadata,
                content_kind,
                strict=content_kind in {"json", "xml", "csv"},
            )

        if content_kind in {"generic", "unsupported"}:
            raise ValueError(f"unsupported content type: {media_type(content_type)}")
        await page.wait_for_load_state(
            "domcontentloaded", timeout=NAVIGATION_TIMEOUT_MS
        )
        validate_url(page.url)
        return await _HTMLExtractor.extract_rendered_page(transport, content_kind)


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
