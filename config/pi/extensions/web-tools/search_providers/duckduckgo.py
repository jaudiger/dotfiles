from typing import Any

ROOT = "#links"
CARD = ".result"
TITLE = ".result__a"
SNIPPET = ".result__snippet"


class ParseError(ValueError):
    pass


async def parse(page: Any) -> list[dict[str, str]]:
    root = page.locator(ROOT)
    if await root.count() == 0:
        raise ParseError("expected results root was not found")
    if await root.locator(".result--no-result").count():
        return []
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
