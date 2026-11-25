from typing import Any

from .common import parse_result_cards

ROOT = "#links"
CARD = ".result"
TITLE = ".result__a"
SNIPPET = ".result__snippet"
EMPTY = ".result--no-result"


class ParseError(ValueError):
    pass


async def parse(page: Any) -> list[dict[str, str]]:
    root = page.locator(ROOT)
    empty = await root.locator(EMPTY).count() > 0
    try:
        return await parse_result_cards(root, CARD, TITLE, SNIPPET)
    except ValueError as error:
        if empty:
            return []
        raise ParseError(str(error)) from error
