# ASCII-only output

Use only ASCII characters in all generated text.

## Banned characters

Never produce any of these Unicode characters:

- Em dash (U+2014), en dash (U+2013)
- Curly/smart quotes (U+2018, U+2019, U+201C, U+201D)
- Horizontal ellipsis (U+2026)
- Unicode arrows (U+2190 through U+2194)
- Bullet (U+2022)
- Non-breaking space (U+00A0)

## Style guidance

Do not use `--` or `->` in prose. Reserve `--` for CLI flags and `->` for code and type signatures. Rephrase with commas, parentheses, or separate sentences.

## Exceptions

Permitted when preserving existing non-ASCII content, in string literals that require Unicode, or in names that naturally contain non-ASCII characters.
