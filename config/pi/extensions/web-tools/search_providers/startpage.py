from typing import Any

from .common import parse_result_cards

ROOT = ".w-gl"
EMPTY = ".noresults"
CARD = ".result"
TITLE = 'a[data-testid="gl-title-link"]'
SNIPPET = "p.description"


class ParseError(ValueError):
    pass


async def parse(page: Any) -> list[dict[str, str]]:
    if await page.locator(EMPTY).count():
        return []
    try:
        return await parse_result_cards(page.locator(ROOT), CARD, TITLE, SNIPPET)
    except ValueError as error:
        raise ParseError(str(error)) from error
