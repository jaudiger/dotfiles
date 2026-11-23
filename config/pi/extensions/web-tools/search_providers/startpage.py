from typing import Any

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
    root = page.locator(ROOT)
    if await root.count() == 0:
        raise ParseError("expected results root was not found")
    cards = await root.locator(CARD).evaluate_all(
        """(cards, selectors) => cards.map(card => {
            const link = card.querySelector(selectors.title);
            const snippet = card.querySelector(selectors.snippet);
            return {title: link ? (link.innerText || '').trim() : '',
                url: link ? link.href : '',
                snippet: snippet ? (snippet.innerText || '').trim() : ''};
        })""",
        {"title": TITLE, "snippet": SNIPPET},
    )
    if not cards or not any(item["title"] and item["url"] for item in cards):
        raise ParseError("result cards were malformed")
    return [
        {
            "title": item["title"],
            "url": item["url"],
            **({"snippet": item["snippet"]} if item["snippet"] else {}),
        }
        for item in cards
        if item["title"] and item["url"]
    ][:10]
