# ASCII-only output

MUST emit ASCII-only generated prose. MUST NOT emit em dash (U+2014), en dash (U+2013), curly or smart quotes (U+2018, U+2019, U+201C, U+201D), horizontal ellipsis (U+2026), Unicode arrows (U+2190 through U+2194), bullet (U+2022), or non-breaking space (U+00A0). MUST NOT use `--` or `->` in prose; reserve them for CLI flags, code, and type signatures. Use commas, parentheses, or separate sentences instead. Preserve non-ASCII text only when it already exists in source content, is required by a string literal, or belongs to a name that naturally uses non-ASCII characters.
