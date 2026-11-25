from typing import Any


async def parse_result_cards(
    root: Any,
    card_selector: str,
    title_selector: str,
    snippet_selector: str,
) -> list[dict[str, str]]:
    if await root.count() == 0:
        raise ValueError("expected results root was not found")
    cards = await root.locator(card_selector).evaluate_all(
        """(cards, selectors) => cards.map(card => {
            const link = card.querySelector(selectors.title);
            const snippet = card.querySelector(selectors.snippet);
            return {title: link ? (link.innerText || '').trim() : '',
                url: link ? link.href : '',
                snippet: snippet ? (snippet.innerText || '').trim() : ''};
        })""",
        {"title": title_selector, "snippet": snippet_selector},
    )
    if not cards or not any(item["title"] and item["url"] for item in cards):
        raise ValueError("result cards were malformed")
    return [
        {
            "title": item["title"],
            "url": item["url"],
            **({"snippet": item["snippet"]} if item["snippet"] else {}),
        }
        for item in cards
        if item["title"] and item["url"]
    ]
