from typing import Any

from .common import parse_result_cards

ROOT = "#links"
CARD = ".result"
TITLE = ".result__a"
SNIPPET = ".result__snippet"


class ParseError(ValueError):
    pass


async def parse(page: Any) -> list[dict[str, str]]:
    root = page.locator(ROOT)
    if await root.locator(".result--no-result").count():
        return []
    try:
        return await parse_result_cards(root, CARD, TITLE, SNIPPET)
    except ValueError as error:
        raise ParseError(str(error)) from error
